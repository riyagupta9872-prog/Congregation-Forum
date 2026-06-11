# Congregation-Forum vs Sakhi-Sang-Attendence — Diff Reference

## Why this file exists

`Congregation-Forum/` was forked from `../Sakhi-Sang-Attendence/`. Both apps share
~95% of their code and get bugfixes/features independently. **When the user copies
updated files from Sakhi-Sang-Attendence into Congregation-Forum again, those pasted
files will be missing everything below** — use this file + `git diff HEAD -- <file>`
(HEAD = last known-good Congregation-Forum state) to find and re-apply the gaps.

### Standard re-sync procedure
1. After the paste, run `git status` / `git diff HEAD --stat` to see which files changed.
2. For each changed file, run `git diff HEAD -- <file>` and read the WHOLE diff.
3. Classify the diff:
   - **Pure Congregation-specific stuff missing** (dept/branding/fields, matches a
     section below) and **nothing new/useful from Sakhi-Sang** → `git checkout HEAD -- <file>`
     is the fast path (wholesale-restore the Congregation version).
   - **Mix of Congregation-specific stuff + genuine new Sakhi-Sang improvements** →
     `git checkout HEAD -- <file>` first, then re-apply the genuine improvements as
     targeted Edits (see "Known cross-pollinated additions" below for examples).
   - **firestore.rules / sw.js** → NEVER blind-checkout. Merge manually (see their
     own sections below) — these files evolve independently and Sakhi-Sang's may be
     newer/better than Congregation's HEAD.
4. After all files converge, bump `sw.js` CACHE version (`congregation-forum-vNN`,
   increment N).
5. Final check: `git diff HEAD --stat` — every file should be empty or have only an
   intentional, documented residual.

---

## 1. Branding (search & replace pattern)

| Sakhi-Sang | Congregation-Forum |
|---|---|
| "Sakhi Sang" / "Sakhi Sang – Devotee Management" | "Congregation Forum" / "Congregation Forum – Devotee Management" |
| `manifest.json` name/short_name/description | "Congregation Forum" / "Cong Forum" / "...for Congregation Forum" |
| AI chat system prompt in `js/ui-ai-chat.js` (`_buildPrompt`) | `"You are an AI assistant for "Congregation Forum"...` |
| "Gopi Dress" (label text) | "Vaishnav Dress" — **NOT** "Dhoti Kurta" (user explicitly rejected that) |

Firestore field/key for attire stays `gopi_dress`/`gopiDress` → `vaishnav_dress`/`vaishnavDress`
(both the field id `f-gopi` in the form AND the snake_case Firestore key are renamed to
`vaishnav_dress`/`vaishnavDress` in Congregation — see js/db.js section).

`firebaseConfig` in `js/config.js` — Congregation has its **own Firebase project**.
Never overwrite with Sakhi-Sang's keys.

---

## 2. Departments (the core new concept)

Congregation groups all 15 teams into 2 departments, single source of truth in
`js/config.js`:

```js
const DEPARTMENTS = {
  ICF_Prji: ['Vasudeva','Sankarshan','Pradyumna','Anirudha','Panchaal','Other ICF_Prji'],
  ICF_Mtg:  ['Rohini','Rukmini','Kalindi','Satyabhama','Jamvanti','Lakshmana','Kaushal','Bhadra','Panchaali','Other ICF_Mtg'],
};
const TEAMS = Object.values(DEPARTMENTS).flat();

function getDeptForTeam(team)    // team -> 'ICF_Prji' | 'ICF_Mtg' | ''
function getTeamsForDept(dept)   // dept -> string[] of team names
function getDeptForGender(gender) // 'Male'->ICF_Prji, 'Female'->ICF_Mtg, else ''
function matchesDept(d, dept)    // devotee {teamName, department, gender} matches dept?
function sortTeamsByDept(teams)  // sorts a team-name array dept-grouped (ICF_Prji first)
function deptGroupHeaderHTML(colspan, deptName) // <tr> dept section header for tables
```

