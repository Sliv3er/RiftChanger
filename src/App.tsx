import { useState, useEffect, useCallback } from 'react';
import Titlebar from './components/Titlebar';
import Skins from './pages/Skins';
import AppliedSkins from './pages/AppliedSkins';
import Generator from './pages/Generator';
import Settings from './pages/Settings';
import type { ChampionData, ScanResult } from './types/api';

type Page = 'skins' | 'applied' | 'generator' | 'settings';

export default function App() {
  const [page, setPage] = useState<Page>('skins');
  const [champions, setChampions] = useState<ChampionData[]>([]);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [patch, setPatch] = useState('14.24.1');
  const [skinsPath, setSkinsPath] = useState('');
  const [appliedMods, setAppliedMods] = useState<Record<string, { skinName: string; appliedAt: string }>>({});
  const [toolsReady, setToolsReady] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const notify = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const refreshApplied = useCallback(async () => {
    if (!window.api) return;
    const res = await window.api.getAppliedMods();
    setAppliedMods(res?.active || {});
  }, []);

  const refreshTools = useCallback(async () => {
    if (!window.api) return;
    const avail = await window.api.checkToolsAvailability();
    setToolsReady(!!avail['cslol-manager']);
  }, []);

  useEffect(() => {
    (async () => {
      if (!window.api) return;
      const [p, c, s, sp] = await Promise.all([
        window.api.getPatch(),
        window.api.getChampions(),
        window.api.scan(),
        window.api.getSkinsPath(),
      ]);
      setPatch(p || '14.24.1');
      setChampions(c || []);
      setScanResult(s);
      setSkinsPath(sp || '');
      refreshApplied();
      refreshTools();
    })();
  }, [refreshApplied, refreshTools]);

  const rescan = useCallback(async () => {
    if (!window.api) return;
    setScanResult(await window.api.scan());
  }, []);

  const handleApply = useCallback(async (champ: string, skin: string, zipPath: string) => {
    const res = await window.api.injectSkin(champ, skin, zipPath);
    if (res.success) {
      notify(`${skin} applied to ${champ}`);
      refreshApplied();
    } else {
      notify(res.error || 'Failed to apply skin', false);
    }
  }, [notify, refreshApplied]);

  const handleRemove = useCallback(async (champ: string) => {
    await window.api.removeSkin(champ);
    notify(`Removed skin from ${champ}`);
    refreshApplied();
  }, [notify, refreshApplied]);

  const handleRemoveAll = useCallback(async () => {
    await window.api.removeAllSkins();
    refreshApplied();
  }, [refreshApplied]);

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#010A13' }}>
      <Titlebar />

      {/* Nav */}
      <div className="lol-nav flex-shrink-0">
        {(['skins', 'applied', 'generator', 'settings'] as Page[]).map(p => (
          <button key={p} onClick={() => setPage(p)}
            className={`lol-nav-tab ${page === p ? 'active' : ''}`}>
            {p === 'skins' ? 'SKINS' : p === 'applied' ? `APPLIED (${Object.keys(appliedMods).length})` : p.toUpperCase()}
          </button>
        ))}
        <div className="flex-1" />
        {scanResult && (
          <span style={{ fontSize: 9, color: '#5B5A56', letterSpacing: '0.15em' }}>
            {scanResult.total.champions} CHAMPS · {scanResult.total.skins} SKINS · PATCH {patch}
          </span>
        )}
      </div>

      {/* Pages — Generator stays mounted */}
      <div className="flex-1 overflow-hidden relative">
        <div className={`absolute inset-0 ${page === 'skins' ? '' : 'hidden'}`}>
          <Skins champions={champions} patch={patch} skinsPath={skinsPath}
            appliedMods={appliedMods} onApply={handleApply} onRemove={handleRemove} notify={notify} />
        </div>
        <div className={`absolute inset-0 ${page === 'applied' ? '' : 'hidden'}`}>
          <AppliedSkins appliedMods={appliedMods} toolsReady={toolsReady}
            onRemove={handleRemove} onRemoveAll={handleRemoveAll} notify={notify} />
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
        <div className={`toast ${toast.ok ? 'toast-ok' : 'toast-err'}`}>{toast.msg}</div>
      )}
    </div>
  );
}
