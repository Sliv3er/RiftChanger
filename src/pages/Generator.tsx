import { useState, useEffect } from 'react';

interface Props { notify: (m: string, ok?: boolean) => void; onDone: () => void; }

export default function Generator({ notify, onDone }: Props) {
  const [status, setStatus] = useState<'idle' | 'running' | 'done'>('idle');
  const [progress, setProgress] = useState<any>(null);
  const [single, setSingle] = useState('');
  const [singleMsg, setSingleMsg] = useState('');

  useEffect(() => { window.api?.onGenAllProgress((p: any) => setProgress(p)); }, []);

  const genAll = async () => {
    if (!window.api) return;
    setStatus('running');
    try {
      const r = await window.api.generateAll();
      setProgress(r); setStatus('done');
      notify(`${r.generated} skins generated`, true); onDone();
    } catch (e: any) { setStatus('done'); notify(e.message, false); }
  };

  const genSingle = async () => {
    if (!window.api || !single) return;
    setSingleMsg('Generating...');
    try {
      const r = await window.api.generateChampion(single);
      setSingleMsg(`Done — ${r.generated} generated`); notify(`${single}: ${r.generated}`, true); onDone();
    } catch (e: any) { setSingleMsg(`Error: ${e.message}`); }
  };

  const pct = progress ? Math.round((progress.done / Math.max(progress.total, 1)) * 100) : 0;

  return (
    <div className="h-full overflow-y-auto p-8" style={{ background: '#010A13' }}>
      <div className="max-w-xl mx-auto space-y-5">
        <h1 style={{ fontSize: 14, fontWeight: 600, color: '#C8AA6E', letterSpacing: '0.2em', textTransform: 'uppercase' as const }}>
          Skin Generator
        </h1>

        {/* Single champion */}
        <div style={{ background: '#0A1428', border: '1px solid #1E2328', padding: 20 }}>
          <p style={{ fontSize: 10, color: '#A09B8C', letterSpacing: '0.2em', textTransform: 'uppercase' as const, marginBottom: 10 }}>
            Single Champion
          </p>
          <div className="flex gap-2">
            <input value={single} onChange={e => setSingle(e.target.value)}
              placeholder="e.g. Ahri"
              className="lol-search flex-1" style={{ paddingLeft: 10 }} />
            <button onClick={genSingle} disabled={!single} className="btn-gold">Generate</button>
          </div>
          {singleMsg && <p style={{ fontSize: 11, color: '#C8AA6E', marginTop: 8 }}>{singleMsg}</p>}
        </div>

        {/* Generate all */}
        <div style={{ background: '#0A1428', border: '1px solid #1E2328', padding: 20 }}>
          <p style={{ fontSize: 10, color: '#A09B8C', letterSpacing: '0.2em', textTransform: 'uppercase' as const, marginBottom: 6 }}>
            Generate All Champions
          </p>
          <p style={{ fontSize: 11, color: '#5B5A56', marginBottom: 12 }}>
            Downloads skin bins from CDragon and packs WADs. Takes 30-60 minutes.
          </p>
          <button onClick={genAll} disabled={status === 'running'} className="btn-gold">
            {status === 'running' ? 'Running...' : 'Generate All'}
          </button>

          {progress && (
            <div className="mt-4 space-y-2 anim-fade">
              <div className="flex justify-between" style={{ fontSize: 10 }}>
                <span style={{ color: '#C8AA6E' }} className="truncate mr-4">{progress.current}</span>
                <span style={{ color: '#5B5A56' }}>{progress.done}/{progress.total}</span>
              </div>
              <div className="lol-progress">
                <div className="lol-progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between" style={{ fontSize: 10 }}>
                <span style={{ color: '#0ACE83' }}>{progress.generated} generated</span>
                <span style={{ color: '#C8AA6E' }}>{pct}%</span>
                {progress.errors?.length > 0 && <span style={{ color: '#C24B4B' }}>{progress.errors.length} errors</span>}
              </div>
            </div>
          )}
          {status === 'done' && <p style={{ fontSize: 11, color: '#0ACE83', marginTop: 8 }}>Complete</p>}
        </div>
      </div>
    </div>
  );
}
