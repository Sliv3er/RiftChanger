import { useState, useEffect, useRef } from 'react';

interface Props { notify: (m: string, ok?: boolean) => void; onDone: () => void; }

export default function Generator({ notify, onDone }: Props) {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState<any>(null);
  const [single, setSingle] = useState('');
  const [singleStatus, setSingleStatus] = useState<'idle' | 'running' | 'done'>('idle');
  const [singleMsg, setSingleMsg] = useState('');
  const startTime = useRef(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => { window.api?.onGenAllProgress((p: any) => setProgress(p)); }, []);

  // Timer
  useEffect(() => {
    if (status !== 'running') return;
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startTime.current) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [status]);

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const genAll = async () => {
    if (!window.api) return;
    setStatus('running');
    setProgress(null);
    startTime.current = Date.now();
    setElapsed(0);
    try {
      const r = await window.api.generateAll();
      setProgress(r);
      setStatus('done');
      notify(`✅ ${r.generated} skins generated successfully!`, true);
      onDone();
    } catch (e: any) {
      setStatus('error');
      notify(e.message, false);
    }
  };

  const genSingle = async () => {
    if (!window.api || !single) return;
    setSingleStatus('running');
    setSingleMsg('Generating...');
    try {
      const r = await window.api.generateChampion(single);
      setSingleStatus('done');
      if (r.generated > 0) {
        setSingleMsg(`✅ Done — ${r.generated} skins generated${r.errors?.length ? `, ${r.errors.length} errors` : ''}`);
        notify(`${single}: ${r.generated} skins generated`, true);
      } else {
        setSingleMsg(`❌ Failed — ${r.errors?.[0] || 'Unknown error'}`);
        notify(`${single} failed`, false);
      }
      onDone();
    } catch (e: any) {
      setSingleStatus('done');
      setSingleMsg(`❌ Error: ${e.message}`);
    }
  };

  const pct = progress ? Math.round((progress.done / Math.max(progress.total, 1)) * 100) : 0;
  const eta = progress && progress.done > 0
    ? Math.round((elapsed / progress.done) * (progress.total - progress.done))
    : 0;

  return (
    <div className="h-full overflow-y-auto p-8" style={{ background: '#010A13' }}>
      <div className="max-w-xl mx-auto space-y-5">
        <h1 style={{ fontSize: 14, fontWeight: 600, color: '#C8AA6E', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
          Skin Generator
        </h1>

        {/* Single champion */}
        <div style={{ background: '#0A1428', border: '1px solid #1E2328', borderRadius: 4, padding: 20 }}>
          <p style={{ fontSize: 10, color: '#A09B8C', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 10 }}>
            Single Champion
          </p>
          <div className="flex gap-2">
            <input value={single} onChange={e => setSingle(e.target.value)}
              placeholder="e.g. Ahri"
              onKeyDown={e => e.key === 'Enter' && genSingle()}
              className="lol-search flex-1" style={{ paddingLeft: 10 }} />
            <button onClick={genSingle} disabled={!single || singleStatus === 'running'} className="btn-gold">
              {singleStatus === 'running' ? 'Generating...' : 'Generate'}
            </button>
          </div>
          {singleMsg && (
            <p style={{ fontSize: 11, color: singleMsg.startsWith('✅') ? '#0ACE83' : singleMsg.startsWith('❌') ? '#C24B4B' : '#C8AA6E', marginTop: 8 }}>
              {singleMsg}
            </p>
          )}
        </div>

        {/* Generate all */}
        <div style={{ background: '#0A1428', border: '1px solid #1E2328', borderRadius: 4, padding: 20 }}>
          <p style={{ fontSize: 10, color: '#A09B8C', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6 }}>
            Generate All Champions
          </p>
          <p style={{ fontSize: 11, color: '#5B5A56', marginBottom: 12 }}>
            Extracts skin bins from your game files and packs them as mods. Takes 30-60 minutes.
          </p>
          <button onClick={genAll} disabled={status === 'running'} className="btn-gold">
            {status === 'running' ? 'Generating...' : status === 'done' ? 'Regenerate All' : 'Generate All'}
          </button>

          {status === 'running' && progress && (
            <div className="mt-4 space-y-3 anim-fade">
              {/* Current champion */}
              <div style={{ fontSize: 12, color: '#F0E6D2', fontWeight: 500 }}>
                {progress.current}
              </div>

              {/* Progress bar */}
              <div className="lol-progress">
                <div className="lol-progress-fill" style={{ width: `${pct}%`, transition: 'width 0.3s ease' }} />
              </div>

              {/* Stats row */}
              <div className="flex justify-between" style={{ fontSize: 11 }}>
                <span style={{ color: '#0ACE83' }}>{progress.generated} generated</span>
                <span style={{ color: '#C8AA6E' }}>{progress.done}/{progress.total} champions • {pct}%</span>
              </div>

              {/* Time info */}
              <div className="flex justify-between" style={{ fontSize: 10, color: '#5B5A56' }}>
                <span>Elapsed: {fmt(elapsed)}</span>
                {eta > 0 && <span>ETA: ~{fmt(eta)}</span>}
              </div>

              {progress.errors?.length > 0 && (
                <div style={{ fontSize: 10, color: '#C24B4B' }}>
                  {progress.errors.length} error{progress.errors.length > 1 ? 's' : ''}
                </div>
              )}
            </div>
          )}

          {/* Completion state */}
          {status === 'done' && progress && (
            <div className="mt-4 space-y-2 anim-fade" style={{ background: '#091E0F', border: '1px solid #0ACE83', borderRadius: 4, padding: 16 }}>
              <div style={{ fontSize: 14, color: '#0ACE83', fontWeight: 600 }}>
                ✅ Generation Complete!
              </div>
              <div style={{ fontSize: 12, color: '#F0E6D2' }}>
                <span style={{ color: '#0ACE83', fontWeight: 600 }}>{progress.generated}</span> skins generated across{' '}
                <span style={{ color: '#C8AA6E', fontWeight: 600 }}>{progress.done}</span> champions
              </div>
              <div style={{ fontSize: 10, color: '#5B5A56' }}>
                Completed in {fmt(elapsed)}
              </div>
              {progress.errors?.length > 0 && (
                <details style={{ fontSize: 10, color: '#C24B4B', marginTop: 4 }}>
                  <summary style={{ cursor: 'pointer' }}>{progress.errors.length} error{progress.errors.length > 1 ? 's' : ''}</summary>
                  <ul className="mt-1 space-y-1 ml-3" style={{ maxHeight: 120, overflowY: 'auto' }}>
                    {progress.errors.map((e: string, i: number) => <li key={i}>• {e}</li>)}
                  </ul>
                </details>
              )}
            </div>
          )}

          {status === 'error' && (
            <div className="mt-4" style={{ background: '#1E0A0A', border: '1px solid #C24B4B', borderRadius: 4, padding: 16 }}>
              <div style={{ fontSize: 14, color: '#C24B4B', fontWeight: 600 }}>
                ❌ Generation Failed
              </div>
              <div style={{ fontSize: 11, color: '#A09B8C', marginTop: 4 }}>
                Check the error details and try again.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
