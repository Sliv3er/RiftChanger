import { useState } from 'react';
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
  const [loading, setLoading] = useState(false);

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
      setLoading(true);
      addLog('Setting up CSLoL Manager...');
      const result = await window.api.setupCslol();
      addLog(result.message);
      setCslolReady(result.success);
      setLoading(false);
    }
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

      {/* Patch Info */}
      <div className="flex gap-4">
        <div className="league-border bg-league-grey-cool rounded p-4 flex-1">
          <p className="text-league-grey text-xs uppercase tracking-wider">Current Patch</p>
          <p className="text-league-gold font-beaufort text-2xl mt-1">{patch || '—'}</p>
        </div>
        <div className="league-border bg-league-grey-cool rounded p-4 flex-1">
          <p className="text-league-grey text-xs uppercase tracking-wider">Game Status</p>
          <p className={`font-beaufort text-2xl mt-1 ${gameInfo?.found ? 'text-green-400' : 'text-league-grey'}`}>
            {gameInfo ? (gameInfo.found ? 'DETECTED' : 'NOT FOUND') : '—'}
          </p>
        </div>
        <div className="league-border bg-league-grey-cool rounded p-4 flex-1">
          <p className="text-league-grey text-xs uppercase tracking-wider">CSLoL Manager</p>
          <p className={`font-beaufort text-2xl mt-1 ${cslolReady ? 'text-green-400' : 'text-league-grey'}`}>
            {cslolReady ? 'READY' : 'NOT SETUP'}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={handleDetectGame} className="btn-league text-sm">
          Detect Game
        </button>
        <button onClick={handleSetupCslol} className="btn-league text-sm" disabled={loading}>
          {loading ? 'Setting up...' : 'Setup CSLoL'}
        </button>
      </div>

      {/* Skins Folder */}
      <div className="league-border bg-league-blue-deeper rounded p-5 space-y-4">
        <h2 className="font-beaufort text-lg text-league-gold tracking-wide">SKIN LIBRARY</h2>
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
      </div>

      {/* Scan Results */}
      {scanResult && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 fade-in">
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
      )}
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
