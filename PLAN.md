# Growtrail Quick Logger — Implementation Plan

Source spec: `docs/SPEC.md`. This plan turns that spec into ordered, verifiable work.

---

## 0. Current state (inspected 2026-10-26)

| Item | Finding | Impact |
|---|---|---|
| Repository | Only `README.md` + `.claude/settings.json`. Not a git repo. | Greenfield. Run `git init` first. |
| OS | Ubuntu 24.04.5 LTS, x86_64 | AppImage target. Two Ubuntu 24.04 quirks to handle (see §8). |
| Node / npm | v22.23.4 / 10.9.9 | Fine for Electron + Vite. |
| Browser | Google Chrome 153 at `/usr/bin/google-chrome`. No system Chromium. | Use the installed Chrome via `channel: "chrome"`/CDP. Don't bundle a browser. |
| Playwright cache | `~/.cache/ms-playwright` has Chromium builds (dev only) | Useful for automation tests; not shipped. |
| Claude Code | Playwright MCP plugin enabled | Can be used for the Phase 1 live-UI inspection, with your login. |

### Critical constraint found during inspection

**Chrome 136+ refuses `--remote-debugging-port` on the default profile.** On Chrome 153, Playwright can't attach to your everyday Chrome window and its existing session. This is a security change in Chrome itself, and no flag works around it.

So "use my existing Chrome session" will work like this in practice:

- **Mode A: Dedicated CDP profile (the default).** The app launches *your installed Chrome* with
  `--remote-debugging-port=<port> --remote-debugging-address=127.0.0.1 --user-data-dir=<appData>/chrome-profile`,
  or shows you the exact command to run yourself. You log into Growtrail once in that window. The profile persists, so later runs reuse the session. Playwright attaches with `chromium.connectOverCDP("http://127.0.0.1:<port>")`.
- **Mode B: Attach to an already-running debug Chrome.** If you have already started Chrome with a debugging port and a non-default `--user-data-dir`, the app only connects to it.
- **Mode C: Playwright persistent context (fallback).** `chromium.launchPersistentContext(profileDir, { channel: "chrome", headless: false })`. This needs no CDP port, but the browser closes when the app closes.

The UI states plainly that this profile is separate from your normal Chrome profile, as spec §10 requires ("do not silently switch").

---

## 1. Key technical decisions

| Decision | Choice | Rationale |
|---|---|---|
| Scaffold / build | **electron-vite** (main, preload and renderer builds in one config) + Vite | Standard for Electron + React + TS. Fast HMR. Clean three-way split. |
| UI | React 18 + TypeScript + **Tailwind CSS v4** (`@tailwindcss/vite`) | As specified. |
| Renderer state | `useReducer` + context, or Zustand (one small store) | The app has two screens, so it doesn't need Redux. |
| Validation | **zod** schemas in `src/shared/` | One source of truth. The renderer validates for UX. The main process re-validates every IPC payload. |
| Automation lib | **`playwright-core`**, not `playwright` | No browser download and smaller AppImage. Uses the installed Chrome. |
| Persistence | **JSON files** in `app.getPath("userData")`, written atomically (write `*.tmp`, `fsync`, then `rename`) | Avoids SQLite native modules (`better-sqlite3` needs an Electron rebuild and complicates the Windows build). The data volume is tiny. |
| Secrets | **None stored.** No passwords, cookies or tokens. | Nothing needs `safeStorage`. The session lives in the Chrome profile directory, which the browser owns. Recorded as a deliberate deviation from the stack table. |
| Packaging | **electron-builder**, `linux.target: AppImage` | As specified. A Windows `nsis` target can be added later with no code change. |
| Tests | **Vitest** (unit + React Testing Library) + **Playwright Test** (Electron UI smoke + automation against a local mock of Growtrail) | Tests can't touch production Growtrail, so a static mock that mirrors the inspected DOM lets automation code run in CI. |
| Lint/format | ESLint (typescript-eslint) + Prettier | Standard. |

---

## 2. Project structure

