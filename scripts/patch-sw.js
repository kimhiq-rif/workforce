// Runs after `next build` to inject the OneSignal service worker SDK into
// the workbox-generated sw.js. next-pwa v5.6.0 does not reliably merge
// worker/index.js on Vercel builds, so we patch the file directly.
const fs = require("fs");
const path = require("path");

const swPath = path.join(__dirname, "..", "public", "sw.js");

if (!fs.existsSync(swPath)) {
  console.error("patch-sw: public/sw.js not found — skipping");
  process.exit(0);
}

const existing = fs.readFileSync(swPath, "utf8");
const line = 'importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");\n';

if (existing.includes("OneSignalSDK.sw.js")) {
  console.log("patch-sw: public/sw.js already contains OneSignal SDK — skipping");
  process.exit(0);
}

fs.writeFileSync(swPath, line + existing);
console.log("patch-sw: injected OneSignal SDK into public/sw.js");
