# Contributing to Bowling League Helper

Thank you for your interest in contributing to **Bowling League Helper**! This guide covers setting up a local environment on **Windows 11** or **Linux**, code organization, testing standards, and submitting pull requests.

---

## Development Setup

### Prerequisites
- **Node.js** `20+` and `npm` (required for UI builds, tests, and running the Linux desktop host)
- Optional (only needed when rebuilding `BowlingLeagueHelper.exe` and `installer.exe` for Windows 11):
  - **On Windows 11:** MinGW-w64 (`g++`, `windres`) and [NSIS 3.x](https://nsis.sourceforge.io/)
  - **On Linux (cross-compilation):** `mingw-w64` (`x86_64-w64-mingw32-g++`, `x86_64-w64-mingw32-windres`) and `nsis` (`makensis`)

### Quick Start

```bash
# Install dependencies
npm install

# Start the development server at http://localhost:3000
npm run dev
```

---

## Testing & Verification

Before opening a pull request, ensure TypeScript types, unit tests, and the single-file production bundle all pass cleanly:

```bash
# Run TypeScript type check
npm run lint

# Run unit tests (Node test runner + tsx)
npx tsx --test src/utils/bowlingLogic.test.ts

# Verify Vite single-file build succeeds
npm run build
```

If your change alters the frontend UI, native Windows 11 host (`desktop/host/main.cpp`), or NSIS installer (`desktop/installer/installer.nsi`), regenerate the bundled HTML and root `installer.exe`:

```bash
node desktop/scripts/build-installer.mjs
```

To verify the Linux desktop host locally after building:

```bash
BOWLING_INSTALL_DIR=. node desktop/host/linux-host.mjs
```

---

## Coding Guidelines

- **TypeScript Strictness:** Keep domain types updated in `src/types/bowling.ts` and avoid `any`.
- **Pure Logic Separation:** Keep scoring, handicap math, bracket elimination, treasury math, schedule generation, and backup serialization inside `src/utils/` so they remain unit-testable outside React components.
- **Tailwind CSS:** Style components using Tailwind utility classes rather than separate CSS files.
- **Zero External Telemetry:** Maintain offline-first design—only contact GitHub during explicit or startup update manifest checks (`githubUpdater.ts`).

---

## Pull Request Process

1. Create a feature or fix branch from `main`.
2. Add or update unit tests in `src/utils/bowlingLogic.test.ts` for any logic changes.
3. Update `version.json` and `CHANGELOG.md` when preparing a release increment.
4. Fill out [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md) when submitting your PR.