Sakhi-Sang has **no** `DEPARTMENTS`/dept helpers and a flat 10-team `TEAMS` list with
different team names (incl. "Vishakha"). **Do not let a Sakhi-Sang `js/config.js`
paste overwrite this block.**

`AppState`:
- `userDept` — set at login for `deptAdmin` (from `users/{uid}.department`, or derived
  from `userTeam` via `getDeptForTeam` if missing)
- `filters.dept` — master filter bar dept selection (`''` = All)

---

## 3. New devotee fields

Added to the devotee form (5-tab modal in `js/ui-devotees.js` / `index.html`) and
`js/db.js` toCamel/toSnake:

| UI field id | camelCase | snake_case (Firestore) | Notes |
|---|---|---|---|
| `f-gender` | `gender` | `gender` | Male / Female / Other. `onchange="_onGenderChange(this.value)"` |
| `f-anniversary` | `marriageAnniversary` | `marriage_anniversary` | date input, after `f-dob` |
| `f-dept` | `department` | `department` | `onchange="_onDeptChange(this.value)"`, before `f-team` |
| `f-team` | `teamName` | `team_name` | now uses `<optgroup label="ICF_Prji">`/`<optgroup label="ICF_Mtg">`, `onchange="_onTeamChange(this.value)"` |
| `f-gopi` | `vaishnavDress` | `vaishnav_dress` | label "Vaishnav Dress" (was "Gopi Dress" / `gopiDress` / `gopi_dress`) |

`js/ui-devotees.js` handlers (NOT in Sakhi-Sang):
- `_onGenderChange(val)` — auto-fills `f-dept` from gender if dept not yet set
- `_onTeamChange(val)` — auto-fills `f-dept` from the selected team
- `_onDeptChange(val, keepTeam)` — shows/hides `f-team` optgroups by dept; resets team
  if it no longer matches the dept (unless `keepTeam`)
- `getFormPayload()` includes `gender`, `marriage_anniversary`, `department`
  (computed as `f-dept` value, falling back to `getDeptForTeam`/`getDeptForGender`)
- `saveDevotee()` requires Name + Mobile + **Gender** + **Department** + Reference By
  (Sakhi-Sang only requires Name + Mobile + Reference By)
- `_calcProfileCompletion()` includes `d.gender`
- `clearDevoteeForm()` resets `f-gender`/`f-anniversary`/`f-dept` and calls `_onDeptChange('')`
- `populateEditForm()` populates all of the above + sets `f-gopi` from `vaishnav_dress`
- `openProfileModal()` shows Gender / Marriage Anniversary / Department fields, and
  "Vaishnav Dress" (not "Gopi Dress") in the attire section
- `openHistoryModal()` field labels map includes `vaishnav_dress:'Vaishnav Dress'`,
  `gender:'Gender'`, `marriage_anniversary:'Marriage Anniversary'`

Selects that need ICF_Prji/ICF_Mtg `<optgroup>`s instead of Sakhi-Sang's flat list (in
`index.html`): `f-team`, `rename-team-from`, `edit-profile-team`, `mgmt-new-team`,
`bulk-team`, `ua-team`, signup-team.

---

## 4. New role: `deptAdmin`

Role hierarchy: `superAdmin > deptAdmin > teamAdmin > serviceDevotee` (deptAdmin sits
between superAdmin and teamAdmin, scoped to one department instead of one team).

