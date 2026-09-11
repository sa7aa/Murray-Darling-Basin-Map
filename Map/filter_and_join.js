// filter_and_join.js
// Usage: node filter_and_join.js path/to/mdb_wrpa.geojson
//
// Filters the full 19-region GeoJSON down to your four selected
// contrast regions, and attaches exposure data to each feature's
// properties so the output file is ready to drop straight into D3.

const fs = require("fs");

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node filter_and_join.js path/to/mdb_wrpa.geojson");
  process.exit(1);
}

const raw = fs.readFileSync(filePath, "utf8");
const geojson = JSON.parse(raw);

// Your four selected contrast regions, one per state.
// Fill in real reliability/risk/summary values as you confirm them
// against the ABARES dataset and your written brief.
const selectedRegions = {
  "Murrumbidgee": {
    state: "NSW",
    current: { reliability: 35, risk: "High", volatility: "High", gviap: "Declining (rice)" },
    proposed: { reliability: 58, risk: "Moderate", volatility: "Moderate", gviap: "Stabilising" },
    dominantCrop: "Rice, cotton",
    entitlementType: "General security",
  },
  "Condamine-Balonne": {
    state: "QLD",
    current: { reliability: null, risk: "High", volatility: "High", gviap: null },
    proposed: { reliability: null, risk: "Moderate", volatility: null, gviap: null },
    dominantCrop: "Cotton",
    entitlementType: "Floodplain harvesting / works-based licence",
  },
  "Victorian Murray": {
    state: "VIC",
    current: { reliability: 88, risk: "Low", volatility: "Low", gviap: "Growing (almonds)" },
    proposed: { reliability: 90, risk: "Low", volatility: "Low", gviap: "Growing (almonds)" },
    dominantCrop: "Almonds, grapevine",
    entitlementType: "High security",
  },
  "South Australian River Murray": {
    state: "SA",
    current: { reliability: 82, risk: "Low", volatility: "Low", gviap: "Growing (almonds/fruit)" },
    proposed: { reliability: 85, risk: "Low", volatility: "Low", gviap: "Growing (almonds/fruit)" },
    dominantCrop: "Almonds, fruit",
    entitlementType: "High security",
  },
};

const filteredFeatures = geojson.features
  .filter(f => selectedRegions.hasOwnProperty(f.properties.SWWRPANAME))
  .map(f => {
    const data = selectedRegions[f.properties.SWWRPANAME];
    return {
      ...f,
      properties: {
        ...f.properties,
        exposure: data,
      },
    };
  });

if (filteredFeatures.length !== Object.keys(selectedRegions).length) {
  console.warn(
    `Warning: expected ${Object.keys(selectedRegions).length} regions, found ${filteredFeatures.length}.` +
    ` Double check the SWWRPANAME spelling matches exactly.`
  );
}

const output = {
  type: "FeatureCollection",
  features: filteredFeatures,
};

const outPath = "mdb_selected_regions.geojson";
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`Wrote ${filteredFeatures.length} regions to ${outPath}`);
filteredFeatures.forEach(f => console.log(` - ${f.properties.SWWRPANAME} (${f.properties.STATE})`));
