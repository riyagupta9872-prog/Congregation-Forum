/* ══ CONFIG.JS – Firebase, AppState, constants, utilities ══ */

// ── FIREBASE INIT ─────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBq6tXjUvBRfIIiLIeDcXC2yFXBWDnlQZ0",
  authDomain: "congregation-forum.firebaseapp.com",
  projectId: "congregation-forum",
  storageBucket: "congregation-forum.firebasestorage.app",
  messagingSenderId: "81725947083",
  appId: "1:81725947083:web:978837bbcc6b0e18246f4e"
};
firebase.initializeApp(firebaseConfig);
const fdb = firebase.firestore();
const TS  = () => firebase.firestore.FieldValue.serverTimestamp();
const INC = (n) => firebase.firestore.FieldValue.increment(n);
fdb.enablePersistence({ synchronizeTabs: true }).catch(err => {
  if (err.code === 'failed-precondition') {
    console.warn('[Congregation Forum] Offline persistence disabled (multiple tabs open)');
  } else if (err.code === 'unimplemented') {
    console.warn('[Congregation Forum] Offline persistence not supported in this browser');
  }
});

// Recover from Firestore SDK internal assertion errors (known bug with multi-tab persistence).
// When this happens the SDK is in an unrecoverable state — a reload is the only fix.
function _isFirestoreAssertionError(msg) {
  return typeof msg === 'string' && msg.includes('INTERNAL ASSERTION FAILED');
}
window.addEventListener('unhandledrejection', e => {
  if (_isFirestoreAssertionError(e.reason?.message)) {
    console.warn('[Congregation Forum] Firestore internal error — reloading to recover');
    setTimeout(() => location.reload(), 600);
  }
});
window.addEventListener('error', e => {
  if (_isFirestoreAssertionError(e.message)) {
    console.warn('[Congregation Forum] Firestore internal error — reloading to recover');
    setTimeout(() => location.reload(), 600);
  }
});

// ── APP STATE ─────────────────────────────────────────
const AppState = {
  currentTab: 'devotees',
  _currentSessionId: null,
  _currentReportSessionId: null,
  currentDevoteeId: null,
  currentEventId: null,
  trendsChart: null,
  callingData: [],
  fromAttendance: false,
  attendanceCandidates: {},
  sessionsCache: {},
  isAttSevaDev: false,
  // Auth
  userRole: null,
  userTeam: null,
  userPosition: null,
  userName: '',
  userId: null,
  profilePic: null,

  // ── MASTER FILTER STATE ─────────────────────────────────
  filters: {
    sessionId:     null,
    team:          '',
    callingBy:     '',
    period:        'session',
    periodAnchor:  null,
  },
};

// ── FILTER ALIASES ─────────────────────────────────────
Object.defineProperty(AppState, 'currentSessionId', {
  get() { return this._currentSessionId; },
  set(v) { this._currentSessionId = v; },
  configurable: true,
});
Object.defineProperty(AppState, 'currentReportSessionId', {
  get() { return this._currentReportSessionId || this._currentSessionId; },
  set(v) { this._currentReportSessionId = v; },
  configurable: true,
});

// ── FILTER DISPATCHER ──────────────────────────────────
function dispatchFilters(patch) {
  const f = AppState.filters;
  if (!f) return;
  const before = { ...f };

  if (patch.sessionId !== undefined) {
    f.sessionId = patch.sessionId || null;
    if (f.sessionId && !f.periodAnchor) f.periodAnchor = f.sessionId;
    const docId = patch._sessionDocId || f.sessionId;
    AppState._currentSessionId       = docId;
    AppState._currentReportSessionId = docId;
    if (patch._sessionDocId && f.sessionId && !AppState.sessionsCache[patch._sessionDocId]) {
      AppState.sessionsCache[patch._sessionDocId] = {
        id: patch._sessionDocId, session_date: f.sessionId, topic: '', is_cancelled: false
      };
    }
  }
  if (patch.team !== undefined) {
    const onDevoteesTab = AppState.currentTab === 'devotees';
    if (AppState.userRole && AppState.userRole !== 'superAdmin' && AppState.userTeam && !onDevoteesTab) {
      f.team = AppState.userTeam;
    } else {
      f.team = patch.team || '';
    }
  }
  if (patch.callingBy !== undefined) { f.callingBy = patch.callingBy || ''; }
  if (patch.period !== undefined)    { f.period = patch.period || 'session'; }
  if (patch.periodAnchor !== undefined) { f.periodAnchor = patch.periodAnchor || null; }

  const changed = ['sessionId','team','callingBy','period','periodAnchor']
    .some(k => before[k] !== f[k]);
  if (!changed) return;

  try {
    window.dispatchEvent(new CustomEvent('filtersChanged', { detail: { ...f, before } }));
  } catch (_) {}
}

function getFilterTeam()      { return AppState.filters?.team      || ''; }
function getFilterCallingBy() { return AppState.filters?.callingBy || ''; }
function getFilterSessionId() { return AppState.filters?.sessionId || null; }

