import { useState, useEffect } from 'react';
import type { ScanResult } from '../types/api';

interface Props {
  scanResult: ScanResult | null;
  patch: string;
  onScan: (path: string) => void;
  skinsPath: string;
  addLog: (msg: string) => void;
}

export default function Dashboard({ scanResult, patch, onScan, skinsPath, addLog }: Props) {
  const [inputPath, setInputPath] = useState(skinsPath);
  const [gameInfo, setGameInfo] = useState<any>(null);
  const [cslolReady, setCslolReady] = useState(false);
  const [loading, setLoading] = useState('');
  const [installedMods, setInstalledMods] = useState<string[]>([]);

  useEffect(() => { setInputPath(skinsPath); }, [skinsPath]);
  useEffect(() => { checkCslol(); }, []);

  const checkCslol = async () => {
    if (!window.api) return;
    const ready = await window.api.isCslolReady();
    setCslolReady(ready);
    if (ready) {
      const mods = await window.api.listInstalledMods();
      setInstalledMods(mods);
    }
  };

  const handleBrowse = async () => {
    if (window.api) {
      const p = await window.api.selectFolder();
      if (p) setInputPath(p);
    }
  };

  const handleDetectGame = async () => {
    if (window.api) {
      const info = await window.api.detectGame();
      setGameInfo(info);
      addLog(info.found ? `Game found: ${info.path}` : 'Game not found');
    }
  };

  const handleSetupCslol = async () => {
    if (!window.api) return;
    setLoading('cslol');
    addLog('Downloading CSLoL Manager...');
    const result = await window.api.setupCslol();
    addLog(result.message);
    setCslolReady(result.success);
    setLoading('');
  };

  const handleLaunchCslol = async () => {
    if (window.api) {
      const result = await window.api.launchCslol();
      addLog(result.message);
    }
  };

  const validSkins = scanResult?.skins.filter(s => s.valid).length || 0;

  return (
    <div className="animate-fade-in space-y-8 max-w-6xl mx-auto">
      {/* ══════ HERO ══════ */}
      <div className="relative overflow-hidden league-card p-0">
        <div className="absolute inset-0 bg-gradient-to-r from-league-blue-darkest via-league-blue-darker to-league-blue-deep opacity-80" />
        <div className="absolute inset-0 bg-[url('https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-splashes/uncentered/103/103000.jpg')] bg-cover bg-center opacity-15" />
        <div className="relative z-10 p-8">
          <h1 className="font-beaufort text-4xl font-bold tracking-widest uppercase">
            <span className="gold-shimmer">RiftChanger</span>
          </h1>
          <p className="text-league-grey-light text-sm mt-2 max-w-md">
            Your premium custom skin manager. Browse, generate, and apply skins with CSLoL integration.
          </p>
          <div className="flex gap-3 mt-6">
            <button onClick={() => inputPath && onScan(inputPath)} className="btn-primary">
              Scan Library
            </button>
            {cslolReady ? (
              <button onClick={handleLaunchCslol} className="btn-secondary">
                🚀 Launch CSLoL
              </button>
            ) : (
              <button onClick={handleSetupCslol} className="btn-secondary" disabled={loading === 'cslol'}>
                {loading === 'cslol' ? '⏳ Setting up...' : '📦 Setup CSLoL'}
              </button>
            )}
            <button onClick={handleDetectGame} className="btn-secondary">
              🔍 Detect Game
            </button>
          </div>
        </div>
      </div>

      {/* ══════ STATS ROW ══════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="🎮" value={patch || '—'} label="Current Patch" isText />
        <StatCard icon="🎨" value={scanResult?.totalSkins || 0} label="Total Skins" />
        <StatCard icon="⚔" value={scanResult?.champions.length || 0} label="Champions" />
        <StatCard
          icon={cslolReady ? '✅' : '⚠'}
          value={cslolReady ? installedMods.length : 0}
          label={cslolReady ? 'Active Mods' : 'CSLoL Not Setup'}
        />
      </div>

      {/* ══════ SKIN LIBRARY PATH ══════ */}
      <div className="league-card p-6 space-y-4">
        <div className="section-header">
          <h2>Skin Library</h2>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={inputPath}
            onChange={(e) => setInputPath(e.target.value)}
            placeholder="Path to your skins folder..."
            className="league-input flex-1"
          />
          <button onClick={handleBrowse} className="btn-secondary">Browse</button>
          <button onClick={() => inputPath && onScan(inputPath)} className="btn-primary">Scan</button>
        </div>
      </div>

      {/* ══════ SCAN RESULTS ══════ */}
      {scanResult && (
        <div className="space-y-4 animate-slide-up">
          <div className="section-header">
            <h2>Library Overview</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniStat label="Valid Skins" value={validSkins} color="text-league-green" />
            <MiniStat label="Chromas" value={scanResult.totalChromas} />
            <MiniStat label="Forms" value={scanResult.totalForms} />
            <MiniStat label="Exalted" value={scanResult.totalExalted} />
          </div>
          {scanResult.errors.length > 0 && (
            <div className="league-card border-league-red/30 p-4">
              <p className="text-league-red text-sm font-bold mb-2">
                {scanResult.errors.length} Error{scanResult.errors.length > 1 ? 's' : ''}
              </p>
              {scanResult.errors.slice(0, 5).map((err, i) => (
                <p key={i} className="text-league-red/70 text-xs">{err}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════ GAME STATUS ══════ */}
      {gameInfo && (
        <div className="league-card p-5 animate-fade-in">
          <div className="section-header">
            <h2>Game Status</h2>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-league-grey-light">Status: </span>
              <span className={gameInfo.found ? 'text-league-green' : 'text-league-red'}>
                {gameInfo.found ? 'Detected' : 'Not Found'}
              </span>
            </div>
            {gameInfo.path && (
              <div>
                <span className="text-league-grey-light">Path: </span>
                <span className="text-league-gold-light text-xs">{gameInfo.path}</span>
              </div>
            )}
            <div>
              <span className="text-league-grey-light">Running: </span>
              <span className={gameInfo.isRunning ? 'text-league-green' : 'text-league-grey-light'}>
                {gameInfo.isRunning ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ══════ INSTALLED MODS ══════ */}
      {installedMods.length > 0 && (
        <div className="league-card p-5 space-y-3">
          <div className="section-header">
            <h2>Installed Mods ({installedMods.length})</h2>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {installedMods.map((mod, i) => (
              <div key={i} className="flex items-center justify-between bg-league-blue-darker/50 border border-league-grey-dark/30 px-4 py-2">
                <span className="text-league-gold-light text-sm truncate">{mod.replace('.fantome', '')}</span>
                <button
                  onClick={async () => {
                    if (window.api) {
                      const result = await window.api.removeSkin(mod.replace('.fantome', ''));
                      addLog(result.message);
                      const mods = await window.api.listInstalledMods();
                      setInstalledMods(mods);
                    }
                  }}
                  className="text-league-red hover:text-red-300 text-xs ml-2 transition-colors"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <p className="text-league-grey-light text-xs">
            Launch CSLoL Manager and click "Run" to apply changes to the game.
          </p>
        </div>
      )}

      {/* ══════ HOW IT WORKS ══════ */}
      <div className="league-card p-6">
        <div className="section-header">
          <h2>How It Works</h2>
        </div>
        <div className="grid grid-cols-4 gap-6 text-center mt-4">
          {[
            { n: 1, icon: '📂', label: 'Scan', desc: 'Point to your skins folder' },
            { n: 2, icon: '🔍', label: 'Browse', desc: 'Find skins by champion' },
            { n: 3, icon: '✨', label: 'Apply', desc: 'Import into CSLoL' },
            { n: 4, icon: '🚀', label: 'Play', desc: 'Launch and enjoy' },
          ].map(step => (
            <div key={step.n} className="space-y-2">
              <div className="w-12 h-12 mx-auto flex items-center justify-center border border-league-gold/40 bg-league-gold/5 rotate-45">
                <span className="text-xl -rotate-45">{step.icon}</span>
              </div>
              <p className="font-beaufort text-league-gold text-sm tracking-wide">{step.label}</p>
              <p className="text-league-grey-light text-xs">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, value, label, isText }: { icon: string; value: number | string; label: string; isText?: boolean }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div className="stat-value">{isText ? value : typeof value === 'number' ? value.toLocaleString() : value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function MiniStat({ label, value, color = 'text-league-gold-bright' }: { label: string; value: number; color?: string }) {
  return (
    <div className="league-card p-4 text-center">
      <p className={`font-beaufort text-2xl font-bold ${color}`}>{value.toLocaleString()}</p>
      <p className="text-league-grey-light text-xs uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}
