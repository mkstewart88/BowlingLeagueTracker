const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let mainWindow = null;
let allowWindowClose = false;
let closeRequestInFlight = false;

function getInstallDir() {
  if (app.isPackaged) {
    return path.dirname(process.execPath);
  }
  return __dirname;
}

function getPersistentConfigDir() {
  return app.getPath('userData');
}

function getConfigPaths() {
  const userConfig = path.join(getPersistentConfigDir(), 'bowling-desktop-config.json');
  const installConfig = path.join(getInstallDir(), 'bowling-desktop-config.json');
  return { userConfig, installConfig };
}

function readDesktopConfig() {
  const { installConfig, userConfig } = getConfigPaths();
  for (const candidate of [installConfig, userConfig]) {
    try {
      if (fs.existsSync(candidate)) {
        const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8'));
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      }
    } catch {
      // Ignore malformed config candidate
    }
  }
  return {
    lastSaveFilePath: '',
    lastSavedAt: null,
  };
}

function writeDesktopConfig(partial) {
  const next = {
    ...readDesktopConfig(),
    ...partial,
    updatedAt: new Date().toISOString(),
  };
  const payload = JSON.stringify(next, null, 2);
  const { installConfig, userConfig } = getConfigPaths();

  for (const target of [userConfig, installConfig]) {
    try {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, payload, 'utf8');
    } catch {
      // Ignore if install directory is read-only
    }
  }
  return next;
}

function detectPreferredOneDriveDir() {
  const candidates = [
    process.env.OneDriveCommercial,
    process.env.OneDriveConsumer,
    process.env.OneDrive,
    path.join(os.homedir(), 'OneDrive'),
    path.join(os.homedir(), 'Documents'),
  ].filter(Boolean);

  for (const dir of candidates) {
    try {
      if (dir && fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        return dir;
      }
    } catch {
      // Try next directory
    }
  }
  return app.getPath('documents');
}

function atomicWriteFileSync(targetPath, content) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const tempPath = `${targetPath}.tmp-${Date.now()}`;
  fs.writeFileSync(tempPath, content, 'utf8');
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { force: true });
  }
  fs.renameSync(tempPath, targetPath);
}

function resolveAppHtmlEntry() {
  const installDir = getInstallDir();
  const candidates = [
    path.join(installDir, 'BowlingLeagueHelper.html'),
    path.join(process.resourcesPath || '', 'BowlingLeagueHelper.html'),
    path.join(__dirname, 'BowlingLeagueHelper.html'),
    path.join(__dirname, '..', 'public', 'BowlingLeagueHelper.html'),
    path.join(__dirname, '..', 'dist', 'index.html'),
  ];

  for (const file of candidates) {
    try {
      if (file && fs.existsSync(file)) {
        return file;
      }
    } catch {
      // Check next candidate
    }
  }
  return null;
}

function resolveWindowIcon() {
  const installDir = getInstallDir();
  const candidates = [
    path.join(installDir, 'icon.ico'),
    path.join(process.resourcesPath || '', 'icon.ico'),
    path.join(__dirname, 'assets', 'icon.ico'),
    path.join(__dirname, 'assets', 'icon.png'),
  ];

  for (const candidate of candidates) {
    try {
      if (candidate && fs.existsSync(candidate)) {
        return candidate;
      }
    } catch {
      // Ignore
    }
  }
  return undefined;
}

function readInstalledVersion() {
  const installDir = getInstallDir();
  const candidates = [
    path.join(installDir, 'version.json'),
    path.join(process.resourcesPath || '', 'version.json'),
    path.join(__dirname, 'version.json'),
  ];

  for (const file of candidates) {
    try {
      if (file && fs.existsSync(file)) {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (parsed && typeof parsed.latestVersion === 'string') {
          return parsed.latestVersion;
        }
      }
    } catch {
      // Ignore
    }
  }
  return '1.0.14';
}

