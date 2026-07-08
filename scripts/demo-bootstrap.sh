#!/usr/bin/env bash
# Resets the DB to the seed state, then drives the API to produce a rich,
# deterministic demo: dry-spell alerts, escalated tickets, and an outbreak.
set -euo pipefail
API="${API:-http://localhost:4000/api}"
cd "$(dirname "$0")/../server"

echo "→ Resetting database (migrate + seed)…"
# Use the prebuilt single-file bundles if present (reliable), else full reset.
if [ -f dist/migrate.cjs ] && [ -f dist/seed.cjs ]; then
  node dist/migrate.cjs && node dist/seed.cjs
else
  npm run --silent db:reset
fi

echo "→ Running advisory sweep (dry-spell / soil-moisture / heat scan)…"
curl -s -X POST "$API/advisory/run" -H 'content-type: application/json' -d '{}' \
  | python3 -c "import sys,json;print('   raised', json.load(sys.stdin)['raised'],'alerts')"

echo "→ Creating crop-health escalations (voice + image paths)…"
# Two Narsampet farmers report leaf blight by voice -> with the 3 seeded reports
# this crosses the outbreak threshold and auto-escalates a regional alert.
curl -s -X POST "$API/health/diagnose/voice" -H 'content-type: application/json' \
  -d '{"farmerId":1,"transcript":"brown dry patches leaves drying jhulsa on cotton"}' >/dev/null
curl -s -X POST "$API/health/diagnose/voice" -H 'content-type: application/json' \
  -d '{"farmerId":3,"transcript":"leaves have brown blight patches drying"}' >/dev/null
# A Sangem farmer reports pests (separate high-severity ticket).
curl -s -X POST "$API/health/diagnose/voice" -H 'content-type: application/json' \
  -d '{"farmerId":4,"transcript":"insects keeda eating holes in leaves"}' >/dev/null

echo "→ Generating a crop recommendation for a deep-groundwater farmer…"
curl -s -X POST "$API/crop/recommend" -H 'content-type: application/json' -d '{"farmerId":6}' \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print('   best:',d['best']['name'])"

echo "✓ Demo state ready. Open the dashboard at http://localhost:5180"
