# Growtrail Quick Logger
## Product Requirements & Implementation Specification

**Project type:** Cross-platform-ready desktop automation tool  
**Initial target:** Ubuntu Linux  
**Distribution format:** AppImage  
**Automation:** Playwright + TypeScript  
**Desktop framework:** Electron  
**UI:** React + TypeScript  
**Primary purpose:** Automate creating multiple tasks and logging time against each task in Growtrail.

---

## 1. Project Overview

Build a desktop application named **Growtrail Quick Logger** that simplifies the repetitive process of creating tasks and logging time in the Growtrail web application.

The application will automate the existing manual workflow:

1. Open Growtrail.
2. Navigate to My Task.
3. Create a new task for each work activity.
4. Fill the task creation form.
5. Submit the task.
6. Locate the newly created task.
7. Click its `+` action to open the time log form.
8. Fill the time log form.
9. Submit the time log.
10. Verify that the entry was successfully saved.
11. Repeat for the remaining activities.

The application must provide a simple desktop interface where the user can enter several activities in advance and execute the entire workflow with one action.

### Important product decisions

- No AI or LLM integration.
- No external AI API.
- No dependency on a Growtrail API.
- Use browser automation with Playwright.
- Use the user's own authenticated Growtrail session.
- Create a new Growtrail task for every activity.
- Log time against each newly created task.
- Estimate Time must match Spent Time.
- The daily target is 9 hours.
- Show a warning if the total is below 9 hours, but allow the user to proceed.
- Use an in-app Settings screen for reusable defaults.
- Package the initial release as an Ubuntu AppImage.
- Keep the architecture maintainable for a future Windows build.

---

## 2. Technology Stack

Use the following stack unless a verified technical limitation requires a change.

| Component | Technology |
|---|---|
| Desktop framework | Electron |
| Frontend | React |
| Language | TypeScript |
| UI styling | Tailwind CSS |
| Browser automation | Playwright |
| Browser connection | Chrome DevTools Protocol (CDP), where supported |
| Local settings | Electron safe storage + JSON configuration |
| Task draft persistence | Local JSON or SQLite |
| Build tooling | Vite |
| Desktop packaging | electron-builder |
| Ubuntu distribution | AppImage |
| Testing | Vitest + Playwright tests |

### Why Electron?

Electron is suitable for this project because it provides a mature desktop packaging ecosystem and straightforward distribution through AppImage.

Playwright must run in the Node.js main process or a dedicated local automation service, never directly inside the React renderer.

The renderer must not receive unrestricted Node.js access.

### Proposed architecture

```text
React Desktop UI
       |
       | IPC through a typed, restricted API
       v
Electron Main Process
       |
       +---- Settings and draft persistence
       |
       +---- Automation Controller
                    |
                    v
              Playwright
                    |
                    v
            Chrome / Chromium
                    |
                    v
                 Growtrail
```

Use a secure Electron configuration:

- `contextIsolation: true`
- `nodeIntegration: false`
- A restricted `preload.ts`
- Explicit IPC handlers for approved application operations
- No arbitrary JavaScript execution from the renderer

---

## 3. Existing Growtrail Workflow

The following workflow is confirmed from the supplied screenshots.

### Step 1: Open Growtrail

The visible dashboard contains a left sidebar.

The My Task navigation item is used to reach the task listing page.

The observed route is:

`https://app.growtrail.com/task/list`

This URL should be configurable rather than permanently hardcoded.

### Step 2: Open My Task

Navigate to My Task and wait for the task list to finish loading.

The page contains a Create Task action.

### Step 3: Create Task

Click Create Task to open the task creation form.

The form contains the following fields, as identified from the screenshots:

| Field | Expected input |
|---|---|
| Title | Text input |
| Description | Textarea |
| Project | Dropdown |
| Task Type | Dropdown |
| Status | Dropdown |
| Priority | Dropdown |
| Assigned To | Searchable employee dropdown |
| Followed By | Employee dropdown |
| Create Date | Date input |
| Due Date | Date input |
| Estimate Time (Hrs.) | Numeric or text input |
| ETA | Date input |
| Billable | Yes/No dropdown |
| Attachments | Optional file upload |
| Add Task | Submit button |

Some field requirements and exact behaviors remain unverified. Inspect the live application before implementing them.

The form is scrollable. Automation must handle the modal or form's internal scrolling where necessary.

### Step 4: Find the Created Task

