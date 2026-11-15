#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const desktopDir = path.join(rootDir, 'desktop');
const hostDir = path.join(desktopDir, 'host');
const distHostDir = path.join(desktopDir, 'dist-host');

function run(cmd, args, cwd = rootDir) {
  console.log(`> ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, { cwd, stdio: 'inherit' });
}

function commandExists(cmd) {
  try {
    const checker = process.platform === 'win32' ? 'where' : 'which';
    execFileSync(checker, [cmd], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

fs.mkdirSync(distHostDir, { recursive: true });

// 1. Sync HTML & version manifests across root, public, and desktop directories
const builtHtml = path.join(rootDir, 'dist', 'index.html');
if (fs.existsSync(builtHtml)) {
  for (const target of [
    path.join(rootDir, 'BowlingLeagueHelper.html'),
    path.join(rootDir, 'public', 'BowlingLeagueHelper.html'),
    path.join(rootDir, 'public', 'standalone_template.html'),
    path.join(desktopDir, 'BowlingLeagueHelper.html'),
  ]) {
    fs.copyFileSync(builtHtml, target);
  }
}

const rootVersionJson = path.join(rootDir, 'version.json');
if (fs.existsSync(rootVersionJson)) {
  for (const target of [
    path.join(rootDir, 'public', 'version.json'),
    path.join(desktopDir, 'version.json'),
  ]) {
    fs.copyFileSync(rootVersionJson, target);
  }
}

// 2. Compile Win32 resources & native 64-bit desktop host executable
const isWindows = process.platform === 'win32';
const windresCmd = isWindows ? 'windres' : 'x86_64-w64-mingw32-windres';
const gxxCmd = isWindows ? 'g++' : 'x86_64-w64-mingw32-g++';
const stripCmd = isWindows ? 'strip' : 'x86_64-w64-mingw32-strip';

if (!commandExists(windresCmd) || !commandExists(gxxCmd)) {
  throw new Error(
    `Missing MinGW-w64 toolchain (${windresCmd} / ${gxxCmd}). Install mingw-w64 to compile BowlingLeagueHelper.exe.`
  );
}

const resFile = path.join(distHostDir, 'resource.res');
const exeFile = path.join(distHostDir, 'BowlingLeagueHelper.exe');

run(windresCmd, [
  '-I',
  hostDir,
  path.join(hostDir, 'resource.rc'),
  '-O',
  'coff',
  '-o',
  resFile,
]);

run(gxxCmd, [
  '-O2',
  '-std=c++17',
  '-Wall',
  '-Wextra',
  '-municode',
  '-mwindows',
  '-static',
  '-static-libgcc',
  '-static-libstdc++',
  path.join(hostDir, 'main.cpp'),
  resFile,
  '-o',
  exeFile,
  '-lws2_32',
  '-lcomdlg32',
  '-lshell32',
  '-lole32',
  '-luuid',
]);

if (commandExists(stripCmd)) {
  run(stripCmd, ['--strip-all', exeFile]);
}

// 3. Compile NSIS installer directly to repository root (/installer.exe)
const makensisCandidates = isWindows
  ? [
      'C:\\Program Files (x86)\\NSIS\\makensis.exe',
      'C:\\Program Files\\NSIS\\makensis.exe',
      'makensis.exe',
    ]
  : ['makensis'];

const makensisCmd = makensisCandidates.find(
  (c) => fs.existsSync(c) || commandExists(c)
);

if (!makensisCmd) {
  throw new Error('NSIS (makensis) is required to build installer.exe.');
}

const installerScript = path.join(desktopDir, 'installer', 'installer.nsi');
const rootInstallerOut = path.join(rootDir, 'installer.exe');

run(
  makensisCmd,
  [isWindows ? `/DOUT_FILE=${rootInstallerOut}` : `-DOUT_FILE=${rootInstallerOut}`, installerScript],
  path.dirname(installerScript)
);

const stat = fs.statSync(rootInstallerOut);
console.log(
  `\nBuilt ${rootInstallerOut} (${(stat.size / (1024 * 1024)).toFixed(2)} MB)`
);
