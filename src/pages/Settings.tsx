import { useState, useEffect } from 'react';

interface Props {
  notify: (msg: string, ok?: boolean) => void;
  onRescan: () => void;
}

export default function Settings({ notify, onRescan }: Props) {
  const [cslolReady, setCslolReady] = useState(false);
  const [skinsPath, setSkinsPath] = useState('');
  const [mods, setMods] = useState<string[]>([]);

  useEffect(() => {
    if (!window.api) return;
    window.api.isCslolReady().then(setCslolReady);
    window.api.getSkinsPath().then(setSkinsPath);
    window.api.listMods().then(setMods);
  }, []);

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="font-beaufort text-2xl text-league-gold-light tracking-widest uppercase">Settings</h1>

        {/* Skins Path */}
        <div className="league-card p-5 space-y-2">
          <h2 className="font-beaufort text-sm text-league-gold tracking-widest uppercase">Skin Library</h2>
          <p className="text-league-grey-light text-xs">{skinsPath}</p>
          <button onClick={onRescan} className="btn-secondary">Rescan Library</button>
        </div>

        {/* CSLoL */}
        <div className="league-card p-5 space-y-3">
          <h2 className="font-beaufort text-sm text-league-gold tracking-widest uppercase">CSLoL Manager</h2>
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${cslolReady ? 'bg-league-green' : 'bg-league-red'}`} />
            <span className="text-xs text-league-gold-light">{cslolReady ? 'Ready' : 'Not installed'}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={async () => {
              const r = await window.api?.setupCslol();
              if (r) { notify(r.message, r.success); setCslolReady(r.success); }
            }} className="btn-secondary">📦 Setup</button>
            {cslolReady && (
              <button onClick={async () => {
                const r = await window.api?.launchCslol();
                if (r) notify(r.message, r.success);
              }} className="btn-primary">🚀 Launch CSLoL</button>
            )}
          </div>
        </div>

        {/* Active Mods */}
        {mods.length > 0 && (
          <div className="league-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-beaufort text-sm text-league-gold tracking-widest uppercase">
                Active Mods ({mods.length})
              </h2>
              <button onClick={async () => {
                await window.api?.removeAllMods();
                setMods([]);
                notify('All mods removed', true);
              }} className="text-league-red text-[10px] hover:text-red-300 transition-colors">Clear All</button>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {mods.map((m, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 px-2 hover:bg-league-gold/5 text-sm">
                  <span className="text-league-gold-light truncate text-xs">{m.replace('.fantome', '')}</span>
                  <button onClick={async () => {
                    await window.api?.removeMod(m.replace('.fantome', ''));
                    const updated = await window.api?.listMods();
                    if (updated) setMods(updated);
                  }} className="text-league-red text-xs hover:text-red-300 ml-2">✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* About */}
        <div className="league-card p-5 space-y-2">
          <h2 className="font-beaufort text-sm text-league-gold tracking-widest uppercase">About</h2>
          <p className="text-xs text-league-grey-light">RiftChanger v1.0.0 by Sliv3er</p>
          <div className="league-divider"><div className="league-divider-diamond" /></div>
          <p className="text-[10px] text-league-grey-lightest text-center">CDragon • CSLoL • Data Dragon</p>
        </div>
      </div>
    </div>
  );
}
