<p align="center">
  <img src="build/icon.png" width="96" alt="Growtrail Quick Logger icon">
</p>

<h1 align="center">Growtrail Quick Logger</h1>

<p align="center">
  Enter your day's work once, press <b>Run</b>, and the app creates each Growtrail task and logs time against it for you.
</p>

<p align="center">
  <a href="https://github.com/shibu2000/growtrail-quick-logger/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/shibu2000/growtrail-quick-logger?label=latest%20release"></a>
  <img alt="Platform" src="https://img.shields.io/badge/platform-Windows%2010%2F11%20%7C%20Ubuntu%20%7C%20Linux%20x64-orange">
</p>

---

## Download

| Package | Best for | Size | Download |
|---|---|---|---|
| **Windows installer** | Windows 10 and 11 (64-bit) | ~125 MB | [**Growtrail-Quick-Logger-Setup-x64.exe**](https://github.com/shibu2000/growtrail-quick-logger/releases/latest/download/Growtrail-Quick-Logger-Setup-x64.exe) |
| **.deb installer** | Ubuntu 20.04, 22.04, 24.04 (recommended on Ubuntu) | ~104 MB | [**growtrail-quick-logger_amd64.deb**](https://github.com/shibu2000/growtrail-quick-logger/releases/latest/download/growtrail-quick-logger_amd64.deb) |
| **AppImage** | Any 64-bit Linux, no install needed | ~130 MB | [**Growtrail-Quick-Logger-x86_64.AppImage**](https://github.com/shibu2000/growtrail-quick-logger/releases/latest/download/Growtrail-Quick-Logger-x86_64.AppImage) |

All versions and release notes: [Releases](https://github.com/shibu2000/growtrail-quick-logger/releases).

Free code signing on Windows provided by [SignPath.io](https://about.signpath.io), certificate by [SignPath Foundation](https://signpath.org). See the [code signing policy](#code-signing-policy).

## Install

### Windows 10 / 11

1. Download and run `Growtrail-Quick-Logger-Setup-x64.exe`.
2. The installer is not code-signed yet, so Windows SmartScreen may say "Windows protected your PC". Click **More info → Run anyway**.
3. Choose the install folder (no administrator rights needed). A Start menu and desktop shortcut are created.

To update, run the newer installer. To remove: **Settings → Apps → Installed apps → Growtrail Quick Logger → Uninstall**.

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

- Windows 10 or 11 (64-bit), or 64-bit Intel/AMD Linux (Ubuntu 20.04 or newer)
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
| Windows says "Windows protected your PC" | The installer is not signed yet. Click **More info → Run anyway**. |
| AppImage does not start | Install FUSE 2 (see above), or use the `.deb`. |
| Dark mode does not follow Ubuntu | Use the **Theme** button in the header to pick Dark. |

Settings, drafts and run history are stored in `%APPDATA%\Growtrail Quick Logger\` on Windows and `~/.config/Growtrail Quick Logger/` on Linux.

## Build from source

```bash
npm install
npm run dev            # run the app in development
npm run typecheck
npm test
npm run package:linux  # builds dist/*.deb and dist/*.AppImage
npm run package:win    # builds dist/*.exe (run on Windows)
```

Releases are built by GitHub Actions: pushing a tag such as `v0.2.0` builds the Windows and Linux installers and publishes them on the Releases page.

## Code signing policy

Windows releases are built from this repository by GitHub Actions and signed through SignPath.

- Free code signing provided by [SignPath.io](https://about.signpath.io), certificate by [SignPath Foundation](https://signpath.org)
- Committers and reviewers: [Shibu Dhara](https://github.com/shibu2000)
- Approvers: [Shibu Dhara](https://github.com/shibu2000)

Only builds produced by the release workflow from tagged commits in this repository are signed.

## Privacy

This program will not transfer any information to other networked systems unless specifically requested by the user or the person installing or operating it. It only talks to the Growtrail site you sign in to, in your own browser. Settings, drafts and run history stay on your computer, and no passwords, cookies or tokens are stored.

## License

[MIT](LICENSE) © 2026 Bluehorse Software Private Limited. Developed by [Shibu Dhara](https://github.com/shibu2000).
