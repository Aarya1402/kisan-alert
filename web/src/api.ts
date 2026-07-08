const BASE = '/api';

async function j<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'content-type': 'application/json' },
    ...opts,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  return res.json();
}

export const api = {
  stats: () => j<any>('/stats'),
  langs: () => j<Record<string, string>>('/langs'),
  farmers: () => j<any[]>('/farmers'),
  farmer: (id: number) => j<any>(`/farmers/${id}`),
  createFarmer: (body: any) => j<any>('/farmers', { method: 'POST', body: JSON.stringify(body) }),
  map: () => j<any>('/map'),
  alerts: () => j<any[]>('/alerts'),
  tickets: (status?: string) => j<any[]>(`/tickets${status ? `?status=${status}` : ''}`),
  ticket: (id: number) => j<any>(`/tickets/${id}`),
  resolveTicket: (id: number, body: any) => j<any>(`/tickets/${id}/resolve`, { method: 'POST', body: JSON.stringify(body) }),
  ticketStatus: (id: number, status: string) => j<any>(`/tickets/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),

  recommend: (farmerId: number) => j<any>('/crop/recommend', { method: 'POST', body: JSON.stringify({ farmerId }) }),
  recommendRaw: (inputs: any) => j<any>('/crop/recommend', { method: 'POST', body: JSON.stringify({ inputs }) }),
  forecast: (block: string, dry = true) => j<any[]>(`/weather/${encodeURIComponent(block)}/forecast?dry=${dry ? 1 : 0}`),
  runAdvisory: (farmerId?: number) => j<any>('/advisory/run', { method: 'POST', body: JSON.stringify({ farmerId, dry: true }) }),
  setSensor: (plotId: number, soil_moisture: number) =>
    j<any>(`/plots/${plotId}/sensor`, { method: 'POST', body: JSON.stringify({ soil_moisture }) }),

  ivr: (body: any) => j<any>('/ivr/step', { method: 'POST', body: JSON.stringify(body) }),
  diagnoseVoice: (farmerId: number, transcript: string) =>
    j<any>('/health/diagnose/voice', { method: 'POST', body: JSON.stringify({ farmerId, transcript }) }),
  diagnoseImage: async (farmerId: number, file: File, hint?: string) => {
    const fd = new FormData();
    fd.append('farmerId', String(farmerId));
    if (hint) fd.append('hint', hint);
    fd.append('image', file);
    const res = await fetch(BASE + '/health/diagnose/image', { method: 'POST', body: fd });
    if (!res.ok) throw new Error('diagnose failed');
    return res.json();
  },
};

export const LANG_LABEL: Record<string, string> = { hi: 'हिंदी', te: 'తెలుగు', mr: 'मराठी', en: 'English' };
