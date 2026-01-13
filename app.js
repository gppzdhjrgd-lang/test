const map = L.map("map").setView([59.9139, 10.7522], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

const markers = {
  playgrounds: L.layerGroup().addTo(map),
  food: L.layerGroup().addTo(map),
  chargers: L.layerGroup().addTo(map),
};

const elements = {
  radius: document.getElementById("radius"),
  radiusValue: document.getElementById("radiusValue"),
  foodWeight: document.getElementById("foodWeight"),
  foodWeightValue: document.getElementById("foodWeightValue"),
  chargerWeight: document.getElementById("chargerWeight"),
  chargerWeightValue: document.getElementById("chargerWeightValue"),
  idealDistance: document.getElementById("idealDistance"),
  idealDistanceValue: document.getElementById("idealDistanceValue"),
  refresh: document.getElementById("refresh"),
  resultsList: document.getElementById("resultsList"),
};

const iconFactory = (color) =>
  L.divIcon({
    className: "",
    html: `<div style="background:${color};width:12px;height:12px;border-radius:50%;border:2px solid white"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

const icons = {
  playground: iconFactory("#2563eb"),
  food: iconFactory("#16a34a"),
  charger: iconFactory("#f97316"),
};

const toRadians = (value) => (value * Math.PI) / 180;

const distanceInMeters = (a, b) => {
  const earthRadius = 6371000;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const haversine =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return earthRadius * c;
};

const updateRangeLabels = () => {
  elements.radiusValue.textContent = `${elements.radius.value} m`;
  elements.foodWeightValue.textContent = elements.foodWeight.value;
  elements.chargerWeightValue.textContent = elements.chargerWeight.value;
  elements.idealDistanceValue.textContent = `${elements.idealDistance.value} m`;
};

const clearLayers = () => {
  Object.values(markers).forEach((layer) => layer.clearLayers());
};

const buildOverpassQuery = (center, radius) => `
[out:json][timeout:25];
(
  node["leisure"="playground"](around:${radius},${center.lat},${center.lng});
  way["leisure"="playground"](around:${radius},${center.lat},${center.lng});
  node["amenity"~"cafe|restaurant"](around:${radius},${center.lat},${center.lng});
  node["amenity"="charging_station"](around:${radius},${center.lat},${center.lng});
  way["amenity"="charging_station"](around:${radius},${center.lat},${center.lng});
);
(._;>;);
out center;
`;

const normalizeScore = (distance, idealDistance) => {
  if (!Number.isFinite(distance)) {
    return 0;
  }
  const score = Math.max(0, 1 - distance / idealDistance);
  return Math.min(1, score);
};

const renderResults = (playgrounds) => {
  elements.resultsList.innerHTML = "";
  playgrounds.slice(0, 5).forEach((item) => {
    const listItem = document.createElement("li");
    listItem.className = "result-card";
    listItem.innerHTML = `
      <h3>${item.name}</h3>
      <div class="result-meta">Score: ${item.score.toFixed(2)}</div>
      <div class="result-meta">Nærmeste mat: ${Math.round(item.foodDistance)} m</div>
      <div class="result-meta">Nærmeste lader: ${Math.round(item.chargerDistance)} m</div>
    `;
    listItem.addEventListener("click", () => {
      map.setView([item.lat, item.lng], 15);
    });
    elements.resultsList.appendChild(listItem);
  });
};

const parseElements = (elementsData) => {
  const nodes = new Map();
  const items = [];

  elementsData.forEach((element) => {
    if (element.type === "node") {
      nodes.set(element.id, element);
      items.push(element);
    }
    if (element.type === "way" && element.center) {
      items.push({
        ...element,
        lat: element.center.lat,
        lon: element.center.lon,
      });
    }
  });

  return items.map((element) => ({
    id: element.id,
    lat: element.lat,
    lng: element.lon,
    tags: element.tags || {},
  }));
};

const showMarkers = (items, layer, icon, getLabel) => {
  items.forEach((item) => {
    const marker = L.marker([item.lat, item.lng], { icon }).bindPopup(getLabel(item));
    marker.addTo(layer);
  });
};

const computeScores = (playgrounds, foodPlaces, chargers, weights, idealDistance) =>
  playgrounds
    .map((playground) => {
      const foodDistance = Math.min(
        ...foodPlaces.map((food) => distanceInMeters(playground, food)),
      );
      const chargerDistance = Math.min(
        ...chargers.map((charger) => distanceInMeters(playground, charger)),
      );

      const foodScore = normalizeScore(foodDistance, idealDistance) * weights.food;
      const chargerScore = normalizeScore(chargerDistance, idealDistance) * weights.charger;

      const score = foodScore + chargerScore;

      return {
        ...playground,
        name: playground.tags.name || "Lekeplass",
        foodDistance,
        chargerDistance,
        score,
      };
    })
    .sort((a, b) => b.score - a.score);

const updateData = async () => {
  updateRangeLabels();
  const center = map.getCenter();
  const radius = Number(elements.radius.value);
  const idealDistance = Number(elements.idealDistance.value);

  elements.refresh.textContent = "Henter data...";
  elements.refresh.disabled = true;
  clearLayers();

  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: buildOverpassQuery(center, radius),
  });

  const data = await response.json();
  const allItems = parseElements(data.elements || []);
  const playgrounds = allItems.filter((item) => item.tags.leisure === "playground");
  const foodPlaces = allItems.filter((item) =>
    ["restaurant", "cafe"].includes(item.tags.amenity),
  );
  const chargers = allItems.filter((item) => item.tags.amenity === "charging_station");

  showMarkers(playgrounds, markers.playgrounds, icons.playground, (item) =>
    item.tags.name ? `Lekeplass: ${item.tags.name}` : "Lekeplass",
  );
  showMarkers(foodPlaces, markers.food, icons.food, (item) =>
    item.tags.name ? `Mat: ${item.tags.name}` : "Restaurant/kafé",
  );
  showMarkers(chargers, markers.chargers, icons.charger, (item) =>
    item.tags.name ? `Lader: ${item.tags.name}` : "Elbillader",
  );

  const weights = {
    food: Number(elements.foodWeight.value),
    charger: Number(elements.chargerWeight.value),
  };

  if (foodPlaces.length === 0 || chargers.length === 0 || playgrounds.length === 0) {
    elements.resultsList.innerHTML =
      "<li class=\"result-card\">Fant ingen fullstendige treff i dette området. Prøv å øke radiusen eller flytte kartet.</li>";
  } else {
    const scored = computeScores(playgrounds, foodPlaces, chargers, weights, idealDistance);
    renderResults(scored);
  }

  elements.refresh.textContent = "Oppdater kartet";
  elements.refresh.disabled = false;
};

["radius", "foodWeight", "chargerWeight", "idealDistance"].forEach((id) => {
  document.getElementById(id).addEventListener("input", updateRangeLabels);
});

elements.refresh.addEventListener("click", updateData);

updateRangeLabels();
updateData();
