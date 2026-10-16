// Group imported farmer-related resources by the supplied basin polygons.
// These evidence cards describe resources, not individual farmers.
const fs = require("node:fs");
const path = require("node:path");
const read = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, name), "utf8"));
const geojson = read("mdb_geo_json.json");
const [headers, ...rows] = read("data/MDB_Summary.json");
const townLocations = read("data/MDB_Towns_Rivers.json");
const resources = read("data/MDB_Community_Data_v5.json");
const cropWaterUse = read("data/water_use_nrm_2020_2021.json");
const personaThemes = {
  "Condamine-Balonne": {
    role: "Cotton, grain and irrigation community composite",
    crop: "Cotton and grain are named in regional grower records.",
    goals: ["Inferred: plan cotton or grain production around irrigation and water access.", "Inferred: protect farm water resources and maintain access to farmer support."],
    concerns: ["Inferred: water access and groundwater protection may matter to local growers.", "Inferred: drought, flood or fire impacts may create a need for rural support."],
  },
  Gwydir: {
    role: "Cotton and irrigated agriculture community composite",
    crop: "Cotton is named in regional grower records; the irrigators association also references broadacre crops.",
    goals: ["Inferred: plan cotton production with current allocation and entitlement information.", "Inferred: keep informed about irrigation research and environmental flow updates."],
    concerns: ["Inferred: seasonal water availability and entitlement changes may affect planning.", "Inferred: balancing irrigation with environmental flows may be a local consideration."],
  },
  Lachlan: {
    role: "Lachlan catchment landholder and irrigator composite",
    crop: "The records describe irrigators, sustainable agriculture and grazing; no dominant crop is identified.",
    goals: ["Inferred: improve soil health and sustainable land management.", "Inferred: maintain productive water access in the Lachlan catchment."],
    concerns: ["Inferred: water policy and licence access may affect irrigators.", "Inferred: landholders may need support for restoration and sustainable farming."],
  },
  "Macquarie-Castlereagh": {
    role: "Grazing and irrigated water-user composite",
    crop: "A Bourke case study describes Merino sheep grazing; other records describe Macquarie Valley irrigators.",
    goals: ["Inferred: maintain grazing land and soil through managed grazing practices.", "Inferred: secure water access for productive use where irrigation is used."],
    concerns: ["Inferred: rainfall and soil conditions may influence grazing decisions.", "Inferred: water access and licence policy may affect irrigators."],
  },
  "Queensland Border Rivers-Moonie": {
    role: "Cotton, broadacre and irrigated farming composite",
    crop: "Cotton, grains and broadacre farming are named in local records.",
    goals: ["Inferred: improve soil management and farm sustainability.", "Inferred: use grower field days and networks to share farming practices."],
    concerns: ["Inferred: water management and allocation policy may affect irrigation planning.", "Inferred: soil health and natural resource management are local themes."],
  },
  Namoi: {
    role: "Cotton and irrigated agriculture community composite",
    crop: "Cotton and irrigated agriculture are named in regional records.",
    goals: ["Inferred: improve irrigation efficiency and keep up with water allocation information.", "Inferred: learn from grower field days and technical workshops."],
    concerns: ["Inferred: water availability and water policy may affect crop planning.", "Inferred: protection of Namoi catchment waterways is a documented community theme."],
  },
  "New South Wales Border Rivers": {
    role: "Cotton-growing community composite",
    crop: "Cotton is named in the supplied local record.",
    goals: ["Inferred: use cotton industry resources to support efficient production."],
    concerns: ["The single supplied record gives limited evidence about local farmer priorities."],
  },
  "New South Wales Murray and Lower Darling": {
    role: "Rice and irrigation community composite",
    crop: "Rice growing and irrigation are named in regional records.",
    goals: ["Inferred: plan production using irrigation delivery and water allocation information.", "Inferred: stay connected to rice grower and irrigator networks."],
    concerns: ["Inferred: water access and allocation policy may affect irrigation planning.", "Inferred: river operations and water management are relevant local themes."],
  },
  "Northern Victoria": {
    role: "Mixed farming and landcare community composite",
    crop: "Records mention dairy, pome fruit and Jersey cattle; they do not identify one dominant farm type.",
    goals: ["Inferred: improve sustainable farming and soil management.", "Inferred: access practical advice, workshops and farmer support networks."],
    concerns: ["Inferred: soil health, weeds and river health are documented landcare themes.", "Inferred: dairy and horticulture productivity are relevant sector themes."],
  },
  "South Australian Murray Region": {
    role: "Riverland horticulture and Murray Plains farming composite",
    crop: "Citrus, almonds and grapes are named in a Riverland irrigation record; Murray Plains records describe farming systems work.",
    goals: ["Inferred: coordinate irrigation water delivery with horticultural production.", "Inferred: use farming systems research and development resources."],
    concerns: ["Inferred: water delivery and irrigation are central regional considerations.", "The supplied records give limited direct evidence about individual farmer concerns."],
  },
  "Victorian Murray": {
    role: "Irrigated horticulture and dairy community composite",
    crop: "Records mention table grapes, summerfruit and dairy farming; they do not identify one dominant crop.",
    goals: ["Inferred: use research, extension and grower networks to support farm decisions.", "Inferred: maintain crop quality, vine health or dairy productivity, depending on farm type."],
    concerns: ["Water security and irrigation policy are documented community themes.", "Inferred: crop-specific issues differ across horticulture and dairy farms."],
  },
  Murrumbidgee: {
    role: "Murrumbidgee irrigated agriculture community composite",
    crop: "The supplied records describe irrigated agriculture but do not establish a dominant crop.",
    goals: ["Inferred: use irrigation research and allocation information in farm planning.", "Inferred: improve productivity and sustainability through local extension resources."],
    concerns: ["Water allocations and availability are explicit themes in the supplied records.", "Inferred: water policy and irrigation operations may affect farm planning."],
  },
};

