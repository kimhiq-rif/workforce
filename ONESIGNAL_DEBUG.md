# OneSignal - "no subscriptions registered" - fast triage

Symptom: OneSignal is not registering web-push subscriptions, so Audience >
Subscriptions stays empty and no pushes arrive.

Stack context:
- Next.js PWA with `next-pwa`.
- OneSignal v16 Web SDK.
- Init: `components/OneSignalInit.tsx`.
- OneSignal App ID: `99920054-1c05-4673-8652-95599e8efbd6`.
- Configured Site URL: `https://workforce-ivory-delta.vercel.app`.
- Required Vercel env vars: `NEXT_PUBLIC_ONESIGNAL_APP_ID`,
  `ONESIGNAL_REST_API_KEY`.

## 1. Service worker sidecar blocked by middleware

`next-pwa` serves `/sw.js`, but that file imports generated root-level files such
as `/worker-<build-id>.js` and `/workbox-<hash>.js`. If middleware redirects those
files to `/login`, the browser receives HTML instead of JavaScript and OneSignal's
service worker SDK never loads.

Fast test:

```js
const sw = await fetch("/sw.js").then((r) => r.text());
const workerPath = sw.match(/importScripts\("([^"]*worker-[^"]+\.js)"\)/)?.[1];
console.log(workerPath);
await fetch(`/${workerPath}`).then(async (r) => ({
  status: r.status,
  contentType: r.headers.get("content-type"),
  startsWith: (await r.text()).slice(0, 40),
}));
```

Expected: status 200, JavaScript content, and a body containing
`OneSignalSDK.sw.js`.

If it returns the login page or `text/html`, allow root PWA assets through
`middleware.ts`:

```ts
const isPwaAsset =
  pathname === "/manifest.json" ||
  pathname === "/sw.js" ||
  /^\/(?:worker|workbox)-.*\.js$/.test(pathname);
```

## 2. `NEXT_PUBLIC_ONESIGNAL_APP_ID` not baked into the live bundle

`NEXT_PUBLIC_*` values are inlined at build time. If the var was added in Vercel
after the deployed build, the client bundle has `undefined`, `OneSignalInit`
returns early, the SDK is never injected, and there may be no visible error.

On the live site console after login:

```js
document.querySelector('script[src*="OneSignalSDK.page.js"]');
window.OneSignal;
```

If both are missing, trigger a fresh Vercel redeploy after confirming the env var
exists for the active environment.

## 3. Origin mismatch

Web push only registers on the exact origin configured in OneSignal. A preview or
branch URL can fail silently.

Expected address bar:

```text
https://workforce-ivory-delta.vercel.app
```

## 4. v16 permission is not the same as subscription

In OneSignal v16, granting notification permission does not always mean the push
subscription is opted in.

Check after enabling:

```js
OneSignal.Notifications.permission;
await OneSignal.User.PushSubscription.optedIn;
await OneSignal.User.PushSubscription.id;
```

Expected: permission true, optedIn true, and a non-null subscription id.

If permission is true but optedIn is false:

```js
await OneSignal.User.PushSubscription.optIn();
```

The source code path in `lib/onesignal.ts` should call `optIn()` after permission
is granted and during user sync. If production does not, redeploy the current
source.

## 5. Turn on trace logs

```js
OneSignal.Debug.setLogLevel("trace");
```

Reload and read the OneSignal init logs. They usually print the exact failure:
service worker registration, app id missing, rejected origin, or unsupported
browser mode.

## Also confirm

- Not incognito/private mode.
- iOS only works as an installed PWA on iOS 16.4+, not in a Safari tab.
- OneSignal dashboard > Audience > Subscriptions should show a record shortly
  after granting permission.

Current high-probability causes:
- Root-level `worker-*.js` was redirected by middleware.
- Production bundle is stale and does not include the current v16 `optIn()` path.
- Vercel env was added after the last deployment.
