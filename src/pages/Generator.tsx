import { useState, useEffect } from 'react';
import type { GenProgress } from '../types/api';

interface Props {
  notify: (msg: string, ok?: boolean) => void;
  onDone: () => void;
}

export default function Generator({ notify, onDone }: Props) {
  const [status, setStatus] = useState<'idle' | 'running' | 'done'>('idle');
  const [progress, setProgress] = useState<GenProgress | null>(null);
  const [singleChamp, setSingleChamp] = useState('');
  const [singleStatus, setSingleStatus] = useState('');

  useEffect(() => {
    window.api?.onGenAllProgress((p: GenProgress) => setProgress(p));
  }, []);

  const handleGenerateAll = async () => {
    if (!window.api) return;
    setStatus('running');
    setProgress(null);
    try {
      const r = await window.api.generateAll();
      setProgress(r);
      setStatus('done');
      notify(`Done! ${r.generated} skins generated`, true);
      onDone();
    } catch (e: any) {
      setStatus('done');
      notify(e.message, false);
    }
  };

  const handleSingle = async () => {
    if (!window.api || !singleChamp) return;
    setSingleStatus('Generating...');
    try {
      const r = await window.api.generateChampion(singleChamp);
      setSingleStatus(`✅ ${r.generated} generated, ${r.failed} failed`);
      notify(`${singleChamp}: ${r.generated} skins`, true);
      onDone();
    } catch (e: any) {
      setSingleStatus(`❌ ${e.message}`);
    }
  };

  const pct = progress ? Math.round((progress.done / Math.max(progress.total, 1)) * 100) : 0;

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="font-beaufort text-2xl text-league-gold-light tracking-widest uppercase">Skin Generator</h1>
          <p className="text-league-grey-light text-xs mt-1">
            Generate skin mods from CDragon data into the lol-skins folder
          </p>
        </div>

        {/* Single */}
        <div className="league-card p-5 space-y-3">
          <h2 className="font-beaufort text-sm text-league-gold tracking-widest uppercase">Single Champion</h2>
          <div className="flex gap-2">
            <input value={singleChamp} onChange={e => setSingleChamp(e.target.value)}
                   placeholder="Champion ID (e.g. Ahri, Jinx)"
                   className="league-input flex-1" />
            <button onClick={handleSingle} disabled={!singleChamp || status === 'running'}
                    className="btn-primary">Generate</button>
          </div>
          {singleStatus && <p className="text-sm text-league-gold">{singleStatus}</p>}
        </div>

        {/* All */}
        <div className="league-card p-5 space-y-4">
          <h2 className="font-beaufort text-sm text-league-gold tracking-widest uppercase">Generate All</h2>
          <p className="text-league-grey-light text-xs">
            Downloads every skin bin from CDragon. Takes 30-60 min.
          </p>

          <button onClick={handleGenerateAll} disabled={status === 'running'} className="btn-primary">
            {status === 'running' ? '⏳ Running...' : '⚡ Generate All Skins'}
          </button>

          {progress && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-league-gold truncate mr-4">{progress.current}</span>
                <span className="text-league-grey-light">{progress.done}/{progress.total}</span>
              </div>
              <div className="league-progress-lg">
                <div className="league-progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-league-green">{progress.generated} generated</span>
                <span className="text-league-gold">{pct}%</span>
                {progress.errors.length > 0 && <span className="text-league-red">{progress.errors.length} errors</span>}
              </div>
            </div>
          )}

          {status === 'done' && <p className="text-league-green text-sm">✅ Complete</p>}
        </div>
      </div>
    </div>
  );
}
