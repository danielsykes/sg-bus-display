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
};

// ── Clock ──────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  document.getElementById("clock").textContent = now.toLocaleTimeString(
    "en-SG",
    { hour: "2-digit", minute: "2-digit", hour12: true }
  );
}

// ── Map Setup ──────────────────────────────────────────
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
  // Remove old markers
  busMarkers.forEach((m) => map.removeLayer(m));
  busMarkers.length = 0;

  const validBuses = buses.filter(
    (b) => b.lat && b.lng && b.lat !== 0 && b.lng !== 0
  );

  const statusEl = document.getElementById("map-status");

  if (validBuses.length === 0) {
    statusEl.textContent = "No GPS — waiting for tracked buses";
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

  // Fit map to show stop + all buses
  const points = [[CONFIG.stopLat, CONFIG.stopLng], ...validBuses.map((b) => [b.lat, b.lng])];
  map.fitBounds(L.latLngBounds(points).pad(0.15));
}

// ── Fetch Arrivals ─────────────────────────────────────
async function fetchArrivals() {
  const url = `${CONFIG.apiUrl}?BusStopCode=${CONFIG.busStopCode}&ServiceNo=${CONFIG.serviceNo}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return res.json();
}

// ── Render ─────────────────────────────────────────────
function minutesUntil(isoString) {
  if (!isoString) return null;
  const diff = (new Date(isoString) - new Date()) / 60_000;
  return Math.max(0, Math.round(diff));
}

function loadLabel(code) {
  const map = { SEA: "Seats avail", SDA: "Standing", LSD: "Full" };
  return map[code] || "";
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

  // Update map markers
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
        mins === null ? "—" : isArriving ? "Arr" : String(mins);
      const unit = mins === null ? "" : isArriving ? "" : "min";
      const load = bus.data?.Load || "";
      const eta = bus.data?.EstimatedArrival
        ? new Date(bus.data.EstimatedArrival).toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit", hour12: true })
        : "";

      return `
        <div class="arrival-card ${i === 0 ? "next" : ""}">
          <div class="arrival-label">${bus.label}</div>
          <div class="arrival-minutes ${isArriving ? "arriving" : ""}">${minsText}</div>
          <div class="arrival-unit">${unit}</div>
          <div class="arrival-eta">${eta}</div>
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

// ── Main Loop ──────────────────────────────────────────
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
