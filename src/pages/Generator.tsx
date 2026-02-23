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
      setSingleMsg(`✅ ${r.generated} generated`); notify(`${single}: ${r.generated}`, true); onDone();
    } catch (e: any) { setSingleMsg(`❌ ${e.message}`); }
  };

  const pct = progress ? Math.round((progress.done / Math.max(progress.total, 1)) * 100) : 0;

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="max-w-xl mx-auto space-y-6">
        <h1 className="font-beaufort text-xl text-[#C8AA6E] tracking-widest uppercase">Generator</h1>

        <div className="bg-[#0A1428] border border-[#1E2328] p-5 space-y-3">
          <p className="text-[#A09B8C] text-xs uppercase tracking-widest font-beaufort">Single Champion</p>
          <div className="flex gap-2">
            <input value={single} onChange={e => setSingle(e.target.value)}
                   placeholder="e.g. Ahri"
                   className="flex-1 px-3 py-2 bg-[#1E2328] border border-[#3C3C41] text-[#F0E6D2] text-xs outline-none focus:border-[#C8AA6E]/40 placeholder-[#5B5A56]" />
            <button onClick={genSingle} disabled={!single} className="btn-gold">Go</button>
          </div>
          {singleMsg && <p className="text-xs text-[#C8AA6E]">{singleMsg}</p>}
        </div>

        <div className="bg-[#0A1428] border border-[#1E2328] p-5 space-y-4">
          <p className="text-[#A09B8C] text-xs uppercase tracking-widest font-beaufort">Generate All</p>
          <p className="text-[#5B5A56] text-xs">Downloads from CDragon. ~30-60 min.</p>
          <button onClick={genAll} disabled={status === 'running'} className="btn-gold">
            {status === 'running' ? '⏳ Running...' : '⚡ Generate All'}
          </button>

          {progress && (
            <div className="space-y-2 animate-fade">
              <div className="flex justify-between text-[10px]">
                <span className="text-[#C8AA6E] truncate mr-4">{progress.current}</span>
                <span className="text-[#5B5A56]">{progress.done}/{progress.total}</span>
              </div>
              <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
              <div className="flex justify-between text-[10px]">
                <span className="text-[#0ACE83]">{progress.generated} generated</span>
                <span className="text-[#C8AA6E]">{pct}%</span>
                {progress.errors?.length > 0 && <span className="text-[#C24B4B]">{progress.errors.length} errors</span>}
              </div>
            </div>
          )}
          {status === 'done' && <p className="text-[#0ACE83] text-xs">✅ Complete</p>}
        </div>
      </div>
    </div>
  );
}