`js/config.js` permission helpers (Sakhi-Sang doesn't have `isDeptAdmin`):
```js
function isDeptAdmin()        { return AppState.userRole === 'deptAdmin'; }
function isAdminOrCoord()      { return isSuperAdmin() || isDeptAdmin() || isCoordinator(); }
function canCrossTeamCalling() { return isSuperAdmin() || isDeptAdmin() || !!AppState.canAllTeamCalling || !!AppState.canManageAllTeams; }
function canCrossTeamReports() { return isSuperAdmin() || isDeptAdmin() || !!AppState.canAllTeamReports || !!AppState.canManageAllTeams; }
function canCrossTeamManage()  { return isSuperAdmin() || !!AppState.canManageAllTeams; } // deptAdmin NOT included
```

`js/ui-core.js` areas that need `deptAdmin` handling (all in `git checkout HEAD --`
territory if missing):
- `applyRoleUI()` — role pill text + tab-access map includes `deptAdmin`
- `renderSignupRequests()` — team `<select>` built from `DEPARTMENTS` optgroups
- `openEditProfile` / `saveEditProfile` / `_applySidebarInfo` — show/edit
  `edit-profile-dept` field; `AppState.userDept` updates
- `renderUserMgmtList()` / `_umRowHtml()` — group by deptAdmin section, show
  department tag (`u.department`)
- `openUserAction` / `_uaRefreshSummary` / `doSaveUserAction` — handle `ua-dept`
  select, `deptAdmin` option in `ua-role`
- `runDeptBackfill` (window function) — calls `DB.backfillDepartmentOnce()`

---

## 5. Master Filter Bar — Dept chip

Third filter chip (Session / Team / **Dept** / Calling By order may vary — Dept sits
before Team). In `index.html`:
```html
<div class="fr-chip" id="fr-chip-dept" data-active="false" onclick="_frToggle(event,'dept')">
  ...
  <button class="fr-chip-clear" id="fr-dept-clear" onclick="_frClearDept(event)">...</button>
</div>
<div class="fr-dropdown hidden" id="fr-dropdown-dept">...</div>
```

`js/ui-core.js` functions (none exist in Sakhi-Sang):
- `_mfbReloadDeptOptions()`, `_frPickDept(value)`, `_frClearDept(e)`
- `_mfbReloadTeamOptions()` — dept-aware (filters team list by selected dept)
- `_mfbUpdateCaption()`, `_frRefreshChips()`, `_frClearAll()`, `_frRefreshActiveItems()`,
  `_mfbOnFiltersChanged()` — all dept-aware versions
- `getFilterDept()` — reads `AppState.filters.dept`
- `dispatchFilters()` validates `dept` same as `team`/`callingBy`

When `deptAdmin` logs in, the dept chip is locked to `AppState.userDept` (see
`isDeptAdmin() && AppState.userDept` checks around ui-core.js:1642 and :1962).

`css/style.css`:
- `.fr-dropdown-group-header` class (dept group header inside dropdown menus)
- `.ua` modal sized larger (`max-width: 820px; min-height: 560px`) and
  `.ua__body { flex: 1 1 auto; min-height: 320px; }` and
  `#user-action-modal .modal-box { max-height: 96dvh; }` to fit the extra `ua-dept` field

---

## 6. Backfill Department migration

`js/db.js`: `DB.backfillDepartmentOnce()` — one-time migration, guarded by
`settings/migrations.deptBackfill_v1`, batches 400 docs, sets
`department = getDeptForTeam(teamName) || getDeptForGender(gender) || null` for any
active devotee missing `department`.

`index.html`: "Backfill Department on Existing Devotees" card in `#clear-data-modal`
(placed BEFORE "Clear Data for a Team on a Date" card; styled as non-destructive
`btn-primary`, not a danger button).

`js/ui-core.js`: `window.runDeptBackfill` — calls the migration, toasts progress,
then `DevoteeCache.bust()`.

---

## 7. Dept-grouped "Subtotal" rows / dept filtering in reports

These are the parts most likely to silently regress on a naive paste — they're scattered
across 3 files and each spot needs the dept filter AND/OR dept-group-header logic:

### `js/ui-home.js` — `renderHomeLeaderboard()`
- `renderKey` includes `_lbDept` (`getFilterDept()`)
- `scopedDevotees` filtered by `getTeamsForDept(_lbDept)` when a dept is selected
- When NO dept filter: groups `sorted` teams by `getDeptForTeam`, inserts
  `deptGroupHeaderHTML(_lbSpan, dept)` before each dept's rows, and a styled
  **"Subtotal"** row (`_lbSubtotalRow`) after each dept's teams (light-blue row,
  per-session present counts + avg for that dept only)
- Total/footer row only counts devotees whose team is in `sorted` (`_sortedSet`)
- Sticky `<thead>` (`position:sticky;top:0`), styled `<tfoot>` (`#1a3a5c` background)

