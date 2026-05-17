/*
 * sg-bus-display — Bus 92 arrival times at Henry Park
 */

const CONFIG = {
  apiUrl: "https://sg-bus-proxy.danielsykes.workers.dev",
  busStopCode: "11369",
  serviceNo: "92",
  refreshInterval: 10_000,
  stopLat: 1.31637,
  stopLng: 103.78936,
  weatherArea: "Bukit Timah",
  cameraRefreshInterval: 60_000,
};

// -- Clock
function updateClock() {
  const now = new Date();
  document.getElementById("clock").textContent = now.toLocaleTimeString(
    "en-SG",
    { hour: "2-digit", minute: "2-digit", hour12: true }
  );
}

// -- Weather
const weatherIcons = {
  "Fair": "\u2600\ufe0f", "Fair (Day)": "\u2600\ufe0f", "Fair (Night)": "\ud83c\udf19",
  "Fair & Warm": "\ud83c\udf21\ufe0f",
  "Partly Cloudy": "\u26c5", "Partly Cloudy (Day)": "\u26c5", "Partly Cloudy (Night)": "\u2601\ufe0f",
  "Cloudy": "\u2601\ufe0f", "Hazy": "\ud83c\udf2b\ufe0f", "Windy": "\ud83d\udca8",
  "Mist": "\ud83c\udf2b\ufe0f", "Fog": "\ud83c\udf2b\ufe0f",
  "Light Rain": "\ud83c\udf26\ufe0f", "Moderate Rain": "\ud83c\udf27\ufe0f", "Heavy Rain": "\u26c8\ufe0f",
  "Passing Showers": "\ud83c\udf26\ufe0f", "Light Showers": "\ud83c\udf26\ufe0f", "Showers": "\ud83c\udf27\ufe0f",
  "Heavy Showers": "\u26c8\ufe0f", "Thundery Showers": "\u26c8\ufe0f",
  "Heavy Thundery Showers": "\u26c8\ufe0f",
  "Heavy Thundery Showers with Gusty Winds": "\ud83c\udf2a\ufe0f",
};

async function refreshWeather() {
  try {
    const [fcRes, tmpRes] = await Promise.all([
      fetch("https://api.data.gov.sg/v1/environment/2-hour-weather-forecast"),
      fetch("https://api.data.gov.sg/v1/environment/air-temperature"),
    ]);
    const [fc, tmp] = await Promise.all([fcRes.json(), tmpRes.json()]);

    const area = fc.items[0].forecasts.find((a) => a.area === CONFIG.weatherArea);
    const forecast = area ? area.forecast : "Unknown";
    const icon = weatherIcons[forecast] || "\ud83c\udf21\ufe0f";

    const stations = tmp.metadata.stations;
    const readings = tmp.items[0].readings;
    let bestTemp = null;
    let bestDist = Infinity;
    stations.forEach((s) => {
      const d = Math.hypot(s.location.latitude - CONFIG.stopLat, s.location.longitude - CONFIG.stopLng);
      if (d < bestDist) {
        bestDist = d;
        const r = readings.find((r) => r.station_id === s.id);
        if (r) bestTemp = r.value;
      }
    });

    const el = document.getElementById("weather");
    el.innerHTML =
      `<span class="weather-icon">${icon}</span>` +
      (bestTemp !== null ? `<span class="weather-temp">${bestTemp}\u00b0</span>` : "") +
      `<span>${forecast}</span>`;
  } catch (e) {
    console.error("Weather fetch failed:", e);
  }
}

// -- Traffic Camera
async function refreshCamera() {
  try {
    const res = await fetch("https://api.data.gov.sg/v1/transport/traffic-images");
    const data = await res.json();
    const cams = data.items[0].cameras;

    let best = null;
    let bestDist = Infinity;
    cams.forEach((c) => {
      const d = Math.hypot(c.location.latitude - CONFIG.stopLat, c.location.longitude - CONFIG.stopLng);
      if (d < bestDist) { bestDist = d; best = c; }
    });

    if (best) {
      document.getElementById("camera-img").src = best.image;
      document.getElementById("camera-label").textContent =
        `\ud83d\udcf7 Nearest cam \u00b7 ${new Date(best.timestamp).toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit" })}`;
    }
  } catch (e) {
    console.error("Camera fetch failed:", e);
  }
}

// -- Map Setup
const map = L.map("map", {
  zoomControl: false,
  attributionControl: false,
  dragging: false,
  scrollWheelZoom: false,
  doubleClickZoom: false,
  touchZoom: false,
}).setView([CONFIG.stopLat, CONFIG.stopLng], 15);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

const stopIcon = L.divIcon({ className: "stop-icon", iconSize: [16, 16] });
L.marker([CONFIG.stopLat, CONFIG.stopLng], { icon: stopIcon })
  .addTo(map)
  .bindTooltip("Henry Park", { permanent: true, direction: "top", className: "stop-tooltip", offset: [0, -12] });

