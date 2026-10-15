# The Farmer's Basin — Map Prototype Setup

## Current dashboard filters

`data/Australia.geojson` supplies the muted background outline (Natural Earth
1:110m Admin 0 Countries, public domain). Source:
https://www.naturalearthdata.com/downloads/110m-cultural-vectors/110m-admin-0-countries/
It is bundled by `node Map/build-data.cjs` and rendered behind the basin using
the same projection and zoom transform. The initial view and reset fit Australia.

Generated GeoJSON files in `Map/data` (rebuild with `node Map/build-data.cjs`):

- `MDB_Towns.geojson`: summary towns as Points, including state, region, and river properties.
- `MDB_Regions.geojson`: summary regions as MultiPoints of their member towns, with town lists and states. These are not boundary polygons.
- `MDB_Water_Resource_Regions.geojson`: the 19 supplied water resource plan area polygons, distinct from summary regions.
- `MDB_Summary.geojson`: the town collection used by the dashboard, retained for compatibility.
Open `map.html` at the repository root. The top filter panel uses
`data/MDB_Summary.json` for State, Town, Region, Tributary River, and Major River.
Options narrow together; Clear filters restores all towns. The summary displays
the matching town count. The water resource region selector continues to
control the sample farmer panels independently.

The Community Organisation dropdown uses `dc:title` from
`data/MDB_Community_Data_v5_PLAY.json`. Records are linked to towns using
`geo:nearestTown` and `geo:State`. Selecting an organisation filters its town;
geographic filters narrow the organisation options. Each community organisation has a green map symbol, spaced around its nearest town;
these are not exact office locations. Hovering, focusing, or tapping a symbol
opens that organisation's card with its website, subject, description, and any
supplied address. Cards contain no organisation selector. Escape or the close
button dismisses the card; filtering and zooming also dismiss it.
Clear filters resets the organisation selection.
Organisation cards also show `geo:contactAddress` when supplied. The town is
labelled separately as a nearby location. Cards request the website's own
locally discovered logo or site icon first, then `/favicon.ico`, with the generic
building illustration if neither loads. Refresh downloaded images with
`node --use-system-ca Map/discover-logos.cjs`, then `node Map/build-data.cjs`.
The discovery script checks website structured logo metadata, logo images, and
declared browser/touch icons. `data/organisation-logos.json` records source URLs
and local image paths; assets are saved in `assets/img/organisation-logos`.

Run `node Map/build-data.cjs` from the repository root after editing source data.
This joins summary towns to coordinates in `data/MDB_Towns_Rivers.json`, writes
`data/MDB_Summary.geojson`, and bundles towns, boundaries, and farmer profiles in
`dashboard-data.js`. The dashboard can load this bundle directly from disk.
Summary regions and water resource plan areas have different names and meanings;
filtered boundaries are highlighted using town coordinates. Town markers show
town locations, not individual asset locations. River dropdowns filter town
records; the supplied boundary file does not contain river line geometry.

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
