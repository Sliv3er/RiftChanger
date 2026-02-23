import { useState, useEffect, useCallback } from 'react';
import Titlebar from './components/Titlebar';
import Collection from './pages/Collection';
import Generator from './pages/Generator';
import Settings from './pages/Settings';
import type { ChampionData, SkinData, ScanResult } from './types/api';

type Page = 'collection' | 'generator' | 'settings';

export default function App() {
  const [page, setPage] = useState<Page>('collection');
  const [champions, setChampions] = useState<ChampionData[]>([]);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [patch, setPatch] = useState('');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const notify = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    (async () => {
      if (!window.api) return;
      const p = await window.api.getCurrentPatch();
      setPatch(p);
      const c = await window.api.getChampions();
      setChampions(c);
      // Auto-scan the lol-skins folder
      const scan = await window.api.scan();
      setScanResult(scan);
    })();
  }, []);

  const rescan = useCallback(async () => {
    if (!window.api) return;
    const scan = await window.api.scan();
    setScanResult(scan);
  }, []);

  const handleApply = useCallback(async (zipPath: string, skinName: string, champName: string) => {
    if (!window.api) return;
    const r = await window.api.apply(zipPath, skinName, champName);
    notify(r.message, r.success);
  }, [notify]);

  return (
    <div className="h-screen flex flex-col bg-league-blue-darkest overflow-hidden">
      <Titlebar />

      {/* Navigation */}
      <div className="flex items-center gap-0 bg-league-hextech-black border-b border-league-grey-dark/40 px-4">
        {(['collection', 'generator', 'settings'] as Page[]).map(p => (
          <button
            key={p}
            onClick={() => setPage(p)}
            className={`px-5 py-2.5 text-xs font-beaufort uppercase tracking-[0.2em] transition-all border-b-2 ${
              page === p
                ? 'text-league-gold border-league-gold bg-league-gold/5'
                : 'text-league-grey-light border-transparent hover:text-league-gold/80 hover:border-league-gold/30'
            }`}
          >
            {p}
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-[10px] text-league-grey-lightest tracking-wider">PATCH {patch}</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {page === 'collection' && (
          <Collection champions={champions} scanResult={scanResult} onApply={handleApply} notify={notify} />
        )}
        {page === 'generator' && (
          <Generator notify={notify} onDone={rescan} />
        )}
        {page === 'settings' && (
          <Settings notify={notify} onRescan={rescan} />
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 text-sm border animate-slide-up ${
          toast.ok
            ? 'bg-league-green-dark/90 border-league-green/40 text-league-green'
            : 'bg-league-red-dark/90 border-league-red/40 text-league-red'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
