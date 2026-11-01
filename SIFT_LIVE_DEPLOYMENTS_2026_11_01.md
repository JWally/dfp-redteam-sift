# Sift Science sensor hunt — 2026-11-01 (live deployments found)

**Objective:** find a live Sift client-side deployment, capture the sensor, its
beacon endpoint, and the payload shape. All work on public pages only.

**Result: 5 LIVE deployments confirmed with beacon traffic captured, 2 more
with partial markers.** The sensor is Sift's self-contained `s.js` "beacon"
(v121) — NOT the old per-account `cdn.sift.com/<key>/sift.js` (that path is
dead, 404 on every key probed). Beacon data is exfiltrated as a **1x1 image
GET to `https://hexagon-analytics.com/images/<random>.gif?...` — a fully
plaintext, readable query string.** No `api.siftscience.com` / `v205/events`
POSTs were observed for this sensor version.

---

## Live deployments found (beacon pixel captured end-to-end)

| Site | Account key (`bk`) | Sensor URL | Notes |
|---|---|---|---|
| **studypool.com** (StudyPool) | `19f6874a79` | `https://cdn.siftscience.com/s.js` | inline `_sift` snippet + loader on window load |
| **ksl.com** (KSL) | `46e0e4c3e4` | `https://cdn.siftscience.com/s.js` | snippet inside `KSL.onLoad`; fires late |
| **poshmark.com** (Poshmark) | `98eed03b69` | `https://cdn.siftscience.com/s.js` | also sets `esid=sift%3A…` cookie |
| **depop.com** (Depop) | `3aebb2dfc2` | `https://cdn.sift.com/s.js` | uses the new canonical CDN host |
| **paulaschoice.com** (Paula's Choice) | `57cc2a5fd4` | `https://cdn.siftscience.com/s.js` | also has old-style `window.SiftScienceScript` global; `ui` = real user id |

Partial (markers / beacon loads, no pixel observed in our runs):
- **ebth.com** — `_sift` queue + loads s.js + initializes (`Sift=Sift`) but never
  emits a pixel in headless runs (suspect consent-gated or GTM/Turbolinks wiring).
- **remitly.com** — `<link rel=preload href="//cdn.siftscience.com/s.js">` present
  but script is never executed on the homepage (dormant on this page).

All five live sites come from **Sift's own public case-study list**
(`sift.com/resources/case-studies/` pages 1–4), which was the most productive
lead source. Direct CDN account-key guessing (`cdn.sift.com/<brand>/sift.js`)
failed everywhere — that path is discontinued.

## The sensor

- `https://cdn.sift.com/s.js` (also served at legacy host `cdn.siftscience.com/s.js`;
  identical 57,981-byte file, ~19.6 KB gzipped).
- Self-contained: bundles fingerprintjs2/fingerprintjs v3, crypto-js, detectIncognito.
- Reads `window._sift` command queue (`_setAccount`, `_setUserId`, `_setSessionId`,
  `_setTrackerUrl`, `_trackPageview`, …), sets `window.Sift = "Sift"`, collects
  signals, and sends via `new Image(1,1)` to the tracker.
- Default tracker host: `hexagon-analytics.com` (Sift-owned). Pixel:
  `https://hexagon-analytics.com/images/<rand>.gif?<query>`. Returns HTTP 200.
- Device identity: `uu` (a UUID) is persisted in cookie **`__ssid`** (4-year
  expiry) — this is Sift's cross-site device cookie.

## Payload shape (fully plaintext)

Full example (KSL): see `artifacts/ksl-full-pixel.txt`. Field mapping decoded from
`artifacts/sift-beacon-v121.js`:

First block (from `K()`):
```
bk  account key            r   random              v   version ("121")
cs  charset                h   hostname            l   language
P   partnerUserId_(hash)   S   sessionId (hash)    ui  userId (hashed)
uu  device UUID (plaintext) t  page title          u   page URL
rf  referrer               ua  user-agent
nm/mh  #mime types + hash  np/ph #plugins + hash
sh/sw screen h/w           cd  color depth         p   platform
to  tz offset              d   DST offset          ce  cookies enabled
dt  do-not-track           tp  touch points        ol  online
pr/ps/vd product/productSub/vendor
hc  hardware concurrency   je  java enabled
ss/ls/in  storage flags    db  openDB              cp  cpuClass
tl/tr/ts/tb  tamper flags  ab  adblock
cf  canvas fingerprint hash
sri fixed "0"              pf  collection duration (ms)
inc incognito flag         bn  browser name
ow/oh window outer size    wd  webdriver flag      npe notification permission
```

Second block (`f*` = "stable/fast fingerprint" pass):
```
fph plugins hash   fsh/fsw screen h/w   fcd color depth    fp platform
ftp touch points   fhc hw concurrency   fss/fls/fin storage
fcp cpuClass hash  fvch webgl (videoCard) hash   fad audio value
fdm deviceMemory   fvf vendorFlavors    fcg colorGamut     fic invertedColors
ffc forcedColors   fm monochrome        fc contrast        frm reducedMotion
fhdr HDR           fmf math hash        fa architecture    fte/fts touch ev/start
fce cookiesEnabled fpdf pdfViewer       fl languages hash  ft timezone
pfe second-pass duration
```

Hashes (canvas `cf`, webgl `fvch`, audio `fmf`, mime/plugin hashes, session `S`,
user `ui`, partner `P`) are MD5-style 32-hex values. `uu` is the plaintext device
UUID. `mh`/`ph`/`fph` show the MD5-of-empty-string `d41d8cd9…` until interaction
data exists — in all captures the pageview beacon carried `nm=0/np=0` (no mouse
movement / plugin data yet). **Nothing is encrypted or encoded beyond URL-encoding.**

## Beacon behavior notes

- Fires once per `_trackPageview` (pageview pixel). Interaction signals were not
  observed in additional beacons within a ~30s interaction window.
- The beacon only processes `_trackPageview` if the command is delivered after
  the script initializes its command handler (see `beacon-lab.mjs`: snippet-then-
  load replay silently drops it; load-then-push fires). The live sites we found
  load s.js after the queue is pushed, so the replay path works there.
- Beacon does not re-send on repeat visits; `__ssid` is reused (observed same
  `uu` across pages in one browser profile).
- No CSP blocking observed in the live deployments (Poshmark/StudyPool pages even
  show report-only CSP violations for the s.js script tag).

## Repro

```bash
node deep-capture.mjs https://ksl.com
# or StudyPool / Poshmark / Depop / Paula's Choice
```
The capture script launches headless chromium with host-resolver-rules mapping
`hexagon-analytics.com`, `cdn.siftscience.com`, `cdn.sift.com` to their public IPs
(local resolver drops `hexagon-analytics.com`; public DNS resolves it to
34.102.249.210). Output: every sift/hexagon request incl. the full pixel URL,
plus `_sift`/`Sift` globals and cookies. JSON saved under `capture/`.

## What was NOT found (honest negatives)

- Old per-account `cdn.sift.com/<key>/sift.js` / `sift.js?key=` — 404 on every key
  tried (Wingstop, Wayfair, Instacart, Wish, Vimeo `9fc40762c3`, all case-study brands).
- `api.siftscience.com/v205/events` POSTs — not used by this sensor version.
- DoorDash, Reddit, Patreon, Etsy, Turo, Coinbase, Goat, StockX, Mercari, OfferUp,
  Eventbrite, SeatGeek, StubHub, eBay, Airbnb and ~130 more sites — no Sift sensor
  on homepage in headless runs (several embed other vendors: Forter, iovation, etc.).
  Some may only load the sensor in checkout/auth flows (e.g. DoorDash, Turo,
  Remitly) — untested beyond homepage.

## Artifacts (this directory)

- `artifacts/sift-beacon-v121.js` — the exact sensor served by both CDN hosts
- `artifacts/ksl-full-pixel.txt`, `artifacts/depop-full-pixel.txt` — full plaintext payloads
- `artifacts/pixels-collected.json` — 9 captured pixel URLs across the 5 sites
- `capture/*.json` — per-site request/state captures
- Scripts: `deep-capture.mjs`, `browser-probe.mjs`, `beacon-lab.mjs`,
  `cookie-check.mjs`, `sift-customers.mjs`, `probe1.sh`, `curlscan.sh`,
  `sweep2.sh`, `sweep3.sh`

## Still open / next steps

- Probe checkout/signup/account pages of DoorDash, Turo, Remitly, Etsy, Coinbase
  for flow-gated sensor loads.
- Capture a login/session-context pageview on Paula's Choice / Poshmark to see the
  full `ui`/`P`/`S` when a real user id + session is passed.
- Check whether interaction produces follow-up pixels on real-user sessions.
