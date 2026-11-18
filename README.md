# MEV Detector documentation portal

A static site. No install and no build step.

## Run in VS Code
1. Open this folder in VS Code (File > Open Folder).
2. Install the "Live Server" extension, right-click `index.html`, choose "Open with Live Server".
   Or in the VS Code terminal: `python -m http.server 8000` and open http://localhost:8000
   (Double-clicking `index.html` also works.)

## Files
- `index.html`        all pages (Overview, Quick start, Architecture, Rules, Scoring, Contract, Results, Plots, Limits, Code map, FAQ, About)
- `css/style.css`     styles, light and dark themes
- `js/app.js`         navigation, search (Ctrl+K), score calculator, charts
- `js/data.js`        numbers taken from your results_live CSV files
- `assets/plots/`     the monitor's PNG plots (CPU and memory plots not included)

## Updating the numbers
`js/data.js` holds the run results. Edit it, or regenerate it from new CSVs.
Keep your Alchemy key out of this folder.
