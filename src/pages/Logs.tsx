import { useState, useEffect, useRef } from 'react';

interface Props {
  logs: string[];
}

export default function Logs({ logs }: Props) {
  const [filter, setFilter] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const filtered = filter
    ? logs.filter(l => l.toLowerCase().includes(filter.toLowerCase()))
    : logs;

  const getLogColor = (log: string): string => {
    if (log.includes('✅') || log.includes('success') || log.includes('Generated') || log.includes('complete'))
      return 'text-league-green';
    if (log.includes('❌') || log.includes('Error') || log.includes('error') || log.includes('Failed') || log.includes('failed'))
      return 'text-league-red';
    if (log.includes('⏳') || log.includes('Downloading') || log.includes('Scanning') || log.includes('Setting up'))
      return 'text-league-blue-light';
    return 'text-league-gold/80';
  };

  return (
    <div className="animate-fade-in space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-beaufort text-3xl font-bold text-league-gold-light tracking-widest uppercase">Logs</h1>
          <p className="text-league-grey-light text-sm mt-1">{logs.length} entries</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        <div className="league-search flex-1">
          <span className="league-search-icon">🔍</span>
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter logs..."
          />
        </div>
      </div>

      {/* Log output */}
      <div className="flex-1 league-card p-4 overflow-y-auto font-mono text-xs min-h-0"
           style={{ background: '#05080D' }}>
        {filtered.length === 0 ? (
          <p className="text-league-grey-lightest text-center py-8">
            {logs.length === 0 ? 'No logs yet. Actions will appear here.' : 'No logs match your filter.'}
          </p>
        ) : (
          <div className="space-y-0.5">
            {filtered.map((log, i) => {
              const tsMatch = log.match(/^\[([^\]]+)\]\s*(.*)/);
              const ts = tsMatch ? tsMatch[1] : '';
              const msg = tsMatch ? tsMatch[2] : log;
              return (
                <div key={i} className="flex gap-3 py-0.5 hover:bg-white/[0.02] px-2 -mx-2">
                  {ts && <span className="text-league-grey-lightest flex-shrink-0">{ts}</span>}
                  <span className={getLogColor(log)}>{msg || log}</span>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  );
}
