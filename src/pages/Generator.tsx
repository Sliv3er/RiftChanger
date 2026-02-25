import { useState, useEffect, useRef } from 'react';

interface Props { notify: (m: string, ok?: boolean) => void; onDone: () => void; }

export default function Generator({ notify, onDone }: Props) {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState<any>(null);

  // Single champion
  const [query, setQuery] = useState('');
  const [champions, setChampions] = useState<{ id: string; name: string }[]>([]);
  const [filtered, setFiltered] = useState<{ id: string; name: string }[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedChamp, setSelectedChamp] = useState<{ id: string; name: string } | null>(null);
  const [singleStatus, setSingleStatus] = useState<'idle' | 'running' | 'done'>('idle');
  const [singleMsg, setSingleMsg] = useState('');
  const [singleProgress, setSingleProgress] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Timer
  const startTime = useRef(0);
  const [elapsed, setElapsed] = useState(0);

  // Load champion list
  useEffect(() => {
    window.api?.getChampions().then((champs) => {
      const list = champs.map((c: any) => ({ id: c.id, name: c.name })).sort((a: any, b: any) => a.name.localeCompare(b.name));
      setChampions(list);
    }).catch(() => {});
  }, []);

  // Filter champions as user types
  useEffect(() => {
    if (!query.trim()) { setFiltered([]); return; }
    const q = query.toLowerCase();
    setFiltered(champions.filter(c => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)).slice(0, 15));
  }, [query, champions]);

  // Listen for gen:allProgress
  useEffect(() => { window.api?.onGenAllProgress((p: any) => setProgress(p)); }, []);

  // Listen for single champion progress
  useEffect(() => { window.api?.onGenProgress((m: string) => setSingleProgress(m)); }, []);

  // Fallback: listen for champion done event in case invoke doesn't resolve
  useEffect(() => {
    window.api?.onGenChampionDone?.((r: any) => {
      if (singleStatus !== 'running') return;
      setSingleStatus('done');
      setSingleProgress('');
      if (r.generated > 0) {
        setSingleMsg(`✅ ${r.generated} skins generated${r.errors?.length ? ` (${r.errors.length} errors)` : ''}`);
        notify(`${r.generated} skins generated!`, true);
      } else {
        setSingleMsg(`❌ Failed — ${r.errors?.[0] || 'Unknown error'}`);
      }
      onDone();
    });
  }, [singleStatus]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Timer for generate all
  useEffect(() => {
    if (status !== 'running') return;
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startTime.current) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [status]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const selectChampion = (c: { id: string; name: string }) => {
    setSelectedChamp(c);
    setQuery(c.name);
    setShowDropdown(false);
  };

  const genSingle = async () => {
    const champ = selectedChamp || champions.find(c => c.name.toLowerCase() === query.toLowerCase() || c.id.toLowerCase() === query.toLowerCase());
    if (!window.api || !champ) {
      notify('Select a champion from the list', false);
      return;
    }
    setSingleStatus('running');
    setSingleMsg('');
    setSingleProgress('Starting...');
    try {
      const r = await window.api.generateChampion(champ.id);
      setSingleStatus('done');
      setSingleProgress('');
      if (r.generated > 0) {
        setSingleMsg(`✅ ${r.generated} skins generated${r.errors?.length ? ` (${r.errors.length} errors)` : ''}`);
        notify(`${champ.name}: ${r.generated} skins generated!`, true);
      } else {
        setSingleMsg(`❌ Failed — ${r.errors?.[0] || 'Unknown error'}`);
        notify(`${champ.name} generation failed`, false);
      }
      // Auto-rescan
      onDone();
    } catch (e: any) {
      setSingleStatus('done');
      setSingleProgress('');
      setSingleMsg(`❌ Error: ${e.message}`);
    }
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
      onDone(); // Auto-rescan
    } catch (e: any) {
      setStatus('error');
      notify(`Generation failed: ${e.message}`, false);
    }
  };

  const pct = progress ? Math.round((progress.done / Math.max(progress.total, 1)) * 100) : 0;
  const eta = progress && progress.done > 0 ? Math.round((elapsed / progress.done) * (progress.total - progress.done)) : 0;

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
          <div className="flex gap-2 relative" ref={dropdownRef}>
            <div className="relative flex-1">
              <input
                value={query}
                onChange={e => { setQuery(e.target.value); setSelectedChamp(null); setShowDropdown(true); }}
                onFocus={() => query && setShowDropdown(true)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { setShowDropdown(false); genSingle(); }
                  if (e.key === 'Escape') setShowDropdown(false);
                }}
                placeholder="Search champion..."
                className="lol-search w-full" style={{ paddingLeft: 10 }}
              />
              {/* Dropdown */}
              {showDropdown && filtered.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto"
                  style={{ background: '#0A1428', border: '1px solid #C8AA6E33', borderRadius: 4, boxShadow: '0 8px 32px rgba(0,0,0,0.8)' }}>
                  {filtered.map(c => (
                    <div key={c.id}
                      onClick={() => selectChampion(c)}
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors"
                      style={{ borderBottom: '1px solid #1E2328' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#1E2328')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <img
                        src={`https://ddragon.leagueoflegends.com/cdn/15.4.1/img/champion/${c.id}.png`}
                        alt={c.name}
                        style={{ width: 28, height: 28, borderRadius: 4, border: '1px solid #C8AA6E44' }}
                        onError={e => (e.currentTarget.style.display = 'none')}
                      />
                      <span style={{ fontSize: 13, color: '#F0E6D2' }}>{c.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={genSingle} disabled={singleStatus === 'running'} className="btn-gold" style={{ whiteSpace: 'nowrap' }}>
              {singleStatus === 'running' ? 'Generating...' : 'Generate'}
            </button>
          </div>

          {/* Single progress */}
          {singleStatus === 'running' && singleProgress && (
            <div className="mt-3 anim-fade" style={{ fontSize: 11, color: '#C8AA6E' }}>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ background: '#C8AA6E' }} />
                {singleProgress}
              </div>
            </div>
          )}

          {singleMsg && singleStatus === 'done' && (
            <p style={{
              fontSize: 12, marginTop: 10, padding: '8px 12px', borderRadius: 4,
              color: singleMsg.startsWith('✅') ? '#0ACE83' : '#C24B4B',
              background: singleMsg.startsWith('✅') ? '#091E0F' : '#1E0A0A',
              border: `1px solid ${singleMsg.startsWith('✅') ? '#0ACE8333' : '#C24B4B33'}`,
            }}>
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
              <div style={{ fontSize: 12, color: '#F0E6D2', fontWeight: 500 }}>{progress.current}</div>
              <div className="lol-progress"><div className="lol-progress-fill" style={{ width: `${pct}%`, transition: 'width 0.3s ease' }} /></div>
              <div className="flex justify-between" style={{ fontSize: 11 }}>
                <span style={{ color: '#0ACE83' }}>{progress.generated} generated</span>
                <span style={{ color: '#C8AA6E' }}>{progress.done}/{progress.total} champions • {pct}%</span>
              </div>
              <div className="flex justify-between" style={{ fontSize: 10, color: '#5B5A56' }}>
                <span>Elapsed: {fmt(elapsed)}</span>
                {eta > 0 && <span>ETA: ~{fmt(eta)}</span>}
              </div>
              {progress.errors?.length > 0 && (
                <div style={{ fontSize: 10, color: '#C24B4B' }}>{progress.errors.length} error{progress.errors.length > 1 ? 's' : ''}</div>
              )}
            </div>
          )}

          {status === 'done' && progress && (
            <div className="mt-4 anim-fade" style={{ background: '#091E0F', border: '1px solid #0ACE83', borderRadius: 4, padding: 16 }}>
              <div style={{ fontSize: 14, color: '#0ACE83', fontWeight: 600 }}>✅ Generation Complete!</div>
              <div style={{ fontSize: 12, color: '#F0E6D2', marginTop: 4 }}>
                <span style={{ color: '#0ACE83', fontWeight: 600 }}>{progress.generated}</span> skins across{' '}
                <span style={{ color: '#C8AA6E', fontWeight: 600 }}>{progress.done}</span> champions
              </div>
              <div style={{ fontSize: 10, color: '#5B5A56', marginTop: 2 }}>Completed in {fmt(elapsed)}</div>
              {progress.errors?.length > 0 && (
                <details style={{ fontSize: 10, color: '#C24B4B', marginTop: 6 }}>
                  <summary className="cursor-pointer">{progress.errors.length} error{progress.errors.length > 1 ? 's' : ''}</summary>
                  <ul className="mt-1 ml-3" style={{ maxHeight: 120, overflowY: 'auto' }}>
                    {progress.errors.map((e: string, i: number) => <li key={i}>• {e}</li>)}
                  </ul>
                </details>
              )}
            </div>
          )}

          {status === 'error' && (
            <div className="mt-4" style={{ background: '#1E0A0A', border: '1px solid #C24B4B', borderRadius: 4, padding: 16 }}>
              <div style={{ fontSize: 14, color: '#C24B4B', fontWeight: 600 }}>❌ Generation Failed</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
