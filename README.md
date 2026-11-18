# Neuroatlas — interactive 3D brain

Explore a 3D brain, click regions to see their functions, and watch neurotransmitters and hormones flow along their pathways.

## Run it
No build step. Three.js loads from a CDN, so you need an internet connection.

- **VS Code:** install the "Live Server" extension, right-click `index.html` → "Open with Live Server".
- **Or from a terminal:** `python3 -m http.server 8000`, then open http://localhost:8000

## Files
- `index.html`: page layout (panels, buttons)
- `css/style.css`: all styling
- `js/data.js`: brain regions (`REGIONS`) and chemicals (`CHEMS`), so edit text here
- `js/main.js`: 3D scene, brain geometry, chemical pathways (`PATHS`), interaction

## Adding things
- **New chemical:** add an entry to `CHEMS` in `data.js` and a matching function in `PATHS` in `main.js` (a list of 3D waypoint paths).
- **New structure:** add it to `REGIONS`, then create its mesh in `main.js` with `ellip(...)` or `tube(...)`.

Coordinates: x = left(−)/right(+), y = up, z = front(+)/back(−).
