import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, LANG_LABEL } from '../api';
import { Card, SectionTitle, Badge, Button } from '../ui';

export default function TicketDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState<any>(null);
  const [reply, setReply] = useState('');
  const [finalDx, setFinalDx] = useState('');
  const [channel, setChannel] = useState('sms');
  const [busy, setBusy] = useState(false);

  const load = () => api.ticket(Number(id)).then((d) => {
    setData(d);
    setFinalDx(d.ticket.ai_diagnosis || '');
    if (d.ticket.expert_reply) setReply(d.ticket.expert_reply);
  });
  useEffect(() => { load(); }, [id]);

  if (!data) return <div className="text-emerald-100/40">Loading…</div>;
  const t = data.ticket;

  const resolve = async () => {
    setBusy(true);
    try {
      await api.resolveTicket(t.id, { reply, finalDiagnosis: finalDx, channel });
      await load();
    } finally { setBusy(false); }
  };
  const setStatus = async (s: string) => { await api.ticketStatus(t.id, s); await load(); };

  return (
    <div className="space-y-5">
      <button onClick={() => nav('/')} className="text-sm text-emerald-300/70 hover:text-emerald-200">← Back to command center</button>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-sm text-emerald-300">{t.code}</div>
                <h1 className="mt-1 text-xl font-bold text-emerald-100">{t.summary}</h1>
              </div>
              <div className="flex gap-2">
                <Badge tone={t.priority}>{t.priority}</Badge>
                <Badge tone={t.status}>{t.status.replace('_', ' ')}</Badge>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <Field label="Farmer" value={t.farmer_name} />
              <Field label="Phone" value={t.phone} />
              <Field label="Village / Block" value={`${t.village}, ${t.block}`} />
              <Field label="Language" value={LANG_LABEL[t.language]} />
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle sub="AI triage output — verify or override before replying">AI diagnosis</SectionTitle>
            {data.diagnosis ? (
              <div className="rounded-xl border border-emerald-900/30 bg-black/20 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-emerald-100">{data.diagnosis.disease}</span>
                  <Badge tone={data.diagnosis.severity}>{data.diagnosis.severity} severity</Badge>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-emerald-950">
                  <div className="h-full bg-emerald-400" style={{ width: `${Math.round(data.diagnosis.confidence * 100)}%` }} />
                </div>
                <div className="mt-1 text-xs text-emerald-100/50">Model confidence {Math.round(data.diagnosis.confidence * 100)}% · via {data.diagnosis.input_type}</div>
                {data.diagnosis.transcript && <p className="mt-2 text-xs italic text-emerald-100/50">Farmer said: “{data.diagnosis.transcript}”</p>}
                <p className="mt-2 text-sm text-emerald-100/70">{data.diagnosis.advice}</p>
              </div>
            ) : <p className="text-sm text-emerald-100/40">{t.ai_diagnosis} ({Math.round((t.ai_confidence || 0) * 100)}%)</p>}
          </Card>

          <Card className="p-5">
            <SectionTitle>Timeline</SectionTitle>
            <ol className="space-y-3">
              {data.events.map((e: any) => (
                <li key={e.id} className="flex gap-3">
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                  <div>
                    <div className="text-sm text-emerald-100">{e.action.replace('_', ' ')} <span className="text-emerald-100/40">· {e.actor}</span></div>
                    {e.note && <div className="text-xs text-emerald-100/50">{e.note}</div>}
                    <div className="text-[11px] text-emerald-100/30">{new Date(e.created_at).toLocaleString()}</div>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <SectionTitle sub="approve or override the AI, then push reply to the farmer">Expert action</SectionTitle>
            <label className="text-xs text-emerald-100/50">Confirmed diagnosis</label>
            <input value={finalDx} onChange={(e) => setFinalDx(e.target.value)}
              className="mt-1 w-full rounded-lg border border-emerald-900/40 bg-black/30 px-3 py-2 text-sm text-emerald-100 outline-none focus:border-emerald-500" />

            <label className="mt-3 block text-xs text-emerald-100/50">Advice to farmer</label>
            <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={4}
              placeholder="e.g. Confirmed leaf blight. Spray Mancozeb, remove affected leaves. Visit RSK Friday."
              className="mt-1 w-full rounded-lg border border-emerald-900/40 bg-black/30 px-3 py-2 text-sm text-emerald-100 outline-none focus:border-emerald-500" />

            <label className="mt-3 block text-xs text-emerald-100/50">Reply channel</label>
            <div className="mt-1 flex gap-2">
              {['sms', 'ivr'].map((c) => (
                <button key={c} onClick={() => setChannel(c)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${channel === c ? 'bg-emerald-500 text-emerald-950' : 'border border-emerald-800/60 text-emerald-200'}`}>
                  {c === 'sms' ? '✉️ SMS' : '📞 Voice call'}
                </button>
              ))}
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <Button onClick={resolve} disabled={busy || !reply || t.status === 'resolved'}>
                {t.status === 'resolved' ? '✓ Resolved & sent' : busy ? 'Sending…' : `Resolve & send to farmer (${t.language.toUpperCase()})`}
              </Button>
              {t.status !== 'resolved' && (
                <Button variant="ghost" onClick={() => setStatus('in_review')} disabled={t.status === 'in_review'}>
                  Mark in review
                </Button>
              )}
            </div>
            {t.expert_reply && (
              <p className="mt-3 rounded-lg bg-emerald-900/20 p-2 text-xs text-emerald-200/80">
                Sent to farmer: “{t.expert_reply}”
              </p>
            )}
          </Card>

          <Card className="p-5">
            <SectionTitle>Assigned officer</SectionTitle>
            <div className="text-sm text-emerald-100">{t.expert_name || 'Unassigned'}</div>
            <div className="text-xs text-emerald-100/50">{t.center}</div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-emerald-100/40">{label}</div>
      <div className="text-emerald-100">{value}</div>
    </div>
  );
}