After submitting a task, return to the task list and identify the newly created task.

The task list displays a `+` action associated with each task.

Click the correct `+` action to open the time log form.

Do not select the first plus button on the page without confirming that it belongs to the newly created task.

### Step 5: Submit the Time Log

The time log form contains these identified fields:

| Field | Expected input |
|---|---|
| Time Log Type | Dropdown |
| Date | Date input |
| Spent Time | Numeric or text input |
| Description | Textarea |
| Billable | Yes/No dropdown |
| Submit | Submit button |

The exact input formats, required fields, dropdown behavior, and successful-submission indicators must be verified in the live UI.

### Step 6: Repeat

Repeat task creation and time logging for every activity entered by the user.

Each task and its time log must be treated as a separate transaction with its own status and error handling.

---

## 4. Task Type Dropdown Options

The Task Type dropdown has the following fixed options:

1. Bug
2. New Development
3. Changes
4. Design
5. QC
6. Client Communication
7. Support
8. R&D
9. Project Management
10. Social Media
11. Content Writing
12. Others

These values belong to the Create Task form.

Use the exact labels when matching dropdown options.

Do not confuse Task Type with Time Log Type.

---

## 5. Time Log Type Dropdown Options

The Time Log Type dropdown has these options:

1. Billable
2. Inhouse
3. AMC
4. Support (No AMC)
5. RnD and Blog
6. Training and Others
7. Management

These options belong to the time logging form.

The separate Billable field is a Yes/No dropdown. A Time Log Type of Billable does not automatically mean the separate Billable field should be Yes.

The application must allow the user to configure both independently.

---

## 6. Other Dropdowns

### 6.1 Status

Available options:

- Open
- On Hold
- In Progress
- Closed
- Done
- Re Open
- Delete

Use the exact option labels found in Growtrail.

**Important:** Delete appears in the supplied dropdown list. Treat it as a potentially destructive action, not as a normal status to select automatically. Never select Delete as a default or submit it without an explicit, deliberate user action and confirmation.

### 6.2 Billable

Available options:

- Yes
- No

Store the selection as a configurable string value.

### 6.3 Assigned To

This is a searchable employee dropdown.

The default selection will usually be the current user's own employee account.

Implementation requirements:

1. Open the dropdown.
2. Enter the configured employee name.
3. Wait for matching options.
4. Select an exact match.
5. Verify the selected value.
6. Stop and request user intervention if no exact match exists or multiple indistinguishable matches are found.

Never assume the first result is the correct employee.

### 6.4 Followed By

This is an employee dropdown used to select the team lead.

Use a configurable default.

The automation must verify the selected employee before submitting the task.

The exact searchable behavior of this dropdown is not yet confirmed.

### 6.5 Project

Project selection may vary between activities.

Each task must therefore have its own Project selection.

The application may provide a saved default project, but it must allow individual task rows to override that default.

The available project list and exact selection behavior must be inspected in the live application.

### 6.6 Priority

The available priority options have not yet been documented.

Inspect the live dropdown and allow the user to choose a saved default.

Do not invent priority options or select an arbitrary value.

---

## 7. Main Application UI

Build a compact, practical desktop application.

The interface should prioritize entering multiple tasks quickly rather than recreating the entire Growtrail website.

### 7.1 Main screen

The main screen should contain:

- Application name: Growtrail Quick Logger
- Selected work date
- Browser connection status
- A multi-task entry list
- Add Task Row button
- Remove Task Row action
- Daily total hours
- Target-hours indicator
- Run Automation button
- Pause or Stop button
- Progress indicator
- Execution log
- Settings shortcut

### 7.2 Multi-task entry row

Each row represents one activity and contains:

- Task Title
- Task Description
- Project
- Task Type
- Status
- Priority
- Estimate Time
- Spent Time
- Time Log Type
- Billable
- Optional row-specific overrides

The task creation and time logging descriptions are separate fields in Growtrail.

For convenience, the application can initialize the Time Log Description from the Task Description, but the user must be able to edit it independently.

Do not force the descriptions to remain identical.

### 7.3 Shared defaults

Fields that are usually the same for all activities should be configured in Settings:

- Assigned To
- Followed By
- Default Status
- Default Priority
- Default Task Type
- Default Time Log Type
- Default Billable
- Default Project
- Date handling

The Project field must remain overridable per task.

All defaults must be editable by the user.

The application should initialize new rows with the configured defaults while preserving values already entered in existing rows.

