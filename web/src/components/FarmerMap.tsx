import { MapContainer, TileLayer, CircleMarker, Tooltip, Circle } from 'react-leaflet';

interface FarmerPin {
  id: number; name: string; village: string; block: string;
  lat: number; lng: number; critical: number; open_tickets: number; alert_types?: string;
}

function color(f: FarmerPin) {
  if (Number(f.critical) > 0) return '#f87171';       // red — critical alert
  if (Number(f.open_tickets) > 0) return '#fbbf24';   // amber — open ticket
  if (f.alert_types) return '#38bdf8';                // blue — has alerts
  return '#34d399';                                   // green — healthy
}

export default function FarmerMap({ farmers, outbreaks, onSelect }: {
  farmers: FarmerPin[]; outbreaks: any[]; onSelect?: (id: number) => void;
}) {
  const center: [number, number] = farmers.length
    ? [farmers.reduce((a, f) => a + Number(f.lat), 0) / farmers.length,
       farmers.reduce((a, f) => a + Number(f.lng), 0) / farmers.length]
    : [17.87, 79.83];

  // Outbreak zones: center on the mean of that block's farmers.
  const zones = outbreaks.map((o) => {
    const inBlock = farmers.filter((f) => f.block === (o.block || o.data?.block));
    if (!inBlock.length) return null;
    const lat = inBlock.reduce((a, f) => a + Number(f.lat), 0) / inBlock.length;
    const lng = inBlock.reduce((a, f) => a + Number(f.lng), 0) / inBlock.length;
    return { lat, lng, title: o.title };
  }).filter(Boolean) as { lat: number; lng: number; title: string }[];

  return (
    <MapContainer center={center} zoom={11} style={{ height: '100%', width: '100%', borderRadius: '1rem' }} scrollWheelZoom>
      <TileLayer
        attribution='&copy; OpenStreetMap · Kisan Alert'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      {zones.map((z, i) => (
        <Circle key={`z${i}`} center={[z.lat, z.lng]} radius={2800}
          pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.12, weight: 1, dashArray: '4' }}>
          <Tooltip>{z.title}</Tooltip>
        </Circle>
      ))}
      {farmers.map((f) => (
        <CircleMarker key={f.id} center={[Number(f.lat), Number(f.lng)]} radius={9}
          pathOptions={{ color: color(f), fillColor: color(f), fillOpacity: 0.85, weight: 2 }}
          eventHandlers={{ click: () => onSelect?.(f.id) }}>
          <Tooltip>
            <div className="text-xs">
              <div className="font-semibold">{f.name}</div>
              <div>{f.village}, {f.block}</div>
              {Number(f.critical) > 0 && <div className="text-red-600">⚠ {f.critical} critical alert(s)</div>}
              {Number(f.open_tickets) > 0 && <div className="text-amber-600">🎫 {f.open_tickets} open ticket(s)</div>}
              {f.alert_types && <div>Alerts: {f.alert_types}</div>}
            </div>
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
