#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile, execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const INSTALL_DIR = process.env.BOWLING_INSTALL_DIR || path.resolve(__dirname);
const CONFIG_FILE = path.join(INSTALL_DIR, 'bowling-desktop-config.json');

let pendingClose = false;
let stagedSavePayload = '';
const sseClients = new Set();

function readConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        return {
          lastSaveFilePath: parsed.lastSaveFilePath || '',
          lastSavedAt: parsed.lastSavedAt || null,
        };
      }
    }
  } catch {
    // Ignore malformed config
  }
  return { lastSaveFilePath: '', lastSavedAt: null };
}

function writeConfig(partial) {
  const next = {
    ...readConfig(),
    ...partial,
    updatedAt: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  atomicWrite(CONFIG_FILE, JSON.stringify(next, null, 2));
  return next;
}

function atomicWrite(targetPath, content) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const tmpPath = `${targetPath}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmpPath, content, 'utf8');
  fs.renameSync(tmpPath, targetPath);
}

function getDocumentsDir() {
  const docs = path.join(os.homedir(), 'Documents');
  return fs.existsSync(docs) ? docs : os.homedir();
}

function readInstalledVersion() {
  try {
    const raw = fs.readFileSync(path.join(INSTALL_DIR, 'version.json'), 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.latestVersion === 'string') {
      return parsed.latestVersion;
    }
  } catch {
    // Fallback
  }
  return '1.0.14';
}

function commandExists(cmd) {
  try {
    execFileSync('which', [cmd], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function showLinuxSaveDialog(title, defaultDir, defaultFilename) {
  const initialPath = path.join(defaultDir, defaultFilename);
  return new Promise((resolve) => {
    if (commandExists('zenity')) {
      execFile(
        'zenity',
        [
          '--file-selection',
          '--save',
          '--confirm-overwrite',
          `--title=${title}`,
          `--filename=${initialPath}`,
          '--file-filter=Bowling League Save (*.json) | *.json',
        ],
        (err, stdout) => {
          if (err) {
            resolve({ canceled: true });
            return;
          }
          const chosen = stdout.trim();
          resolve(chosen ? { canceled: false, filePath: chosen } : { canceled: true });
        }
      );
      return;
    }

    if (commandExists('kdialog')) {
      execFile(
        'kdialog',
        ['--getsavefilename', initialPath, '*.json |Bowling League Save (*.json)'],
        (err, stdout) => {
          if (err) {
            resolve({ canceled: true });
            return;
          }
          const chosen = stdout.trim();
          resolve(chosen ? { canceled: false, filePath: chosen } : { canceled: true });
        }
      );
      return;
    }

    // Headless / minimal environment fallback without graphical file chooser: write to Documents
    resolve({ canceled: false, filePath: initialPath });
  });
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > 32 * 1024 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function shutdownSoon(relaunchUrl) {
  setTimeout(() => {
    for (const client of sseClients) {
      try {
        client.end();
      } catch {
        // Ignore
      }
    }
    if (relaunchUrl) {
      const child = spawn(process.execPath, [__filename, '--no-browser'], {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env, BOWLING_INSTALL_DIR: INSTALL_DIR },
      });
      child.unref();
    }
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 300);
  }, 150);
}

const server = http.createServer(async (req, res) => {
  const urlPath = (req.url || '/').split('?')[0];

  if (req.method === 'GET' && urlPath === '/api/desktop/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(': connected\n\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  if (req.method === 'POST' && urlPath === '/api/desktop/close-ack') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'POST' && urlPath === '/api/desktop/stage-state') {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const rawBody = Buffer.concat(chunks).toString('utf8');
      if (rawBody) stagedSavePayload = rawBody;
      sendJson(res, 200, { ok: true });
    } catch {
      sendJson(res, 200, { ok: false });
    }
    return;
  }

  if (req.method === 'POST' && urlPath === '/api/desktop/autosave-beacon') {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      let rawBody = Buffer.concat(chunks).toString('utf8');
      if (rawBody.includes('"useStaged"') && stagedSavePayload) {
        rawBody = stagedSavePayload;
      }
      const cfg = readConfig();
      const target = (cfg.lastSaveFilePath || '').trim();
      if (target && fs.existsSync(target) && rawBody) {
        atomicWrite(target, rawBody);
        writeConfig({ lastSaveFilePath: target, lastSavedAt: new Date().toISOString() });
        sendJson(res, 200, { ok: true });
        return;
      }
      sendJson(res, 200, { ok: false });
    } catch {
      sendJson(res, 200, { ok: false });
    }
    return;
  }

  if (req.method === 'GET' && urlPath === '/api/desktop/pending-close') {
    const wasPending = pendingClose;
    pendingClose = false;
    sendJson(res, 200, { pending: wasPending });
    return;
  }

  if (req.method === 'GET' && urlPath === '/api/desktop/info') {
    const cfg = readConfig();
    sendJson(res, 200, {
      isDesktopApp: true,
      installDir: INSTALL_DIR,
      defaultSaveDir: getDocumentsDir(),
      desktopVersion: readInstalledVersion(),
      lastSaveFilePath: cfg.lastSaveFilePath || '',
      lastSavedAt: cfg.lastSavedAt || null,
      lastSaveExists: Boolean(cfg.lastSaveFilePath && fs.existsSync(cfg.lastSaveFilePath)),
    });
    return;
  }

  if (req.method === 'GET' && urlPath === '/api/desktop/load-save') {
    const cfg = readConfig();
    const target = (cfg.lastSaveFilePath || '').trim();
    if (!target || !fs.existsSync(target)) {
      sendJson(res, 200, { ok: false, exists: false, filePath: target || '' });
      return;
    }
    try {
      const jsonText = fs.readFileSync(target, 'utf8');
      if (jsonText) stagedSavePayload = jsonText;
      sendJson(res, 200, { ok: true, exists: true, filePath: target, jsonText });
    } catch (err) {
      sendJson(res, 200, {
        ok: false,
        exists: false,
        filePath: target,
        error: err?.message || 'Could not read save file.',
      });
    }
    return;
  }

  if (req.method === 'POST' && urlPath === '/api/desktop/quick-save') {
    try {
      const { jsonText } = await readJsonBody(req);
      const cfg = readConfig();
      const target = (cfg.lastSaveFilePath || '').trim();
      if (!target || !fs.existsSync(target)) {
        sendJson(res, 200, { saved: false, missing: true });
        return;
      }
      const payload = jsonText || stagedSavePayload || '';
      atomicWrite(target, payload);
      if (payload) stagedSavePayload = payload;
      const savedAt = new Date().toISOString();
      writeConfig({ lastSaveFilePath: target, lastSavedAt: savedAt });
      sendJson(res, 200, {
        saved: true,
        missing: false,
        filePath: target,
        filename: path.basename(target),
        savedAt,
      });
    } catch (err) {
      sendJson(res, 200, { saved: false, error: err?.message || 'Quick save failed.' });
    }
    return;
  }

  if (req.method === 'POST' && urlPath === '/api/desktop/clear-save-link') {
    writeConfig({ lastSaveFilePath: '', lastSavedAt: null });
    stagedSavePayload = '';
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'POST' && urlPath === '/api/desktop/save-backup') {
    try {
      const { jsonText, defaultFilename } = await readJsonBody(req);
      const cfg = readConfig();
      const startDir =
        cfg.lastSaveFilePath && fs.existsSync(path.dirname(cfg.lastSaveFilePath))
          ? path.dirname(cfg.lastSaveFilePath)
          : getDocumentsDir();

      const dlg = await showLinuxSaveDialog(
        'Save Bowling League File',
        startDir,
        defaultFilename || 'BowlingLeagueTrackerSave.json'
      );
      if (dlg.canceled || !dlg.filePath) {
        sendJson(res, 200, { saved: false, canceled: true });
        return;
      }
      atomicWrite(dlg.filePath, jsonText || '');
      const savedAt = new Date().toISOString();
      writeConfig({ lastSaveFilePath: dlg.filePath, lastSavedAt: savedAt });
      sendJson(res, 200, {
        saved: true,
        canceled: false,
        filePath: dlg.filePath,
        filename: path.basename(dlg.filePath),
        savedAt,
      });
    } catch (err) {
      sendJson(res, 200, { saved: false, error: err?.message || 'Save failed.' });
    }
    return;
  }

  if (req.method === 'POST' && urlPath === '/api/desktop/close-attempt') {
    try {
      const { jsonText } = await readJsonBody(req);
      const cfg = readConfig();
      const target = (cfg.lastSaveFilePath || '').trim();
      if (!target || !fs.existsSync(target)) {
        pendingClose = false;
        sendJson(res, 200, {
          ok: false,
          missing: true,
          missingPath: target || null,
          reason: target
            ? `Cannot find your last save file at "${target}".`
            : 'No save file location has been selected yet.',
        });
        return;
      }
      atomicWrite(target, jsonText || '');
      writeConfig({ lastSaveFilePath: target, lastSavedAt: new Date().toISOString() });
      sendJson(res, 200, { ok: true, savedPath: target });
      shutdownSoon(false);
    } catch (err) {
      sendJson(res, 200, {
        ok: false,
        missing: true,
        reason: err?.message || 'Could not write to last save file.',
      });
    }
    return;
  }

  if (req.method === 'POST' && urlPath === '/api/desktop/pick-save-and-close') {
    try {
      const { jsonText, defaultFilename } = await readJsonBody(req);
      const dlg = await showLinuxSaveDialog(
        'Pick Save File Location Before Closing',
        getDocumentsDir(),
        defaultFilename || 'BowlingLeagueTrackerSave.json'
      );
      if (dlg.canceled || !dlg.filePath) {
        sendJson(res, 200, { closed: false, canceled: true });
        return;
      }
      atomicWrite(dlg.filePath, jsonText || '');
      writeConfig({ lastSaveFilePath: dlg.filePath, lastSavedAt: new Date().toISOString() });
      sendJson(res, 200, { closed: true, canceled: false, filePath: dlg.filePath });
      shutdownSoon(false);
    } catch (err) {
      sendJson(res, 200, { closed: false, error: err?.message || 'Could not save file.' });
    }
    return;
  }

  if (req.method === 'POST' && urlPath === '/api/desktop/force-close') {
    pendingClose = false;
    sendJson(res, 200, { closed: true });
    shutdownSoon(false);
    return;
  }

  if (req.method === 'POST' && urlPath === '/api/desktop/cancel-close') {
    pendingClose = false;
    sendJson(res, 200, { cancelled: true });
    return;
  }

  if (req.method === 'POST' && urlPath === '/api/desktop/install-update') {
    try {
      const { targetVersion, htmlContent, versionJsonContent } = await readJsonBody(req);
      if (!htmlContent || !htmlContent.includes('id="root"')) {
        sendJson(res, 200, { ok: false, error: 'Downloaded HTML bundle is invalid.' });
        return;
      }
      const htmlTarget = path.join(INSTALL_DIR, 'BowlingLeagueHelper.html');
      atomicWrite(htmlTarget, htmlContent);
      if (versionJsonContent) {
        atomicWrite(path.join(INSTALL_DIR, 'version.json'), versionJsonContent);
      }
      sendJson(res, 200, {
        ok: true,
        targetVersion,
        installDir: INSTALL_DIR,
        updatedTargets: [htmlTarget],
        needsPageReload: true,
      });
      setTimeout(() => {
        shutdownSoon(true);
      }, 400);
    } catch (err) {
      sendJson(res, 200, { ok: false, error: err?.message || 'Update failed.' });
    }
    return;
  }

  if (req.method === 'GET' && (urlPath === '/' || urlPath === '/index.html' || urlPath === '/BowlingLeagueHelper.html')) {
    const htmlFile = path.join(INSTALL_DIR, 'BowlingLeagueHelper.html');
    if (!fs.existsSync(htmlFile)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('BowlingLeagueHelper.html was not found in the program folder.');
      return;
    }
    let html = fs.readFileSync(htmlFile, 'utf8');
    const inject = '<script>window.__BOWLING_NATIVE_HOST__=true;</script>';
    html = html.includes('<head>')
      ? html.replace('<head>', `<head>${inject}`)
      : `${inject}${html}`;
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(html);
    return;
  }

  if (req.method === 'GET' && urlPath === '/version.json') {
    const verFile = path.join(INSTALL_DIR, 'version.json');
    if (fs.existsSync(verFile)) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(fs.readFileSync(verFile, 'utf8'));
    } else {
      sendJson(res, 404, {});
    }
    return;
  }

  if (req.method === 'GET' && urlPath === '/bowling-icon.png') {
    const iconFile = path.join(INSTALL_DIR, 'bowling-icon.png');
    if (fs.existsSync(iconFile)) {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(fs.readFileSync(iconFile));
    } else {
      res.writeHead(404);
      res.end();
    }
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

function openLinuxBrowserWindow(appUrl) {
  if (process.argv.includes('--no-browser')) return;
  const profileDir = path.join(INSTALL_DIR, 'BrowserProfile');
  fs.mkdirSync(profileDir, { recursive: true });

  const browsers = ['google-chrome', 'chromium', 'chromium-browser', 'microsoft-edge'];
  const chosen = browsers.find((b) => commandExists(b));
  if (chosen) {
    const child = spawn(
      chosen,
      [`--app=${appUrl}`, `--user-data-dir=${profileDir}`, '--class=BowlingLeagueHelper', '--new-window'],
      { detached: true, stdio: 'ignore' }
    );
    child.on('exit', () => {
      setTimeout(() => {
        if (sseClients.size === 0) shutdownSoon(false);
      }, 600);
    });
    child.unref();
    return;
  }
  if (commandExists('xdg-open')) {
    const child = spawn('xdg-open', [appUrl], { detached: true, stdio: 'ignore' });
    child.unref();
  }
}

server.listen(0, '127.0.0.1', () => {
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 3000;
  const appUrl = `http://127.0.0.1:${port}/`;
  console.log(`Bowling League Helper Linux Desktop Host running at ${appUrl}`);
  openLinuxBrowserWindow(appUrl);
});
