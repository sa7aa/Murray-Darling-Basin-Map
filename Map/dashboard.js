/* Supplied basin boundaries and fictional farm scenarios are loaded separately. */
(async function () {
  const el = (id) => document.getElementById(id);
  let farmers,
    regions,
    paths,
    selected,
    policy = "current";
    //Used for farmer goals and concerns
  function list(id, values) {
    el(id).replaceChildren(
      ...values.map((value) => {
        const item = document.createElement("li");
        item.textContent = value;
        return item;
      }),
    );
  }
  //Refresh all dashboard content whenever a region/farmer/policy tabs change
  function update() {
     //Find the farmer profile and map region that match the selected region
    const farmer = farmers.find((f) => f.region === selected);
    const region = regions.find((f) => f.properties.SWWRPANAME === selected);
    //Dropdowns in sync with the selected area
    el("region-select").value = selected;
    el("farmer-select").value = farmer ? farmer.region : "";
    if (el("region-name")) el("region-name").textContent = selected;
    if (el("region-state")) el("region-state").textContent = region.properties.STATE;
    //updated map styling
    paths
      .attr("fill", (d) =>
        d.properties.SWWRPANAME === selected
          ? "#2456ee"
          : farmers.some((f) => f.region === d.properties.SWWRPANAME)
            ? "#65b5a3"
            : "#d7e2d9",
      )
      .attr("stroke", (d) =>
        d.properties.SWWRPANAME === selected ? "#123bab" : "#829c91",
      )
      .attr("stroke-width", (d) =>
        d.properties.SWWRPANAME === selected ? 2 : 0.7,
      )
      .attr("aria-pressed", (d) =>
        String(d.properties.SWWRPANAME === selected),
      );
    paths.filter((d) => d.properties.SWWRPANAME === selected).raise();
    //display the farmer profile when a profile exists for the region
    el("farmer-profile").hidden = !farmer;
    el("no-profile").hidden = !!farmer;
    document.querySelectorAll("[data-policy]").forEach((button) => {
      button.disabled = !farmer;
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.policy === policy),
      );
    });
    // Implement water Security snapshot, policy settings and economic impact data
    const water = farmer?.waterSecurity;
    const economic = farmer?.economicImpact;

    //Water security snapshot
    el("reliability").textContent = water
      ? water.reliability === null
        ? "N/A"
        : water.reliability + "%"
      : "--";

    el("reliability-bar").value = water?.reliability ?? 0;
    el("reliability-bar").hidden =
      !water || water.reliability === null;

    el("risk").textContent = water?.risk ?? "--";

    const riskColor =
      { High: "#cf2027", Moderate: "#a86b00", Low: "#218263" }[
        water?.risk
      ] || "#67727c";

    el("risk").style.color = riskColor;
    el("risk-bar").style.setProperty("--risk-color", riskColor);

    [...el("risk-bar").children].forEach((bar, i) =>
      bar.classList.toggle(
        "on",
        i < ({ High: 3, Moderate: 2, Low: 1 }[water?.risk] || 0),
      ),
    );

    // Economic impact
    el("volatility").textContent = economic?.volatility ?? "--";
    el("gviap").textContent = economic?.gviap ?? "--";
    el("dominant-crop").textContent = farmer?.crop ?? "--";

    // Policy text
    el("policy-summary").textContent =
      farmer?.policy?.[policy]?.summary ??
      "No sample policy scenario is available for this region.";

    //Farmer 
    el("farmer-photo").src = farmer.photo;
    el("farmer-photo").alt =
      "Illustrative stock portrait; not the fictional farmer";
    el("farmer-name").textContent = farmer.name;
    el("farmer-role").textContent = farmer.age + " | " + farmer.role;
    el("farmer-description").textContent = farmer.description;
    el("farmer-region").textContent = farmer.region + ", " + farmer.state;
    el("farmer-crop").textContent = farmer.crop;
    list("farmer-goals", farmer.goals);
    list("farmer-concerns", farmer.concerns);
  }
  try {
     // Make sure required data and the D3 library loaded successfully
    if (!window.d3) throw new Error("The map library could not load.");
    if (!window.basinData) throw new Error("The bundled basin data could not load.");
     // Extract the GeoJSON regions and farmer profiles from dashboard-data.json
    const { geojson, farmers: profiles } = window.basinData;
    farmers = profiles;
    regions = geojson.features;
    //Fix polygon coordinate direction so D3 renders each map region correctly
    for (const feature of regions) {
      const polygons =
        feature.geometry.type === "MultiPolygon"
          ? feature.geometry.coordinates
          : [feature.geometry.coordinates];
      for (const polygon of polygons) {
        if (d3.geoArea({ type: "Polygon", coordinates: polygon }) > 2 * Math.PI)
          polygon.forEach((ring) => ring.reverse());
      }
    }
    //create MDB map
    const svg = d3.select("#basin-map");
    const mobile = window.matchMedia("(max-width: 700px)");
    function frameMap() {
      svg.attr("viewBox", mobile.matches ? "250 0 500 520" : "0 0 1000 520");
    }
    frameMap();
    mobile.addEventListener("change", frameMap);
    const group = svg.append("g");
    const projection = d3.geoMercator().fitExtent(
      [
        [220, 25],
        [790, 465],
      ],
      geojson,
    );
    const path = d3.geoPath(projection);
    paths = group
      .selectAll("path")
      .data(regions)
      .join("path")
      .attr("d", path)
      .attr("vector-effect", "non-scaling-stroke")
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", (d) => d.properties.SWWRPANAME)
      .style("cursor", "pointer")
      .on("click", (event, d) => {
        selected = d.properties.SWWRPANAME;
        update();
      })
      .on("keydown", (event, d) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selected = d.properties.SWWRPANAME;
          update();
        }
      });
    paths.append("title").text((d) => d.properties.SWWRPANAME);
    const zoom = d3
      .zoom()
      .scaleExtent([1, 8])
      .on("zoom", (event) => group.attr("transform", event.transform));
    svg.call(zoom);
    el("zoom-in").onclick = () =>
      svg.transition().duration(200).call(zoom.scaleBy, 1.4);
    el("zoom-out").onclick = () =>
      svg
        .transition()
        .duration(200)
        .call(zoom.scaleBy, 1 / 1.4);
    el("reset-map").onclick = () =>
      svg.transition().duration(200).call(zoom.transform, d3.zoomIdentity);
    el("region-select").replaceChildren(
      ...[...regions]
        .sort((a, b) =>
          a.properties.SWWRPANAME.localeCompare(b.properties.SWWRPANAME),
        )
        .map(
          (f) => new Option(f.properties.SWWRPANAME, f.properties.SWWRPANAME),
        ),
    );
    el("farmer-select").replaceChildren(
      new Option("No sample profile", ""),
      ...farmers.map((f) => new Option(f.name, f.region)),
    );
    el("farmer-select").options[0].disabled = true;
    el("region-select").onchange = (event) => {
      selected = event.target.value;
      update();
    };
    el("farmer-select").onchange = (event) => {
      selected = event.target.value;
      update();
    };
    document.querySelectorAll("[data-policy]").forEach(
      (button) =>
        (button.onclick = () => {
          policy = button.dataset.policy;
          update();
        }),
    );
    document
      .querySelectorAll(".map-controls button, #region-select, #farmer-select")
      .forEach((control) => (control.disabled = false));
    selected = farmers[0].region;
    update();
    el("map-status").hidden = true;
  } catch (error) {
    console.error(error);
    el("map-status").textContent =
      "Unable to load the basin map: " + error.message;
    el("region-select").options[0].textContent = "Map unavailable";
    el("farmer-select").options[0].textContent = "Profiles unavailable";
    el("policy-summary").textContent = "Data is unavailable.";
  }
})();
