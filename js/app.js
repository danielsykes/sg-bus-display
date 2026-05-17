/*
 * sg-bus-display — Bus 92 arrival times at Henry Park
 *
 * Configure your Cloudflare Worker URL below.
 * See worker/worker.js for the proxy that calls LTA DataMall.
 */

const CONFIG = {
  // Replace with your deployed Cloudflare Worker URL
  apiUrl: "https://YOUR-WORKER.workers.dev",
  busStopCode: "11369",
  serviceNo: "92",
  refreshInterval: 30_000, // 30 seconds
};

// ── Clock ──────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  document.getElementById("clock").textContent = now.toLocaleTimeString(
    "en-SG",
    { hour: "2-digit", minute: "2-digit", hour12: true }
  );
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
  const map = { SEA: "Seats available", SDA: "Standing only", LSD: "Full" };
  return map[code] || "Unknown";
}

function loadClass(code) {
  return `load-${(code || "").toLowerCase()}`;
}

function renderArrivals(data) {
  const main = document.getElementById("arrivals");
  const service = data.Services && data.Services[0];

  if (!service) {
    main.innerHTML = `<div class="error-msg">Bus 92 is not operating right now</div>`;
    return;
  }

  const buses = [
    { label: "Next", data: service.NextBus },
    { label: "2nd", data: service.NextBus2 },
    { label: "3rd", data: service.NextBus3 },
  ];

  main.innerHTML = buses
    .map((bus, i) => {
      const mins = minutesUntil(bus.data?.EstimatedArrival);
      const isArriving = mins !== null && mins <= 1;
      const minsText =
        mins === null ? "—" : isArriving ? "Arr" : String(mins);
      const unit = mins === null ? "" : isArriving ? "" : "min";
      const dest = bus.data?.DestinationCode
        ? `→ ${bus.data.DestinationCode}`
        : "";
      const load = bus.data?.Load || "";

      return `
        <div class="arrival-card ${i === 0 ? "next" : ""}">
          <div class="arrival-label">${bus.label}</div>
          <div class="arrival-minutes ${isArriving ? "arriving" : ""}">${minsText}</div>
          <div class="arrival-unit">${unit}</div>
          ${
            load
              ? `<div class="load-indicator">
                   <span class="load-dot ${loadClass(load)}"></span>
                   ${loadLabel(load)}
                 </div>`
              : ""
          }
          <div class="arrival-destination">${dest}</div>
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
