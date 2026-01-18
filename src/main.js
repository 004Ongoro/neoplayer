const { app, BrowserWindow, ipcMain, Menu, Tray, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const isDev = process.env.NODE_ENV !== 'production';

let mainWindow;
let tray = null;

// Create the main window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    frame: true,
    titleBarStyle: 'default',
    backgroundColor: '#1a1a1a'
  });

  // Load the index.html
  mainWindow.loadFile('src/index.html');

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Create application menu
  createApplicationMenu();

  // Handle window close event
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Create system tray
  createTray();
}

// Create system tray
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  
  tray = new Tray(iconPath);
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Player',
      click: () => {
        mainWindow.show();
      }
    },
    {
      label: 'Pause',
      click: () => {
        mainWindow.webContents.send('player-control', 'pause');
      }
    },
    {
      label: 'Play',
      click: () => {
        mainWindow.webContents.send('player-control', 'play');
      }
    },
    {
      label: 'Next',
      click: () => {
        mainWindow.webContents.send('player-control', 'next');
      }
    },
    {
      label: 'Previous',
      click: () => {
        mainWindow.webContents.send('player-control', 'previous');
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip('Media Player');
  tray.setContextMenu(contextMenu);
}

// Create application menu
function createApplicationMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open File...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile'],
              filters: [
                { name: 'Media Files', extensions: ['mp4', 'avi', 'mkv', 'mov', 'mp3', 'wav', 'flac', 'm4a'] },
                { name: 'All Files', extensions: ['*'] }
              ]
            });
            if (!result.canceled && result.filePaths.length > 0) {
              mainWindow.webContents.send('file-opened', result.filePaths[0]);
            }
          }
        },
        {
          label: 'Open Folder...',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openDirectory']
            });
            if (!result.canceled && result.filePaths.length > 0) {
              mainWindow.webContents.send('folder-opened', result.filePaths[0]);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Playback',
      submenu: [
        {
          label: 'Play/Pause',
          accelerator: 'Space',
          click: () => {
            mainWindow.webContents.send('player-control', 'toggle-play');
          }
        },
        {
          label: 'Next',
          accelerator: 'Ctrl+Right',
          click: () => {
            mainWindow.webContents.send('player-control', 'next');
          }
        },
        {
          label: 'Previous',
          accelerator: 'Ctrl+Left',
          click: () => {
            mainWindow.webContents.send('player-control', 'previous');
          }
        },
        {
          label: 'Forward 10s',
          accelerator: 'Right',
          click: () => {
            mainWindow.webContents.send('player-control', 'forward-10');
          }
        },
        {
          label: 'Backward 10s',
          accelerator: 'Left',
          click: () => {
            mainWindow.webContents.send('player-control', 'backward-10');
          }
        },
        { type: 'separator' },
        {
          label: 'Increase Volume',
          accelerator: 'Up',
          click: () => {
            mainWindow.webContents.send('player-control', 'volume-up');
          }
        },
        {
          label: 'Decrease Volume',
          accelerator: 'Down',
          click: () => {
            mainWindow.webContents.send('player-control', 'volume-down');
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: async () => {
            await shell.openExternal('https://electronjs.org/docs');
          }
        },
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Media Player',
              message: 'Electron Media Player',
              detail: 'Version 1.0.0\nA feature-rich media player built with Electron'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC Handlers
ipcMain.handle('read-directory', async (event, dirPath) => {
  try {
    const files = await fs.readdir(dirPath);
    const mediaFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.mp4', '.avi', '.mkv', '.mov', '.mp3', '.wav', '.flac', '.m4a'].includes(ext);
    }).map(file => ({
      name: file,
      path: path.join(dirPath, file),
      type: ['.mp3', '.wav', '.flac', '.m4a'].includes(path.extname(file).toLowerCase()) ? 'audio' : 'video'
    }));
    
    return mediaFiles;
  } catch (error) {
    console.error('Error reading directory:', error);
    return [];
  }
});

// App lifecycle events
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}