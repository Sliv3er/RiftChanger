import { useState, useEffect, useCallback } from 'react';
import Titlebar from './components/Titlebar';
import Collection from './pages/Collection';
import Generator from './pages/Generator';
import Settings from './pages/Settings';
import type { ChampionData, ScanResult } from './types/api';

type Page = 'collection' | 'generator' | 'settings';

export default function App() {
  const [page, setPage] = useState<Page>('collection');
  const [champions, setChampions] = useState<ChampionData[]>([]);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [patch, setPatch] = useState('');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const notify = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    (async () => {
      if (!window.api) return;
      const [p, c, s] = await Promise.all([
        window.api.getPatch(),
        window.api.getChampions(),
        window.api.scan(),
      ]);
      setPatch(p); setChampions(c); setScanResult(s);
    })();
  }, []);

  const rescan = useCallback(async () => {
    if (!window.api) return;
    setScanResult(await window.api.scan());
  }, []);

  return (
    <div className="h-screen flex flex-col bg-[#010A13] overflow-hidden">
      <Titlebar />

      {/* Nav */}
      <div className="flex items-center bg-[#010A13] border-b border-[#1E2328]/50 px-4 flex-shrink-0">
        {(['collection', 'generator', 'settings'] as Page[]).map(p => (
          <button key={p} onClick={() => setPage(p)}
            className={`nav-tab ${page === p ? 'active' : ''}`}>
            {p === 'collection' ? '⚔ Collection' : p === 'generator' ? '⚙ Generator' : '☰ Settings'}
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-[9px] text-[#5B5A56] tracking-[0.15em] font-beaufort">PATCH {patch}</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {page === 'collection' && (
          <Collection champions={champions} scanResult={scanResult} notify={notify} />
        )}
        {page === 'generator' && <Generator notify={notify} onDone={rescan} />}
        {page === 'settings' && <Settings notify={notify} onRescan={rescan} />}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 text-sm animate-slide-up ${
          toast.ok ? 'bg-[#0A3C2E] border border-[#0ACE83]/40 text-[#0ACE83]'
                   : 'bg-[#3C1A1A] border border-[#C24B4B]/40 text-[#C24B4B]'
        }`}>{toast.msg}</div>
      )}
    </div>
  );
}
