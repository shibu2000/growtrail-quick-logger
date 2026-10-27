<p align="center">
  <img src="build/icon.png" width="96" alt="Growtrail Quick Logger icon">
</p>

<h1 align="center">Growtrail Quick Logger</h1>

<p align="center">
  Enter your day's work once, press <b>Run</b>, and the app creates each Growtrail task and logs time against it for you.
</p>

<p align="center">
  <a href="https://github.com/shibu2000/growtrail-quick-logger/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/shibu2000/growtrail-quick-logger?label=latest%20release"></a>
  <img alt="Platform" src="https://img.shields.io/badge/platform-Ubuntu%20%7C%20Linux%20x64-orange">
</p>

---

## Download

| Package | Best for | Download |
|---|---|---|
| **.deb installer** | Ubuntu 20.04, 22.04, 24.04 (recommended) | [**growtrail-quick-logger_amd64.deb**](https://github.com/shibu2000/growtrail-quick-logger/releases/latest/download/growtrail-quick-logger_amd64.deb) |
| **AppImage** | Any 64-bit Linux, no install needed | [**Growtrail-Quick-Logger-x86_64.AppImage**](https://github.com/shibu2000/growtrail-quick-logger/releases/latest/download/Growtrail-Quick-Logger-x86_64.AppImage) |

All versions and release notes: [Releases](https://github.com/shibu2000/growtrail-quick-logger/releases).

## Install

### .deb (Ubuntu)

```bash
sudo apt install ./growtrail-quick-logger_amd64.deb
```

Open **Growtrail Quick Logger** from the application menu, or run `growtrail-quick-logger`.
To update, install the newer `.deb` the same way. To remove: `sudo apt remove growtrail-quick-logger`.

### AppImage

```bash
chmod +x Growtrail-Quick-Logger-x86_64.AppImage
./Growtrail-Quick-Logger-x86_64.AppImage
```

The AppImage needs FUSE 2: `sudo apt install libfuse2t64` on Ubuntu 24.04, `sudo apt install libfuse2` on 22.04.

## Requirements

- 64-bit Intel/AMD Linux (Ubuntu 20.04 or newer)
- A Chromium-based browser installed: **Google Chrome**, **Thorium**, **Microsoft Edge** or **Chromium** (not the Snap version)
- A Growtrail account

## First-time setup

1. **Connect browser.** The app opens your browser in a separate window with its own profile. Sign in to Growtrail there once; the login is remembered. Your everyday browser profile is never touched.
2. **Settings → Fetch from Growtrail.** Loads your projects and the employee list from Growtrail. "Assigned To" is filled with your name.
3. Pick **Followed By** and your defaults (task type, time log type, billable), then **Save**.

## Daily use

1. Choose the work date: **Today** or **Yesterday** (Growtrail accepts only these).
2. Add one row per activity: title, project, task type and spent time (e.g. `1.5`, `1:30` or `1h 30m`). Estimate is kept equal to spent time automatically.
3. Watch the daily total. Below the 9 h target you get a warning, but you can still run.
4. Press **Run automation** and confirm. Tasks are processed one at a time and every step is shown in the execution log.

**Shortcuts:** `Ctrl+Enter` adds a row · `Ctrl+Shift+Enter` runs.

## Safety

- Nothing is submitted until you confirm the run.
- Every dropdown is matched by exact name; if Growtrail has no exact match, that task stops before anything is sent.
- Progress is saved before every submit. If something is interrupted, the task is marked **Check Growtrail** and is never resubmitted on its own.
- Completed tasks are locked, so the same work cannot be logged twice.
- No passwords, cookies or tokens are stored by the app.

## Troubleshooting

| Problem | Fix |
|---|---|
| "No Chrome, Chromium or Thorium found" | Install Google Chrome, or set the browser path in **Settings → Browser**. |
| "Login required" | Sign in to Growtrail in the browser window the app opened, then press **Re-check**. |
| AppImage does not start | Install FUSE 2 (see above), or use the `.deb`. |
| Dark mode does not follow Ubuntu | Use the **Theme** button in the header to pick Dark. |

Settings, drafts and run history are stored in `~/.config/Growtrail Quick Logger/`.

## Build from source

```bash
npm install
npm run dev            # run the app in development
npm run typecheck
npm test
npm run package:linux  # builds dist/*.deb and dist/*.AppImage
```

Releases are built by GitHub Actions: pushing a tag such as `v0.2.0` builds both installers and publishes them on the Releases page.
