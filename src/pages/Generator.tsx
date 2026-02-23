import { useState, useEffect } from 'react';

interface Props {
  addLog: (msg: string) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

interface GenProgress {
  total: number; done: number; current: string; errors: string[]; generated: number;
}

export default function Generator({ addLog, showToast }: Props) {
  const [libPath, setLibPath] = useState('');
  const [status, setStatus] = useState<'idle' | 'running' | 'done'>('idle');
  const [progress, setProgress] = useState<GenProgress | null>(null);
  const [singleChamp, setSingleChamp] = useState('');
  const [singleStatus, setSingleStatus] = useState('');

  useEffect(() => {
    window.api?.getLibraryPath().then(setLibPath);
    window.api?.onGeneratorAllProgress((p: GenProgress) => setProgress(p));
  }, []);

  const handleGenerateAll = async () => {
    if (!window.api) return;
    setStatus('running');
    setProgress(null);
    addLog('Starting full generation...');
    try {
      const result = await window.api.generateAll(libPath || undefined);
      setProgress(result);
      setStatus('done');
      showToast(`Done! ${result.generated} skins generated`, 'success');
    } catch (e: any) {
      setStatus('done');
      showToast(`Failed: ${e.message}`, 'error');
    }
  };

  const handleGenerateSingle = async () => {
    if (!window.api || !singleChamp) return;
    setSingleStatus('Generating...');
    try {
      const r = await window.api.generateChampion(singleChamp);
      setSingleStatus(`✅ ${r.generated} generated, ${r.failed} failed`);
      showToast(`${singleChamp}: ${r.generated} skins`, 'success');
    } catch (e: any) {
      setSingleStatus(`❌ ${e.message}`);
    }
  };

  const pct = progress ? Math.round((progress.done / Math.max(progress.total, 1)) * 100) : 0;

  return (
    <div className="animate-fade-in space-y-6 max-w-3xl mx-auto">
      <h1 className="font-beaufort text-2xl text-league-gold-light tracking-widest uppercase">Generator</h1>
      <p className="text-league-grey-light text-sm -mt-4">
        Generate skin mods from CDragon. Output goes to your library folder.
      </p>

      {/* Output path */}
      <div className="league-card p-5 space-y-3">
        <div className="section-header"><h2>Output</h2></div>
        <div className="flex gap-2">
          <input value={libPath} onChange={e => setLibPath(e.target.value)}
                 className="league-input flex-1 text-xs" placeholder="Library path..." />
          <button onClick={async () => {
            const p = await window.api?.selectFolder();
            if (p) setLibPath(p);
          }} className="btn-secondary">Browse</button>
        </div>
      </div>

      {/* Single champion */}
      <div className="league-card p-5 space-y-3">
        <div className="section-header"><h2>Single Champion</h2></div>
        <div className="flex gap-2">
          <input value={singleChamp} onChange={e => setSingleChamp(e.target.value)}
                 className="league-input flex-1" placeholder="Champion ID (e.g. Ahri)" />
          <button onClick={handleGenerateSingle} disabled={!singleChamp || status === 'running'}
                  className="btn-primary">Generate</button>
        </div>
        {singleStatus && <p className="text-sm text-league-gold">{singleStatus}</p>}
      </div>

      {/* Generate All */}
      <div className="league-card p-5 space-y-4">
        <div className="section-header"><h2>Generate All</h2></div>
        <p className="text-league-grey-light text-xs">
          Downloads every skin bin from CDragon and creates fantome ZIPs. Takes 30-60 min.
        </p>
        <button onClick={handleGenerateAll} disabled={status === 'running'} className="btn-primary">
          {status === 'running' ? '⏳ Running...' : '⚡ Generate All Skins'}
        </button>

        {progress && (
          <div className="space-y-3 animate-fade-in">
            <div className="flex justify-between text-xs">
              <span className="text-league-gold truncate mr-4">{progress.current}</span>
              <span className="text-league-grey-light flex-shrink-0">{progress.done}/{progress.total}</span>
            </div>
            <div className="league-progress-lg">
              <div className="league-progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-league-green">{progress.generated} generated</span>
              <span className="text-league-gold">{pct}%</span>
              {progress.errors.length > 0 && (
                <span className="text-league-red">{progress.errors.length} errors</span>
              )}
            </div>
          </div>
        )}

        {status === 'done' && (
          <p className="text-league-green text-sm">✅ Generation complete</p>
        )}
      </div>
    </div>
  );
}
