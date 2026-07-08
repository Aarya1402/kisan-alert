import { useEffect, useRef, useState } from 'react';
import { api, LANG_LABEL } from '../api';
import { Card, SectionTitle, Badge, Button } from '../ui';

type Tab = 'call' | 'diagnose' | 'inbox';

export default function FarmerPhone() {
  const [farmers, setFarmers] = useState<any[]>([]);
  const [farmerId, setFarmerId] = useState<number | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [tab, setTab] = useState<Tab>('call');

  const load = () => api.farmers().then((f) => { setFarmers(f); if (!farmerId && f.length) setFarmerId(f[0].id); });
  useEffect(() => { load(); }, []);
  const refreshDetail = () => farmerId && api.farmer(farmerId).then(setDetail);
  useEffect(() => { refreshDetail(); }, [farmerId]);

  const farmer = detail?.farmer;

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      {/* Phone */}
      <div className="mx-auto w-full max-w-[380px]">
        <div className="rounded-[2.2rem] border-4 border-emerald-900/60 bg-black p-3 shadow-2xl shadow-emerald-950">
          <div className="rounded-[1.6rem] bg-[#0c130f] p-4 min-h-[560px] flex flex-col">
            <div className="mb-3 flex items-center justify-between text-[11px] text-emerald-100/40">
              <span>Kisan Alert · 1800-KISAN</span>
              <span>{farmer ? LANG_LABEL[farmer.language] : ''} · 📶 2G</span>
            </div>

            <select value={farmerId ?? ''} onChange={(e) => setFarmerId(Number(e.target.value))}
              className="mb-3 w-full rounded-lg border border-emerald-900/40 bg-black/40 px-3 py-2 text-sm text-emerald-100">
              {farmers.map((f) => (
                <option key={f.id} value={f.id}>{f.name} · {f.village} ({LANG_LABEL[f.language]})</option>
              ))}
            </select>

            <div className="mb-3 grid grid-cols-3 gap-1 rounded-xl bg-black/40 p-1 text-xs">
              {(['call', 'diagnose', 'inbox'] as Tab[]).map((tv) => (
                <button key={tv} onClick={() => setTab(tv)}
                  className={`rounded-lg py-1.5 font-semibold capitalize ${tab === tv ? 'bg-emerald-500 text-emerald-950' : 'text-emerald-200/60'}`}>
                  {tv === 'call' ? '📞 Call' : tv === 'diagnose' ? '🌿 Diagnose' : '✉️ Inbox'}
                </button>
              ))}
            </div>

            <div className="flex-1">
              {farmerId && tab === 'call' && <CallFlow farmerId={farmerId} onChange={refreshDetail} />}
              {farmerId && tab === 'diagnose' && <Diagnose farmerId={farmerId} onChange={refreshDetail} />}
              {tab === 'inbox' && <Inbox messages={detail?.messages || []} />}
            </div>
          </div>
        </div>
      </div>

      {/* Side panel: farmer profile + sensor + alerts */}
      <div className="space-y-5">
        {farmer && (
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-emerald-100">{farmer.name}</h1>
                <p className="text-sm text-emerald-100/50">{farmer.village}, {farmer.block}, {farmer.district} · {farmer.land_size_ha} ha · {farmer.soil_type} soil</p>
              </div>
              <Badge>{LANG_LABEL[farmer.language]}</Badge>
            </div>
            {detail?.plots?.[0] && <SensorPanel plot={detail.plots[0]} onChange={refreshDetail} block={farmer.block} />}
          </Card>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          <Card className="p-5">
            <SectionTitle>Recent alerts (SMS/IVR)</SectionTitle>
            <div className="space-y-2 max-h-64 overflow-auto scrollbar-thin">
              {(detail?.alerts || []).length === 0 && <p className="text-sm text-emerald-100/30">No alerts.</p>}
              {(detail?.alerts || []).map((a: any) => (
                <div key={a.id} className="rounded-lg border border-emerald-900/30 bg-black/20 p-2.5">
                  <div className="flex items-center justify-between"><span className="text-xs font-semibold text-emerald-100">{a.title}</span><Badge tone={a.severity}>{a.severity}</Badge></div>
                  <p className="mt-1 text-[11px] text-emerald-100/50">{a.message}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <SectionTitle>Your tickets</SectionTitle>
            <div className="space-y-2 max-h-64 overflow-auto scrollbar-thin">
              {(detail?.tickets || []).length === 0 && <p className="text-sm text-emerald-100/30">No tickets raised.</p>}
              {(detail?.tickets || []).map((t: any) => (
                <div key={t.id} className="rounded-lg border border-emerald-900/30 bg-black/20 p-2.5">
                  <div className="flex items-center justify-between"><span className="font-mono text-xs text-emerald-300">{t.code}</span><Badge tone={t.status}>{t.status}</Badge></div>
                  <p className="mt-1 text-[11px] text-emerald-100/60">{t.ai_diagnosis}</p>
                  {t.expert_reply && <p className="mt-1 text-[11px] text-emerald-200/80">👨‍🌾 {t.expert_reply}</p>}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function CallFlow({ farmerId, onChange }: { farmerId: number; onChange: () => void }) {
  const [turn, setTurn] = useState<any>(null);
  const [speech, setSpeech] = useState('');
  const [log, setLog] = useState<{ who: 'ivr' | 'farmer'; text: string }[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setTurn(null); setLog([]); }, [farmerId]);
  useEffect(() => { logRef.current?.scrollTo(0, 99999); }, [log]);

  const step = async (body: any, farmerEcho?: string) => {
    if (farmerEcho) setLog((l) => [...l, { who: 'farmer', text: farmerEcho }]);
    const t = await api.ivr({ farmerId, ...body });
    setTurn(t);
    setLog((l) => [...l, { who: 'ivr', text: t.prompt }]);
    onChange();
  };

  const start = () => step({ state: 'welcome' });

  return (
    <div className="flex h-full flex-col">
      <div ref={logRef} className="flex-1 space-y-2 overflow-auto scrollbar-thin pr-1">
        {log.length === 0 && (
          <div className="grid h-full place-items-center text-center">
            <div>
              <div className="text-4xl">📞</div>
              <p className="mt-2 text-sm text-emerald-100/50">Farmer dials <b>1800-KISAN</b> from a feature phone.</p>
              <Button className="mt-3" onClick={start}>Place call</Button>
            </div>
          </div>
        )}
        {log.map((m, i) => (
          <div key={i} className={`flex ${m.who === 'farmer' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs ${m.who === 'farmer' ? 'bg-emerald-500 text-emerald-950' : 'bg-emerald-900/40 text-emerald-100'}`}>
              {m.who === 'ivr' && <span className="mr-1">🔊</span>}{m.text}
            </div>
          </div>
        ))}
      </div>

      {turn && !turn.done && (
        <div className="mt-3 space-y-2">
          {turn.options?.some((o: any) => /^\d$/.test(o.key)) && (
            <div className="grid grid-cols-3 gap-1">
              {turn.options.filter((o: any) => /^\d$/.test(o.key)).map((o: any) => (
                <button key={o.key} onClick={() => step({ state: turn.state, digit: o.key }, `Pressed ${o.key} — ${o.label}`)}
                  className="rounded-lg border border-emerald-800/60 py-2 text-xs text-emerald-100 hover:bg-emerald-900/40">
                  <span className="text-base font-bold">{o.key}</span><br />{o.label}
                </button>
              ))}
            </div>
          )}
          {turn.state === 'disease_listen' && (
            <div className="flex gap-1">
              <input value={speech} onChange={(e) => setSpeech(e.target.value)} placeholder="Speak symptom… e.g. brown dry patches"
                className="flex-1 rounded-lg border border-emerald-900/40 bg-black/30 px-2 py-2 text-xs text-emerald-100 outline-none" />
              <Button onClick={() => { step({ state: 'disease_listen', speech }, `🎙️ "${speech}"`); setSpeech(''); }} disabled={!speech}>Send</Button>
            </div>
          )}
        </div>
      )}
      {turn?.done && (
        <div className="mt-3">
          {turn.payload?.ticket && <p className="mb-2 rounded-lg bg-amber-500/15 p-2 text-[11px] text-amber-200">🎫 Escalated to RSK · Ticket {turn.payload.ticket.code}</p>}
          <Button variant="ghost" className="w-full" onClick={start}>Call again</Button>
        </div>
      )}
    </div>
  );
}

function Diagnose({ farmerId, onChange }: { farmerId: number; onChange: () => void }) {
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const symptoms = [
    { label: '🟡 Leaves turning yellow', text: 'leaves are turning yellow and pale' },
    { label: '🟤 Brown dry patches', text: 'brown dry patches, leaves drying, jhulsa' },
    { label: '🐛 Insects / holes', text: 'insects keeda eating holes in leaves' },
    { label: '⬜ White powder', text: 'white powder safed on leaves mildew' },
    { label: '🥀 Plant wilting', text: 'plant wilting murjha drooping' },
  ];
  const runVoice = async (text: string) => {
    setBusy(true);
    try { setResult(await api.diagnoseVoice(farmerId, text)); onChange(); } finally { setBusy(false); }
  };
  const runImage = async (file: File) => {
    setBusy(true);
    try { setResult(await api.diagnoseImage(farmerId, file, file.name)); onChange(); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-emerald-100/50">No camera? Describe the symptom by voice. With a smartphone, send a photo.</p>
      <div className="space-y-1.5">
        {symptoms.map((s) => (
          <button key={s.text} onClick={() => runVoice(s.text)} disabled={busy}
            className="w-full rounded-lg border border-emerald-900/40 bg-black/20 px-3 py-2 text-left text-xs text-emerald-100 hover:bg-emerald-900/30 disabled:opacity-50">
            {s.label}
          </button>
        ))}
      </div>
      <label className="block cursor-pointer rounded-lg border border-dashed border-emerald-800/60 py-3 text-center text-xs text-emerald-200/70 hover:bg-emerald-900/20">
        📷 Upload leaf photo (smartphone)
        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && runImage(e.target.files[0])} />
      </label>

      {busy && <p className="text-center text-xs text-emerald-100/40">Analyzing…</p>}
      {result && (
        <div className="rounded-xl border border-emerald-900/40 bg-black/30 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-emerald-100">{result.diagnosis.disease}</span>
            <Badge tone={result.diagnosis.severity}>{result.diagnosis.severity}</Badge>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-emerald-950">
            <div className="h-full bg-emerald-400" style={{ width: `${Math.round(result.diagnosis.confidence * 100)}%` }} />
          </div>
          <div className="mt-1 text-[11px] text-emerald-100/50">Confidence {Math.round(result.diagnosis.confidence * 100)}%</div>
          <p className="mt-2 text-xs text-emerald-100/70">{result.diagnosis.advice}</p>
          {result.ticket && <p className="mt-2 rounded-lg bg-amber-500/15 p-2 text-[11px] text-amber-200">🎫 Low confidence / high severity → routed to RSK officer. Ticket {result.ticket.code}.</p>}
          {result.outbreak && <p className="mt-2 rounded-lg bg-red-500/15 p-2 text-[11px] text-red-200">🚨 {result.outbreak.title}</p>}
        </div>
      )}
    </div>
  );
}

function Inbox({ messages }: { messages: any[] }) {
  return (
    <div className="space-y-2 overflow-auto scrollbar-thin">
      {messages.length === 0 && <p className="text-center text-sm text-emerald-100/30">No messages yet.</p>}
      {messages.map((m) => (
        <div key={m.id} className="rounded-xl border border-emerald-900/30 bg-black/20 p-3">
          <div className="mb-1 flex items-center gap-2 text-[10px] uppercase text-emerald-100/40">
            <Badge tone="normal">{m.channel}</Badge>
            <span>{new Date(m.created_at).toLocaleString()}</span>
          </div>
          <p className="text-sm text-emerald-100">{m.body}</p>
          {m.body_en && m.body_en !== m.body && <p className="mt-1 text-[11px] italic text-emerald-100/40">EN: {m.body_en}</p>}
        </div>
      ))}
    </div>
  );
}

function SensorPanel({ plot, onChange, block }: { plot: any; onChange: () => void; block: string }) {
  const [moisture, setMoisture] = useState<number>(Number(plot.soil_moisture ?? 20));
  useEffect(() => { setMoisture(Number(plot.soil_moisture ?? 20)); }, [plot.id]);
  const save = async () => { await api.setSensor(plot.id, moisture); await api.runAdvisory(); onChange(); };
  const tone = moisture < 12 ? 'text-red-400' : moisture < 18 ? 'text-amber-400' : 'text-emerald-400';

  return (
    <div className="mt-4 rounded-xl border border-emerald-900/30 bg-black/20 p-3">
      <div className="flex items-center justify-between text-xs text-emerald-100/50">
        <span>💧 Soil moisture sensor (ESP32 sim · {block})</span>
        <span className={`text-lg font-bold ${tone}`}>{moisture}%</span>
      </div>
      <input type="range" min={5} max={45} value={moisture} onChange={(e) => setMoisture(Number(e.target.value))}
        className="mt-2 w-full accent-emerald-500" />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] text-emerald-100/40">
          N {plot.n} · P {plot.p} · K {plot.k} · pH {plot.ph} · GW {plot.groundwater_m}m
        </span>
        <Button variant="ghost" onClick={save}>Push reading + scan</Button>
      </div>
    </div>
  );
}
