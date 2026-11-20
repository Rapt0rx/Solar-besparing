# Changelog

All notable changes to the Solar savings app. Versions follow MAJOR.MINOR.PATCH:
MAJOR for changes that need a new sheet layout, MINOR for new features or screens, PATCH for fixes.
The current version is in `VERSION`, at the top of the script in `index.html` (`VERSION`) and in `sw.js`.
The Google Sheet keeps its own history on its "Change log" tab.

## 1.3.0 - 2026-11-20
- Demo data is now sample numbers, so no personal figures are stored in the public repo.
- The typical-day chart shows the dates it covers; the home screen shows the date the data runs to.
- Version number in the app footer; the service worker cache is named after the version.
- Switching back to the app only refreshes the data after 5 minutes.
- Added CHANGELOG.md and VERSION.

## 1.2.1 - 2026-11-20
- Fix: months with negligible use (placeholder values) are ignored, so Home no longer shows December 2027.

## 1.2.0 - 2026-11-20
- Four pages with a tab bar: Home, Days, Months, Battery.
- Month-by-month stats: savings, solar, home use, grid, average solar a day, best day, share covered.

## 1.1.0 - 2026-11-18
- Redesign: payback shown as a charging battery, tap-through daily chart, ledger of totals, typical day, battery range rows.

## 1.0.0 - 2026-11-18
- First GitHub Pages release: live data from the published "App data" CSV, offline copy, installable (manifest, service worker, icons).

## How to release a change
1. Edit the files and decide the new number (patch for a fix, minor for a feature).
2. Change `VERSION` in `VERSION`, `index.html` and `sw.js` to the same number.
3. Add an entry at the top of this file.
4. Upload the changed files to the repo and commit with the version in the message, e.g. "v1.3.1: fix ...".
