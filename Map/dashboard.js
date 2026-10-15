/* Supplied basin boundaries and fictional farm scenarios are loaded separately. */
(async function () {
  const el = (id) => document.getElementById(id);
  let farmers,
    regions,
    paths,
    markers,
    selected,
    selectedFarmer,
    policy = "current";
  let towns, townMarkers, community, communityMarkers, selectedOrganisation = "";
  let popupTrigger, popupTimer;
  const sameTown = (organisation, town) =>
    organisation.town.trim().toLowerCase() === town.properties.Town.trim().toLowerCase() &&
    organisation.state.trim().toLowerCase() === town.properties.State.trim().toLowerCase();
  const filterFields = {
    "state-filter": ["State", "All states"],
    "town-filter": ["Town", "All towns"],
    "summary-region-filter": ["Region", "All regions"],
    "tributary-filter": ["Tributary River", "All tributary rivers"],
    "major-river-filter": ["Major River", "All major rivers"],
  };
  const filters = Object.fromEntries(Object.keys(filterFields).map((id) => [id, ""]));
  const matches = (town, except) => Object.entries(filters).every(([id, value]) =>
    id === except || !value || town.properties[filterFields[id][0]] === value) &&
    (!selectedOrganisation || sameTown(community.find((item) => item.id === selectedOrganisation), town));

  function showOrganisation(organisation) {
    const header = document.createElement("div");
    header.className = "organisation-header";
    const identity = document.createElement("div");
    identity.className = "organisation-identity";
    const badge = document.createElement("span");
    badge.className = "organisation-logo";
    badge.setAttribute("aria-hidden", "true");
    const fallback = document.createElement("img");
    fallback.src = "assets/img/organisation-default.svg";
    fallback.alt = "";
    badge.append(fallback);
    let websiteURL;
    try {
      const parsed = new URL(organisation.website);
      if (["http:", "https:"].includes(parsed.protocol)) websiteURL = parsed;
    } catch { /* Some identifiers are not web URLs. */ }
    if (websiteURL) {
      // Prefer the locally discovered logo, then try the site's conventional icon.
      const logo = document.createElement("img");
      logo.alt = "";
      logo.referrerPolicy = "no-referrer";
      logo.onload = () => { fallback.hidden = true; };
      let triedWebsiteIcon = !organisation.logo;
      logo.onerror = () => {
        if (!triedWebsiteIcon) {
          triedWebsiteIcon = true;
          logo.src = new URL("/favicon.ico", websiteURL).href;
        } else { logo.remove(); fallback.hidden = false; }
      };
      logo.src = organisation.logo || new URL("/favicon.ico", websiteURL).href;
      badge.append(logo);
    }
    const eyebrow = document.createElement("p");
    eyebrow.className = "organisation-eyebrow";
    eyebrow.textContent = "Community directory";
    const heading = document.createElement("h3");
    heading.textContent = organisation.title;
    const location = document.createElement("p");
    location.className = "organisation-location";
    location.textContent = `Near ${organisation.town}, ${organisation.state}`;
    identity.append(eyebrow, heading, location);
    header.append(badge, identity);
    const website = document.createElement("div");
    website.className = "organisation-website";
    // Only render web links for HTTP(S) identifiers from the dataset.
    if (websiteURL) {
      const link = document.createElement("a");
      link.href = organisation.website;
      link.textContent = "Visit website ↗";
      link.title = organisation.website;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      website.append(link);
      const domain = document.createElement("span");
      domain.textContent = websiteURL.hostname.replace(/^www\./, "");
      website.append(domain);
    } else website.textContent = organisation.website || "Website not supplied";
    const subject = document.createElement("div");
    subject.className = "organisation-subjects";
    subject.setAttribute("aria-label", "Subject");
    (organisation.subject || "Subject not supplied").split(",").map((part) => part.trim()).filter(Boolean).forEach((part) => {
      const tag = document.createElement("span");
      tag.textContent = part;
      subject.append(tag);
    });
    const description = document.createElement("p");
    description.className = "organisation-description";
    description.textContent = organisation.description || "Description not supplied";
    const content = [header, subject, description];
    el("community-details").replaceChildren(...content, website);
  }

  function filterTowns() {
    const visible = towns.filter((town) => matches(town));
    const active = Object.values(filters).some(Boolean) || !!selectedOrganisation;
    for (const [id, [field, label]] of Object.entries(filterFields)) {
      const values = [...new Set(towns.filter((town) => matches(town, id))
        .map((town) => town.properties[field]))].sort((a, b) => a.localeCompare(b));
      el(id).replaceChildren(new Option(label, ""), ...values.map((value) => new Option(value, value)));
      el(id).value = filters[id];
    }
    townMarkers.style("display", (town) => el("show-towns").checked && matches(town) ? null : "none");
    // Geographic regions in the summary are distinct from water plan boundaries.
    // Use town coordinates to connect the two, rather than equating their names.
    const matchingRegions = new Set(regions.filter((region) => visible.some((town) =>
      d3.geoContains(region, town.geometry.coordinates))));
    paths.attr("opacity", (region) => !active || matchingRegions.has(region) ? 1 : 0.2);
    markers.style("display", (region) => !active || matchingRegions.has(region) ? null : "none");
    el("filter-status").textContent = `${visible.length} of ${towns.length} towns` +
      (visible.length ? "" : ". No towns match these filters.");
    el("clear-filters").disabled = !active;
    // Build options from geographic filters independently of the organisation selection.
    const eligible = community.filter((organisation) => towns.some((town) =>
      sameTown(organisation, town) && Object.entries(filters).every(([id, value]) =>
        !value || town.properties[filterFields[id][0]] === value)))
      .sort((a, b) => a.title.localeCompare(b.title));
    if (selectedOrganisation && !eligible.some((item) => item.id === selectedOrganisation)) {
      selectedOrganisation = "";
      filterTowns();
      return;
    }
    el("community-filter").replaceChildren(new Option("All community organisations", ""),
      ...eligible.map((organisation) => {
        const option = new Option(organisation.title, organisation.id);
        option.title = `${organisation.website || ""}\n${organisation.subject || ""}\n${organisation.description || ""}`;
        return option;
      }));
    el("community-filter").value = selectedOrganisation;
    const shown = eligible.filter((item) => !selectedOrganisation || item.id === selectedOrganisation);
    const shownIds = new Set(shown.map((organisation) => organisation.id));
    communityMarkers.style("display", (organisation) =>
      (el("show-community").checked || organisation.id === selectedOrganisation) && shownIds.has(organisation.id) ? null : "none");
    closeCommunity();
    if (selectedOrganisation) {
      const organisation = shown.find((item) => item.id === selectedOrganisation);
      const marker = communityMarkers.filter((item) => item.id === selectedOrganisation).node();
      if (organisation && marker) openCommunity({ currentTarget: marker }, organisation);
    }
  }
  function closeCommunity() {
    clearTimeout(popupTimer);
    el("community-popup").hidden = true;
  }
  function openCommunity(event, organisation) {
    clearTimeout(popupTimer);
    popupTrigger = event.currentTarget;
    el("community-count").textContent = "Near " + organisation.town + ", " + organisation.state;
    showOrganisation(organisation);
    el("community-popup").hidden = false;
    const surface = el("basin-map").parentElement.getBoundingClientRect();
    const anchor = event.currentTarget.getBoundingClientRect();
    const popup = el("community-popup");
    popup.style.left = Math.max(12, Math.min(anchor.right - surface.left + 12, surface.width - popup.offsetWidth - 12)) + "px";
    popup.style.top = Math.max(12, Math.min(anchor.top - surface.top, surface.height - popup.offsetHeight - 12)) + "px";
  }
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
    const regionalFarmers = farmers.filter((f) => f.region === selected);
    if (!regionalFarmers.includes(farmers[selectedFarmer])) {
      selectedFarmer = farmers.findIndex((f) => f.region === selected);
    }
    const farmer = farmers[selectedFarmer];
    const region = regions.find((f) => f.properties.SWWRPANAME === selected);
    //Dropdowns in sync with the selected area
    el("region-select").value = selected;
    el("farmer-select").replaceChildren(
      ...(regionalFarmers.length
        ? regionalFarmers.map((f) => new Option(f.name, String(farmers.indexOf(f))))
        : [new Option("No sample profile in this region", "")]),
    );
    el("farmer-select").value = farmer ? String(selectedFarmer) : "";
    el("farmer-select").disabled = !farmer;
    if (el("region-name")) el("region-name").textContent = selected;
    if (el("region-state")) el("region-state").textContent = region.properties.STATE;
    //updated map styling
    paths
      .attr("fill", "#d7e2d9")
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
    markers.attr("aria-pressed", (d) => String(d.properties.SWWRPANAME === selected));
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
    if (!farmer) return;
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
    towns = window.basinData.towns.features;
    community = window.basinData.community;
    //Fix polygon coordinate direction so D3 renders each map region correctly
    const australia = window.basinData.australia;
    for (const feature of [...regions, ...australia.features]) {
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
    svg.attr("viewBox", "0 0 1000 520");
    const group = svg.append("g");
    const projection = d3.geoMercator().fitExtent(
      [
        [120, 25],
        [880, 465],
      ],
      australia,
    );
    const path = d3.geoPath(projection);
    group.append("g").attr("aria-hidden", "true")
      .selectAll("path").data(australia.features).join("path")
      .attr("class", "australia-background")
      .attr("d", path).attr("vector-effect", "non-scaling-stroke");
    paths = group.append("g")
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
    // Markers represent regional profile counts, not actual farm locations
    const markerLayer = group.append("g");
    function openProfiles(event, d) {
      event.stopPropagation();
      selected = d.properties.SWWRPANAME;
      update();
      el("farmer-select").focus();
    }
    markers = markerLayer.selectAll("g")
      .data(regions.filter((d) => farmers.some((f) => f.region === d.properties.SWWRPANAME)))
      .join("g")
      .attr("class", "farmer-marker")
      .attr("transform", (d) => `translate(${path.centroid(d)})`)
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", (d) => `${d.properties.SWWRPANAME}: ${farmers.filter((f) => f.region === d.properties.SWWRPANAME).length} farmer profiles. Select to browse.`)
      .on("click", openProfiles)
      .on("keydown", (event, d) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openProfiles(event, d);
        }
      });
    markers.append("circle").attr("r", 14);
    markers.append("text").attr("text-anchor", "middle").attr("dy", "0.35em")
      .text((d) => farmers.filter((f) => f.region === d.properties.SWWRPANAME).length);
    markers.append("title").text((d) => `${d.properties.SWWRPANAME}: browse farmer profiles`);
    function selectTown(event, town) {
      event.stopPropagation();
      // A town selection replaces previous filters so it is always reachable.
      Object.keys(filters).forEach((id) => { filters[id] = ""; });
      selectedOrganisation = "";
      filters["town-filter"] = town.properties.Town;
      const region = regions.find((feature) => d3.geoContains(feature, town.geometry.coordinates));
      if (region) selected = region.properties.SWWRPANAME;
      update();
      filterTowns();
    }
    townMarkers = group.append("g").selectAll("g")
      .data(towns).join("g")
      .attr("class", "town-marker")
      .attr("transform", (town) => `translate(${projection(town.geometry.coordinates)})`)
      .attr("tabindex", 0).attr("role", "button")
      .attr("aria-label", (town) => `${town.properties.Town}, ${town.properties.State}. Filter by town.`)
      .on("click", selectTown)
      .on("keydown", (event, town) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectTown(event, town);
        }
      });
    townMarkers.append("circle").attr("r", 11).attr("class", "town-symbol-background");
    townMarkers.append("path").attr("d", "M-8,6V-2L-4,-6L0,-2V6ZM1,6V-7H7V6ZM-5,6V2H-3V6M3,-4H5M3,-1H5M3,2H5");
    townMarkers.append("title").text((town) => `${town.properties.Town}, ${town.properties.State}\n${town.properties.Region}\n${town.properties["Tributary River"]}`);
    // Spread individual symbols around the nearest town, not exact office locations.
    const markerPositions = new Map();
    for (const town of towns) {
      community.filter((organisation) => sameTown(organisation, town)).forEach((organisation, index) => {
        const angle = index * 2.399963229728653;
        const radius = 16 + 12 * Math.sqrt(index);
        markerPositions.set(organisation.id, { point: projection(town.geometry.coordinates), offset: [Math.cos(angle) * radius, Math.sin(angle) * radius] });
      });
    }
    function organisationTransform(organisation, scale = 1) {
      const position = markerPositions.get(organisation.id);
      // Start at a quarter size and grow to normal size at 4× zoom.
      const symbolSize = Math.min(1, 0.25 * scale);
      return `translate(${position.point}) scale(${1 / scale}) translate(${position.offset}) scale(${symbolSize})`;
    }
    communityMarkers = group.append("g").selectAll("g")
      .data(community).join("g")
      .attr("class", "community-marker")
      .attr("transform", (organisation) => organisationTransform(organisation))
      .attr("aria-label", (organisation) => organisation.title + ". Near " + organisation.town + ". Show details.")
      .attr("tabindex", 0).attr("role", "button")
      .attr("aria-controls", "community-popup")
      .on("mouseenter", openCommunity).on("focus", openCommunity)
      .on("mouseleave", () => { popupTimer = setTimeout(closeCommunity, 350); })
      .on("click", (event, town) => { event.stopPropagation(); openCommunity(event, town); el("close-community").focus(); })
      .on("keydown", (event, town) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault(); event.stopPropagation(); openCommunity(event, town); el("close-community").focus();
        }
      });
    communityMarkers.append("circle").attr("r", 8);
    communityMarkers.append("path").attr("transform", "scale(0.65)").attr("d", "M-3,-1a3,3 0 1,0 0,-6a3,3 0 1,0 0,6M4,-1a2.5,2.5 0 1,0 0,-5a2.5,2.5 0 1,0 0,5M-8,6v-2q0,-4 5,-4q5,0 5,4v2ZM3,6v-2q0,-2 -1,-3q7,-2 7,3v2Z");
    el("close-community").onclick = () => { popupTrigger?.focus(); closeCommunity(); };
    el("community-popup").onmouseenter = () => clearTimeout(popupTimer);
    el("community-popup").onmouseleave = () => { popupTimer = setTimeout(closeCommunity, 350); };
    el("community-popup").onfocusin = () => clearTimeout(popupTimer);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !el("community-popup").hidden) { popupTrigger?.focus(); closeCommunity(); }
    });
    const zoom = d3
      .zoom()
      .scaleExtent([1, 8])
      .on("zoom", (event) => {
        group.attr("transform", event.transform);
        closeCommunity();
        communityMarkers.attr("transform", (organisation) => organisationTransform(organisation, event.transform.k));
        markers.attr("transform", (d) => `translate(${path.centroid(d)}) scale(${1 / event.transform.k})`);
        townMarkers.attr("transform", (town) => `translate(${projection(town.geometry.coordinates)}) scale(${1 / event.transform.k})`);
      });
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
    el("region-select").onchange = (event) => {
      selected = event.target.value;
      update();
    };
    el("farmer-select").onchange = (event) => {
      selectedFarmer = Number(event.target.value);
      selected = farmers[selectedFarmer].region;
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
    selected = farmers[0]?.region ?? regions[0].properties.SWWRPANAME;
    update();
    for (const id of Object.keys(filterFields)) {
      el(id).disabled = false;
      el(id).onchange = (event) => {
        filters[id] = event.target.value;
        filterTowns();
      };
    }
    el("clear-filters").onclick = () => {
      Object.keys(filters).forEach((id) => { filters[id] = ""; });
      selectedOrganisation = "";
      filterTowns();
    };
    el("community-filter").disabled = false;
    for (const id of ["show-towns", "show-community"]) {
      el(id).disabled = false;
      el(id).onchange = () => filterTowns();
    }
    el("community-filter").onchange = (event) => {
      selectedOrganisation = event.target.value;
      filterTowns();
    };

    filterTowns();
    el("map-status").hidden = true;
  } catch (error) {
    console.error(error);
    el("filter-status").textContent = "Filters unavailable.";
    el("map-status").textContent =
      "Unable to load the basin map: " + error.message;
    el("region-select").options[0].textContent = "Map unavailable";
    el("farmer-select").options[0].textContent = "Profiles unavailable";
    el("policy-summary").textContent = "Data is unavailable.";
  }
})();
