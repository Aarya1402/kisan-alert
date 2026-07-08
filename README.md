# 🌾 Kisan Alert — Smart Water, Crop & Advisory System

A **voice + SMS-first, Indic-language** advisory platform for small & marginal farmers,
with a **human-in-the-loop** Rythu Seva Kendra (RSK) / KVK escalation loop. Built for the
Hack2Skill "Kisan Alert" problem statement.

> **Positioning:** *Not another agri-app — a Bharat-scale advisory layer that meets the
> farmer on a basic phone call, and meets the government's existing RSK/KVK network halfway.*
> AI **triages**, a human expert **decides**.

---

## What's built (end to end, running locally)

Three farmer-facing pillars + an extension-officer command center, all wired through a
mock **Language Gateway** (Bhashini/AI4Bharat ASR→NMT→TTS) and **Telephony** (SMS/IVR) layer.

| Pillar | Endpoint(s) | Highlights |
|---|---|---|
| **1. Crop Recommendation** | `POST /api/crop/recommend` | Nearest-centroid classifier over the Kaggle crop dataset (22 crops) **+ groundwater-aware rule layer** + **explainable** natural-language "why", localized to the farmer's language |
| **2. Advisory & Dry-Spell Alerts** | `POST /api/advisory/run` | Rule engine (rainfall deficit, soil-moisture, heat) + **rolling z-score** rainfall anomaly; breaches auto-dispatch **SMS (warning) / outbound IVR (critical)** |
| **3. Crop-Health Diagnosis** | `POST /api/health/diagnose/{image,voice}` | Image heuristic (PlantVillage-style classes) **and** camera-free **voice-symptom** matcher; **confidence-based escalation** → auto-ticket to RSK; **community outbreak** auto-detection |
| **RSK/KVK Dashboard** | React SPA | Stat tiles, **PostGIS farmer map** (flagged/outbreak zones), live alert feed, **ticket queue**, expert **approve/override + push reply** back to farmer in their language |
| **Farmer Phone Simulator** | React SPA | IVR **finite-state call flow** with keypad + voice, **low-ASR-confidence keypad fallback**, SMS inbox (localized), ESP32 soil-sensor simulation |

**DPI alignment story:** Bhashini (language) · Soil Health Card (NPK) · mKisan (SMS distribution) ·
Bhuvan/GEE (satellite/soil) · IMD/OpenWeather (weather). Each has a real integration point;
the demo uses realistic simulation where sandbox access is slow, and degrades gracefully to
SMS/IVR for feature-phone users.

---

## Tech stack

- **Backend:** Node.js + Express + TypeScript (`tsx`), **PostgreSQL + PostGIS** (Docker)
- **Frontend:** React + Vite + Tailwind v4 + React-Leaflet
- **ML/rules:** nearest-centroid crop model, z-score anomaly engine, keyword/heuristic diagnosis
  (classical + transparent — judges reward correct data integration over model complexity)

---

## Run it (3 commands)

Prereqs: Docker, Node ≥ 20.

```bash
# 1. Start Postgres + PostGIS (port 5544)
docker compose up -d

# 2. Backend — install, create schema, seed demo data, serve on :4000
cd server && npm install && npm run db:reset && npm start

# 3. Frontend — dev server on :5180 (proxies /api → :4000)
cd ../web && npm install && npm run dev
```

Open **http://localhost:5180**.

### One-shot rich demo state
With the server running:
```bash
./scripts/demo-bootstrap.sh
```
Resets the DB, runs an advisory sweep, and drives crop-health reports so the dashboard
loads with dry-spell alerts, escalated tickets, and a **Narsampet leaf-blight outbreak**.

---

## Suggested demo script (highest-impact order)

1. **Farmer Phone → Call.** Pick *Rajaiah (Telugu)*, "Place call". Menu is spoken in Telugu.
   - Press **2** → hear a **dry-spell alert** ("no rain for 10 days, irrigate cotton tonight").
   - Press **1** → **crop recommendation** with an explainable reason (groundwater 14 m → low-water crop).
   - Press **3** → describe *"brown dry patches"* → **Leaf Blight**, escalated with a **ticket code**.
2. **Diagnose / Inbox tabs.** Show camera-free voice diagnosis and the localized SMS inbox.
3. **Soil sensor slider.** Drag moisture below 12 % → "Push reading + scan" → a **critical** alert fires.
4. **RSK Command Center.** Map shows the farmer turn red; the **outbreak zone** ring appears over Narsampet.
5. **Open a ticket** → verify/override the AI diagnosis → **Resolve & send** (SMS or Voice) →
   flip to the Farmer Phone **Inbox** to show the officer's reply arrived in the farmer's language.

---

## Architecture

```
Farmer (IVR / SMS / smartphone)
        │  Language Gateway (Bhashini mock: ASR→NMT→TTS)
        ▼
┌──────────────┬────────────────────┬─────────────────────┐
│ 1 Crop rec.  │ 2 Advisory/alerts   │ 3 Health diagnosis   │
│ centroid+rule│ rules + z-score     │ image + voice + esc.  │
└──────┬───────┴─────────┬──────────┴──────────┬───────────┘
       ▼                 ▼                     ▼
  Farmer data store (Postgres/PostGIS)  ◄──►  RSK/KVK expert portal
  farmers·plots·sensors·weather·alerts        ticket queue · map · override
```

## Repo layout

```
docker-compose.yml         Postgres + PostGIS
scripts/demo-bootstrap.sh  reset + drive a rich demo state
server/                    Express + TS API
  src/db/                  schema.sql · migrate · seed
  src/lib/                 cropData · diseaseData · language (Bhashini mock)
  src/services/            crop · advisory · weather · health · telephony · tickets · ivr
  src/routes/api.ts        all REST endpoints
web/                       React + Vite + Tailwind
  src/pages/               Dashboard · TicketDetail · FarmerPhone
  src/components/          FarmerMap (Leaflet)
```

## API quick reference

`GET /api/health` · `GET /api/stats` · `GET /api/map` · `GET /api/alerts`
`GET|POST /api/farmers` · `GET /api/farmers/:id`
`POST /api/crop/recommend` · `GET /api/weather/:block/forecast`
`POST /api/advisory/run` · `POST /api/plots/:id/sensor`
`POST /api/health/diagnose/image|voice`
`GET /api/tickets` · `GET /api/tickets/:id` · `POST /api/tickets/:id/{status,resolve}`
`POST /api/ivr/step` · `POST /api/language/{asr,translate,tts}`

## Responsible-AI framing
- AI diagnosis returns an **honest confidence**; low-confidence / high-severity always routes
  to a human RSK officer rather than overclaiming.
- Real Bhashini/telephony keys drop into `server/.env` (`BHASHINI_API_KEY`, `OPENWEATHER_API_KEY`);
  without them the system runs on deterministic, demo-safe simulation.
