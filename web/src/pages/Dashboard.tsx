import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, LANG_LABEL } from '../api';
import { Card, SectionTitle, Badge, Stat, Button } from '../ui';
import FarmerMap from '../components/FarmerMap';

export default function Dashboard() {
  const nav = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [map, setMap] = useState<any>({ farmers: [], outbreaks: [] });
  const [alerts, setAlerts] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [s, m, a, t] = await Promise.all([api.stats(), api.map(), api.alerts(), api.tickets()]);
    setStats(s); setMap(m); setAlerts(a); setTickets(t);
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 6000); return () => clearInterval(id); }, [load]);

  const runSweep = async () => {
    setBusy(true);
    try { await api.runAdvisory(); await load(); } finally { setBusy(false); }
  };

  const openTickets = tickets.filter((t) => t.status !== 'resolved');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-emerald-100">RSK / KVK Command Center</h1>
          <p className="text-sm text-emerald-100/50">Warangal District · Rythu Seva Kendra extension network</p>
        </div>
        <Button onClick={runSweep} disabled={busy}>
          {busy ? 'Running…' : '⚡ Run advisory sweep (dry-spell scan)'}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat label="Farmers" value={stats?.farmers?.c ?? '—'} hint="registered" />
        <Stat label="Active alerts" value={stats?.alerts?.c ?? '—'} tone="amber"
          hint={`${stats?.alerts?.crit ?? 0} critical`} />
        <Stat label="Open tickets" value={stats?.tickets?.open ?? '—'} tone="sky" hint="awaiting expert" />
        <Stat label="AI diagnoses" value={stats?.diagnoses?.c ?? '—'} hint="triaged" />
        <Stat label="Outbreak zones" value={stats?.outbreaks?.c ?? '—'} tone="red" hint="cluster-detected" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3 overflow-hidden p-0">
          <div className="flex items-center justify-between px-4 pt-4">
            <SectionTitle sub="green healthy · blue alert · amber ticket · red critical/outbreak">
              Flagged farmers — field-visit map
            </SectionTitle>
          </div>
          <div className="h-[420px] w-full px-4 pb-4">
            <FarmerMap farmers={map.farmers} outbreaks={map.outbreaks} onSelect={(id) =>
              openTickets.find((t) => t.farmer_id === id) &&
              nav(`/tickets/${openTickets.find((t) => t.farmer_id === id).id}`)} />
          </div>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4">
            <SectionTitle sub="most-recent first">Live alert feed</SectionTitle>
            <div className="max-h-[380px] space-y-2 overflow-auto scrollbar-thin pr-1">
              {alerts.length === 0 && <Empty>No alerts yet — run the advisory sweep.</Empty>}
              {alerts.map((a) => (
                <div key={a.id} className="rounded-xl border border-emerald-900/30 bg-black/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-emerald-100">{a.title}</span>
                    <Badge tone={a.severity}>{a.severity}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-emerald-100/60">{a.message}</p>
                  <div className="mt-1.5 flex items-center gap-2 text-[11px] text-emerald-100/40">
                    <span>{a.type}</span>·<span>{a.farmer_name || a.block}</span>·
                    <span className="uppercase">{a.channel}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <SectionTitle sub="human-in-the-loop escalations from AI triage">Expert ticket queue</SectionTitle>
          <span className="text-xs text-emerald-100/40">{openTickets.length} open · {tickets.length} total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-emerald-100/40">
                <th className="pb-2">Ticket</th><th>Farmer</th><th>AI diagnosis</th>
                <th>Conf.</th><th>Priority</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-900/20">
              {tickets.length === 0 && <tr><td colSpan={7}><Empty>No tickets — diagnose a crop from the Farmer Phone.</Empty></td></tr>}
              {tickets.map((t) => (
                <tr key={t.id} className="hover:bg-emerald-900/10">
                  <td className="py-2 font-mono text-xs text-emerald-300">{t.code}</td>
                  <td>
                    <div className="font-medium text-emerald-100">{t.farmer_name}</div>
                    <div className="text-[11px] text-emerald-100/40">{t.village}, {t.block} · {LANG_LABEL[t.language]}</div>
                  </td>
                  <td className="text-emerald-100/80">{t.ai_diagnosis || '—'}</td>
                  <td className="text-emerald-100/60">{t.ai_confidence ? `${Math.round(t.ai_confidence * 100)}%` : '—'}</td>
                  <td><Badge tone={t.priority}>{t.priority}</Badge></td>
                  <td><Badge tone={t.status}>{t.status.replace('_', ' ')}</Badge></td>
                  <td className="text-right">
                    <Button variant="ghost" onClick={() => nav(`/tickets/${t.id}`)}>Open</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-8 text-center text-sm text-emerald-100/30">{children}</div>;
}
