# Bowling League Helper - Dual Codebase Sandbox Documentation

## Overview
This studio workspace contains **both** codebases provided by the user for comparison, testing, and future development without making any modifications to either source file.

---

## File Locations in Workspace
- **Version 1 (Advanced Bowling League Tracker)**: `/public/legacy_tracker.html`
- **Version 2 (Thursday Night Rollers Tracker)**: `/public/legacy_tracker_v2.html`
- **Comparison Studio Sandbox Dashboard**: `/src/App.tsx`
- **Metadata Configuration**: `/metadata.json`

---

## Architecture Comparison

| Capability / Aspect | Version 1 (`legacy_tracker.html`) | Version 2 (`legacy_tracker_v2.html`) |
|---|---|---|
| **Branding & Title** | Advanced Bowling League Tracker | Thursday Night Rollers |
| **Styling & Theme** | Classic Form Layout (Gray Panels) | Modern CSS Variables (`--navy`, `--blue`, rounded cards) |
| **Live Leaderboard** | Side-by-Side Lists | Bar Chart Visual Widget + Stat Counter Grid |
| **Undo System** | Single Last Entry Undo | 30-Level Deep Undo Stack + `Ctrl+Z` Keyboard Shortcut |
| **Local Storage Schema** | Multi-Key (`bowlingDataV6`, `bowlingRosterV1`) | Unified Schema (`tnr_bowling_tracker_v3`) + Migration Adapter |
| **Storage Fault Tolerance** | Basic localStorage write | Safe storage check, toast notices, overwrite guard |
| **Print Output** | Landscape table columns | Landscape print layout with first-place highlights |

---

## How to Test Live Environments
In the AI Studio applet preview:
1. **Split Side-by-Side View**: Compare both running applications side-by-side live in real-time.
2. **Version 1 Only**: Test Version 1 full-screen.
3. **Version 2 Only**: Test Version 2 full-screen.
4. **Feature Matrix**: Review the structural breakdown table.
5. **Direct Browser Links**: You can also open `/legacy_tracker.html` or `/legacy_tracker_v2.html` directly in new browser tabs.