// ── TEAMS LIST (single source of truth) ───────────────
const TEAMS = ['Vasudeva','Sankarshan','Pradyumna','Anirudha','Rohini','Rukmini','Kalindi','Satyabhama','Jamvanti','Lakshmana','Kaushal','Bhadra','Other','Other ICF_Prji','Other ICF_Mtg'];

// ── ATTENDANCE TIME COLOUR ─────────────────────────────
function attTimeStyle(markedAtISO) {
  if (!markedAtISO) return { card: '', badge: '' };
  const d = new Date(markedAtISO);
  const mins = d.getHours() * 60 + d.getMinutes();
  const t1230 = 12 * 60 + 30, t1245 = 12 * 60 + 45, t1300 = 13 * 60;
  if (mins >= t1300) return { card: 'background:#c62828;color:#fff', badge: 'color:#fff' };
  if (mins >= t1245) return { card: 'background:#ef9a9a', badge: '' };
  if (mins >= t1230) return { card: 'background:#ffcdd2', badge: '' };
  return { card: '', badge: '' };
}

// ── DATE UTILITIES ─────────────────────────────────────
function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function getToday() { return localDateStr(new Date()); }
function getCurrentSunday() {
  const now = new Date(), day = now.getDay();
  const sun = new Date(now); sun.setDate(now.getDate() - day);
  return localDateStr(sun);
}
function getUpcomingSunday() {
  const now = new Date(), day = now.getDay();
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  const sun = new Date(now); sun.setDate(now.getDate() + daysUntilSunday);
  return localDateStr(sun);
}
function getCallingWeekDefault() { return getUpcomingSunday(); }
function snapToSunday(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay();
  if (day === 0) return dateStr;
  dt.setDate(dt.getDate() + (7 - day));
  return localDateStr(dt);
}
function initials(name = '') { return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join(''); }
function formatDate(iso) {
  if (!iso || typeof iso !== 'string') return '—';
  const isYmd = /^\d{4}-\d{2}-\d{2}/.test(iso);
  const d = isYmd ? new Date(iso.slice(0, 10) + 'T00:00:00') : new Date(iso);
  if (!d || isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function formatBirthday(dob) {
  if (!dob || typeof dob !== 'string') return '';
  const m = dob.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const mi = parseInt(m[2], 10);
  const di = parseInt(m[3], 10);
  if (!mi || !di || mi < 1 || mi > 12) return '';
  return `${di} ${'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')[mi - 1]}`;
}
function formatAnniversary(dom) {
  if (!dom || typeof dom !== 'string') return '';
  const m = dom.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const mi = parseInt(m[2], 10);
  const di = parseInt(m[3], 10);
  if (!mi || !di || mi < 1 || mi > 12) return '';
  return `${di} ${'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')[mi - 1]}`;
}
function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!d || isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function isBirthdayWeek(dob) {
  if (!dob) return false;
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now); d.setDate(now.getDate() + i);
    if (dob.slice(5) === `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`) return true;
  }
  return false;
}
function isAnniversaryWeek(dom) {
  if (!dom) return false;
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now); d.setDate(now.getDate() + i);
    if (dom.slice(5) === `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`) return true;
  }
  return false;
}

