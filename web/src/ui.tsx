import { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-emerald-900/40 bg-[#0f1815] shadow-lg shadow-black/30 ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-300/90">{children}</h2>
      {sub && <p className="text-xs text-emerald-100/40">{sub}</p>}
    </div>
  );
}

const SEV: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-300 border-red-500/30',
  warning: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  info: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  high: 'bg-red-500/15 text-red-300 border-red-500/30',
  medium: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  low: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  urgent: 'bg-red-500/15 text-red-300 border-red-500/30',
  normal: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30',
  open: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  in_review: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  resolved: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
};

export function Badge({ children, tone = 'normal' }: { children: ReactNode; tone?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${SEV[tone] || SEV.normal}`}>
      {children}
    </span>
  );
}

export function Stat({ label, value, hint, tone = 'emerald' }: { label: string; value: ReactNode; hint?: string; tone?: string }) {
  const tones: Record<string, string> = {
    emerald: 'text-emerald-300', red: 'text-red-300', amber: 'text-amber-300', sky: 'text-sky-300',
  };
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wide text-emerald-100/40">{label}</div>
      <div className={`mt-1 text-3xl font-bold ${tones[tone]}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-emerald-100/40">{hint}</div>}
    </Card>
  );
}

export function Button({ children, onClick, variant = 'primary', disabled, className = '' }: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; className?: string;
}) {
  const styles = {
    primary: 'bg-emerald-500 text-emerald-950 hover:bg-emerald-400 disabled:opacity-40',
    ghost: 'border border-emerald-800/60 text-emerald-200 hover:bg-emerald-900/30',
    danger: 'bg-red-500/90 text-white hover:bg-red-500',
  }[variant];
  return (
    <button onClick={onClick} disabled={disabled}
      className={`rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed ${styles} ${className}`}>
      {children}
    </button>
  );
}
