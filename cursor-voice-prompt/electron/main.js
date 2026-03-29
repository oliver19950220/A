const {
  app,
  BrowserWindow,
  ipcMain,
  clipboard,
  globalShortcut,
  Tray,
  Menu,
  nativeImage,
  session,
} = require('electron');
const path = require('path');
const { execFileSync } = require('child_process');

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {Tray | null} */
let tray = null;

/**
 * 通过 PowerShell 调用 SendKeys 模拟 Ctrl+V，将当前剪贴板内容粘贴到前台焦点控件。
 * 依赖用户已将焦点放在 Cursor 输入框（见 PRD）。
 */
function sendCtrlV() {
  execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-STA',
      '-WindowStyle',
      'Hidden',
      '-Command',
      'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("^v")',
    ],
    { windowsHide: true }
  );
}

ipcMain.handle('inject-snippet', async (_, payload) => {
  const { text, leadingNewline } = payload;
  const clip = leadingNewline ? `\n${text}` : String(text);
  clipboard.writeText(clip);
  await new Promise((r) => setTimeout(r, 50));
  sendCtrlV();
  return { ok: true };
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 440,
    height: 560,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    title: 'Cursor 语音 Prompt',
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  );
  tray = new Tray(icon);
  tray.setToolTip('Cursor 语音 Prompt');
  const menu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: '退出',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function registerGlobalShortcuts() {
  // 显示/隐藏窗口
  globalShortcut.register('CommandOrControl+Shift+Y', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  // 开始/停止聆听（由渲染进程处理状态）
  globalShortcut.register('CommandOrControl+Shift+U', () => {
    mainWindow?.webContents.send('toggle-listening');
  });
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    if (permission === 'media') {
      callback(true);
    } else {
      callback(false);
    }
  });

  createWindow();
  createTray();
  registerGlobalShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Windows 下保留托盘进程，不自动退出
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
