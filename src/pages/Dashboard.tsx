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
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  useEffect(() => {
    setInputPath(skinsPath);
  }, [skinsPath]);

  useEffect(() => {
    checkCslol();
  }, []);

  const checkCslol = async () => {
    if (window.api) {
      const ready = await window.api.isCslolReady();
      setCslolReady(ready);
      if (ready) {
        const mods = await window.api.listInstalledMods();
        setInstalledMods(mods);
      }
    }
  };

  const handleScan = () => {
    if (inputPath) onScan(inputPath);
  };

  const handleBrowse = async () => {
    if (window.api) {
      const path = await window.api.selectFolder();
      if (path) setInputPath(path);
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
    if (window.api) {
      setLoading('cslol');
      addLog('Downloading CSLoL Manager...');
      const result = await window.api.setupCslol();
      addLog(result.message);
      setCslolReady(result.success);
      setLoading('');
    }
  };

  const handleLaunchCslol = async () => {
    if (window.api) {
      const result = await window.api.launchCslol();
      addLog(result.message);
    }
  };

  const handleUpdateSkins = async () => {
    if (!inputPath || !window.api) return;
    setLoading('update');
    addLog('Updating skin library from GitHub...');
    const result = await window.api.updateSkins(inputPath);
    addLog(result.message);
    if (result.success && result.updated > 0) {
      addLog(`${result.updated} skin files updated. Rescanning...`);
      onScan(inputPath);
    }
    setLoading('');
  };

  const handleCheckLastUpdate = async () => {
    if (inputPath && window.api) {
      const date = await window.api.getLastUpdate(inputPath);
      setLastUpdate(date);
      if (date) addLog(`Skin library last updated: ${date}`);
      else addLog('Could not determine last update (not a git repo)');
    }
  };

  const handleRemoveAll = async () => {
    if (window.api) {
      const result = await window.api.removeSkins();
      addLog(result.message);
      setInstalledMods([]);
    }
  };

  // Generator state
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState<{total: number; done: number; current: string; errors: string[]; generated: number} | null>(null);

  useEffect(() => {
    if (window.api?.onGeneratorAllProgress) {
      window.api.onGeneratorAllProgress((progress) => {
        setGenProgress(progress);
      });
    }
  }, []);

  const handleGenerateAll = async () => {
    if (!window.api || generating) return;
    setGenerating(true);
    setGenProgress(null);
    addLog('Starting skin generation for all champions...');
    try {
      const result = await window.api.generateAll(inputPath);
      addLog(`Generation complete: ${result.generated} skins generated, ${result.errors.length} errors`);
      setGenProgress(result);
    } catch (e: any) {
      addLog(`Generation failed: ${e.message}`);
    }
    setGenerating(false);
  };

  const validSkins = scanResult?.skins.filter(s => s.valid).length || 0;
  const invalidSkins = scanResult?.skins.filter(s => !s.valid).length || 0;

  return (
    <div className="fade-in space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-beaufort text-3xl font-bold text-league-gold-light tracking-wide">
          DASHBOARD
        </h1>
        <p className="text-league-grey text-sm mt-1">
          Manage your custom skin library
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="league-border bg-league-grey-cool rounded p-4">
          <p className="text-league-grey text-xs uppercase tracking-wider">Current Patch</p>
          <p className="text-league-gold font-beaufort text-2xl mt-1">{patch || '—'}</p>
        </div>
        <div className="league-border bg-league-grey-cool rounded p-4">
          <p className="text-league-grey text-xs uppercase tracking-wider">Game Status</p>
          <p className={`font-beaufort text-2xl mt-1 ${gameInfo?.found ? 'text-green-400' : 'text-league-grey'}`}>
            {gameInfo ? (gameInfo.found ? 'DETECTED' : 'NOT FOUND') : '—'}
          </p>
        </div>
        <div className="league-border bg-league-grey-cool rounded p-4">
          <p className="text-league-grey text-xs uppercase tracking-wider">CSLoL Manager</p>
          <p className={`font-beaufort text-2xl mt-1 ${cslolReady ? 'text-green-400' : 'text-yellow-400'}`}>
            {cslolReady ? 'READY' : 'NOT SETUP'}
          </p>
        </div>
        <div className="league-border bg-league-grey-cool rounded p-4">
          <p className="text-league-grey text-xs uppercase tracking-wider">Active Mods</p>
          <p className="text-league-gold font-beaufort text-2xl mt-1">{installedMods.length}</p>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex gap-3 flex-wrap">
        <button onClick={handleDetectGame} className="btn-league text-sm">
          🔍 Detect Game
        </button>
        <button onClick={handleSetupCslol} className="btn-league text-sm" disabled={loading === 'cslol'}>
          {loading === 'cslol' ? '⏳ Downloading...' : '📦 Setup CSLoL'}
        </button>
        {cslolReady && (
          <button onClick={handleLaunchCslol} className="btn-league-primary text-sm">
            🚀 Launch CSLoL Manager
          </button>
        )}
        {installedMods.length > 0 && (
          <button onClick={handleRemoveAll} className="btn-league text-sm text-red-400 border-red-400/50">
            🗑️ Remove All Mods
          </button>
        )}
      </div>

      {/* Skins Folder */}
      <div className="league-border bg-league-blue-deeper rounded p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-beaufort text-lg text-league-gold tracking-wide">SKIN LIBRARY</h2>
          {lastUpdate && (
            <span className="text-league-grey text-xs">Last updated: {lastUpdate}</span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={inputPath}
            onChange={(e) => setInputPath(e.target.value)}
            placeholder="Path to skins folder..."
            className="search-input flex-1 rounded"
          />
          <button onClick={handleBrowse} className="btn-league text-sm">Browse</button>
          <button onClick={handleScan} className="btn-league-primary text-sm">Scan</button>
        </div>
        <div className="flex gap-2">
          <button onClick={handleUpdateSkins} className="btn-league text-sm" disabled={loading === 'update'}>
            {loading === 'update' ? '⏳ Updating...' : '🔄 Update Library (git pull)'}
          </button>
          <button onClick={handleCheckLastUpdate} className="btn-league text-sm">
            📅 Check Version
          </button>
        </div>
      </div>

      {/* Skin Generator */}
      <div className="league-border bg-league-blue-deeper rounded p-5 space-y-4">
        <h2 className="font-beaufort text-lg text-league-gold tracking-wide">SKIN GENERATOR</h2>
        <p className="text-league-grey text-sm">
          Generate fantome skin mods for all champions using CDragon bin files.
        </p>
        <button
          onClick={handleGenerateAll}
          className="btn-league-primary text-sm"
          disabled={generating}
        >
          {generating ? '⏳ Generating...' : '⚡ Generate All Skins'}
        </button>
        {genProgress && (
          <div className="space-y-2">
            <div className="w-full bg-league-grey-cool rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-league-gold transition-all duration-300"
                style={{ width: `${genProgress.total > 0 ? (genProgress.done / genProgress.total) * 100 : 0}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-league-grey">
              <span>{genProgress.done}/{genProgress.total} champions</span>
              <span>{genProgress.generated} skins generated</span>
              {genProgress.errors.length > 0 && (
                <span className="text-red-400">{genProgress.errors.length} errors</span>
              )}
            </div>
            {genProgress.current && (
              <p className="text-league-gold-light text-sm">Current: {genProgress.current}</p>
            )}
          </div>
        )}
      </div>

      {/* Scan Results */}
      {scanResult && (
        <div className="space-y-4 fade-in">
          <h2 className="font-beaufort text-lg text-league-gold tracking-wide">SCAN RESULTS</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Champions" value={scanResult.champions.length} />
            <StatCard label="Skins" value={scanResult.totalSkins} />
            <StatCard label="Chromas" value={scanResult.totalChromas} />
            <StatCard label="Valid" value={validSkins} color="text-green-400" />
            {invalidSkins > 0 && (
              <StatCard label="Invalid" value={invalidSkins} color="text-red-400" />
            )}
            <StatCard label="Forms" value={scanResult.totalForms} />
            <StatCard label="Exalted" value={scanResult.totalExalted} />
            <StatCard label="Total Files" value={scanResult.skins.length} />
          </div>

          {scanResult.errors.length > 0 && (
            <div className="league-border bg-red-900/20 rounded p-4">
              <p className="text-red-400 text-sm font-bold mb-2">Errors ({scanResult.errors.length})</p>
              {scanResult.errors.slice(0, 10).map((err, i) => (
                <p key={i} className="text-red-300 text-xs">{err}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Installed Mods */}
      {installedMods.length > 0 && (
        <div className="league-border bg-league-blue-deeper rounded p-5 space-y-3">
          <h2 className="font-beaufort text-lg text-league-gold tracking-wide">
            INSTALLED MODS ({installedMods.length})
          </h2>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {installedMods.map((mod, i) => (
              <div key={i} className="flex items-center justify-between bg-league-grey-cool rounded px-3 py-2">
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
                  className="text-red-400 hover:text-red-300 text-xs ml-2"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <p className="text-league-grey text-xs">
            💡 After adding/removing mods, launch CSLoL Manager and click "Run" to apply changes to the game.
          </p>
        </div>
      )}

      {/* How It Works */}
      <div className="league-border bg-league-blue-deeper rounded p-5 space-y-3">
        <h2 className="font-beaufort text-lg text-league-gold tracking-wide">HOW IT WORKS</h2>
        <div className="grid grid-cols-4 gap-4 text-center">
          <Step num={1} label="Scan" desc="Point to your skins folder and validate" />
          <Step num={2} label="Browse" desc="Find skins by champion with previews" />
          <Step num={3} label="Apply" desc="Import skins into CSLoL Manager" />
          <Step num={4} label="Launch" desc="Open CSLoL Manager and click Run" />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color = 'text-league-gold' }: { label: string; value: number; color?: string }) {
  return (
    <div className="league-border bg-league-grey-cool rounded p-4 text-center">
      <p className="text-league-grey text-xs uppercase tracking-wider">{label}</p>
      <p className={`font-beaufort text-3xl mt-1 ${color}`}>{value.toLocaleString()}</p>
    </div>
  );
}

function Step({ num, label, desc }: { num: number; label: string; desc: string }) {
  return (
    <div>
      <div className="w-10 h-10 rounded-full bg-league-gold/20 border border-league-gold flex items-center justify-center mx-auto mb-2">
        <span className="text-league-gold font-beaufort font-bold">{num}</span>
      </div>
      <p className="text-league-gold-light text-sm font-beaufort">{label}</p>
      <p className="text-league-grey text-xs mt-1">{desc}</p>
    </div>
  );
}
