import { query, one } from '../db/pool.js';
import { forecast, recentRainfall, DayWeather } from './weather.js';
import { dispatch } from './telephony.js';

export interface DetectedAlert {
  type: 'dry_spell' | 'soil_moisture_critical' | 'heat_stress';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  data: Record<string, any>;
}

// Rolling z-score of upcoming rainfall vs recent recorded baseline.
function rainfallZScore(recent: DayWeather[], upcoming: DayWeather[]): number {
  if (recent.length < 5) return 0;
  const vals = recent.map((d) => Number(d.rainfall_mm));
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length) || 1;
  const upMean = upcoming.slice(0, 7).reduce((a, d) => a + Number(d.rainfall_mm), 0) / 7;
  return (upMean - mean) / sd;
}

function longestDrySpell(days: DayWeather[], threshold = 2): number {
  let max = 0, cur = 0;
  for (const d of days) {
    if (Number(d.rainfall_mm) < threshold) { cur++; max = Math.max(max, cur); } else cur = 0;
  }
  return max;
}

// Evaluate all rule thresholds for one plot/block and return breached alerts.
export async function evaluatePlot(plot: {
  id: number; farmer_id: number; block: string; soil_moisture?: number; current_crop?: string;
}, opts: { dry?: boolean } = {}): Promise<DetectedAlert[]> {
  const alerts: DetectedAlert[] = [];
  const upcoming = await forecast(plot.block, opts.dry);
  const recent = await recentRainfall(plot.block);

  // 1. Dry-spell: rainfall deficit over consecutive upcoming days.
  const spell = longestDrySpell(upcoming);
  const z = rainfallZScore(recent, upcoming);
  if (spell >= 7) {
    alerts.push({
      type: 'dry_spell', severity: spell >= 9 ? 'critical' : 'warning',
      title: `No rain expected for ${spell} days`,
      message: `No significant rain is forecast for the next ${spell} days in ${plot.block}. ` +
        (plot.current_crop ? `Delay sowing / irrigate ${plot.current_crop} tonight. ` : 'Delay sowing and conserve soil moisture. ') +
        `(rainfall anomaly z=${z.toFixed(1)})`,
      data: { dry_days: spell, zscore: Number(z.toFixed(2)), forecast: upcoming },
    });
  }

  // 2. Soil-moisture critical: latest sensor reading below wilting threshold.
  const sm = plot.soil_moisture ?? (await latestMoisture(plot.id));
  if (sm != null && sm < 18) {
    alerts.push({
      type: 'soil_moisture_critical', severity: sm < 12 ? 'critical' : 'warning',
      title: `Soil moisture critical (${sm}%)`,
      message: `Soil moisture at ${sm}% is below the safe level for ${plot.current_crop || 'your crop'}. Irrigate tonight to avoid crop stress.`,
      data: { soil_moisture: sm },
    });
  }

  // 3. Heat stress: sustained high temperature in the forecast.
  const hotDays = upcoming.filter((d) => Number(d.temp_c) >= 38).length;
  if (hotDays >= 3) {
    alerts.push({
      type: 'heat_stress', severity: hotDays >= 5 ? 'critical' : 'warning',
      title: `Heat stress: ${hotDays} days ≥ 38°C`,
      message: `${hotDays} of the next 10 days are forecast at or above 38°C in ${plot.block}. Irrigate in the evening and mulch to reduce evaporation.`,
      data: { hot_days: hotDays },
    });
  }

  return alerts;
}

async function latestMoisture(plotId: number): Promise<number | null> {
  const row = await one<{ soil_moisture: number }>(
    `SELECT soil_moisture FROM sensor_readings WHERE plot_id=$1 ORDER BY ts DESC LIMIT 1`, [plotId]
  );
  return row ? Number(row.soil_moisture) : null;
}

// Persist an alert and dispatch it to the farmer over SMS/IVR.
export async function raiseAlert(farmer: any, block: string, a: DetectedAlert, channel: 'sms' | 'ivr' = 'sms') {
  const row = await one(
    `INSERT INTO alerts (farmer_id, block, type, severity, title, message, data, channel)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [farmer.id, block, a.type, a.severity, a.title, a.message, JSON.stringify(a.data), channel]
  );
  await dispatch(farmer, channel, a.message, { kind: 'alert', alert_type: a.type, severity: a.severity });
  return row;
}
