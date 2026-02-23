import { Routes, Route } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import Layout from './components/Layout';
import Champions from './pages/Champions';
import ChampionDetail from './pages/ChampionDetail';
import Settings from './pages/Settings';
import Logs from './pages/Logs';
import Dashboard from './pages/Dashboard';
import Generator from './pages/Generator';
import type { LibChampion } from './types/api';

export default function App() {
  const [champions, setChampions] = useState<LibChampion[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [patch, setPatch] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const handleApply = useCallback(async (zipPath: string, skinName: string, champName: string) => {
    if (!window.api) return;
    addLog(`Applying: ${skinName}...`);
    const result = await window.api.applySkin(zipPath, skinName, champName);
    addLog(result.message);
    showToast(result.message, result.success ? 'success' : 'error');
  }, [addLog, showToast]);

  useEffect(() => {
    const init = async () => {
      if (!window.api) { setLoading(false); return; }
      try {
        const p = await window.api.getCurrentPatch();
        setPatch(p);
        addLog(`Patch: ${p}`);

        // Try cached index first
        const cached = await window.api.getLibraryIndex();
        if (cached) {
          setChampions(cached);
          addLog(`Loaded ${cached.length} champions from cache`);
        }
      } catch (e: any) {
        addLog(`Init error: ${e.message}`);
      }
      setLoading(false);
    };
    init();
  }, []);

  const refreshIndex = useCallback(async () => {
    if (!window.api) return;
    setLoading(true);
    addLog('Building library index...');
    try {
      const index = await window.api.buildLibraryIndex();
      setChampions(index);
      addLog(`Indexed ${index.length} champions`);
      showToast(`Library indexed: ${index.length} champions`, 'success');
    } catch (e: any) {
      addLog(`Index failed: ${e.message}`);
      showToast('Index failed', 'error');
    }
    setLoading(false);
  }, [addLog, showToast]);

  return (
    <Layout patch={patch}>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-12 right-4 z-[100] px-5 py-3 text-sm animate-slide-in border ${
          toast.type === 'success' ? 'bg-league-green-dark border-league-green/50 text-league-green' :
          toast.type === 'error' ? 'bg-league-red-dark border-league-red/50 text-league-red' :
          'bg-league-blue-deeper border-league-gold/30 text-league-gold'
        }`}>
          {toast.msg}
        </div>
      )}

      <Routes>
        <Route path="/" element={
          <Dashboard champions={champions} patch={patch} loading={loading}
                     onRefresh={refreshIndex} addLog={addLog} showToast={showToast} />
        } />
        <Route path="/champions" element={
          <Champions champions={champions} loading={loading} />
        } />
        <Route path="/champion/:id" element={
          <ChampionDetail champions={champions} onApply={handleApply} addLog={addLog} showToast={showToast} />
        } />
        <Route path="/generator" element={
          <Generator addLog={addLog} showToast={showToast} />
        } />
        <Route path="/settings" element={
          <Settings addLog={addLog} showToast={showToast} onRefresh={refreshIndex} />
        } />
        <Route path="/logs" element={<Logs logs={logs} />} />
      </Routes>
    </Layout>
  );
}