### `js/ui-calling.js`
- `filterCallingList()` — when no team selected but a dept is, restricts to
  `matchesDept(d, dept)`
- `_loadCallingSummary(week, el)` — filters `teams` by `getTeamsForDept(dept)`,
  sorts via `sortTeamsByDept`, inserts `deptGroupHeaderHTML(6, dept)` row per dept group
- `_loadAccuracyReport(week, el)` — same pattern, `deptGroupHeaderHTML(4, dept)`
- `loadLateReports()` — `teamRows` filtered by dept; `_lrRowHtml` extracted as a
  closure so rows can be grouped under `deptGroupHeaderHTML(_lrSpan, dept)` per dept
  (only when no dept filter active)
- `loadCallingHistory()` — cache key includes `deptFilter`; passes `deptFilter` as 3rd
  arg to `DB.getCallingHistoryGrid(teamFilter, callerFilter, deptFilter)`
- `_tcRenderTeamGrid()` (Team Calling) — `teamOrder` filtered by `getTeamsForDept(dept)`
- `loadSaidComingTab()` / `loadNotComingPresentTab()` — filter list/surprisePresent by
  `matchesDept`
- `doSubmitCallingWeek()` calls `_tcBustCache()` after `_bustCSCache()`
- `filtersChanged` listener also calls `loadCallingHistory()` when
  `AppState._callingSubTab === 'history'`

### `js/ui-analytics.js`
- `_dashRender()` — `teamsToShow` = `getTeamsForDept(filterDept)` when no team filter;
  team table rows grouped by dept with `deptGroupHeaderHTML(6, dept)` (only when
  neither team nor dept filter active)
- `loadTeamLeaderboard()` — `lbKey` includes dept; `ranked` filtered by
  `getTeamsForDept` (if dept selected) OR grouped-and-sorted-by-dept (if not), with
  `deptGroupHeaderHTML(7, dept)` rows; rank numbering (`rankNum`) resets per dept group
- `_careRender()` (Care tab) — `tf()` filters by `matchesDept` when dept selected (in
  addition to team filter)
- `exportMgmtFY()` — inserts a dept section header row (`_thisDept`) before each dept's
  team-subtotal rows in the FY export sheet
- `loadLateComersReport()` — `filtered` records by `matchesDept` when dept selected
- `exportEventDevotees()` — column label "Vaishnav Dress" / `full.vaishnavDress` (not
  "Gopi Dress"/`gopiDress`)

### `js/db.js` (supporting these)
- `getDevotees(filters)` — `if (filters.dept) list = list.filter(d => matchesDept(d, filters.dept))`
- `getSessionStats(sessionId, filters = {})` — `scopedIds` computed from
  `filters.team`/`filters.dept` via `matchesDept`, used to scope `confirmed`/`present`/
  `totalPresent`/`newDevotees`
- `getAttendanceCandidates` — scopes by `AppState.filters.team` else `AppState.filters.dept`
- `getCallingStatus` — non-superAdmin sees only their own `calling_by` rows
- `getTeamCallingStatus` — role-based scope (teamAdmin→own team, deptAdmin→own dept via
  `matchesDept`) PLUS master filter bar team/dept (dept only honored for superAdmin)
- `getCallingHistoryGrid(teamFilter, callerFilter, deptFilter)` — 3rd param filters
  `devotees` by `matchesDept` before the team filter

### `js/excel.js`
- Sample devotee data uses "Radha Kumari" / "Arjun Das" (not "Sita Devi")
- `IMPORT_FIELDS` includes `gender`, `marriageAnniversary`, `department` (computed via
  `getDeptForGender(g) || getDeptForTeam(t) || null`)
- `vaishnavDress` import column (aliases include "Vaishnav Dress")
- `_MONTHLY_TEAM_PALETTES` keyed to ICF team names
- Export filenames `congregation_forum_*` (not `sakhi_sang_*`)
- Dept summary sheets / dept-grouped attendance sheet sections
- "Vaishnav Dress" ↔ "Gopi Dress" column labels everywhere

---

