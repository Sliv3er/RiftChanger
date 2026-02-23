import { Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Champions from './pages/Champions';
import ChampionDetail from './pages/ChampionDetail';
import Settings from './pages/Settings';
import Logs from './pages/Logs';
import Dashboard from './pages/Dashboard';
import type { ScanResult, ChampionData, SkinEntry } from './types/api';

export default function App() {
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [champions, setChampions] = useState<ChampionData[]>([]);
  const [appliedSkins, setAppliedSkins] = useState<SkinEntry[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [skinsPath, setSkinsPath] = useState<string>('');
  const [patch, setPatch] = useState<string>('');

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  useEffect(() => {
    // Load champions from API on mount
    const init = async () => {
      try {
        if (window.api) {
          const p = await window.api.getCurrentPatch();
          setPatch(p);
          addLog(`Current patch: ${p}`);

          const champs = await window.api.getChampions();
          setChampions(champs);
          addLog(`Loaded ${champs.length} champions from Data Dragon`);
        }
      } catch (e: any) {
        addLog(`Init error: ${e.message}`);
      }
    };
    init();
  }, []);

  const handleScan = async (path: string) => {
    setSkinsPath(path);
    addLog(`Scanning skins folder: ${path}`);
    try {
      if (window.api) {
        const result = await window.api.scanSkins(path);
        setScanResult(result);
        addLog(`Scan complete: ${result.totalSkins} skins, ${result.totalChromas} chromas, ${result.totalForms} forms`);
        if (result.errors.length > 0) {
          result.errors.forEach(e => addLog(`Error: ${e}`));
        }
      }
    } catch (e: any) {
      addLog(`Scan failed: ${e.message}`);
    }
  };

  const handleApply = async (skins: SkinEntry[]) => {
    addLog(`Applying ${skins.length} skins...`);
    try {
      if (window.api) {
        const result = await window.api.applySkins(skins);
        if (result.success) {
          setAppliedSkins(prev => [...prev, ...skins]);
          addLog(`Applied: ${result.applied.join(', ')}`);
        }
        if (result.errors.length > 0) {
          result.errors.forEach(e => addLog(`Error: ${e}`));
        }
      }
    } catch (e: any) {
      addLog(`Apply failed: ${e.message}`);
    }
  };

  return (
    <Layout>
      <Routes>
        <Route
          path="/"
          element={
            <Dashboard
              scanResult={scanResult}
              patch={patch}
              onScan={handleScan}
              skinsPath={skinsPath}
              addLog={addLog}
            />
          }
        />
        <Route
          path="/champions"
          element={
            <Champions
              champions={champions}
              scanResult={scanResult}
            />
          }
        />
        <Route
          path="/champion/:id"
          element={
            <ChampionDetail
              scanResult={scanResult}
              onApply={handleApply}
              addLog={addLog}
            />
          }
        />
        <Route
          path="/settings"
          element={
            <Settings
              skinsPath={skinsPath}
              onScan={handleScan}
              addLog={addLog}
            />
          }
        />
        <Route
          path="/logs"
          element={<Logs logs={logs} />}
        />
      </Routes>
    </Layout>
  );
}
