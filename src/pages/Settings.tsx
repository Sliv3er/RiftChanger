import { useState } from 'react';

interface Props {
  skinsPath: string;
  onScan: (path: string) => void;
  addLog: (msg: string) => void;
}

export default function Settings({ skinsPath, onScan, addLog }: Props) {
  const [path, setPath] = useState(skinsPath);
  const [gameInfo, setGameInfo] = useState<any>(null);
  const [backups, setBackups] = useState<any[]>([]);

  const handleBrowse = async () => {
    if (window.api) {
      const selected = await window.api.selectFolder();
      if (selected) setPath(selected);
    }
  };

  const handleDetect = async () => {
    if (window.api) {
      const info = await window.api.detectGame();
      setGameInfo(info);
    }
  };

  const handleBackup = async () => {
    if (window.api && gameInfo?.path) {
      const result = await window.api.createBackup(gameInfo.path);
      addLog(result.message);
      loadBackups();
    }
  };

  const loadBackups = async () => {
    if (window.api) {
      const list = await window.api.listBackups();
      setBackups(list);
    }
  };

  const handleRestore = async (backupId: string) => {
    if (window.api && gameInfo?.path) {
      const result = await window.api.restoreBackup(backupId, gameInfo.path);
      addLog(result.message);
    }
  };

  return (
    <div className="animate-fade-in space-y-8 max-w-3xl mx-auto">
      <div>
        <h1 className="font-beaufort text-3xl font-bold text-league-gold-light tracking-widest uppercase">Settings</h1>
        <p className="text-league-grey-light text-sm mt-1">Configure your RiftChanger setup</p>
      </div>

      {/* ══════ LIBRARY PATH ══════ */}
      <div className="league-card p-6 space-y-4">
        <div className="section-header"><h2>Skin Library Path</h2></div>
        <div className="flex gap-2">
          <input
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            className="league-input flex-1"
            placeholder="Path to skins folder..."
          />
          <button onClick={handleBrowse} className="btn-secondary">Browse</button>
        </div>
        <button onClick={() => onScan(path)} className="btn-primary text-sm">
          Save & Rescan
        </button>
      </div>

      {/* ══════ GAME DETECTION ══════ */}
      <div className="league-card p-6 space-y-4">
        <div className="section-header"><h2>Game Detection</h2></div>
        <button onClick={handleDetect} className="btn-secondary">🔍 Detect League of Legends</button>
        {gameInfo && (
          <div className="space-y-2 text-sm">
            <div className="flex gap-4">
              <span className="text-league-grey-light">Status:</span>
              <span className={gameInfo.found ? 'text-league-green' : 'text-league-red'}>
                {gameInfo.found ? 'Found' : 'Not Found'}
              </span>
            </div>
            {gameInfo.path && (
              <div className="flex gap-4">
                <span className="text-league-grey-light">Path:</span>
                <span className="text-league-gold-light text-xs">{gameInfo.path}</span>
              </div>
            )}
            {gameInfo.version && (
              <div className="flex gap-4">
                <span className="text-league-grey-light">Version:</span>
                <span className="text-league-gold-light">{gameInfo.version}</span>
              </div>
            )}
            <div className="flex gap-4">
              <span className="text-league-grey-light">Running:</span>
              <span className={gameInfo.isRunning ? 'text-league-green' : 'text-league-grey-light'}>
                {gameInfo.isRunning ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ══════ CSLOL ══════ */}
      <div className="league-card p-6 space-y-4">
        <div className="section-header"><h2>CSLoL Manager</h2></div>
        <p className="text-league-grey-light text-sm">
          CSLoL Manager is the backend engine that applies skins to the game.
        </p>
        <button
          onClick={async () => {
            if (window.api) {
              addLog('Setting up CSLoL Manager...');
              const result = await window.api.setupCslol();
              addLog(result.message);
            }
          }}
          className="btn-secondary"
        >
          📦 Download & Setup
        </button>
      </div>

      {/* ══════ BACKUPS ══════ */}
      <div className="league-card p-6 space-y-4">
        <div className="section-header"><h2>Backups</h2></div>
        <div className="flex gap-2">
          <button onClick={handleBackup} className="btn-secondary" disabled={!gameInfo?.path}>
            Create Backup
          </button>
          <button onClick={loadBackups} className="btn-secondary">Refresh</button>
        </div>
        {backups.length > 0 && (
          <div className="space-y-2">
            {backups.map(b => (
              <div key={b.id} className="flex items-center justify-between bg-league-blue-darker/50 border border-league-grey-dark/30 p-3">
                <div>
                  <p className="text-league-gold-light text-sm">{b.id}</p>
                  <p className="text-league-grey-light text-xs">{new Date(b.date).toLocaleString()}</p>
                </div>
                <button onClick={() => handleRestore(b.id)} className="btn-secondary text-xs">
                  Restore
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══════ ABOUT ══════ */}
      <div className="league-card p-6 space-y-3">
        <div className="section-header"><h2>About</h2></div>
        <div className="text-sm space-y-1">
          <p><span className="text-league-grey-light">Version:</span> <span className="text-league-gold">1.0.0</span></p>
          <p><span className="text-league-grey-light">Author:</span> <span className="text-league-gold-light">Sliv3er</span></p>
          <p><span className="text-league-grey-light">License:</span> <span className="text-league-gold-light">MIT</span></p>
        </div>
        <div className="league-divider">
          <div className="league-divider-diamond" />
        </div>
        <p className="text-league-grey-lightest text-xs text-center">
          Powered by CDragon • CSLoL • Data Dragon
        </p>
      </div>
    </div>
  );
}
