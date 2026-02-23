import { useState, useEffect } from 'react';

interface Props {
  addLog: (msg: string) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onRefresh: () => void;
}

export default function Settings({ addLog, showToast, onRefresh }: Props) {
  const [libPath, setLibPath] = useState('');
  const [gameInfo, setGameInfo] = useState<any>(null);
  const [cslolReady, setCslolReady] = useState(false);

  useEffect(() => {
    window.api?.getLibraryPath().then(setLibPath);
    window.api?.isCslolReady().then(setCslolReady);
  }, []);

  const handleSavePath = async () => {
    if (!window.api || !libPath) return;
    await window.api.setLibraryPath(libPath);
    showToast('Library path updated', 'success');
    addLog(`Library path set to: ${libPath}`);
  };

  return (
    <div className="animate-fade-in space-y-6 max-w-3xl mx-auto">
      <h1 className="font-beaufort text-2xl text-league-gold-light tracking-widest uppercase">Settings</h1>

      {/* Library Path */}
      <div className="league-card p-5 space-y-3">
        <div className="section-header"><h2>Library Path</h2></div>
        <div className="flex gap-2">
          <input value={libPath} onChange={e => setLibPath(e.target.value)}
                 className="league-input flex-1 text-xs" placeholder="Skins library folder..." />
          <button onClick={async () => {
            const p = await window.api?.selectFolder();
            if (p) setLibPath(p);
          }} className="btn-secondary">Browse</button>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSavePath} className="btn-primary">Save</button>
          <button onClick={onRefresh} className="btn-secondary">Rebuild Index</button>
        </div>
      </div>

      {/* Game */}
      <div className="league-card p-5 space-y-3">
        <div className="section-header"><h2>Game Detection</h2></div>
        <button onClick={async () => {
          const info = await window.api?.detectGame();
          setGameInfo(info);
        }} className="btn-secondary">🔍 Detect</button>
        {gameInfo && (
          <div className="text-sm space-y-1">
            <p><span className="text-league-grey-light">Status:</span>{' '}
              <span className={gameInfo.found ? 'text-league-green' : 'text-league-red'}>
                {gameInfo.found ? 'Found' : 'Not Found'}
              </span>
            </p>
            {gameInfo.path && <p className="text-league-gold-light text-xs">{gameInfo.path}</p>}
          </div>
        )}
      </div>

      {/* CSLoL */}
      <div className="league-card p-5 space-y-3">
        <div className="section-header"><h2>CSLoL Manager</h2></div>
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${cslolReady ? 'bg-league-green' : 'bg-league-red'}`} />
          <span className="text-sm text-league-gold-light">{cslolReady ? 'Installed' : 'Not installed'}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={async () => {
            addLog('Setting up CSLoL...');
            const r = await window.api?.setupCslol();
            if (r) {
              addLog(r.message);
              showToast(r.message, r.success ? 'success' : 'error');
              setCslolReady(r.success);
            }
          }} className="btn-secondary">📦 Setup</button>
          {cslolReady && (
            <button onClick={async () => {
              const r = await window.api?.launchCslol();
              if (r) showToast(r.message, r.success ? 'success' : 'error');
            }} className="btn-secondary">🚀 Launch</button>
          )}
        </div>
      </div>

      {/* About */}
      <div className="league-card p-5 space-y-2">
        <div className="section-header"><h2>About</h2></div>
        <p className="text-sm"><span className="text-league-grey-light">Version:</span> <span className="text-league-gold">1.0.0</span></p>
        <p className="text-sm"><span className="text-league-grey-light">Author:</span> <span className="text-league-gold-light">Sliv3er</span></p>
        <div className="league-divider"><div className="league-divider-diamond" /></div>
        <p className="text-league-grey-lightest text-xs text-center">CDragon • CSLoL • Data Dragon</p>
      </div>
    </div>
  );
}
