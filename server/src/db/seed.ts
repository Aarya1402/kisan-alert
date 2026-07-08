import { pool, query, one } from './pool.js';
import { diagnoseVoice } from '../services/health.js';

// Deterministic demo seed. Farmers are placed around Warangal district
// (Telangana) across three blocks so the map, dry-spell and outbreak features
// all have data on first load.

const EXPERTS = [
  { name: 'Dr. K. Ramesh', center: 'RSK Narsampet', block: 'Narsampet', phone: '+91-90000-10001' },
  { name: 'Smt. P. Lakshmi', center: 'KVK Warangal', block: 'Sangem', phone: '+91-90000-10002' },
  { name: 'Sri M. Anjaneyulu', center: 'RSK Duggondi', block: 'Duggondi', phone: '+91-90000-10003' },
];

const FARMERS = [
  { name: 'Rajaiah Gugulothu', phone: '+91-98480-11001', language: 'te', village: 'Khanapur', block: 'Narsampet', district: 'Warangal', land: 1.2, soil: 'red', lat: 17.933, lng: 79.895, n: 55, p: 35, k: 30, ph: 6.3, gw: 14, sm: 11, crop: 'cotton' },
  { name: 'Sarita Devi', phone: '+91-98480-11002', language: 'hi', village: 'Rampur', block: 'Narsampet', district: 'Warangal', land: 0.8, soil: 'black', lat: 17.945, lng: 79.910, n: 70, p: 45, k: 40, ph: 7.1, gw: 9, sm: 16, crop: 'chickpea' },
  { name: 'Venkat Reddy', phone: '+91-98480-11003', language: 'te', village: 'Khanapur', block: 'Narsampet', district: 'Warangal', land: 2.0, soil: 'red', lat: 17.928, lng: 79.902, n: 60, p: 40, k: 35, ph: 6.5, gw: 13, sm: 14, crop: 'maize' },
  { name: 'Ganga Bai', phone: '+91-98480-11004', language: 'mr', village: 'Sangem', block: 'Sangem', district: 'Warangal', land: 1.5, soil: 'black', lat: 17.760, lng: 79.780, n: 90, p: 50, k: 45, ph: 6.8, gw: 6, sm: 28, crop: 'rice' },
  { name: 'Mohan Rao', phone: '+91-98480-11005', language: 'te', village: 'Sangem', block: 'Sangem', district: 'Warangal', land: 1.0, soil: 'loamy', lat: 17.772, lng: 79.795, n: 80, p: 48, k: 40, ph: 6.6, gw: 7, sm: 24, crop: 'maize' },
  { name: 'Anil Kumar', phone: '+91-98480-11006', language: 'hi', village: 'Duggondi', block: 'Duggondi', district: 'Warangal', land: 0.6, soil: 'sandy', lat: 17.880, lng: 79.720, n: 45, p: 30, k: 25, ph: 6.0, gw: 16, sm: 9, crop: 'pigeonpeas' },
  { name: 'Lakshmi Amma', phone: '+91-98480-11007', language: 'te', village: 'Duggondi', block: 'Duggondi', district: 'Warangal', land: 1.1, soil: 'red', lat: 17.892, lng: 79.735, n: 58, p: 38, k: 32, ph: 6.4, gw: 15, sm: 12, crop: 'cotton' },
  { name: 'Prakash Naik', phone: '+91-98480-11008', language: 'hi', village: 'Rampur', block: 'Narsampet', district: 'Warangal', land: 1.8, soil: 'black', lat: 17.950, lng: 79.888, n: 75, p: 46, k: 42, ph: 6.9, gw: 10, sm: 18, crop: 'cotton' },
];

async function seed() {
  console.log('Seeding…');

  for (const e of EXPERTS) {
    await query(`INSERT INTO experts (name, center, block, phone) VALUES ($1,$2,$3,$4)`,
      [e.name, e.center, e.block, e.phone]);
  }

  const farmerIds: number[] = [];
  for (const f of FARMERS) {
    const farmer = await one<any>(
      `INSERT INTO farmers (name, phone, language, village, block, district, land_size_ha, soil_type, geom)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8, ST_SetSRID(ST_MakePoint($9,$10),4326)) RETURNING id`,
      [f.name, f.phone, f.language, f.village, f.block, f.district, f.land, f.soil, f.lng, f.lat]
    );
    farmerIds.push(farmer.id);
    const plot = await one<any>(
      `INSERT INTO plots (farmer_id, label, area_ha, n, p, k, ph, groundwater_m, soil_moisture, current_crop, geom)
       VALUES ($1,'Plot 1',$2,$3,$4,$5,$6,$7,$8,$9, ST_SetSRID(ST_MakePoint($10,$11),4326)) RETURNING id`,
      [farmer.id, f.land, f.n, f.p, f.k, f.ph, f.gw, f.sm, f.crop, f.lng, f.lat]
    );
    // 14 days of simulated sensor readings, trending toward the current level.
    for (let d = 14; d >= 0; d--) {
      const drift = (f.sm as number) + Math.round((Math.sin(d) + 1) * 3) + (d > 7 ? 5 : 0);
      await query(
        `INSERT INTO sensor_readings (plot_id, ts, soil_moisture, temp_c, source)
         VALUES ($1, now() - ($2 || ' days')::interval, $3, $4, 'sim')`,
        [plot.id, d, Math.max(6, drift), 30 + (d % 5)]
      );
    }
  }

  // Weather history per block (30 days) for anomaly baselines.
  const blocks = [...new Set(FARMERS.map((f) => f.block))];
  for (const block of blocks) {
    for (let d = 30; d >= 1; d--) {
      const rain = d % 4 === 0 ? 8 + (d % 7) : d % 9 === 0 ? 22 : 0;
      await query(
        `INSERT INTO weather_daily (block, day, rainfall_mm, temp_c, humidity)
         VALUES ($1, (now() - ($2 || ' days')::interval)::date, $3, $4, $5)
         ON CONFLICT (block, day) DO NOTHING`,
        [block, d, rain, 29 + (d % 6), 55 + (d % 30)]
      );
    }
  }

  // Pre-existing outbreak: 3 Narsampet farmers reported leaf blight recently.
  const narsampet = farmerIds.filter((_, i) => FARMERS[i].block === 'Narsampet').slice(0, 3);
  for (const fid of narsampet) {
    const dx = diagnoseVoice('brown dry patches, leaves drying, jhulsa on maize');
    await query(
      `INSERT INTO diagnoses (farmer_id, input_type, crop, disease, confidence, severity, advice, transcript, escalated, created_at)
       VALUES ($1,'voice',$2,$3,$4,$5,$6,$7,$8, now() - interval '2 days')`,
      [fid, dx.crop, dx.disease, dx.confidence, dx.severity, dx.advice, 'brown dry patches on maize', dx.escalate]
    );
  }

  console.log(`✓ Seeded ${EXPERTS.length} experts, ${FARMERS.length} farmers, sensors & weather.`);
  console.log('  Next: POST /api/advisory/run to raise dry-spell alerts, and diagnose to open tickets.');
  await pool.end();
}

seed().catch((e) => { console.error('Seed failed:', e); process.exit(1); });
