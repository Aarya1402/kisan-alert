import { NavLink, Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import FarmerPhone from './pages/FarmerPhone';
import TicketDetail from './pages/TicketDetail';

function Nav() {
  const link = (to: string, label: string, icon: string) => (
    <NavLink to={to} end={to === '/'}
      className={({ isActive }) =>
        `flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
          isActive ? 'bg-emerald-500 text-emerald-950' : 'text-emerald-200/70 hover:bg-emerald-900/40'
        }`
      }>
      <span>{icon}</span>{label}
    </NavLink>
  );
  return (
    <header className="sticky top-0 z-[500] border-b border-emerald-900/40 bg-[#0a0f0d]/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500 text-lg">🌾</div>
          <div>
            <div className="text-sm font-bold tracking-tight text-emerald-100">Kisan Alert</div>
            <div className="text-[11px] text-emerald-100/40">Smart Water · Crop · Advisory</div>
          </div>
        </div>
        <nav className="flex items-center gap-1">
          {link('/', 'RSK Command Center', '🛰️')}
          {link('/phone', 'Farmer Phone', '📞')}
        </nav>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <div className="min-h-full">
      <Nav />
      <main className="mx-auto max-w-7xl px-5 py-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tickets/:id" element={<TicketDetail />} />
          <Route path="/phone" element={<FarmerPhone />} />
        </Routes>
      </main>
      <footer className="mx-auto max-w-7xl px-5 py-6 text-center text-xs text-emerald-100/30">
        Hack2Skill · Kisan Alert · Voice + SMS-first advisory on India DPI (Bhashini · Soil Health Card · mKisan · Bhuvan)
      </footer>
    </div>
  );
}