const busMarkers = [];

function updateBusMarkers(buses) {
  busMarkers.forEach((m) => map.removeLayer(m));
  busMarkers.length = 0;

  const validBuses = buses.filter(
    (b) => b.lat && b.lng && b.lat !== 0 && b.lng !== 0
  );

  const statusEl = document.getElementById("map-status");

  if (validBuses.length === 0) {
    statusEl.textContent = "No GPS \u2014 waiting for tracked buses";
    map.setView([CONFIG.stopLat, CONFIG.stopLng], 15);
    return;
  }

  statusEl.textContent = `${validBuses.length} bus${validBuses.length > 1 ? "es" : ""} tracked live`;

  validBuses.forEach((bus, i) => {
    const icon = L.divIcon({
      className: i === 0 ? "bus-icon" : "bus-icon-dim",
      iconSize: i === 0 ? [18, 18] : [14, 14],
    });
    const marker = L.marker([bus.lat, bus.lng], { icon })
      .addTo(map)
      .bindTooltip(bus.label, { permanent: true, direction: "top", offset: [0, -12] });
    busMarkers.push(marker);
  });

  const points = [[CONFIG.stopLat, CONFIG.stopLng], ...validBuses.map((b) => [b.lat, b.lng])];
  map.fitBounds(L.latLngBounds(points).pad(0.15));
}

// -- Fetch Arrivals
async function fetchArrivals() {
  const url = `${CONFIG.apiUrl}?BusStopCode=${CONFIG.busStopCode}&ServiceNo=${CONFIG.serviceNo}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return res.json();
}

// -- Render
function minutesUntil(isoString) {
  if (!isoString) return null;
  const diff = (new Date(isoString) - new Date()) / 60_000;
  return Math.max(0, Math.round(diff));
}

function loadLabel(code) {
  const m = { SEA: "Seats avail", SDA: "Standing", LSD: "Full" };
  return m[code] || "";
}

function loadClass(code) {
  return `load-${(code || "").toLowerCase()}`;
}

function renderArrivals(data) {
  const main = document.getElementById("arrivals");
  const service = data.Services && data.Services[0];

  if (!service) {
    main.innerHTML = `<div class="error-msg">Bus 92 is not operating right now</div>`;
    updateBusMarkers([]);
    return;
  }

  const buses = [
    { label: "Next", data: service.NextBus },
    { label: "2nd", data: service.NextBus2 },
    { label: "3rd", data: service.NextBus3 },
  ];

  const busPositions = buses.map((bus) => ({
    label: bus.label,
    lat: parseFloat(bus.data?.Latitude) || 0,
    lng: parseFloat(bus.data?.Longitude) || 0,
  }));
  updateBusMarkers(busPositions);

  main.innerHTML = buses
    .map((bus, i) => {
      const mins = minutesUntil(bus.data?.EstimatedArrival);
      const isArriving = mins !== null && mins <= 1;
      const minsText =
        mins === null ? "\u2014" : isArriving ? "Arr" : String(mins);
      const unit = mins === null ? "" : isArriving ? "" : "min";
      const load = bus.data?.Load || "";
      const eta = bus.data?.EstimatedArrival
        ? new Date(bus.data.EstimatedArrival).toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit", hour12: true })
        : "";
      const visit = bus.data?.VisitNumber;
      const visitTag = visit && visit !== "1" ? `<span class="arrival-visit">Loop ${visit}</span>` : "";

      return `
        <div class="arrival-card ${i === 0 ? "next" : ""}">
          <div class="arrival-label">${bus.label}</div>
          <div class="arrival-minutes ${isArriving ? "arriving" : ""}">${minsText}</div>
          <div class="arrival-unit">${unit}</div>
          <div class="arrival-eta">${eta}</div>
          ${visitTag}
          ${
            load
              ? `<div class="load-indicator">
                   <span class="load-dot ${loadClass(load)}"></span>
                   ${loadLabel(load)}
                 </div>`
              : ""
          }
        </div>`;
    })
    .join("");
}

function renderError(err) {
  document.getElementById("arrivals").innerHTML =
    `<div class="error-msg">${err.message}</div>`;
}

// -- Main Loop
async function refresh() {
  try {
    const data = await fetchArrivals();
    renderArrivals(data);
    document.getElementById("updated").textContent =
      `Updated ${new Date().toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
  } catch (err) {
    renderError(err);
  }
}

updateClock();
setInterval(updateClock, 1_000);

refresh();
setInterval(refresh, CONFIG.refreshInterval);

refreshWeather();
setInterval(refreshWeather, 300_000);

refreshCamera();
setInterval(refreshCamera, CONFIG.cameraRefreshInterval);
