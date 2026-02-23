import { useState, useEffect } from 'react';

interface Props { notify: (m: string, ok?: boolean) => void; onRescan: () => void; }

export default function Settings({ notify, onRescan }: Props) {
  const [ready, setReady] = useState(false);
  const [mods, setMods] = useState<string[]>([]);
  const [path, setPath] = useState('');

  useEffect(() => {
    if (!window.api) return;
    window.api.injectorReady().then(setReady);
    window.api.listMods().then(setMods);
    window.api.getSkinsPath().then(setPath);
  }, []);

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="max-w-xl mx-auto space-y-6">
        <h1 className="font-beaufort text-xl text-[#C8AA6E] tracking-widest uppercase">Settings</h1>

        <div className="bg-[#0A1428] border border-[#1E2328] p-5 space-y-2">
          <p className="text-[#A09B8C] text-xs uppercase tracking-widest font-beaufort">Library</p>
          <p className="text-[#5B5A56] text-[10px] break-all">{path}</p>
          <button onClick={onRescan} className="btn-dark">Rescan</button>
        </div>

        <div className="bg-[#0A1428] border border-[#1E2328] p-5 space-y-3">
          <p className="text-[#A09B8C] text-xs uppercase tracking-widest font-beaufort">Injection Tools</p>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${ready ? 'bg-[#0ACE83]' : 'bg-[#C24B4B]'}`} />
            <span className="text-xs text-[#F0E6D2]">{ready ? 'Ready' : 'Not installed'}</span>
          </div>
          <button onClick={async () => {
            const r = await window.api?.injectorSetup();
            if (r) { notify(r.message, r.success); setReady(r.success); }
          }} className="btn-dark">Setup cslol-tools</button>
        </div>

        {mods.length > 0 && (
          <div className="bg-[#0A1428] border border-[#1E2328] p-5 space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-[#A09B8C] text-xs uppercase tracking-widest font-beaufort">Active Mods ({mods.length})</p>
              <button onClick={async () => {
                await window.api?.removeAllMods(); setMods([]); notify('Cleared', true);
              }} className="text-[#C24B4B] text-[10px] hover:text-red-300">Clear All</button>
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {mods.map((m, i) => (
                <div key={i} className="flex justify-between items-center py-1 text-xs">
                  <span className="text-[#F0E6D2] truncate">{m.replace('.fantome', '')}</span>
                  <button onClick={async () => {
                    await window.api?.removeMod(m.replace('.fantome', ''));
                    setMods(await window.api?.listMods() || []);
                  }} className="text-[#C24B4B] hover:text-red-300 ml-2">✕</button>
                </div>
              ))}
            </div>
            <button onClick={async () => {
              await window.api?.stopOverlay(); notify('Overlay stopped', true);
            }} className="btn-dark">Stop Overlay</button>
          </div>
        )}
      </div>
    </div>
  );
}
