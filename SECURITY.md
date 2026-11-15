# Security Policy

## Local-First Privacy Architecture

**Bowling League Helper** is designed from the ground up as an offline-first desktop and single-file web application:

- **No Cloud Backend or Accounts:** All league rosters, scores, finances, and schedules are stored locally on the user's computer (`C:\BowlingLeagueHelper\` desktop storage and explicit user-chosen `.json` / `.html` / `.csv` files).
- **No Analytics or Telemetry:** The application contains zero tracking scripts, advertisements, or external data collection endpoints.
- **Isolated Loopback IPC:** When running as an installed Windows desktop program (`BowlingLeagueHelper.exe`), the native host binds strictly to loopback (`127.0.0.1` on an ephemeral local port) and does not expose any network listeners to the LAN or internet.
- **Network Requests:** External network requests occur solely over HTTPS to GitHub (`api.github.com` / `raw.githubusercontent.com`) for checking version manifests (`version.json`) and downloading updated application bundles.

---

## Supported Versions

| Version | Supported |
|---|---|
| `1.0.14` (Current) | :white_check_mark: Yes |
| `< 1.0.14` | :x: Upgrade via built-in updater or `installer.exe` |

---

## Reporting a Vulnerability

If you discover a security issue or vulnerability in the application, installer, or desktop host:

1. **Do not disclose exploit details publicly in general issues** until maintainers have acknowledged and patched the problem.
2. Report privately through **GitHub Security → Report a vulnerability** on the repository (`mkstewart88/BowlingLeagueTracker`), or contact the repository owner directly via GitHub.
3. Include:
   - Affected component (`src/`, `desktop/host/`, or `installer.nsi`) and version
   - Steps to reproduce or minimal proof-of-concept
   - Potential impact and suggested remediation if available

We aim to acknowledge reports within 48 hours and release fixes promptly via the built-in self-updater and updated installer.
