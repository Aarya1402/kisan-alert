-- Kisan Alert schema
CREATE EXTENSION IF NOT EXISTS postgis;

DROP TABLE IF EXISTS ticket_events CASCADE;
DROP TABLE IF EXISTS tickets CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS diagnoses CASCADE;
DROP TABLE IF EXISTS recommendations CASCADE;
DROP TABLE IF EXISTS sensor_readings CASCADE;
DROP TABLE IF EXISTS weather_daily CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS plots CASCADE;
DROP TABLE IF EXISTS farmers CASCADE;
DROP TABLE IF EXISTS experts CASCADE;

-- Extension officers at Rythu Seva Kendras / Krishi Vigyan Kendras
CREATE TABLE experts (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  center        TEXT NOT NULL,          -- RSK/KVK name
  block         TEXT NOT NULL,
  phone         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE farmers (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  phone         TEXT UNIQUE NOT NULL,
  language      TEXT NOT NULL DEFAULT 'hi',  -- hi | te | mr | en
  village       TEXT NOT NULL,
  block         TEXT NOT NULL,
  district      TEXT NOT NULL,
  land_size_ha  NUMERIC(6,2) NOT NULL DEFAULT 1.0,
  soil_type     TEXT NOT NULL DEFAULT 'loamy', -- sandy | loamy | clay | black | red
  geom          geometry(Point, 4326),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE plots (
  id            SERIAL PRIMARY KEY,
  farmer_id     INT NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  label         TEXT NOT NULL DEFAULT 'Plot 1',
  area_ha       NUMERIC(6,2) NOT NULL DEFAULT 1.0,
  -- Soil Health Card style nutrient values
  n             NUMERIC, -- kg/ha
  p             NUMERIC,
  k             NUMERIC,
  ph            NUMERIC,
  soil_moisture NUMERIC, -- % latest
  groundwater_m NUMERIC, -- depth to water table (m)
  current_crop  TEXT,
  geom          geometry(Point, 4326),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE weather_daily (
  id            SERIAL PRIMARY KEY,
  block         TEXT NOT NULL,
  day           DATE NOT NULL,
  rainfall_mm   NUMERIC NOT NULL,
  temp_c        NUMERIC NOT NULL,
  humidity      NUMERIC NOT NULL,
  UNIQUE(block, day)
);

CREATE TABLE sensor_readings (
  id            SERIAL PRIMARY KEY,
  plot_id       INT NOT NULL REFERENCES plots(id) ON DELETE CASCADE,
  ts            TIMESTAMPTZ NOT NULL DEFAULT now(),
  soil_moisture NUMERIC NOT NULL, -- %
  temp_c        NUMERIC,
  source        TEXT NOT NULL DEFAULT 'sim' -- sim | esp32
);

CREATE TABLE recommendations (
  id            SERIAL PRIMARY KEY,
  farmer_id     INT NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  plot_id       INT REFERENCES plots(id) ON DELETE SET NULL,
  crop          TEXT NOT NULL,
  score         NUMERIC NOT NULL,
  alternatives  JSONB NOT NULL DEFAULT '[]',
  explanation   TEXT NOT NULL,
  features      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE alerts (
  id            SERIAL PRIMARY KEY,
  farmer_id     INT REFERENCES farmers(id) ON DELETE CASCADE,
  block         TEXT,
  type          TEXT NOT NULL,   -- dry_spell | soil_moisture_critical | heat_stress | outbreak
  severity      TEXT NOT NULL,   -- info | warning | critical
  title         TEXT NOT NULL,
  message       TEXT NOT NULL,
  data          JSONB NOT NULL DEFAULT '{}',
  channel       TEXT NOT NULL DEFAULT 'sms', -- sms | ivr
  acknowledged  BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE diagnoses (
  id            SERIAL PRIMARY KEY,
  farmer_id     INT NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  plot_id       INT REFERENCES plots(id) ON DELETE SET NULL,
  input_type    TEXT NOT NULL,   -- image | voice
  crop          TEXT,
  disease       TEXT NOT NULL,
  confidence    NUMERIC NOT NULL,
  severity      TEXT NOT NULL,   -- low | medium | high
  advice        TEXT NOT NULL,
  transcript    TEXT,            -- for voice input
  image_path    TEXT,
  escalated     BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tickets (
  id            SERIAL PRIMARY KEY,
  code          TEXT UNIQUE NOT NULL,   -- e.g. KA-2026-0001 (SMS-trackable)
  farmer_id     INT NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  diagnosis_id  INT REFERENCES diagnoses(id) ON DELETE SET NULL,
  expert_id     INT REFERENCES experts(id) ON DELETE SET NULL,
  category      TEXT NOT NULL,   -- crop_health | outbreak | advisory
  status        TEXT NOT NULL DEFAULT 'open', -- open | in_review | resolved
  priority      TEXT NOT NULL DEFAULT 'normal', -- normal | high | urgent
  summary       TEXT NOT NULL,
  ai_diagnosis  TEXT,
  ai_confidence NUMERIC,
  expert_reply  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ticket_events (
  id            SERIAL PRIMARY KEY,
  ticket_id     INT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  actor         TEXT NOT NULL,   -- system | expert | farmer
  action        TEXT NOT NULL,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Outbound message log (SMS / IVR) — simulates mKisan-style dispatch
CREATE TABLE messages (
  id            SERIAL PRIMARY KEY,
  farmer_id     INT REFERENCES farmers(id) ON DELETE CASCADE,
  phone         TEXT NOT NULL,
  channel       TEXT NOT NULL,   -- sms | ivr | whatsapp
  direction     TEXT NOT NULL DEFAULT 'out', -- in | out
  language      TEXT NOT NULL DEFAULT 'hi',
  body          TEXT NOT NULL,   -- localized text
  body_en       TEXT,            -- english for dashboard
  meta          JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_farmers_geom ON farmers USING GIST (geom);
CREATE INDEX idx_plots_geom ON plots USING GIST (geom);
CREATE INDEX idx_alerts_farmer ON alerts(farmer_id);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_sensor_plot_ts ON sensor_readings(plot_id, ts);
