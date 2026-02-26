import { useState, useCallback } from 'react';

const DDRAGON = 'https://ddragon.leagueoflegends.com';

// Champion name → ddragon key
const CHAMP_KEY: Record<string, string> = {
  "Aurelion Sol":"AurelionSol","Cho'Gath":"Chogath","Dr. Mundo":"DrMundo","Jarvan IV":"JarvanIV",
  "Kai'Sa":"Kaisa","Kha'Zix":"Khazix","Kog'Maw":"KogMaw","LeBlanc":"Leblanc","Lee Sin":"LeeSin",
  "Master Yi":"MasterYi","Miss Fortune":"MissFortune","Nunu & Willump":"Nunu","Rek'Sai":"RekSai",
  "Renata Glasc":"Renata","Tahm Kench":"TahmKench","Twisted Fate":"TwistedFate","Vel'Koz":"Velkoz",
  "Wukong":"MonkeyKing","Xin Zhao":"XinZhao",
};
const getKey = (name: string) => CHAMP_KEY[name] || name.replace(/[^a-zA-Z]/g, '');

interface Props {
  patch: string;
  appliedMods: Record<string, { skinName: string; appliedAt: string }>;
  toolsReady: boolean;
  onRemove: (champ: string) => Promise<void>;
  onRemoveAll: () => Promise<void>;
  notify: (msg: string, ok?: boolean) => void;
}

export default function AppliedSkins({ patch, appliedMods, toolsReady, onRemove, onRemoveAll, notify }: Props) {
  const [confirmAll, setConfirmAll] = useState(false);
  const [removingAll, setRemovingAll] = useState(false);
  const [removing, setRemoving] = useState<Set<string>>(new Set());
  const entries = Object.entries(appliedMods);

  const handleRemoveAll = useCallback(async () => {
    setConfirmAll(false);
    setRemovingAll(true);
    try { await onRemoveAll(); notify('All skins removed'); } finally { setRemovingAll(false); }
  }, [onRemoveAll, notify]);

  const handleRemove = useCallback(async (champ: string) => {
    setRemoving(s => new Set([...s, champ]));
    try { await onRemove(champ); } finally { setRemoving(s => { const n = new Set(s); n.delete(champ); return n; }); }
  }, [onRemove]);

  const formatDuration = (appliedAt: string) => {
    const mins = Math.floor((Date.now() - new Date(appliedAt).getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="h-full overflow-auto scrollbar-thin" style={{ background: '#0a0a0a' }}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Applied Skins & Mods</h1>
            <p className="text-sm text-gray-400">{entries.length} item{entries.length !== 1 ? 's' : ''} currently active</p>
          </div>
          {entries.length > 0 && (
            <button onClick={() => setConfirmAll(true)} disabled={removingAll}
              className="btn-primary flex items-center space-x-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>{removingAll ? 'Removing...' : 'Remove All Skins'}</span>
            </button>
          )}
        </div>

        {/* Status Card */}
        <div className="glass-card p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                <div className={`w-3 h-3 rounded-full ${entries.length > 0 ? 'bg-green-500' : 'bg-gray-500'}`}
                  style={entries.length > 0 ? { boxShadow: '0 0 10px rgba(34, 197, 94, 0.5)', animation: 'pulse-glow 2s infinite' } : {}} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">System Status</h3>
                <p className="text-sm text-gray-400">
                  {entries.length > 0 ? `${entries.length} item${entries.length !== 1 ? 's' : ''} active` : 'No skins or mods currently applied'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-sm text-gray-400">CSLoL Tools:</span>
                <div className={`w-3 h-3 rounded-full ${toolsReady ? 'bg-green-500' : 'bg-gray-500'}`}
                  style={toolsReady ? { boxShadow: '0 0 10px rgba(34, 197, 94, 0.5)' } : {}} />
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-400">Injection System:</span>
                <span className={`text-sm ${toolsReady ? 'text-green-400' : 'text-gray-500'}`}>{toolsReady ? 'Ready' : 'Not configured'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Applied List */}
        {entries.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-20 h-20 text-gray-600 mx-auto mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-2xl font-semibold text-gray-400 mb-4">No Applied Skins or Mods</h3>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              You haven't applied any skins yet. Visit the SKINS tab to pick a champion and lock in a skin.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map(([champ, info]) => {
              const key = getKey(champ);
              return (
                <div key={champ} className="bg-black/80 backdrop-blur-sm rounded-lg border border-gold-500/30 p-4 transition-all duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg border border-gold-500/30 overflow-hidden bg-black">
                        <img src={`${DDRAGON}/cdn/${patch}/img/champion/${key}.png`} alt={champ}
                          className="w-full h-full object-cover"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">{champ}</h3>
                        <p className="text-gray-300 font-medium">{info.skinName}</p>
                        <p className="text-sm text-gray-400">Applied {formatDuration(info.appliedAt)}</p>
                      </div>
                      <span className="bg-gold-500/20 text-gold-300 px-3 py-1 rounded-full text-sm font-medium ml-2">OFFICIAL SKIN</span>
                    </div>
                    <button onClick={() => handleRemove(champ)} disabled={removing.has(champ)}
                      className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg font-medium transition-all flex items-center gap-2 disabled:opacity-50">
                      {removing.has(champ) ? (
                        <><div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />Removing...</>
                      ) : (
                        <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>Remove</>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirm Modal */}
      {confirmAll && (
        <div className="fixed inset-0 backdrop-blur-md z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div className="glass-card p-6" style={{ width: 560, maxWidth: '100%' }}>
            <h3 className="text-lg font-bold text-white mb-3">Remove All Items</h3>
            <p className="text-gray-400 mb-6">Are you sure you want to remove all {entries.length} applied items?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmAll(false)} className="btn-secondary px-4 py-2">Cancel</button>
              <button onClick={handleRemoveAll} className="btn-danger px-4 py-2">Remove All</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
