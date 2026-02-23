import { useState, useEffect } from 'react';

interface GeneratorProgress {
  total: number;
  done: number;
  current: string;
  errors: string[];
  generated: number;
}

interface Props {
  skinsPath: string;
  addLog: (msg: string) => void;
}

export default function Generator({ skinsPath, addLog }: Props) {
  const [outputDir, setOutputDir] = useState(skinsPath);
  const [status, setStatus] = useState<'idle' | 'generating' | 'complete' | 'error'>('idle');
  const [progress, setProgress] = useState<GeneratorProgress | null>(null);
  const [currentMsg, setCurrentMsg] = useState('');
  const [singleChamp, setSingleChamp] = useState('');

  useEffect(() => { setOutputDir(skinsPath); }, [skinsPath]);

  useEffect(() => {
    if (!window.api) return;
    window.api.onGeneratorProgress?.((msg: string) => setCurrentMsg(msg));
    window.api.onGeneratorAllProgress?.((p: GeneratorProgress) => setProgress(p));
  }, []);

  const handleBrowse = async () => {
    if (window.api) {
      const p = await window.api.selectFolder();
      if (p) setOutputDir(p);
    }
  };

  const handleGenerateAll = async () => {
    if (!window.api) return;
    setStatus('generating');
    setProgress(null);
    addLog(`Starting full skin generation → ${outputDir}`);
    try {
      const result = await window.api.generateAll(outputDir);
      setProgress(result);
      setStatus(result.errors.length > 0 ? 'error' : 'complete');
      addLog(`Generation complete: ${result.generated} skins, ${result.errors.length} errors`);
    } catch (e: any) {
      setStatus('error');
      addLog(`Generation failed: ${e.message}`);
    }
  };

  const handleGenerateChampion = async () => {
    if (!window.api || !singleChamp) return;
    setStatus('generating');
    setCurrentMsg(`Generating ${singleChamp}...`);
    addLog(`Generating skins for ${singleChamp}...`);
    try {
      const result = await window.api.generateChampion(singleChamp);
      setStatus('complete');
      setCurrentMsg(`Done: ${result.generated} generated, ${result.failed} failed`);
      addLog(`${singleChamp}: ${result.generated} generated, ${result.failed} failed`);
    } catch (e: any) {
      setStatus('error');
      addLog(`Failed: ${e.message}`);
    }
  };

  const pct = progress ? Math.round((progress.done / Math.max(progress.total, 1)) * 100) : 0;

  return (
    <div className="animate-fade-in space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="font-beaufort text-3xl font-bold text-league-gold-light tracking-widest uppercase">
          Skin Generator
        </h1>
        <p className="text-league-grey-light text-sm mt-1">
          Generate fantome skin mods from CDragon data for any champion
        </p>
      </div>

      {/* ══════ OUTPUT DIR ══════ */}
      <div className="league-card p-6 space-y-4">
        <div className="section-header"><h2>Output Directory</h2></div>
        <div className="flex gap-2">
          <input
            type="text"
            value={outputDir}
            onChange={e => setOutputDir(e.target.value)}
            placeholder="Output path for generated skins..."
            className="league-input flex-1"
          />
          <button onClick={handleBrowse} className="btn-secondary">Browse</button>
        </div>
      </div>

      {/* ══════ SINGLE CHAMPION ══════ */}
      <div className="league-card p-6 space-y-4">
        <div className="section-header"><h2>Generate One Champion</h2></div>
        <div className="flex gap-2">
          <input
            type="text"
            value={singleChamp}
            onChange={e => setSingleChamp(e.target.value)}
            placeholder="Champion ID (e.g. Ahri, Jinx, KSante)..."
            className="league-input flex-1"
          />
          <button
            onClick={handleGenerateChampion}
            disabled={!singleChamp || status === 'generating'}
            className="btn-primary"
          >
            Generate
          </button>
        </div>
        {currentMsg && status !== 'idle' && !progress && (
          <p className="text-league-gold text-sm">{currentMsg}</p>
        )}
      </div>

      {/* ══════ GENERATE ALL ══════ */}
      <div className="league-card p-6 space-y-4">
        <div className="section-header"><h2>Generate All Champions</h2></div>
        <p className="text-league-grey-light text-sm">
          Downloads skin bins from CDragon and generates fantome ZIPs for every champion, skin, and chroma.
          This can take 30-60 minutes depending on your internet speed.
        </p>

        <button
          onClick={handleGenerateAll}
          disabled={status === 'generating'}
          className="btn-primary"
        >
          {status === 'generating' ? '⏳ Generating...' : '⚡ Generate All Skins'}
        </button>

        {/* Progress */}
        {progress && (
          <div className="space-y-3 animate-fade-in">
            <div className="flex items-center justify-between text-sm">
              <span className="text-league-gold font-beaufort">{progress.current}</span>
              <span className="text-league-grey-light">{progress.done}/{progress.total} champions</span>
            </div>

            <div className="league-progress-lg">
              <div className="league-progress-fill" style={{ width: `${pct}%` }} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="font-beaufort text-2xl text-league-gold-bright">{progress.generated}</p>
                <p className="text-xs text-league-grey-light uppercase tracking-wider">Generated</p>
              </div>
              <div className="text-center">
                <p className="font-beaufort text-2xl text-league-gold">{pct}%</p>
                <p className="text-xs text-league-grey-light uppercase tracking-wider">Progress</p>
              </div>
              <div className="text-center">
                <p className="font-beaufort text-2xl text-league-red">{progress.errors.length}</p>
                <p className="text-xs text-league-grey-light uppercase tracking-wider">Errors</p>
              </div>
            </div>
          </div>
        )}

        {/* Status indicator */}
        {status === 'complete' && (
          <div className="flex items-center gap-2 text-league-green text-sm animate-fade-in">
            <span>✅</span>
            <span>Generation complete! {progress?.generated} skins ready.</span>
          </div>
        )}

        {/* Errors */}
        {progress && progress.errors.length > 0 && (
          <div className="league-card border-league-red/30 p-4 max-h-40 overflow-y-auto">
            <p className="text-league-red text-xs font-bold mb-2">Errors:</p>
            {progress.errors.slice(0, 20).map((err, i) => (
              <p key={i} className="text-league-red/70 text-[11px]">{err}</p>
            ))}
            {progress.errors.length > 20 && (
              <p className="text-league-grey-light text-[11px] mt-1">...and {progress.errors.length - 20} more</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