```text
growtrail-quick-logger/
  package.json
  electron.vite.config.ts
  electron-builder.yml
  tsconfig.json / tsconfig.node.json / tsconfig.web.json
  vitest.config.ts
  playwright.config.ts
  build/                       # icons (icon.png 512x512), AppImage assets
  docs/
    selector-inventory.md      # Phase 1 output: verified selectors + unknowns
    browser-setup.md
    troubleshooting.md
  src/
    shared/                    # pure TS, no Node/Electron imports (runs in both sides)
      types.ts                 # TaskEntry, Settings, RunState, IPC contract types
      options.ts               # TASK_TYPES, TIME_LOG_TYPES, STATUSES, BILLABLE (verbatim from spec)
      duration.ts              # parse/format, minutes <-> Growtrail format
      validation.ts            # zod schemas + validateDraft() -> errors/warnings
      dates.ts                 # work-date helpers, Growtrail date formatting
      ipc-contract.ts          # channel names + request/response types
    main/
      index.ts                 # BrowserWindow (contextIsolation, sandbox, no nodeIntegration)
      ipc.ts                   # ipcMain.handle per channel, zod-validated
      store/
        json-store.ts          # atomic read/write helper
        settings.ts
        drafts.ts              # draft per work date
        runs.ts                # run journal (per-entry state, persisted per transition)
      automation/
        browser.ts             # connect/launch modes, connection state machine
        session.ts             # find Growtrail tab, auth detection
        navigation.ts          # go to My Task, wait ready
        selectors.ts           # ALL selectors, centralized (filled from inventory)
        controls.ts            # generic helpers: selectDropdown, selectSearchable, fillDate
        create-task.ts
        task-list.ts           # snapshot + identify new task row
        time-log.ts
        verification.ts        # success detection (toast / network response / list)
        runner.ts              # sequential orchestrator, stop flag, resume
        diagnostics.ts         # inspection mode: DOM/a11y inventory + screenshots
        errors.ts              # typed errors: NeedsUserAction, Uncertain, Fatal
    preload/
      index.ts                 # contextBridge.exposeInMainWorld("api", {...typed fns})
    renderer/
      index.html, main.tsx, App.tsx, index.css
      api.ts                   # typed wrapper around window.api
      pages/HomePage.tsx, SettingsPage.tsx, DiagnosticsPage.tsx
      components/
        TaskTable.tsx, TaskRow.tsx, TaskEditor.tsx (expanded row / overrides)
        DailyTotal.tsx, ConnectionBadge.tsx
        ProgressPanel.tsx, ExecutionLog.tsx, ConfirmRunDialog.tsx
  tests/
    unit/                      # vitest
    mock-growtrail/            # static HTML/JS replica of inspected forms
    automation/                # playwright tests against mock
    e2e/                       # Electron app smoke tests
```

---

## 3. Phased plan

Each phase ends with an exit check. Phases 2 and 3 don't depend on Phase 1 results, so they can run while inspection findings are pending.

### Phase 1: Live UI inspection (blocks Phases 4 and 5)

