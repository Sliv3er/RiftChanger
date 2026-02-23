import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LibChampion } from '../types/api';

interface Props {
  champions: LibChampion[];
  patch: string;
  loading: boolean;
  onRefresh: () => void;
  addLog: (msg: string) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function Dashboard({ champions, patch, loading, onRefresh, addLog, showToast }: Props) {
  const navigate = useNavigate();
  const [cslolReady, setCslolReady] = useState(false);
  const [mods, setMods] = useState<string[]>([]);

  useEffect(() => {
    if (window.api) {
      window.api.isCslolReady().then(r => {
        setCslolReady(r);
        if (r) window.api.listInstalledMods().then(setMods);
      });
    }
  }, []);

  const stats = useMemo(() => {
    let totalSkins = 0, availableSkins = 0, totalChromas = 0, availableChromas = 0;
    for (const c of champions) {
      for (const s of c.skins) {
        totalSkins++;
        if (s.available) availableSkins++;
        totalChromas += s.chromas.length;
        availableChromas += s.chromas.filter(ch => ch.available).length;
      }
    }
    return { totalSkins, availableSkins, totalChromas, availableChromas };
  }, [champions]);

  // Top 8 champions by available skin count
  const topChamps = useMemo(() => {
    return [...champions]
      .map(c => ({ ...c, availCount: c.skins.filter(s => s.available).length }))
      .filter(c => c.availCount > 0)
      .sort((a, b) => b.availCount - a.availCount)
      .slice(0, 8);
  }, [champions]);

  return (
    <div className="animate-fade-in space-y-6">
      {/* ── HERO ── */}
      <div className="relative overflow-hidden league-card">
        <div className="absolute inset-0 bg-gradient-to-br from-league-blue-darker via-league-blue-deep/40 to-league-blue-darkest" />
        <div className="relative p-8 flex items-center justify-between">
          <div>
            <h1 className="font-beaufort text-4xl font-bold tracking-widest uppercase gold-shimmer">
              RiftChanger
            </h1>
            <p className="text-league-grey-light text-sm mt-1">Custom Skin Manager for League of Legends</p>
            <div className="flex gap-3 mt-5">
              <button onClick={onRefresh} disabled={loading} className="btn-primary">
                {loading ? '⏳ Loading...' : '🔄 Refresh Library'}
              </button>
              <button onClick={() => navigate('/champions')} className="btn-secondary">
                ⚔ Browse Champions
              </button>
              {cslolReady && (
                <button onClick={async () => {
                  const r = await window.api?.launchCslol();
                  if (r) showToast(r.message, r.success ? 'success' : 'error');
                }} className="btn-secondary">🚀 Launch CSLoL</button>
              )}
            </div>
          </div>
          <div className="text-right hidden lg:block">
            <p className="font-beaufort text-5xl text-league-gold-bright">{patch || '...'}</p>
            <p className="text-league-grey-light text-xs uppercase tracking-widest">Current Patch</p>
          </div>
        </div>
      </div>

      {/* ── STATS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label="Champions" value={champions.length} icon="⚔" />
        <Stat label="Total Skins" value={stats.totalSkins} icon="🎨" />
        <Stat label="Available" value={stats.availableSkins} icon="✅" color="text-league-green" />
        <Stat label="Chromas" value={stats.totalChromas} icon="🌈" />
        <Stat label="Active Mods" value={mods.length} icon="⚡" color="text-league-blue-light" />
      </div>

      {/* ── QUICK CHAMPIONS ── */}
      {topChamps.length > 0 && (
        <div>
          <div className="section-header"><h2>Top Champions</h2></div>
          <div className="grid grid-cols-4 lg:grid-cols-8 gap-3">
            {topChamps.map(c => (
              <div
                key={c.id}
                onClick={() => navigate(`/champion/${c.id}`)}
                className="league-card group cursor-pointer overflow-hidden"
              >
                <div className="relative aspect-square overflow-hidden">
                  <img src={c.iconUrl} alt={c.name}
                       className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-league-blue-darkest/80 to-transparent" />
                  <div className="absolute bottom-0 inset-x-0 p-2 text-center">
                    <p className="font-beaufort text-[11px] text-league-gold-light truncate">{c.name}</p>
                    <p className="text-[10px] text-league-green">{c.availCount} skins</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ACTIVE MODS ── */}
      {mods.length > 0 && (
        <div>
          <div className="section-header"><h2>Active Mods ({mods.length})</h2></div>
          <div className="league-card p-4 max-h-40 overflow-y-auto space-y-1">
            {mods.map((m, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 px-3 hover:bg-league-gold/5 transition-colors">
                <span className="text-league-gold-light text-sm truncate">{m.replace('.fantome', '')}</span>
                <button onClick={async () => {
                  if (window.api) {
                    await window.api.removeSkin(m.replace('.fantome', ''));
                    const updated = await window.api.listInstalledMods();
                    setMods(updated);
                  }
                }} className="text-league-red hover:text-red-300 text-xs">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── EMPTY STATE ── */}
      {champions.length === 0 && !loading && (
        <div className="league-card p-12 text-center space-y-4">
          <p className="text-league-gold font-beaufort text-xl">No Library Loaded</p>
          <p className="text-league-grey-light text-sm max-w-md mx-auto">
            Click "Refresh Library" to index your skin collection, or go to Settings to set your library path.
          </p>
          <button onClick={onRefresh} className="btn-primary">Build Library Index</button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, icon, color = 'text-league-gold-bright' }: { label: string; value: number; icon: string; color?: string }) {
  return (
    <div className="stat-card">
      <div className="text-xl mb-1">{icon}</div>
      <div className={`font-beaufort text-2xl font-bold ${color}`}>{value.toLocaleString()}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
