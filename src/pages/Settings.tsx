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
    <div className="fade-in space-y-6 max-w-3xl">
      <h1 className="font-beaufort text-3xl font-bold text-league-gold-light tracking-wide">SETTINGS</h1>

      {/* Skins Path */}
      <section className="league-border bg-league-blue-deeper rounded p-5 space-y-3">
        <h2 className="font-beaufort text-lg text-league-gold">SKIN LIBRARY PATH</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            className="search-input flex-1 rounded"
            placeholder="Path to skins folder..."
          />
          <button onClick={handleBrowse} className="btn-league text-sm">Browse</button>
        </div>
        <button onClick={() => onScan(path)} className="btn-league-primary text-sm">
          Save & Rescan
        </button>
      </section>

      {/* Game Detection */}
      <section className="league-border bg-league-blue-deeper rounded p-5 space-y-3">
        <h2 className="font-beaufort text-lg text-league-gold">GAME DETECTION</h2>
        <button onClick={handleDetect} className="btn-league text-sm">Detect League of Legends</button>
        {gameInfo && (
          <div className="space-y-1 text-sm">
            <p><span className="text-league-grey">Status:</span> <span className={gameInfo.found ? 'text-green-400' : 'text-red-400'}>{gameInfo.found ? 'Found' : 'Not Found'}</span></p>
            {gameInfo.path && <p><span className="text-league-grey">Path:</span> <span className="text-league-gold-light">{gameInfo.path}</span></p>}
            {gameInfo.version && <p><span className="text-league-grey">Version:</span> <span className="text-league-gold-light">{gameInfo.version}</span></p>}
            <p><span className="text-league-grey">Running:</span> <span className={gameInfo.isRunning ? 'text-green-400' : 'text-league-grey'}>{gameInfo.isRunning ? 'Yes' : 'No'}</span></p>
          </div>
        )}
      </section>

      {/* CSLoL Manager */}
      <section className="league-border bg-league-blue-deeper rounded p-5 space-y-3">
        <h2 className="font-beaufort text-lg text-league-gold">CSLOL MANAGER</h2>
        <p className="text-league-grey text-sm">
          CSLoL Manager is the backend engine that applies skins to the game.
          RiftChanger will automatically download and configure it.
        </p>
        <button
          onClick={async () => {
            if (window.api) {
              addLog('Setting up CSLoL Manager...');
              const result = await window.api.setupCslol();
              addLog(result.message);
            }
          }}
          className="btn-league text-sm"
        >
          Download & Setup
        </button>
      </section>

      {/* Backups */}
      <section className="league-border bg-league-blue-deeper rounded p-5 space-y-3">
        <h2 className="font-beaufort text-lg text-league-gold">BACKUPS</h2>
        <div className="flex gap-2">
          <button onClick={handleBackup} className="btn-league text-sm" disabled={!gameInfo?.path}>
            Create Backup
          </button>
          <button onClick={loadBackups} className="btn-league text-sm">
            Refresh
          </button>
        </div>
        {backups.length > 0 && (
          <div className="space-y-2">
            {backups.map(b => (
              <div key={b.id} className="flex items-center justify-between bg-league-grey-cool rounded p-3">
                <div>
                  <p className="text-league-gold-light text-sm">{b.id}</p>
                  <p className="text-league-grey text-xs">{new Date(b.date).toLocaleString()}</p>
                </div>
                <button
                  onClick={() => handleRestore(b.id)}
                  className="btn-league text-xs"
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