> **Status 2026-10-26: read-only part done.** See `docs/selector-inventory.md`. Plan changes from it:
> - Durations are stored as integer **hundredths of an hour**, because Growtrail takes decimal hours with ≤ 2 dp for both Estimate and Spent.
> - Work date is limited to **today or yesterday** (time log Date min/max). Create Date is always today.
> - Submits are full-page POSTs, so verification means navigation followed by a list or time sheet check.
> - After clicking `+`, wait for the `/task/time-log-details` AJAX and check that hidden `taskId` equals the target task ID before submitting.
> - The Time Log Type `<option>`s all have `value=""`. Flag this to the user.
> - Project options are read from the Create form's select. They differ per user.
> - **Approved test done (task #67455 + 0.25 h log).** Both submits return 302 to `/task/list`. Task creation shows no popup, so verify through the new top row. Time log shows the SweetAlert "Timelog created successfully.", which must be dismissed; verify through `/task-details`. `timeLogId` is confirmed to be sent empty. **Phase 1 complete.**

**Goal:** turn every item in spec §23 into a verified fact or a documented open question.

Steps:
1. You log into Growtrail in a browser I can drive: either the Playwright MCP browser or a Chrome launched with a debug port and a dedicated profile.
2. Read-only walkthrough. Nothing is submitted.
   - `/task/list`: page structure, how rows are rendered, whether a task ID is visible per row, the `+` button's accessible name and DOM position, sorting and pagination.
   - Click **Create Task**: modal or page, scroll container, every field's role/label/name, `required` markers, how dropdowns are built (native `<select>` or React-Select/MUI/AntD), and how employee search behaves. Collect the Priority and Project option lists and the date input format. Check what Estimate Time accepts (decimal? `1:30`?). Then **close without submitting**.
   - Open the `+` time log form on an existing task: the same inventory, then **close without submitting**.
   - Watch the Network tab while forms load, to learn which XHR endpoints and response shapes the app uses. These can serve as verification signals later. They are only observed, never called.
3. One **approved** end-to-end test entry, only with your explicit go-ahead: create a task and log time, to learn the success indicators (toast text, modal close, list refresh, create-response body containing the new task ID).
4. Write `docs/selector-inventory.md`: field, locator, control type, required, accepted format, verification method, confidence.

**Exit:** every row in §23 is marked *verified* or *open: needs user input*.

**Fallback if live access isn't possible yet:** write the inventory as a template, build `diagnostics.ts` (step 4 of Phase 3) so you can run the inspection from inside the app, and keep going on Phases 2 and 3.

### Phase 2: Desktop shell (independent)

1. `git init`, scaffold electron-vite React-TS, add Tailwind v4, ESLint, Prettier, Vitest.
2. Secure window: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, strict CSP in `index.html`, block `window.open`/navigation away from the app, no `remote`.
3. `src/shared`: types, option lists (verbatim from spec §4–6), `duration.ts`, `validation.ts`.
   - `parseDuration("1.5" | "1:30" | "1h 30m" | "90m") → minutes`. Rejects zero, negatives, NaN and >24h.
   - `formatForGrowtrail(minutes)`. The real format is filled in after Phase 1. Until then it is a placeholder that throws if unverified.
4. Typed IPC: `settings:get/save/reset`, `draft:get/save`, `browser:connect/status`, `run:start/stop/resume`, `run:events` (main → renderer stream), `diagnostics:run`.
5. Persistence: `settings.json`, `drafts/<YYYY-MM-DD>.json`, `runs/<runId>.json` under `userData`.
6. UI:
   - **Home:** work date picker, connection badge + Connect button, task table (add/remove/duplicate row), per-row fields, project override, expandable overrides. Daily total in `Xh Ym` against a 9h target, with an amber warning below target. Run/Stop buttons, progress panel, execution log.
   - **Rules:** editing Spent Time sets Estimate Time automatically. A mismatch from an imported draft shows an error with a **Sync** button. The time log description starts as a copy of the task description and stays independent once edited. New rows take the current defaults, and existing rows are never rewritten.
   - **Settings:** browser (base URL, My Task route, mode, port), employees, task defaults, time log defaults, daily target. Validate before saving. Reset to defaults asks for confirmation. **Delete** is excluded from the Status default options.
7. Draft autosave (debounced) and restore on launch.

**Exit:** `npm run dev` opens the app. Rows, totals, the warning and settings work, and data survives a restart. `npm run typecheck` and `npm test` are green.

### Phase 3: Browser connectivity

1. `browser.ts` connection state machine: `disconnected → connecting → connected | growtrail-not-found | login-required | error`.
2. Mode A: find the Chrome binary per platform (`/usr/bin/google-chrome`, `google-chrome-stable`, `chromium`, and Windows paths later) and spawn it detached with a localhost-only port and a dedicated profile. Poll `http://127.0.0.1:<port>/json/version` with a bounded timeout, then `connectOverCDP`. Check whether the port is already in use first. Never reuse the default profile.
3. `session.ts`: scan `browser.contexts()[*].pages()` for the configured base URL. Open one if none exists. Detect auth through a positive signal (sidebar "My Task" visible) versus a login-form or redirect signal. Both selectors are confirmed in Phase 1.
4. `diagnostics.ts`: on the current page, dump the accessibility snapshot (`page.accessibility`/`ariaSnapshot`) plus visible buttons, inputs, labels and dropdowns as JSON, and take a screenshot. Input values are redacted, and cookies and storage are never read. Exposed through the Diagnostics page.
5. Detect disconnects (`browser.on("disconnected")`) and push status to the renderer.
6. `docs/browser-setup.md`: why a dedicated profile is needed (Chrome 136+ policy), the manual launch command, and the security note about the localhost-only port.

**Exit:** the badge shows Connected or Login required correctly against real Growtrail. Diagnostics produces an inventory.

### Phase 4: Task creation (needs Phase 1)

1. Fill `selectors.ts` from the inventory.
2. `controls.ts` generic, verified helpers:
   - `selectOption(field, label)`: open, pick the **exact** label, read back the displayed value, throw if it doesn't match.
   - `selectEmployee(field, name)`: type, wait for options, require **exactly one** exact match, read back. Zero or several matches raise `NeedsUserAction`.
   - `fillDate(field, isoDate)`: uses the verified Growtrail format.
   - Scroll handling with `locator.scrollIntoViewIfNeeded()` inside the modal.
3. `create-task.ts`: open the form, fill fields in order, skip optional fields with no value, pre-submit read-back check of every field, then click **Add Task**.
4. `verification.ts`: register `page.waitForResponse(createTaskEndpoint)` **before** the click, if Phase 1 confirms such an endpoint. Treat success as HTTP 2xx + confirmation UI (toast or modal close), and capture the task ID from the response or the UI. With no confirmation inside the timeout, the result is **Uncertain**, never retried.

**Exit:** against the local mock, creation passes, plus the failure paths (missing employee, ambiguous match, server error). One approved real test task is created and verified.

### Phase 5: Time logging (needs Phase 1)

1. `task-list.ts`: snapshot the list (IDs or titles plus stable attributes) **before** creation. After creation, find the row by: 1) the captured task ID, 2) exact title + date/project, 3) a single new row versus the snapshot. Zero or several candidates raise `NeedsUserAction`. Row position alone never counts.
2. `time-log.ts`: click the `+` **scoped inside the identified row**, wait for the form, set Time Log Type, Date, Spent Time, Description and Billable (independent of Time Log Type), read back, submit, verify the same way as Phase 4.