### 7.4 Example daily entries

The following values are illustrative only:

| Title | Project | Estimate | Spent Time |
|---|---|---:|---:|
| Product UI fixes | Project A | 1 hr | 1 hr |
| API validation updates | Project B | 1 hr | 1 hr |
| Product import improvements | Project A | 5 hrs | 5 hrs |
| Bug fixes and testing | Project B | 2 hrs | 2 hrs |
| **Total** | | **9 hrs** | **9 hrs** |

The user must supply accurate task details and actual time spent.

Do not generate fictional work descriptions or automatically increase hours to meet the daily target.

---

## 8. Daily Hours Validation

The daily target is 9 hours.

Calculate the total using the Spent Time values for all task rows.

### Required behavior

- Display the running total whenever a row's time changes.
- Display the target of 9 hours.
- Show a warning when the total is less than 9 hours.
- Allow the user to proceed despite the warning.
- Do not block submission merely because the total is below 9 hours.
- Do not automatically fill the remaining hours.
- Show the total in hours and minutes where appropriate.
- Validate each row's time value before execution.

If the total is above 9 hours, display the actual total without silently reducing it.

The target may be made configurable in a future version, but 9 hours should be the initial default.

### Time parsing

Inspect Growtrail's actual Spent Time input format before implementing the parser.

It may accept decimal hours, hours and minutes, or another format.

Internally, prefer storing durations as integer minutes to avoid floating-point calculation errors.

For example:

- 1 hour = 60 minutes
- 1.5 hours = 90 minutes
- 5 hours = 300 minutes

Convert to Growtrail's accepted format only when filling the input.

---

## 9. Estimate Time and Spent Time

Estimate Time must match Spent Time for every task.

When the user enters or changes Spent Time, the application should synchronize Estimate Time automatically.

Both values must be validated before starting automation.

If the two fields differ because of an imported draft or manual edit, show a clear validation error and provide a way to synchronize them.

Do not submit mismatched values.

The automation must still inspect whether Growtrail permits fractional hours and determine the exact input format.

---

## 10. Browser Session Strategy

The user prefers to automate an existing Chrome/Chromium session.

This requires special handling.

Playwright cannot reliably attach to an arbitrary already-running Chrome instance that was not launched with remote debugging enabled.

### Preferred implementation

Support connecting to a Chrome/Chromium instance through the Chrome DevTools Protocol (CDP).

The connection workflow should:

1. Check whether a supported browser debugging endpoint is available.
2. Connect through Playwright's supported CDP connection method.
3. Inspect available browser contexts and pages.
4. Identify the Growtrail tab.
5. Confirm that the user is authenticated.
6. Navigate to the configured Growtrail route if necessary.

### Security and compatibility requirements

- Do not attempt to extract passwords or browser cookies manually.
- Do not bypass company authentication or access controls.
- Do not silently launch a second Chrome process against a profile already in use.
- Do not assume the default Chrome profile can always be attached.
- Do not expose an unauthenticated remote debugging port to the network.

Remote debugging gives connected processes powerful control over the browser. Use a localhost-only endpoint and restrict access to the user's own machine.

### Browser setup and fallback

If the user's current Chrome instance cannot be attached to, explain the reason in the UI.

Provide setup instructions for launching Chrome with an appropriate debugging endpoint and a dedicated user-data directory.

Alternatively, offer a dedicated persistent Playwright browser profile as a fallback. The user can log into Growtrail once in that profile and reuse it later.

The fallback must be clearly explained because it will not automatically share the user's existing default Chrome session.

Do not silently switch to a different browser profile.

### Browser connection UI

Show one of these states:

- Disconnected
- Connecting
- Connected
- Growtrail not found
- Login required
- Connection error

Provide a Connect Browser button and a useful troubleshooting message for failures.

---

## 11. Playwright Automation Implementation

Use TypeScript and the Playwright library.

Keep automation logic separate from the React UI.

### Suggested automation modules

```text
src/
  main/
    index.ts
    ipc.ts
    settings.ts
    automation/
      browser.ts
      navigation.ts
      create-task.ts
      task-list.ts
      time-log.ts
      selectors.ts
      verification.ts
      errors.ts
  preload/
    index.ts
  renderer/
    App.tsx
    components/
      TaskRow.tsx
      TaskEditor.tsx
      SettingsPage.tsx
      ProgressPanel.tsx
      ExecutionLog.tsx
    pages/
      HomePage.tsx
      SettingsPage.tsx
  shared/
    types.ts
    validation.ts
    duration.ts
```