// ── FORMAT HELPERS ─────────────────────────────────────
function shortStatus(s) {
  if (!s || s === 'Expected to be Serious') return 'ETS';
  return s;
}
function statusBadge(s) {
  const label = shortStatus(s);
  if (s === 'Most Serious') return `<span class="badge badge-most-serious">${label}</span>`;
  if (s === 'Serious')      return `<span class="badge badge-serious">${label}</span>`;
  if (s === 'New Devotee')  return `<span class="badge badge-new-devotee">${label}</span>`;
  if (s === 'Inactive')     return `<span class="badge badge-inactive">${label}</span>`;
  return `<span class="badge badge-expected">${label}</span>`;
}
function teamBadge(t) { return t ? `<span class="badge badge-team">${t}</span>` : ''; }
function contactIcons(mobile, opts) {
  const altMobile = (opts && opts.altMobile) || '';
  const devoteeId = (opts && opts.devoteeId) || '';
  const name      = (opts && opts.name)      || '';
  const primary   = (mobile || '').replace(/\D/g, '');
  const alt       = (altMobile || '').replace(/\D/g, '');
  if (!primary && !alt) return '';

  if (!primary || !alt) {
    const c  = primary || alt;
    const wa = c.length === 10 ? '91' + c : c;
    return `<div class="contact-icons">
      <a href="tel:${c}" class="contact-icon icon-phone" onclick="event.stopPropagation()" title="Call"><i class="fas fa-phone-alt"></i></a>
      <a href="https://wa.me/${wa}" target="_blank" rel="noopener" class="contact-icon icon-whatsapp" onclick="event.stopPropagation()" title="WhatsApp"><i class="fab fa-whatsapp"></i></a>
    </div>`;
  }

  const sName = name.replace(/'/g, "\\'");
  return `<div class="contact-icons">
    <button class="contact-icon icon-phone" onclick="event.stopPropagation(); openNumberPicker('${devoteeId}','${sName}','${primary}','${alt}')" title="Call"><i class="fas fa-phone-alt"></i><span class="contact-dual">2</span></button>
    <button class="contact-icon icon-whatsapp" onclick="event.stopPropagation(); openNumberPicker('${devoteeId}','${sName}','${primary}','${alt}')" title="WhatsApp"><i class="fab fa-whatsapp"></i><span class="contact-dual">2</span></button>
  </div>`;
}

function openNumberPicker(devoteeId, name, mobile, altMobile) {
  const c = document.getElementById('np-content');
  if (!c) return;
  document.getElementById('np-devotee-id').value = devoteeId || '';
  document.getElementById('np-name').textContent = name || 'Devotee';

  function rowHtml(num, isPrimary) {
    if (!num) return '';
    const wa = num.length === 10 ? '91' + num : num;
    const tag = isPrimary
      ? '<span class="np-tag np-primary"><i class="fas fa-star"></i> Primary</span>'
      : '<span class="np-tag np-alt">Alternate</span>';
    const promote = isPrimary
      ? ''
      : `<button class="btn btn-secondary np-promote" onclick="makePrimaryNumber()"><i class="fas fa-star"></i> Make Primary</button>`;
    return `<div class="np-row">
      <div class="np-head">${tag} <strong class="np-num">${num}</strong></div>
      <div class="np-actions">
        <a href="tel:${num}" class="btn btn-primary np-call"><i class="fas fa-phone-alt"></i> Call</a>
        <a href="https://wa.me/${wa}" target="_blank" rel="noopener" class="btn np-wa"><i class="fab fa-whatsapp"></i> WhatsApp</a>
        ${promote}
      </div>
    </div>`;
  }
  c.innerHTML = rowHtml(mobile, true) + rowHtml(altMobile, false);
  openModal('number-picker-modal');
}

async function makePrimaryNumber() {
  const id = document.getElementById('np-devotee-id').value;
  if (!id) return;
  try {
    const d = await DB.getDevotee(id);
    const oldPrimary = d.mobile;
    const oldAlt     = d.mobile_alt;
    await DB.updateDevotee(id, {
      ...d,
      mobile:     oldAlt || '',
      mobile_alt: oldPrimary || '',
    });
    DevoteeCache.bust();
    closeModal('number-picker-modal');
    showToast('Primary number updated!', 'success');
    if (typeof loadDevotees === 'function'        && AppState.currentTab === 'devotees')     loadDevotees();
    if (typeof loadCallingStatus === 'function'   && AppState.currentTab === 'calling')      loadCallingStatus();
    if (typeof loadCallingMgmtTab === 'function'  && AppState.currentTab === 'calling-mgmt') loadCallingMgmtTab();
    if (typeof loadCareData === 'function'        && AppState.currentTab === 'care')         loadCareData();
  } catch (e) {
    showToast('Failed: ' + (e.message || 'Error'), 'error');
  }
}

// ── UI HELPERS ─────────────────────────────────────────
let _toastTimer;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast' + (type ? ' ' + type : '');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.add('hidden'), 3000);
}
function debounce(fn, ms) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
let _overlayHistoryPushed = false;
function _ensureOverlayHistory() {
  if (!_overlayHistoryPushed) {
    try { history.pushState({ overlay: true }, '', location.href); } catch (_) {}
    _overlayHistoryPushed = true;
  }
}

function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('hidden');
  _ensureOverlayHistory();
}
function closeModal(id) {
  document.getElementById(id)?.classList.add('hidden');
}
function openImportModal() { openModal('import-modal'); }

window.addEventListener('popstate', () => {
  let closedAny = false;
  document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m => {
    m.classList.add('hidden'); closedAny = true;
  });
  const sb = document.getElementById('app-sidebar');
  if (sb?.classList.contains('open')) {
    sb.classList.remove('open');
    document.getElementById('sidebar-overlay')?.classList.add('hidden');
    closedAny = true;
  }
  if (typeof _cmSelectMode !== 'undefined' && _cmSelectMode) {
    _exitCMSelectMode?.(); closedAny = true;
  }
  _overlayHistoryPushed = false;
});

// ── DEVOTEE CACHE (90-second TTL) ────────────────────
const DevoteeCache = {
  raw: [], stamp: 0, TTL: 90000,
  async refresh() {
    const snap = await fdb.collection('devotees').where('isActive', '==', true).get();
    this.raw = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    this.raw.sort((a, b) => a.name.localeCompare(b.name));
    this.stamp = Date.now();
    return this.raw;
  },
  async all(force = false) {
    if (force || Date.now() - this.stamp > this.TTL) return this.refresh();
    return this.raw;
  },
  bust() { this.stamp = 0; }
};
