import { useState, useEffect } from 'react';

interface Props { notify: (m: string, ok?: boolean) => void; onRescan: () => void; }

export default function Settings({ notify, onRescan }: Props) {
  const [ready, setReady] = useState(false);
  const [mods, setMods] = useState<string[]>([]);
  const [skinPath, setSkinPath] = useState('');
  const [overlay, setOverlay] = useState<{ running: boolean; log: string }>({ running: false, log: '' });
  const [setupStatus, setSetupStatus] = useState<'idle' | 'downloading' | 'done' | 'error'>('idle');
  const [setupMsg, setSetupMsg] = useState('');

  useEffect(() => {
    if (!window.api) return;
    window.api.injectorReady().then(setReady);
    window.api.listMods().then(setMods);
    window.api.getSkinsPath().then(setSkinPath);
    window.api.overlayStatus().then(setOverlay);
    const timer = setInterval(() => {
      window.api.overlayStatus().then(setOverlay);
      window.api.listMods().then(setMods);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const setupAuto = async () => {
    setSetupStatus('downloading');
    setSetupMsg('Downloading latest CSLoL Manager...');
    try {
      const r = await window.api?.injectorSetup();
      if (r?.success) {
        setSetupStatus('done');
        setSetupMsg('✅ CSLoL Manager installed successfully!');
        setReady(true);
        notify('CSLoL Manager ready!', true);
      } else {
        setSetupStatus('error');
        setSetupMsg(`❌ ${r?.message || 'Setup failed'}`);
      }
    } catch (e: any) {
      setSetupStatus('error');
      setSetupMsg(`❌ ${e.message}`);
    }
  };

  const setupBrowse = async () => {
    const folder = await window.api?.selectFolder();
    if (!folder) return;
    setSetupStatus('downloading');
    setSetupMsg('Checking folder...');
    try {
      const r = await window.api?.injectorSetupFromPath(folder);
      if (r?.success) {
        setSetupStatus('done');
        setSetupMsg('✅ CSLoL Manager configured!');
        setReady(true);
        notify('CSLoL Manager ready!', true);
      } else {
        setSetupStatus('error');
        setSetupMsg(`❌ ${r?.message || 'Invalid CSLoL Manager folder'}`);
      }
    } catch (e: any) {
      setSetupStatus('error');
      setSetupMsg(`❌ ${e.message}`);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-8" style={{ background: '#010A13' }}>
      <div className="max-w-xl mx-auto space-y-5">
        <h1 style={{ fontSize: 14, fontWeight: 600, color: '#C8AA6E', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
          Settings
        </h1>

        {/* Library */}
        <div style={{ background: '#0A1428', border: '1px solid #1E2328', borderRadius: 4, padding: 20 }}>
          <p style={{ fontSize: 10, color: '#A09B8C', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6 }}>
            Skin Library
          </p>
          <p style={{ fontSize: 10, color: '#5B5A56', wordBreak: 'break-all', marginBottom: 10 }}>{skinPath}</p>
          <button onClick={onRescan} className="btn-outline">Rescan</button>
        </div>

        {/* CSLoL Manager */}
        <div style={{ background: '#0A1428', border: '1px solid #1E2328', borderRadius: 4, padding: 20 }}>
          <p style={{ fontSize: 10, color: '#A09B8C', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>
            CSLoL Manager
          </p>

          <div className="flex items-center gap-2 mb-3">
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: ready ? '#0ACE83' : '#C24B4B' }} />
            <span style={{ fontSize: 12, color: '#F0E6D2' }}>
              {ready ? 'CSLoL Manager ready' : 'Not installed'}
            </span>
          </div>

          {!ready && setupStatus === 'idle' && (
            <div className="space-y-2">
              <p style={{ fontSize: 11, color: '#5B5A56', marginBottom: 8 }}>
                CSLoL Manager is required to apply skins in-game. Download the latest version automatically or browse to an existing installation.
              </p>
              <div className="flex gap-2">
                <button onClick={setupAuto} className="btn-gold">Download Latest</button>
                <button onClick={setupBrowse} className="btn-outline">Browse Folder</button>
              </div>
            </div>
          )}

          {setupStatus === 'downloading' && (
            <div className="space-y-2 anim-fade">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ background: '#C8AA6E' }} />
                <span style={{ fontSize: 11, color: '#C8AA6E' }}>{setupMsg}</span>
              </div>
              <div className="lol-progress">
                <div className="lol-progress-fill" style={{ width: '60%', animation: 'shimmer 1.5s infinite' }} />
              </div>
            </div>
          )}

          {(setupStatus === 'done' || setupStatus === 'error') && (
            <p style={{
              fontSize: 11, marginTop: 6, padding: '6px 10px', borderRadius: 4,
              color: setupStatus === 'done' ? '#0ACE83' : '#C24B4B',
              background: setupStatus === 'done' ? '#091E0F' : '#1E0A0A',
            }}>
              {setupMsg}
            </p>
          )}

          {ready && (
            <button onClick={setupAuto} className="btn-outline" style={{ marginTop: 8 }}>
              Reinstall / Update
            </button>
          )}
        </div>

        {/* Overlay status */}
        <div style={{ background: '#0A1428', border: '1px solid #1E2328', borderRadius: 4, padding: 20 }}>
          <p style={{ fontSize: 10, color: '#A09B8C', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>
            Patcher Status
          </p>
          <div className="flex items-center gap-2 mb-2">
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: overlay.running ? '#0ACE83' : '#3C3C41' }} />
            <span style={{ fontSize: 12, color: overlay.running ? '#0ACE83' : '#5B5A56' }}>
              {overlay.running ? 'CSLoL Manager running' : 'Not running'}
            </span>
          </div>
          {overlay.log && (
            <pre style={{ fontSize: 9, color: '#5B5A56', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 80, overflow: 'auto', marginTop: 4 }}>
              {overlay.log.slice(-500).trim()}
            </pre>
          )}
        </div>

        {/* Active mods */}
        {mods.length > 0 && (
          <div style={{ background: '#0A1428', border: '1px solid #1E2328', borderRadius: 4, padding: 20 }}>
            <div className="flex justify-between items-center mb-3">
              <p style={{ fontSize: 10, color: '#A09B8C', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
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
                await window.api?.stopOverlay(); notify('Patcher stopped', true);
              }} className="btn-outline">Stop Patcher</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