Adjust the exact folder structure as needed, but keep responsibilities separated.

### 11.1 Navigation

The navigation module should:

1. Confirm the browser is connected.
2. Find or open the configured Growtrail page.
3. Confirm the current user is authenticated.
4. Navigate to My Task.
5. Wait for the task list to become ready.
6. Verify the Create Task action is available.

Do not depend on fixed sleep intervals.

Use Playwright's built-in waiting behavior, explicit conditions, and bounded timeouts.

### 11.2 Create Task form

The task creation module should:

1. Click Create Task.
2. Wait for the form to appear.
3. Fill Title.
4. Fill Description.
5. Select Project.
6. Select Task Type.
7. Select Status.
8. Select Priority.
9. Select Assigned To.
10. Select Followed By.
11. Fill Create Date.
12. Fill Due Date if required.
13. Fill Estimate Time.
14. Fill ETA if required.
15. Select Billable.
16. Handle optional fields only when necessary.
17. Validate the completed form.
18. Click Add Task.
19. Wait for confirmation that the task was created.
20. Capture the created task's identifier or another reliable unique reference when available.

Do not fill every optional field with invented values.

Inspect the live UI to determine which fields are required, which values are accepted, and whether blank values are permitted.

If the application generates a task ID, capture it.

### 11.3 Task list identification

After creation, identify the newly created task using the strongest available identifier.

Preferred identification order:

1. Unique task ID returned by the UI.
2. Exact task title plus another stable attribute.
3. A newly added row verified against the previous list state.

Do not rely only on row position.

Do not click a plus button associated with another task.

If the task cannot be identified confidently, pause the workflow and ask the user to intervene.

### 11.4 Time Log form

For each created task:

1. Find the matching task row.
2. Locate the plus action within that row.
3. Click the action.
4. Wait for the time log form.
5. Select Time Log Type.
6. Fill Date.
7. Fill Spent Time.
8. Fill Time Log Description.
9. Select Billable.
10. Validate all required fields.
11. Click Submit.
12. Wait for a reliable success indicator.
13. Record the result.
14. Continue to the next task.

If a dropdown has a custom searchable interface, use the actual visible search and option-selection behavior.

Do not assume every dropdown is a native HTML `<select>` element.

### 11.5 Submission verification

A successful click is not proof that a submission succeeded.

Verification should use one or more of:

- An explicit success message.
- A modal closing after a confirmed successful request.
- The newly created task appearing in the task list.
- The time log appearing against the intended task.
- Another stable, observable confirmation in Growtrail.

Inspect the live application to select the appropriate method.

If verification fails, mark the result as Uncertain rather than automatically submitting again.

---

## 12. Selector Strategy

The screenshots identify the visible forms, but exact DOM selectors have not yet been inspected.

The implementation must inspect the actual live Growtrail DOM before writing the final selectors.

### Preferred locator order

1. Accessible role and name.
2. Label-based locators.
3. Placeholder-based locators when unique and stable.
4. Stable attributes such as `data-testid`.
5. Scoped CSS selectors based on inspected markup.
6. XPath only when necessary.

Examples of preferred locator patterns:

```ts
page.getByRole("button", {
  name: "Create Task",
  exact: true,
});

page.getByRole("button", {
  name: "Add Task",
  exact: true,
});
```

These are examples, not verified selectors. Confirm their uniqueness and accessibility names in the actual DOM.

### Avoid

- Blind coordinate clicking.
- Fragile selectors based on CSS class hashes.
- Selecting an arbitrary first matching element.
- Unbounded waits.
- Repeated submissions when the first result is uncertain.
- Using a title alone when duplicate task titles may exist.

### Selector inspection workflow

Claude Code should first implement an inspection or diagnostic mode that can:

- Inspect visible headings, buttons, inputs, labels, and dropdowns.
- Record relevant DOM structure.
- Identify accessible names and roles.
- Save screenshots for troubleshooting.
- Generate a selector inventory.

Do not store passwords, session cookies, authentication tokens, or sensitive company data in diagnostic logs.

Keep selector definitions centralized so they can be updated when Growtrail changes its UI.

---

## 13. Automation State and Error Recovery

Creating a task and logging time are two separate operations.

The system must not treat them as one atomic transaction because Growtrail may save the task successfully and then fail during time logging.