## 8. firestore.rules — manual merge required

Congregation's `firestore.rules` is based on the **current/comprehensive** Sakhi-Sang
ruleset (`isAuth()`, `self()`, `isSuperAdmin()`, `isCoordinator()`, `canManageAllTeams()`,
`canAllTeamCalling()`, `canAllTeamReports()`, `isAttSeva()`, `canWriteAcrossTeams()`,
includes `bookDistributions`/`services`/`registrations`/`donations`/`callingWeekHistory`),
**plus** these Congregation-only additions on top:

```js
function isDeptAdmin()        { return isAuth() && self().role == 'deptAdmin'; }
function isCoordinator()      { return isAuth() && (self().role == 'teamAdmin' || self().role == 'deptAdmin'); }
function canAllTeamCalling()  { return isAuth() && (self().canAllTeamCalling == true || self().canManageAllTeams == true || isDeptAdmin()); }
function canAllTeamReports()  { return isAuth() && (self().canAllTeamReports == true || self().canManageAllTeams == true || isDeptAdmin()); }

function deptOfTeam(team) {
  return team in ['Vasudeva','Sankarshan','Pradyumna','Anirudha','Panchaal','Other ICF_Prji'] ? 'ICF_Prji'
       : team in ['Rohini','Rukmini','Kalindi','Satyabhama','Jamvanti','Lakshmana','Kaushal','Bhadra','Panchaali','Other ICF_Mtg'] ? 'ICF_Mtg'
       : '';
}
function myDept() { return self().get('department', ''); }
```

And `devotees/{id}` `allow create` is scoped: teamAdmin → own `teamName`; deptAdmin →
`deptOfTeam(requested teamName) == myDept()`; both also allow `teamName == null`.

**HEAD's old firestore.rules (pre-rewrite, `isAuthed()`/`me()`/`myRole()`/`canManageAll()`
naming) is OBSOLETE — never restore that version.** If a future Sakhi-Sang
firestore.rules paste brings in NEW collections/rules, add them to Congregation's rules
and re-apply the `deptAdmin` block above on top.

---

## 9. sw.js

- CACHE name prefix is `congregation-forum-vNN` (Sakhi-Sang uses `sakhi-sang-vNNN`).
- Bump `NN` by 1 every time you finish a re-sync, regardless of which files changed.
- The `SHELL` array and fetch-handler logic should otherwise match Sakhi-Sang's —
  diff and copy over any new entries/strategy changes, just keep the CACHE name.

---

## 10. Known cross-pollinated additions (apply to BOTH apps)

Some features get added to Sakhi-Sang first and should ALSO land in Congregation
(these are NOT dept-related — don't lose them during a `git checkout HEAD --`):

- **"Level 3 — Naveena (Senior)" interaction level** — appears in 3 places, all must
  stay in sync:
  - `index.html` `#li-level` select: `<option value="3">Level 3 — Naveena (Senior)</option>`
  - `js/ui-analytics.js` `INTERACTION_LEVELS[3]`: `{ name: 'Naveena (Senior)', abbr: 'Senior (L3)', color: '#0f766e', bg: '#f0fdfa' }`
  - `js/ui-attendance.js` `_CP_LEVELS[3]`: `{ label: 'Naveena (Senior)', abbr: 'L3 · Senior', color: '#0f766e', bg: '#f0fdfa' }`
- **`doSignup()` duplicate-request guard** (`js/ui-core.js`) — before "Record the
  request" comment, check `signupRequests/{uid}` for an existing `pending` doc and
  re-show the pending screen instead of creating a duplicate.
- **`doSignup()` friendlier `auth/email-already-in-use` message** (`js/ui-core.js`
  catch block) — replace the terse "Email already registered" with the longer
  "This email is already registered. If your account is awaiting approval..." message.
- `sc-attendance-date` auto-fill of `sc-calling-date` to the preceding Saturday
  (`index.html`, with hint text "(calling date auto-fills to Saturday)").

When you find one of these missing in Congregation after a paste, it's a genuine
improvement to re-apply (not a dept regression) — checkout HEAD, then re-add it.
