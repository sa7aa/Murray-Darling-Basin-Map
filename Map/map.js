// map.js
// Renders the four selected MDB regions as an interactive SVG map.
// Clicking a region updates the Data column (Water Security Snapshot,
// Policy Comparison, Economic Impact) using the exposure data attached
// to each feature's properties by filter_and_join.js.

const width = 700;
const height = 600;

const svg = d3.select("#map")
  .append("svg")
  .attr("viewBox", `0 0 ${width} ${height}`)
  .attr("width", "100%")
  .attr("height", "100%");

let selectedRegionName = null;
let selectedPolicy = "current"; // "current" | "proposed"

// Colour scale for allocation reliability: red (low) to green (high).
// Regions with a null reliability (e.g. Condamine-Balonne, which uses
// floodplain harvesting rather than standard allocation) fall back to
// a neutral grey so the map doesn't silently misrepresent them.
const colorScale = d3.scaleLinear()
  .domain([0, 50, 100])
  .range(["#c0392b", "#d68910", "#27ae60"]);

function regionFill(feature) {
  const value = feature.properties.exposure?.[selectedPolicy]?.reliability;
  if (value === null || value === undefined) return "#b0b6bd"; // neutral grey
  return colorScale(value);
}

d3.json("mdb_selected_regions.geojson").then(geojson => {
  const projection = d3.geoMercator().fitSize([width, height], geojson);
  const path = d3.geoPath().projection(projection);

  svg.selectAll("path")
    .data(geojson.features)
    .join("path")
    .attr("d", path)
    .attr("fill", d => regionFill(d))
    .attr("stroke", "#ffffff")
    .attr("stroke-width", 1)
    .style("cursor", "pointer")
    .on("click", (event, d) => selectRegion(d))
    .append("title")
    .text(d => d.properties.SWWRPANAME);

  // Select the first region by default so the Data column isn't empty
  // on first load.
  selectRegion(geojson.features[0]);

  function selectRegion(feature) {
    selectedRegionName = feature.properties.SWWRPANAME;

    svg.selectAll("path")
      .attr("stroke-width", d => d.properties.SWWRPANAME === selectedRegionName ? 3 : 1)
      .attr("stroke", d => d.properties.SWWRPANAME === selectedRegionName ? "#094eff" : "#ffffff");

    updateDataColumn(feature);
  }

  // Re-colour the whole map when the policy toggle changes, so
  // "Proposed policy" visibly improves reliability across regions.
  window.setPolicy = function (policy) {
    selectedPolicy = policy;
    svg.selectAll("path").attr("fill", d => regionFill(d));
    const current = geojson.features.find(f => f.properties.SWWRPANAME === selectedRegionName);
    if (current) updateDataColumn(current);
  };
});

// Wire the map's selected region into the existing Data column UI.
// Assumes the Data column has elements with these ids, matching the
// prototype we built earlier (reliability, risk, volatility, gviap,
// policy-summary).
function updateDataColumn(feature) {
  const exposure = feature.properties.exposure;
  if (!exposure) return;

  const state = exposure[selectedPolicy];

  const reliabilityEl = document.getElementById("reliability");
  if (reliabilityEl) {
    reliabilityEl.textContent = state.reliability !== null ? `${state.reliability}%` : "Not applicable";
  }

  const riskEl = document.getElementById("risk");
  if (riskEl) {
    riskEl.textContent = state.risk;
  }

  const volatilityEl = document.getElementById("volatility");
  if (volatilityEl) {
    volatilityEl.textContent = state.volatility ?? "—";
  }

  const gviapEl = document.getElementById("gviap");
  if (gviapEl) {
    gviapEl.textContent = state.gviap ?? "—";
  }

  const summaryEl = document.getElementById("policy-summary");
  if (summaryEl) {
    summaryEl.textContent = state.reliability !== null
      ? `Under the ${selectedPolicy} policy, ${feature.properties.SWWRPANAME} has an allocation reliability of ${state.reliability}%, categorised as ${state.risk} income risk.`
      : `${feature.properties.SWWRPANAME} does not use standard water allocation. Water access here is managed through ${exposure.entitlementType}.`;
  }
}
