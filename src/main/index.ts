import { app, BrowserWindow, dialog, nativeTheme, screen, shell } from 'electron'
import { join } from 'node:path'
import { registerIpc } from './ipc'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  const area = screen.getPrimaryDisplay().workAreaSize
  mainWindow = new BrowserWindow({
    width: Math.min(1320, area.width),
    height: Math.min(880, area.height),
    minWidth: 1000,
    minHeight: 640,
    title: 'Growtrail Quick Logger',
    icon: join(__dirname, '../../build/icon.png'),
    show: false,
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#14161f' : '#f6f7f9',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })

  mainWindow.once('ready-to-show', () => {
    if (area.width < 1400 || area.height < 900) mainWindow?.maximize()
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault())

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devUrl) void mainWindow.loadURL(devUrl)
  else void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))

  mainWindow.on('closed', () => {
    mainWindow = null
  })
  return mainWindow
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  void app.whenReady().then(() => {
    const ipc = registerIpc(() => mainWindow)
    const win = createWindow()

    win.on('close', (event) => {
      if (!ipc.isRunning()) return
      const choice = dialog.showMessageBoxSync(win, {
        type: 'warning',
        buttons: ['Keep running', 'Quit anyway'],
        defaultId: 0,
        cancelId: 0,
        title: 'Run in progress',
        message: 'A run is in progress.',
        detail: 'Quitting now may leave the current task unconfirmed. It will be marked "needs checking" on next launch.',
      })
      if (choice === 0) event.preventDefault()
    })

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
