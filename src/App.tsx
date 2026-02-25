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
    setTimeout(() => setToast(null), 3500);
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
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#010A13' }}>
      <Titlebar />

      {/* Nav bar */}
      <div className="lol-nav flex-shrink-0">
        {(['collection', 'generator', 'settings'] as Page[]).map(p => (
          <button key={p} onClick={() => setPage(p)}
            className={`lol-nav-tab ${page === p ? 'active' : ''}`}>
            {p === 'collection' ? 'COLLECTION' : p === 'generator' ? 'GENERATOR' : 'SETTINGS'}
          </button>
        ))}
        <div className="flex-1" />
        <span style={{ fontSize: 9, color: '#5B5A56', letterSpacing: '0.15em' }}>
          PATCH {patch}
        </span>
      </div>

      {/* Content — Generator stays mounted to preserve generation state */}
      <div className="flex-1 overflow-hidden relative">
        <div className={`absolute inset-0 ${page === 'collection' ? '' : 'hidden'}`}>
          <Collection champions={champions} scanResult={scanResult} notify={notify} />
        </div>
        <div className={`absolute inset-0 ${page === 'generator' ? '' : 'hidden'}`}>
          <Generator notify={notify} onDone={rescan} />
        </div>
        <div className={`absolute inset-0 ${page === 'settings' ? '' : 'hidden'}`}>
          <Settings notify={notify} onRescan={rescan} />
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.ok ? 'toast-ok' : 'toast-err'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
