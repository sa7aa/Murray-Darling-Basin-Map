# The Farmer's Basin — Map Prototype Setup

## 1. Folder structure

Put these files in your `Maps` directory like this:

```
Maps/
├── index.html              (the page shell)
├── map.js                  (D3 rendering + click logic)
├── filter_and_join.js       (run once with Node to prepare data)
├── mdb_wrpa.geojson          (the full 19-region file you download)
└── mdb_selected_regions.geojson   (generated — see step 3)
```

## 2. Get the full boundary file

1. Go to https://data.gov.au/data/dataset/murray-darling-basin-water-resource-plan-areas-surface-water
2. Download the **GeoJSON** resource (not the WFS link)
3. Save it into your `Maps` folder as `mdb_wrpa.geojson`

## 3. Filter it down to your four regions

You need Node.js installed (check with `node -v` in your terminal, if
that fails, install Node from nodejs.org first).

From inside the `Maps` folder, run:

```
node filter_and_join.js mdb_wrpa.geojson
```

This creates `mdb_selected_regions.geojson`, a smaller file containing
only Murrumbidgee, Condamine-Balonne, Victorian Murray, and South
Australian River Murray, each with exposure data attached. Open
`filter_and_join.js` any time you want to update those numbers, edit
the `selectedRegions` object near the top of the file, then re-run
the command.

## 4. Run it in a browser

Browsers block a webpage from loading a local file (like your
GeoJSON) directly off disk for security reasons, so you can't just
double-click `index.html`. You need a tiny local server instead.
Easiest option, if you have Node installed:

```
npx serve .
```

This will print a local address, usually something like
`http://localhost:3000`. Open that in your browser and you should
see the map, with the two side cards (Water Security Snapshot and
Policy Comparison) updating when you click a region or switch
between Current Policy and Proposed Policy.

If `npx serve .` doesn't work, an alternative that comes with Python
(already installed on most Macs and many PCs):

```
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

## 5. What to expect

- Four coloured regions on the map, red/orange for higher exposure,
  green for lower, grey for Condamine-Balonne (since it uses
  floodplain harvesting rather than a standard allocation
  percentage, so it can't be placed on the same red-to-green scale)
- Clicking a region highlights it with a blue border and updates
  both cards on the right
- Switching between "Current Policy" and "Proposed Policy" re-colours
  the whole map and updates whichever region is currently selected

## 6. Known gaps to fix before presenting

- All numbers in `filter_and_join.js` are illustrative placeholders
  from team discussion, not yet pulled from the real ABARES dataset
- The map currently has no basemap or town labels, it's just the
  four coloured region shapes on a white background. If you want
  geographic context (state borders, town names), that would need
  either a background image or a proper basemap layer added
  separately
- Styling in `index.html` is a starting point, matched loosely to
  your Figma blue/white palette, but not pulled directly from your
  actual design tokens
