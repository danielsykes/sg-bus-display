/*
 * Cloudflare Worker — LTA DataMall proxy
 *
 * Keeps your API key secret and adds CORS headers so the
 * GitHub Pages frontend can call LTA DataMall directly.
 *
 * Deploy: https://developers.cloudflare.com/workers/get-started/guide/
 *
 * After deploying, set the environment variable:
 *   LTA_API_KEY = <your LTA DataMall AccountKey>
 *
 * Usage from the frontend:
 *   GET https://YOUR-WORKER.workers.dev?BusStopCode=11369&ServiceNo=92
 */

const LTA_BASE = "https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const busStopCode = url.searchParams.get("BusStopCode");
    const serviceNo = url.searchParams.get("ServiceNo");

    if (!busStopCode) {
      return new Response(
        JSON.stringify({ error: "BusStopCode is required" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Build LTA API URL
    const ltaUrl = new URL(LTA_BASE);
    ltaUrl.searchParams.set("BusStopCode", busStopCode);
    if (serviceNo) ltaUrl.searchParams.set("ServiceNo", serviceNo);

    const ltaRes = await fetch(ltaUrl.toString(), {
      headers: {
        AccountKey: env.LTA_API_KEY,
        Accept: "application/json",
      },
    });

    const body = await ltaRes.text();

    return new Response(body, {
      status: ltaRes.status,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
    });
  },
};
