# 🚌 sg-bus-display

A minimal bus arrival dashboard for **Bus 92 at Henry Park** (Singapore), designed to be cast to a **Google Nest Hub**.

![Dashboard optimised for 1024×600 Nest Hub display](https://img.shields.io/badge/display-1024%C3%97600-blue)

## Architecture

```
┌──────────────┐     ┌─────────────────────┐     ┌──────────────┐
│  Nest Hub     │────▶│  GitHub Pages        │────▶│  Cloudflare  │────▶ LTA DataMall
│  (cast)       │     │  (frontend)          │     │  Worker      │     Bus Arrival API
└──────────────┘     └─────────────────────┘     └──────────────┘
```

- **Frontend** — static HTML/CSS/JS hosted on GitHub Pages
- **Proxy** — Cloudflare Worker keeps your LTA API key secret and adds CORS headers
- **Data** — [LTA DataMall Bus Arrival v2](https://datamall.lta.gov.sg/content/datamall/en/dynamic-data.html) (bus stop 11369, service 92)

## Setup

### 1. Deploy the Cloudflare Worker (API proxy)

```bash
# Install Wrangler CLI
npm install -g wrangler

# Authenticate
wrangler login

# From the repo root
cd worker
wrangler init sg-bus-proxy
# Copy worker.js into the generated project's src/index.js

# Set your LTA API key as a secret
wrangler secret put LTA_API_KEY
# Paste your key when prompted

# Deploy
wrangler deploy
```

Note the deployed URL (e.g. `https://sg-bus-proxy.<you>.workers.dev`).

### 2. Configure the frontend

Edit `js/app.js` and set `CONFIG.apiUrl` to your Worker URL:

```js
const CONFIG = {
  apiUrl: "https://sg-bus-proxy.<you>.workers.dev",
  ...
};
```

### 3. Enable GitHub Pages

1. Go to **Settings → Pages** in this repo
2. Set **Source** to `Deploy from a branch`
3. Select the `master` branch, root `/`
4. Save — your site will be at `https://<user>.github.io/sg-bus-display/`

### 4. Cast to Nest Hub

Use [CATT](https://github.com/skorokithakis/catt) to cast the dashboard:

```bash
pip install catt
catt -d <nest-hub-ip> cast_site https://<user>.github.io/sg-bus-display/
```

To keep it persistent, set up a cron job or use [ha-catt-fix](https://github.com/swiergot/ha-catt-fix).

## Customisation

| Setting | File | Description |
|---------|------|-------------|
| Bus stop | `js/app.js` → `CONFIG.busStopCode` | LTA bus stop code |
| Bus service | `js/app.js` → `CONFIG.serviceNo` | Bus service number |
| Refresh rate | `js/app.js` → `CONFIG.refreshInterval` | Milliseconds between updates |
| Theme colours | `css/style.css` → `:root` | CSS custom properties |

## License

MIT