function createMainWindow() {
  const iconPath = resolveWindowIcon();
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Bowling League Helper',
    icon: iconPath,
    autoHideMenuBar: true,
    backgroundColor: '#f8fafc',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.on('close', (event) => {
    if (allowWindowClose) return;
    event.preventDefault();

    if (closeRequestInFlight) return;
    closeRequestInFlight = true;
    mainWindow.webContents.send('desktop:request-close-save');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const entryHtml = resolveAppHtmlEntry();
  if (entryHtml) {
    mainWindow.loadFile(entryHtml);
  } else {
    mainWindow.loadURL('http://localhost:3000');
  }
}

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ============================================================================
// IPC HANDLERS: Real Folder Updates, Dated Backups & Safe Close-on-Save
// ============================================================================

ipcMain.handle('desktop:get-info', () => {
  const cfg = readDesktopConfig();
  return {
    isDesktopApp: true,
    installDir: getInstallDir(),
    oneDriveDir: detectPreferredOneDriveDir(),
    desktopVersion: readInstalledVersion(),
    lastSaveFilePath: cfg.lastSaveFilePath || '',
    lastSavedAt: cfg.lastSavedAt || null,
    lastSaveExists: Boolean(cfg.lastSaveFilePath && fs.existsSync(cfg.lastSaveFilePath)),
  };
});

ipcMain.handle('desktop:save-backup-dated', async (_evt, { jsonText, defaultFilename }) => {
  try {
    const cfg = readDesktopConfig();
    const startDir =
      (cfg.lastSaveFilePath && fs.existsSync(path.dirname(cfg.lastSaveFilePath))
        ? path.dirname(cfg.lastSaveFilePath)
        : null) || detectPreferredOneDriveDir();

    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Dated Bowling League Backup',
      defaultPath: path.join(startDir, defaultFilename),
      buttonLabel: 'Save Backup File',
      filters: [
        { name: 'Bowling League Save File (*.json)', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return { saved: false, canceled: true };
    }

    atomicWriteFileSync(result.filePath, jsonText);
    const savedAt = new Date().toISOString();
    writeDesktopConfig({
      lastSaveFilePath: result.filePath,
      lastSavedAt: savedAt,
    });

    return {
      saved: true,
      canceled: false,
      filePath: result.filePath,
      filename: path.basename(result.filePath),
      savedAt,
    };
  } catch (err) {
    return {
      saved: false,
      canceled: false,
      error: err && err.message ? err.message : 'Failed to write backup file.',
    };
  }
});

ipcMain.handle('desktop:attempt-close-with-save', async (_evt, { jsonText }) => {
  const cfg = readDesktopConfig();
  const targetPath = (cfg.lastSaveFilePath || '').trim();

  if (!targetPath || !fs.existsSync(targetPath)) {
    closeRequestInFlight = false;
    return {
      ok: false,
      missing: true,
      missingPath: targetPath || null,
      reason: targetPath
        ? `Cannot find your last save file at "${targetPath}".`
        : 'No save file location has been selected yet.',
    };
  }

  try {
    atomicWriteFileSync(targetPath, jsonText);
    writeDesktopConfig({
      lastSaveFilePath: targetPath,
      lastSavedAt: new Date().toISOString(),
    });
    allowWindowClose = true;
    closeRequestInFlight = false;
    if (mainWindow) {
      mainWindow.destroy();
    }
    return { ok: true, savedPath: targetPath };
  } catch (err) {
    closeRequestInFlight = false;
    return {
      ok: false,
      missing: true,
      missingPath: targetPath,
      reason: err && err.message ? err.message : 'Could not write to last save file.',
    };
  }
});

ipcMain.handle('desktop:pick-new-save-and-close', async (_evt, { jsonText, defaultFilename }) => {
  try {
    const startDir = detectPreferredOneDriveDir();
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Pick Save File Location Before Closing',
      defaultPath: path.join(startDir, defaultFilename),
      buttonLabel: 'Save & Close Program',
      filters: [
        { name: 'Bowling League Save File (*.json)', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || !result.filePath) {
      closeRequestInFlight = false;
      return { closed: false, canceled: true };
    }

    atomicWriteFileSync(result.filePath, jsonText);
    writeDesktopConfig({
      lastSaveFilePath: result.filePath,
      lastSavedAt: new Date().toISOString(),
    });

    allowWindowClose = true;
    closeRequestInFlight = false;
    if (mainWindow) {
      mainWindow.destroy();
    }
    return { closed: true, canceled: false, filePath: result.filePath };
  } catch (err) {
    closeRequestInFlight = false;
    return {
      closed: false,
      canceled: false,
      error: err && err.message ? err.message : 'Could not save to chosen file location.',
    };
  }
});

ipcMain.handle('desktop:force-close-without-saving', () => {
  allowWindowClose = true;
  closeRequestInFlight = false;
  if (mainWindow) {
    mainWindow.destroy();
  }
  return { closed: true };
});

ipcMain.handle('desktop:cancel-close', () => {
  closeRequestInFlight = false;
  return { cancelled: true };
});

ipcMain.handle(
  'desktop:install-update-to-folder',
  async (_evt, { targetVersion, htmlContent, versionJsonContent }) => {
    try {
      const installDir = getInstallDir();
      const updatedTargets = [];

      const htmlTargets = [
        path.join(installDir, 'BowlingLeagueHelper.html'),
        process.resourcesPath ? path.join(process.resourcesPath, 'BowlingLeagueHelper.html') : null,
      ].filter(Boolean);

      for (const htmlFile of htmlTargets) {
        try {
          atomicWriteFileSync(htmlFile, htmlContent);
          updatedTargets.push(htmlFile);
        } catch {
          // Skip read-only fallback targets if primary installDir succeeded
        }
      }

      if (updatedTargets.length === 0) {
        return {
          ok: false,
          error: `Could not write updated program files to ${installDir}. Try running Bowling League Helper as Administrator once or reinstalling into C:\\BowlingLeagueHelper\\.`,
        };
      }

      if (versionJsonContent) {
        const versionTargets = [
          path.join(installDir, 'version.json'),
          process.resourcesPath ? path.join(process.resourcesPath, 'version.json') : null,
        ].filter(Boolean);

        for (const verFile of versionTargets) {
          try {
            atomicWriteFileSync(verFile, versionJsonContent);
          } catch {
            // Ignore secondary target errors
          }
        }
      }

      allowWindowClose = true;
      setTimeout(() => {
        app.relaunch();
        app.exit(0);
      }, 300);

      return {
        ok: true,
        targetVersion,
        installDir,
        updatedTargets,
      };
    } catch (err) {
      return {
        ok: false,
        error: err && err.message ? err.message : 'Failed to update files in installation folder.',
      };
    }
  }
);
