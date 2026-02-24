import { useState, useEffect } from 'react';

interface Props { notify: (m: string, ok?: boolean) => void; onRescan: () => void; }

export default function Settings({ notify, onRescan }: Props) {
  const [ready, setReady] = useState(false);
  const [mods, setMods] = useState<string[]>([]);
  const [skinPath, setSkinPath] = useState('');

  useEffect(() => {
    if (!window.api) return;
    window.api.injectorReady().then(setReady);
    window.api.listMods().then(setMods);
    window.api.getSkinsPath().then(setSkinPath);
  }, []);

  return (
    <div className="h-full overflow-y-auto p-8" style={{ background: '#010A13' }}>
      <div className="max-w-xl mx-auto space-y-5">
        <h1 style={{ fontSize: 14, fontWeight: 600, color: '#C8AA6E', letterSpacing: '0.2em', textTransform: 'uppercase' as const }}>
          Settings
        </h1>

        {/* Library */}
        <div style={{ background: '#0A1428', border: '1px solid #1E2328', padding: 20 }}>
          <p style={{ fontSize: 10, color: '#A09B8C', letterSpacing: '0.2em', textTransform: 'uppercase' as const, marginBottom: 6 }}>
            Skin Library
          </p>
          <p style={{ fontSize: 10, color: '#5B5A56', wordBreak: 'break-all', marginBottom: 10 }}>{skinPath}</p>
          <button onClick={onRescan} className="btn-outline">Rescan</button>
        </div>

        {/* Injection tools */}
        <div style={{ background: '#0A1428', border: '1px solid #1E2328', padding: 20 }}>
          <p style={{ fontSize: 10, color: '#A09B8C', letterSpacing: '0.2em', textTransform: 'uppercase' as const, marginBottom: 8 }}>
            Injection Tools
          </p>
          <div className="flex items-center gap-2 mb-3">
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: ready ? '#0ACE83' : '#C24B4B' }} />
            <span style={{ fontSize: 12, color: '#F0E6D2' }}>{ready ? 'cslol-tools ready' : 'Not installed'}</span>
          </div>
          <button onClick={async () => {
            const r = await window.api?.injectorSetup();
            if (r) { notify(r.message, r.success); setReady(r.success); }
          }} className="btn-outline">Setup cslol-tools</button>
        </div>

        {/* Active mods */}
        {mods.length > 0 && (
          <div style={{ background: '#0A1428', border: '1px solid #1E2328', padding: 20 }}>
            <div className="flex justify-between items-center mb-3">
              <p style={{ fontSize: 10, color: '#A09B8C', letterSpacing: '0.2em', textTransform: 'uppercase' as const }}>
                Active Mods ({mods.length})
              </p>
              <button onClick={async () => {
                await window.api?.removeAllMods(); setMods([]); notify('All mods cleared', true);
              }} style={{ fontSize: 10, color: '#C24B4B', background: 'none', border: 'none', cursor: 'pointer' }}>
                Clear All
              </button>
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {mods.map((m, i) => (
                <div key={i} className="flex justify-between items-center py-1">
                  <span style={{ fontSize: 11, color: '#F0E6D2' }} className="truncate">{m}</span>
                  <button onClick={async () => {
                    await window.api?.removeMod(m);
                    setMods(await window.api?.listMods() || []);
                  }} style={{ color: '#C24B4B', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, marginLeft: 8 }}>✕</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={async () => {
                const r = await window.api?.applyMods();
                if (r) notify(r.message, r.success);
              }} className="btn-gold">Apply All</button>
              <button onClick={async () => {
                await window.api?.stopOverlay(); notify('Overlay stopped', true);
              }} className="btn-outline">Stop Overlay</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