### Per-task state machine

Use these states:

- Pending
- Creating Task
- Task Created
- Opening Time Log
- Submitting Time Log
- Completed
- Failed
- Uncertain

Persist state after each meaningful transition.

### Failure examples

**Task creation fails**

- Stop processing the current task.
- Record the failure.
- Do not open a time log for a task that was not confirmed to exist.

**Task creation succeeds, but time logging fails**

- Preserve the created task ID.
- Mark the task as Task Created / Time Log Failed.
- Allow the user to resume the time logging step without recreating the task.

**Time log submission is uncertain**

- Do not automatically submit a second time.
- Ask the user to inspect Growtrail or verify the existing entry.
- Resume only after the state is clear.

**Browser disconnects**

- Pause the workflow.
- Preserve completed operations.
- Attempt a safe reconnection only when it will not repeat an action.
- Require user intervention if the current submission status cannot be determined.

### Resume support

The application should allow the user to resume an interrupted run.

It must skip confirmed completed operations and avoid duplicate task creation or time logging.

Do not assume that clicking Submit twice is harmless.

---

## 14. Settings Screen

Implement an in-app Settings page.

### Browser settings

- Growtrail base URL.
- My Task route.
- Connection mode.
- CDP endpoint or port, when applicable.
- Browser troubleshooting information.

### Employee settings

- Default Assigned To employee.
- Default Followed By employee.

### Task defaults

- Default Project.
- Default Task Type.
- Default Status.
- Default Priority.
- Default Billable.

### Time log defaults

- Default Time Log Type.
- Default Billable.
- Default work date behavior.
- Daily target hours, initially 9.

### Settings behavior

- Persist settings locally.
- Validate settings before saving.
- Provide Reset to Defaults.
- Confirm destructive resets.
- Allow row-level overrides.
- Never store user passwords or browser cookies in the settings file.

If the browser session already authenticates the user, do not ask for Growtrail credentials in the application.

---

## 15. Data Model

Use typed interfaces for the task rows and automation state.

Suggested initial types:

```ts
export interface TaskEntry {
  id: string;

  title: string;
  description: string;
  timeLogDescription: string;

  project: string;
  taskType: string;
  status: string;
  priority: string;

  assignedTo: string;
  followedBy: string;

  createDate: string;
  dueDate?: string;
  eta?: string;

  estimateMinutes: number;
  spentMinutes: number;

  timeLogType: string;
  billable: "Yes" | "No";

  attachments?: string[];
}

export type TaskExecutionStatus =
  | "pending"
  | "creating-task"
  | "task-created"
  | "opening-time-log"
  | "submitting-time-log"
  | "completed"
  | "failed"
  | "uncertain";

export interface TaskExecutionResult {
  entryId: string;
  status: TaskExecutionStatus;
  growtrailTaskId?: string;
  errorMessage?: string;
  updatedAt: string;
}
```

Adapt the data model to the verified form requirements.

If Task Type and Time Log Type require separate billable selections, represent those values separately.

The UI should not allow invalid time values or mismatched Estimate Time and Spent Time values.

Persist only the information needed to resume execution. Do not persist browser session credentials or sensitive page content.

---

## 16. Execution Controls

The main screen must provide:

### Run Automation

- Validate all rows.
- Display the daily total.
- Warn if total time is below 9 hours.
- Confirm the number of tasks about to be created.
- Start the automation.
- Process rows sequentially.
- Show progress for the current row.
- Update each row's execution state.

### Stop

Provide a safe Stop button.

Stopping should prevent the next task from starting.

If an operation is currently submitting a form, the application must not pretend that it was cancelled if Growtrail may already have processed the request.

After stopping, record the current state and allow safe recovery.

### Progress panel

Display:

- Total tasks.
- Completed tasks.
- Failed tasks.
- Tasks requiring verification.
- Current task.
- Current operation.
- Daily total hours.

### Execution log

Show readable events such as:

- Connected to Growtrail.
- Opened My Task.
- Created task 1.
- Verified task creation.
- Submitted time log for task 1.
- Verified time log submission.
- Task 2 requires attention.

Do not display authentication tokens, cookies, or other sensitive information.

---

## 17. Validation Requirements

Validate the entire draft before starting automation.

Required checks:

- Title is not empty.
- Task Description is not empty if required by Growtrail.
- Project is selected.
- Task Type is valid.
- Status is valid.
- Priority is valid when required.
- Assigned To is selected.
- Followed By is selected if required.
- Create Date is valid.
- Estimate Time equals Spent Time.
- Spent Time is positive and valid.
- Time Log Type is valid.
- Time Log Description is valid if required.
- Billable is Yes or No.
- Date values conform to Growtrail's accepted format.

Do not reject a draft merely because the daily total is below 9 hours. Show a warning and allow the user to continue.

Do not silently modify a task to make the form valid.

If a required field cannot be determined from the screenshots, inspect the live form and document the result.

---

## 18. Ubuntu AppImage Packaging

The initial deliverable is an Ubuntu desktop application distributed as an AppImage.

Use `electron-builder` or another maintained Electron-compatible packaging tool.

### Requirements

- Build a Linux AppImage.
- Include the compiled React UI.
- Include the required Electron runtime.
- Include the Playwright automation code and its runtime dependencies.
- Provide an application icon.
- Set a clear product name and version.
- Ensure configuration and draft data are stored outside the packaged application.
- Provide launch instructions.
- Provide troubleshooting documentation.

### Browser dependency handling

Playwright browser dependencies must be considered during packaging.

The initial implementation should preferably connect to the user's installed Chrome/Chromium browser rather than automatically downloading a second full browser bundle.

Document the expected browser requirements and CDP setup.

If the user chooses the dedicated-browser fallback, handle browser installation and runtime requirements explicitly.

Do not assume that an AppImage can run on every Linux distribution without compatible system libraries.

### Build commands

The repository should provide documented commands similar to:

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
npm run package:linux
```

These are proposed command names. Implement and document the actual scripts in `package.json`.

### Deliverables

At minimum, provide:

```text
dist/
  Growtrail-Quick-Logger-x86_64.AppImage
