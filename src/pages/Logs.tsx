import { useEffect, useRef } from 'react';

interface Props {
  logs: string[];
}

export default function Logs({ logs }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="fade-in space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h1 className="font-beaufort text-3xl font-bold text-league-gold-light tracking-wide">LOGS</h1>
        <span className="text-league-grey text-sm">{logs.length} entries</span>
      </div>

      <div className="flex-1 league-border bg-league-blue-deeper rounded p-4 overflow-y-auto font-mono text-xs">
        {logs.length === 0 ? (
          <p className="text-league-grey">No logs yet. Scan a skin folder to begin.</p>
        ) : (
          logs.map((log, i) => (
            <div key={i} className={`py-0.5 ${
              log.includes('Error') || log.includes('failed')
                ? 'text-red-400'
                : log.includes('complete') || log.includes('Applied') || log.includes('success')
                  ? 'text-green-400'
                  : 'text-league-grey'
            }`}>
              {log}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