**Exit:** an end-to-end pass against the mock, plus one approved real entry.

### Phase 6: Runner, persistence and recovery

1. `runner.ts`: processes rows one at a time. Per-entry states follow spec §13. The run journal is persisted **before** each risky action and after each confirmation:
   - write `creating-task`, click, then write `task-created` with the ID, or `failed`, or `uncertain`
   - write `submitting-time-log`, click, then write `completed`, or `failed`, or `uncertain`
   - A journal that says `creating-task` or `submitting-time-log` on restart means the app crashed mid-submit, so the entry becomes **Uncertain** and is never resubmitted.
2. **Stop** sets a flag that is checked between steps. An in-flight submit finishes and gets verified, and the UI says "stopping after current operation".
3. **Resume** skips `completed`. A `task-created` entry runs only the time log step, with the stored ID. `uncertain` waits for the user to choose *Mark as done* or *Mark as not submitted → retry*, after checking Growtrail. `failed` before creation retries the full row.
4. On browser disconnect: pause, keep the journal, and offer reconnect. The interrupted step becomes Uncertain if it was mid-submit.
5. Run confirmation dialog: "Create N tasks, total Xh Ym on DATE", with the below-9h warning when it applies.

**Exit:** unit tests for every state transition and resume path. A mock test that kills the browser mid-run and then resumes produces no duplicates.

### Phase 7: Test, package, document

