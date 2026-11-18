# Solar savings app (GitHub Pages + Google Sheets)

## A. Put the app on GitHub Pages
1. Create a GitHub repository (e.g. `solar`).
2. Upload ALL files in this folder to the repository root (index.html, manifest.json, sw.js, three icon PNGs).
3. Settings -> Pages -> Deploy from a branch -> `main` / `(root)` -> Save.
4. Wait about a minute. Your app is at `https://<your-username>.github.io/solar/`.

## B. Connect your Google Sheet
1. Upload `Solar_besparing_v2_met_battery_data.xlsx` to Google Drive, open it, and choose File -> Save as Google Sheets.
2. Open the tab **App data** (all values there are formulas, so it updates when you add days).
3. File -> Share -> Publish to web -> pick **App data** (not "Entire document") and **Comma-separated values (.csv)** -> Publish. Copy the link.
4. Open your app, tap **Set sheet link**, paste the link. (Or paste it into `CSV_URL` near the top of the script in index.html.)

## C. Add to your phone's home screen
iPhone: Safari -> Share -> Add to Home Screen. Android: Chrome menu -> Install app / Add to Home screen.

## Notes
- Without a link the app shows demo data. If the sheet cannot be reached it shows the last saved copy ("Offline").
- Privacy: GitHub Pages is public, and a published-to-web sheet is readable by anyone with the long link. To keep the installed cost out of the app, clear Solar Dashboard F5 (or the "cost" cell in App data).
- Adding days: paste new Solar Assistant totals into the **Solar Assistant data** sheet and copy the formulas in columns I, M, N down. App data covers rows 2-300.
- Google may take a few minutes to refresh the published CSV after you edit the sheet.