function insideRing(coordinates, longitude, latitude) {
  let inside = false;
  for (let i = 0, j = coordinates.length - 1; i < coordinates.length; j = i++) {
    const [xi, yi] = coordinates[i];
    const [xj, yj] = coordinates[j];
    if ((yi > latitude) !== (yj > latitude) &&
      longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function insidePolygon(rings, longitude, latitude) {
  return insideRing(rings[0], longitude, latitude) &&
    !rings.slice(1).some((ring) => insideRing(ring, longitude, latitude));
}

function contains(feature, longitude, latitude) {
  const polygons = feature.geometry.type === "MultiPolygon"
    ? feature.geometry.coordinates : [feature.geometry.coordinates];
  return polygons.some((polygon) => insidePolygon(polygon, longitude, latitude));
}

const towns = rows.map((row) => Object.fromEntries(
  Object.entries(headers).map(([key, header]) => [header, row[key]]),
));
const resourcesByRegion = new Map(geojson.features.map((feature) => [
  feature.properties.SWWRPANAME, [],
]));
const unmatched = [];

for (const resource of resources) {
  if (resource["agent:MDBCommunity_0"] !== "Farmers") continue;
  const town = towns.find((item) => item.Town === resource["geo:nearestTown"] &&
    item.State === resource["geo:State"]);
  const location = townLocations.find((item) => item.Town === town?.Town &&
    item.State === town?.State && Number.isFinite(item.Longitude) &&
    Number.isFinite(item.Latitude));
  const region = location && geojson.features.find((feature) =>
    contains(feature, location.Longitude, location.Latitude));
  if (!region) {
    unmatched.push(resource["dc:title"]);
    continue;
  }
  resourcesByRegion.get(region.properties.SWWRPANAME).push({
    title: resource["dc:title"],
    town: resource["geo:nearestTown"],
    state: resource["geo:State"],
    subject: resource["dc:subject"],
    description: resource["dc:description"],
    url: resource["dc:identifier"],
    date: resource["dc:date"],
    dataset: "data/MDB_Community_Data_v5.json",
  });
}

if (unmatched.length) throw new Error(`Could not map farmer resources: ${unmatched.join("; ")}`);

const nationalCropCategories = [
  { match: /cotton/i, label: "Cotton", source: "Cotton" },
  { match: /\b(rice)\b/i, label: "Rice", source: "Rice" },
  { match: /grain|cereal|broadacre/i, label: "Cereals for grain or seed (excluding rice)", source: "Cereals for grain or seed, excluding rice" },
  { match: /grape/i, label: "Grapevines", source: "Grapevines" },
  { match: /vegetable/i, label: "Vegetables", source: "Vegetables" },
  { match: /citrus|almond|fruit|horticulture|summerfruit|pome/i, label: "Fruit and nut crops", source: "Fruit trees, nut trees, plantation or berry fruits" },
];
const australiaCropRecords = cropWaterUse.records.filter((item) =>
  item.region === "Australia" && item.status === "published_estimate");
function nationalCropReferences(cropDescription) {
  return nationalCropCategories.filter((category) => category.match.test(cropDescription || ""))
    .map((category) => {
      const valueFor = (measure) => australiaCropRecords.find((item) =>
        item.measure.startsWith(`Water use - ${category.source} - ${measure}`))?.estimate ?? null;
      return {
        crop: category.label,
        areaWateredHa: valueFor("Area watered (ha)"),
        volumeAppliedML: valueFor("Volume applied (ML)"),
      };
    }).filter((item) => item.areaWateredHa !== null || item.volumeAppliedML !== null);
}

const profiles = [...resourcesByRegion].filter(([, items]) => items.length).map(([region, sources]) => {
  const states = [...new Set(sources.map((source) => source.state))].sort();
  const themes = personaThemes[region];
  if (!themes) throw new Error(`No evidence-based persona themes defined for ${region}`);
  return {
    id: `farmer-evidence-${region.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    name: `${region} farmer (composite)`,
    personaType: "Evidence-based composite; not an individual farmer",
    age: null,
    role: themes.role,
    region,
    state: states.join(", "),
    crop: themes.crop,
    description: `Regional themes from farmer-related records in ${[...new Set(sources.map((source) => source.town))].sort().join(", ")}; not an individual farmer's account.`,
    evidenceNote: "Goals and concerns are inferred from the linked records.",
    cropWaterUse: nationalCropReferences(themes.crop),
    goals: themes.goals,
    concerns: themes.concerns,
    waterSecurity: { reliability: null, risk: null },
    economicImpact: { volatility: null, gviap: null },
    policy: {
      current: { summary: "No region-specific policy finding is asserted by this evidence summary." },
      proposed: { summary: "No proposed policy or modelled outcome is asserted by this evidence summary." },
    },
    sources,
  };
});

fs.writeFileSync(path.join(__dirname, "farmer-evidence.json"), JSON.stringify(profiles, null, 2) + "\n");
console.log(`Grouped ${profiles.reduce((total, profile) => total + profile.sources.length, 0)} farmer-related records into ${profiles.length} basin-region evidence cards.`);