1. `npm run typecheck`, `npm test`, `npm run test:e2e` all green.
2. `electron-builder.yml`: `appId`, `productName: Growtrail Quick Logger`, `linux.target: AppImage`, `category: Utility`, icon, and `artifactName: ${productName}-${version}-${arch}.${ext}`. Make sure `playwright-core` is in `dependencies` and isn't stripped by asar (`asarUnpack` if needed).
3. `npm run package:linux`, then launch the AppImage on this machine and run a smoke test (connect, plus one approved entry).
4. Rewrite `README.md` as user docs, and move this spec to `docs/SPEC.md`. Install, browser setup, troubleshooting.

**Exit:** the AppImage file exists, launches on Ubuntu 24.04, and the acceptance checklist (spec §22) has been gone through item by item.

---

## 4. npm scripts

```jsonc
"dev":            "electron-vite dev",
"build":          "electron-vite build",
"typecheck":      "tsc --noEmit -p tsconfig.node.json && tsc --noEmit -p tsconfig.web.json",
"lint":           "eslint .",
"test":           "vitest run",
"test:e2e":       "playwright test",
"package:linux":  "npm run build && electron-builder --linux AppImage"
```

---

## 5. Safety invariants (enforced in code, covered by tests)

1. No submit click unless an explicit `run:start` / `run:resume` came from the user.
2. The journal entry is written *before* every submit click.
3. An `uncertain` entry is never retried automatically.
4. "Delete" can't be a default and needs a typed confirmation to use on a row.
5. Exact-match-or-stop for every dropdown and employee selection, with a read-back after selecting.
6. The `+` button is only located inside the verified task row.
7. No cookies, tokens, passwords or input values in logs, diagnostics or persisted files.
8. The CDP port binds to `127.0.0.1` only.
9. The main process re-validates all renderer input with zod.

---

## 6. Test matrix

| Layer | Tool | Covers |
|---|---|---|
| Unit | Vitest | duration parse/format, totals, estimate=spent sync, defaults applied to new rows, validateDraft, runner state transitions, resume decisions, atomic store |
| Component | Vitest + RTL | add/remove rows, total updates, <9h warning, sync button, settings validation |
| Automation | Playwright Test + `tests/mock-growtrail` | form fill, dropdown exact match, ambiguous employee, row identification, success/failure/timeout → uncertain, crash + resume = no duplicates |
| App smoke | Playwright `_electron` | app launches, settings persist across restart |
| Live | Manual, approved test entries only | real selectors and success indicators |

---

## 7. Open questions for you (needed before Phases 1, 4 and 5)

1. **Live access:** may I inspect Growtrail read-only through the Playwright MCP browser after you log in, or would you rather run the in-app Diagnostics mode and send me the output?
2. **Test data:** is there a test account or sandbox project? If not, which project or task may I use for **one** approved real create-plus-time-log test? It will leave a real entry.
3. **Company policy:** is browser automation of Growtrail allowed in your organisation (spec §23 item 14)?
4. **Browser mode:** is it OK that the app uses a dedicated Chrome profile (Mode A) that you log into once, given that attaching to your normal Chrome profile is blocked by Chrome 136+?

---

## 8. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Growtrail UI changes break selectors | Centralized `selectors.ts`, Diagnostics mode to regenerate the inventory, read-back checks fail loudly instead of submitting wrong data |
| Custom dropdown libraries (React-Select etc.) behave inconsistently | One generic `controls.ts` helper per control *type*, tested against the mock |
| Ubuntu 24.04 AppImage needs `libfuse2t64` | Document `sudo apt install libfuse2t64` in troubleshooting |
| Ubuntu 24.04 AppArmor blocks Electron's Chromium sandbox (unprivileged userns) in AppImages | Test on this machine. Document the options (AppArmor profile, or `--no-sandbox` launcher as a last resort, with its trade-off) |
| No task ID visible in the UI | Use the create XHR response (observed in Phase 1). Otherwise title + attributes + pre/post snapshot diff, and stop if ambiguous |
| Duplicate titles in the list | Never identify by title alone, see Phase 5 |
| Time format unknown (decimal vs h:mm) | `formatForGrowtrail` throws until verified, so the app can't submit in a guessed format |