```

The exact filename should be generated by the packaging configuration.

Also provide:

- README.md
- Installation instructions
- Browser setup instructions
- Troubleshooting guide
- Source code
- Build instructions

Do not claim the application is packaged or tested until the corresponding commands have actually succeeded.

---

## 19. Windows Compatibility

Although Ubuntu is the first target, keep the code portable.

Avoid hardcoding Linux-only filesystem paths.

Use platform-aware paths and Electron's application data directories.

Do not rely on shell commands that work only on Linux.

The automation logic should remain shared between Linux and Windows.

For a future Windows release, build and test on a Windows machine or a Windows CI runner. Produce an appropriate `.exe` or `.msi` installer.

The initial implementation does not need to deliver a Windows installer.

---

## 20. Testing Plan

### Unit tests

Test:

- Time parsing.
- Duration conversion.
- Daily total calculations.
- Estimate Time and Spent Time matching.
- Default values.
- Row validation.
- State transitions.
- Resume behavior.

### UI tests

Test:

- Adding and removing rows.
- Editing task descriptions.
- Selecting projects.
- Changing dropdown defaults.
- Daily total updates.
- Warning below 9 hours.
- Settings persistence.
- Starting and stopping automation.

### Browser automation tests

Use a safe test environment or a non-production test account where available.

Verify:

1. Browser connection.
2. Growtrail authentication detection.
3. My Task navigation.
4. Create Task form interaction.
5. Dropdown selection.
6. Task creation.
7. Correct task row identification.
8. Time log form interaction.
9. Time log submission.
10. Success verification.
11. Handling of a failed task.
12. Recovery without creating duplicates.

Do not run destructive tests against production data.

Do not use Delete as a test status.

If Growtrail has no test environment, perform read-only inspection first and use an explicitly approved test entry for end-to-end testing.

---

## 21. Implementation Phases

Claude Code should work in the following order.

### Phase 1: Inspect the project and live UI

- Inspect the existing repository and development environment.
- Identify the actual Growtrail form controls and DOM structure.
- Confirm which fields are required.
- Confirm the dropdown behavior.
- Determine how the task list identifies a newly created task.
- Determine how successful task and time log submissions are confirmed.
- Verify browser connection feasibility.

Do not invent selectors.

If access to the live UI is unavailable, create a clearly documented selector inventory and identify what the user must verify manually.

### Phase 2: Build the desktop shell

- Initialize Electron, React, TypeScript, and Vite.
- Configure secure preload and IPC.
- Build the main task-entry interface.
- Implement settings persistence.
- Implement duration validation and the daily total.
- Add execution status indicators.

### Phase 3: Implement browser connectivity

- Implement CDP connection.
- Detect browser connection failures.
- Detect login requirements.
- Identify the Growtrail tab.
- Provide browser setup guidance.

### Phase 4: Implement task creation

- Implement navigation.
- Implement form filling.
- Implement dropdown selection.
- Implement task creation verification.
- Capture the task ID when possible.

### Phase 5: Implement time logging

- Identify the correct task row.
- Open the associated time log form.
- Populate and submit the form.
- Verify the result.
- Record execution status.

### Phase 6: Implement recovery

- Persist task execution states.
- Handle browser disconnections.
- Prevent accidental duplicate submissions.
- Allow the user to resume interrupted work.

### Phase 7: Test and package

- Run type checking.
- Run unit tests.
- Run UI tests.
- Test the automation against Growtrail using an approved test workflow.
- Build the AppImage.
- Document installation and browser configuration.

---

## 22. Acceptance Criteria

The application is considered ready for its first usable release when:

- [ ] It launches as an Ubuntu desktop application.
- [ ] The user can connect to their authenticated Growtrail session.
- [ ] The user can enter multiple task rows.
- [ ] Each row supports a different title and description.
- [ ] Each row supports its own project selection.
- [ ] Shared defaults can be edited in Settings.
- [ ] The Task Type options match the documented list.
- [ ] The Time Log Type options match the documented list.
- [ ] Assigned To and Followed By support verified employee selection.
- [ ] Estimate Time always matches Spent Time.
- [ ] The daily total updates correctly.
- [ ] A total below 9 hours displays a warning without blocking execution.
- [ ] The application creates a task for each activity.
- [ ] The application logs time against the correct newly created task.
- [ ] Each task creation and time log is verified.
- [ ] Errors are displayed clearly.
- [ ] Interrupted runs can be resumed safely.
- [ ] The application does not automatically duplicate uncertain submissions.
- [ ] Settings and draft data persist between launches.
- [ ] The AppImage builds successfully.
- [ ] Installation and troubleshooting instructions are provided.

---

## 23. Important Constraints and Unknowns

The following items must be inspected before the automation can be considered reliable.

1. Exact selectors for all Growtrail buttons and form fields.
2. Required versus optional fields in Create Task.
3. Required versus optional fields in Time Log.
4. Exact priority options.
5. Exact Project dropdown behavior.
6. Exact employee search behavior for Assigned To and Followed By.
7. Date input formats.
8. Spent Time input format and fractional-hour support.
9. Whether Estimate Time accepts the same format as Spent Time.
10. Exact success indicators after task creation and time logging.
11. Whether the created task ID is visible in the UI.
12. How the task list refreshes after submission.
13. Whether the current Chrome/Chromium instance exposes a CDP endpoint.
14. Whether the company environment permits this browser automation workflow.

The supplied screenshots are the initial visual reference. They do not establish the exact DOM selectors or all validation rules.

The application must not silently assume values for unknown fields.

When an unknown required field or ambiguous dropdown is encountered, pause and report the issue clearly.

---

## 24. Instructions to Claude Code

Act as a senior TypeScript and Electron engineer.

First inspect the current workspace, repository, installed dependencies, and available browser environment. Then implement the application in the phases defined above.

Prioritize a working, testable Ubuntu application over unnecessary abstractions or premature features.

Follow these rules:

1. Do not introduce AI processing or external LLM dependencies.
2. Do not assume Growtrail has an API.
3. Do not invent selectors or dropdown values.
4. Do not hardcode employee names, passwords, session cookies, or authentication tokens.
5. Do not create tasks or time logs without explicit user initiation.
6. Do not automatically repeat a submission whose result is uncertain.
7. Do not fabricate working hours or task descriptions.
8. Do not treat a successful button click as proof of successful submission.
9. Do not package the application until the build has been verified.
10. Keep automation logic separate from the desktop UI.
11. Keep the source code maintainable for future Windows support.
12. Document any assumption that cannot be verified.

If a critical unknown prevents safe implementation, ask the user a focused question before proceeding. Otherwise, make progress on the independent parts of the application and maintain a clear list of remaining inspection requirements.

**First deliverable:** a working desktop application that accepts multiple task entries, calculates total hours, saves settings, connects to the user's browser, and can execute the verified Create Task → Time Log workflow on Ubuntu.

**Final deliverable:** the complete source code, tests, documentation, and a verified Ubuntu AppImage.

# End of Specification
