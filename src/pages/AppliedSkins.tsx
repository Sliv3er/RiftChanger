import { useState, useCallback } from 'react';

interface Props {
  appliedMods: Record<string, { skinName: string; appliedAt: string }>;
  toolsReady: boolean;
  onRemove: (champ: string) => Promise<void>;
  onRemoveAll: () => Promise<void>;
  notify: (msg: string, ok?: boolean) => void;
}

export default function AppliedSkins({ appliedMods, toolsReady, onRemove, onRemoveAll, notify }: Props) {
  const [confirmAll, setConfirmAll] = useState(false);
  const entries = Object.entries(appliedMods);

  const handleRemoveAll = useCallback(async () => {
    setConfirmAll(false);
    await onRemoveAll();
    notify('All skins removed');
  }, [onRemoveAll, notify]);

  return (
    <div className="h-full flex flex-col p-6" style={{ background: '#010A13' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold" style={{ color: '#F0E6D2' }}>APPLIED SKINS</h1>
        {entries.length > 0 && (
          <button onClick={() => setConfirmAll(true)}
            className="px-4 py-2 text-sm font-bold rounded"
            style={{ background: '#3C2A2A', color: '#E84057', border: '1px solid #E84057' }}>
            REMOVE ALL
          </button>
        )}
      </div>

      {/* System Status */}
      <div className="rounded-lg p-4 mb-6" style={{ background: '#0A0E13', border: '1px solid #1E2328' }}>
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full" style={{ background: toolsReady ? '#0ACF83' : '#E84057' }} />
          <span className="text-sm" style={{ color: '#A09B8C' }}>
            CSLoL Tools: {toolsReady ? 'Ready' : 'Not configured'}
          </span>
          <span className="text-[#5B5A56] mx-2">|</span>
          <span className="text-sm" style={{ color: '#A09B8C' }}>
            Active Mods: {entries.length}
          </span>
        </div>
      </div>

      {/* Applied Skins List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="text-4xl opacity-30">🎭</div>
            <p style={{ color: '#5B5A56' }} className="text-center">
              No skins applied<br />
              <span className="text-xs">Go to SKINS tab, pick a champion, and lock in a skin</span>
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map(([champ, info]) => (
              <div key={champ} className="flex items-center gap-4 rounded-lg p-3 group"
                style={{ background: '#0A0E13', border: '1px solid #1E2328' }}>
                <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0"
                  style={{ border: '2px solid #C89B3C' }}>
                  <img src={`https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion/${champ}.png`}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold" style={{ color: '#F0E6D2' }}>{champ}</div>
                  <div className="text-xs truncate" style={{ color: '#C89B3C' }}>{info.skinName}</div>
                </div>
                <div className="text-xs" style={{ color: '#5B5A56' }}>
                  {new Date(info.appliedAt).toLocaleTimeString()}
                </div>
                <button onClick={() => onRemove(champ)}
                  className="px-3 py-1 text-xs font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: '#3C2A2A', color: '#E84057' }}>
                  REMOVE
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm All Modal */}
      {confirmAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-lg p-6 max-w-sm" style={{ background: '#0A0E13', border: '1px solid #C89B3C' }}>
            <h3 className="text-lg font-bold mb-3" style={{ color: '#F0E6D2' }}>Remove All Skins?</h3>
            <p className="text-sm mb-4" style={{ color: '#A09B8C' }}>
              This will remove all {entries.length} applied skins and stop the overlay.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmAll(false)}
                className="px-4 py-2 text-sm rounded" style={{ background: '#1E2328', color: '#A09B8C' }}>
                Cancel
              </button>
              <button onClick={handleRemoveAll}
                className="px-4 py-2 text-sm font-bold rounded" style={{ background: '#E84057', color: '#fff' }}>
                Remove All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
