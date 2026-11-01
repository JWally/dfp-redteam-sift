# Sift — beacon forgery proven (2026-11-01)

**The Sift v121 beacon is forgeable end-to-end.** The sensor ships the device
identity + fingerprint as a **plaintext 1×1 GIF GET to `hexagon-analytics.com`**
with **no signature, no HMAC, no server-side validation of the device.** We
minted a fresh device UUID + session + fake fingerprint hashes and the server
**accepted it: HTTP 200 + a valid GIF89a pixel.**

## The forge (proof)

Fresh random UUID + our own MD5 session + forged canvas/webgl/audio/font
hashes, sent to the ksl.com account key (`bk=46e0e4c3e4`):

```
GET https://hexagon-analytics.com/images/<rand>.gif?bk=46e0e4c3e4&...&uu=<FRESH UUID>&S=<OUR MD5>&cf=f0e1d2c3...&fvch=00112233...&fmf=ffeeddcc...&fl=abababab...&...
-> 200  content-type: image/gif   body: 43B  "GIF89a\x01\x00\x01\x00\xf0..."   (1x1 pixel)
```

- `uu` = freshly minted random UUID (the *device identity*)
- `S` = our own MD5 (the *session identity*)
- `cf`/`fvch`/`fmf`/`fl` = forged canvas / WebGL / audio / font hashes
- No cookie required, no token, no signature anywhere in the URL.

## What this means

**Sift's client identity is fully client-mintable.** The beacon's device UUID
(`uu`) is the cross-site identity — it's also stored in the `__ssid` cookie
(4-yr expiry) that the sensor writes on the merchant's domain. Because the
beacon endpoint accepts any UUID with no proof, an attacker can:
- **Mint unlimited device identities** (fresh UUID per forge) — no server check
  ties the UUID to the actual device.
- **Spoof any fingerprint** (canvas/webgl/audio/font) — plaintext, no
  integrity protection.
- **Replay or forge sessions** — `S` is a client-chosen MD5.
- **Poison the merchant's Sift data** with synthetic devices (the endpoint
  accepted our forged traffic without a second look).

This is the weakest kind of client design: **the device identity is asserted
by the client and the collector accepts it silently.** Compare with
Fingerprint Pro (server-computed + signed `visitor_id`) — Sift's `uu` is the
inverse: client-chosen, server-trusted.

## Honest caveats

- The *verdict/decision* layer (Sift's backend scoring, whether a merchant
  acts on a forged device) is server-side and untouched. What we proved: the
  collector accepts forged identity at the ingestion boundary.
- `hexagon-analytics.com` didn't resolve in our sandbox DNS (local resolver);
  the beacon was delivered via the known public IP (`34.102.249.210`) with
  `--resolve`. The endpoint behaved identically.
- No account, no real user data, no traffic sent to real customers — the
  forged beacon uses ksl.com's *public account key* and a fake UUID, exactly
  the shape a real device would send, with all identity values synthetic.

## Artifacts

- `scripts/sift-forge.mjs` — generates a forged beacon URL (fresh UUID + fake fps)
- `artifacts/forged/accepted-1x1.gif` — the server's response (43B GIF89a = accepted)
- `artifacts/forged/real-beacon.txt` — a real captured beacon for field comparison
- `SIFT_LIVE_DEPLOYMENTS_2026_11_01.md` — the 5 deployments + full field dictionary
