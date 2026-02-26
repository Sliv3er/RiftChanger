import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { ChampionData, SkinData, SkinFile } from '../types/api';

// DDragon URLs
const DDRAGON = 'https://ddragon.leagueoflegends.com';
const champIcon = (patch: string, id: string) => `${DDRAGON}/cdn/${patch}/img/champion/${id}.png`;
const splashUrl = (id: string, num: number) => `${DDRAGON}/cdn/img/champion/splash/${id}_${num}.jpg`;
const loadingUrl = (id: string, num: number) => `${DDRAGON}/cdn/img/champion/loading/${id}_${num}.jpg`;

const ROLES = ['ALL', 'Fighter', 'Tank', 'Mage', 'Assassin', 'Marksman', 'Support'] as const;
const ROLE_LABELS: Record<string, string> = {
  ALL: 'ALL', Fighter: 'TOP', Tank: 'JNG', Mage: 'MID', Assassin: 'MID', Marksman: 'ADC', Support: 'SUP'
};

interface Props {
  champions: ChampionData[];
  patch: string;
  skinsPath: string;
  appliedMods: Record<string, { skinName: string; appliedAt: string }>;
  onApply: (champ: string, skin: string, path: string) => Promise<void>;
  onRemove: (champ: string) => Promise<void>;
  notify: (msg: string, ok?: boolean) => void;
}

export default function Skins({ champions, patch, skinsPath, appliedMods, onApply, onRemove, notify }: Props) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [selectedChamp, setSelectedChamp] = useState<ChampionData | null>(null);
  const [skins, setSkins] = useState<SkinData[]>([]);
  const [skinFiles, setSkinFiles] = useState<SkinFile[]>([]);
  const [selectedSkinIdx, setSelectedSkinIdx] = useState(0);
  const [chromaFiles, setChromaFiles] = useState<SkinFile[]>([]);
  const [showChromas, setShowChromas] = useState(false);
  const [applying, setApplying] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);

  // Filter champions
  const filtered = useMemo(() => {
    let list = champions;
    if (roleFilter !== 'ALL') list = list.filter(c => c.tags?.includes(roleFilter));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q));
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [champions, roleFilter, search]);

  // Load skins + skin files when champion selected
  useEffect(() => {
    if (!selectedChamp) return;
    (async () => {
      const [skinsData, filesData] = await Promise.all([
        window.api.getChampionSkins(selectedChamp.id),
        window.api.findSkinFiles(skinsPath, selectedChamp.name),
      ]);
      setSkins(skinsData || []);
      setSkinFiles(filesData?.skinFiles || []);
      setSelectedSkinIdx(0);
      setShowChromas(false);
      setChromaFiles([]);
    })();
  }, [selectedChamp, skinsPath]);

  // Load chromas when skin selected
  useEffect(() => {
    if (!selectedChamp || !skinFiles[selectedSkinIdx]) return;
    (async () => {
      const res = await window.api.findChromaFiles(skinsPath, selectedChamp.name, skinFiles[selectedSkinIdx].name);
      setChromaFiles(res?.chromaFiles || []);
    })();
  }, [selectedChamp, selectedSkinIdx, skinFiles, skinsPath]);

  const currentSkinFile = skinFiles[selectedSkinIdx];
  const currentSkin = skins.find(s => {
    if (!currentSkinFile) return false;
    const skinName = currentSkinFile.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const sName = s.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return sName.includes(skinName) || skinName.includes(sName);
  });
  const skinNum = currentSkin?.num || 0;
  const isApplied = selectedChamp ? appliedMods[selectedChamp.name]?.skinName === currentSkinFile?.name : false;

  const handleApply = useCallback(async (zipPath?: string) => {
    if (!selectedChamp || !currentSkinFile) return;
    setApplying(true);
    try {
      await onApply(selectedChamp.name, currentSkinFile.name, zipPath || currentSkinFile.path);
    } finally {
      setApplying(false);
    }
  }, [selectedChamp, currentSkinFile, onApply]);

  const handleRemove = useCallback(async () => {
    if (!selectedChamp) return;
    await onRemove(selectedChamp.name);
  }, [selectedChamp, onRemove]);

  const scrollStrip = (dir: number) => {
    if (stripRef.current) stripRef.current.scrollBy({ left: dir * 300, behavior: 'smooth' });
  };

  // ─── Champion Grid View ───
  if (!selectedChamp) {
    return (
      <div className="h-full flex flex-col" style={{ background: '#010A13' }}>
        {/* Header: Search + Role Filter */}
        <div className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: '1px solid #1E2328' }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search champions..."
            className="league-input flex-1"
            style={{ maxWidth: 300 }}
          />
          <div className="flex gap-1">
            {ROLES.map(r => (
              <button key={r} onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 text-xs font-bold tracking-wider rounded transition-all ${
                  roleFilter === r
                    ? 'text-[#010A13]'
                    : 'text-[#A09B8C] hover:text-[#F0E6D2]'
                }`}
                style={roleFilter === r ? { background: 'linear-gradient(180deg, #C89B3C 0%, #785A28 100%)' } : { background: '#1E2328' }}>
                {r === 'ALL' ? 'ALL' : r.toUpperCase().slice(0, 3)}
              </button>
            ))}
          </div>
        </div>

        {/* Champion Grid — 8 columns */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(8, 1fr)' }}>
            {filtered.map(c => {
              const hasApplied = !!appliedMods[c.name];
              return (
                <button key={c.id} onClick={() => setSelectedChamp(c)}
                  className="relative group text-center transition-transform hover:scale-105"
                  style={{ aspectRatio: '1' }}>
                  <div className="w-full h-full rounded overflow-hidden border-2 transition-colors"
                    style={{ borderColor: hasApplied ? '#C89B3C' : '#1E2328' }}>
                    <img src={champIcon(patch, c.id)} alt={c.name}
                      className="w-full h-full object-cover"
                      loading="lazy" />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 text-[10px] font-bold truncate px-1 py-0.5"
                    style={{ background: 'rgba(0,0,0,0.8)', color: '#A09B8C' }}>
                    {c.name}
                  </div>
                  {hasApplied && (
                    <div className="absolute top-0 right-0 w-3 h-3 rounded-full m-0.5" style={{ background: '#C89B3C' }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ─── Skin Detail View ───
  return (
    <div className="h-full flex flex-col relative" style={{ background: '#010A13' }}>
      {/* Splash Background */}
      <div className="absolute inset-0 z-0">
        <img src={splashUrl(selectedChamp.id, skinNum)}
          className="w-full h-full object-cover opacity-30"
          onError={(e) => { (e.target as HTMLImageElement).src = splashUrl(selectedChamp.id, 0); }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #010A13 0%, transparent 60%)' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, #010A13 0%, transparent 30%)' }} />
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="flex items-center gap-3 px-6 py-3">
          <button onClick={() => setSelectedChamp(null)}
            className="text-[#C89B3C] hover:text-[#F0E6D2] text-sm font-bold flex items-center gap-1">
            ← BACK
          </button>
          <span className="text-[#A09B8C] text-sm">|</span>
          <span className="text-[#F0E6D2] text-lg font-bold tracking-wide">{selectedChamp.name.toUpperCase()}</span>
          {appliedMods[selectedChamp.name] && (
            <span className="text-[#C89B3C] text-xs ml-2 px-2 py-0.5 rounded" style={{ background: 'rgba(200,155,60,0.15)' }}>
              {appliedMods[selectedChamp.name].skinName} ACTIVE
            </span>
          )}
        </div>

        {/* Center: Skin portrait + info */}
        <div className="flex-1 flex items-center justify-center gap-10 px-10">
          {/* Circular portrait */}
          <div className="flex-shrink-0">
            <div className="w-64 h-64 rounded-full overflow-hidden border-4"
              style={{ borderColor: isApplied ? '#C89B3C' : '#1E2328' }}>
              <img src={loadingUrl(selectedChamp.id, skinNum)}
                className="w-full h-full object-cover object-top"
                onError={(e) => { (e.target as HTMLImageElement).src = loadingUrl(selectedChamp.id, 0); }} />
            </div>
          </div>

          {/* Skin info + actions */}
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold" style={{ color: '#F0E6D2' }}>
              {currentSkinFile?.name || 'Default'}
            </h2>

            {/* Chromas */}
            {chromaFiles.length > 0 && (
              <div className="relative">
                <button onClick={() => setShowChromas(!showChromas)}
                  className="px-4 py-2 text-sm font-bold rounded transition-all"
                  style={{ background: '#1E2328', color: '#C89B3C', border: '1px solid #785A28' }}>
                  🎨 CHROMAS ({chromaFiles.length})
                </button>
                {showChromas && (
                  <div className="absolute bottom-full mb-2 left-0 p-3 rounded-lg grid grid-cols-4 gap-2 max-w-sm"
                    style={{ background: '#0A0E13', border: '1px solid #1E2328' }}>
                    {chromaFiles.map((cf, i) => (
                      <button key={i} onClick={() => { handleApply(cf.path); setShowChromas(false); }}
                        className="px-2 py-1.5 text-xs rounded hover:scale-105 transition-all truncate"
                        style={{ background: '#1E2328', color: '#A09B8C', border: '1px solid #32281E' }}
                        title={cf.name}>
                        {cf.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Apply / Remove buttons */}
            <div className="flex gap-3">
              {!isApplied ? (
                <button onClick={() => handleApply()} disabled={applying || !currentSkinFile}
                  className="px-8 py-3 font-bold text-sm tracking-wider rounded transition-all disabled:opacity-50"
                  style={{ background: 'linear-gradient(180deg, #C89B3C 0%, #785A28 100%)', color: '#010A13' }}>
                  {applying ? 'APPLYING...' : 'LOCK IN'}
                </button>
              ) : (
                <button onClick={handleRemove}
                  className="px-8 py-3 font-bold text-sm tracking-wider rounded transition-all"
                  style={{ background: '#3C2A2A', color: '#E84057', border: '1px solid #E84057' }}>
                  REMOVE
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bottom: Skin strip */}
        <div className="px-6 pb-4" style={{ borderTop: '1px solid #1E2328' }}>
          <div className="flex items-center gap-2 py-3">
            <button onClick={() => scrollStrip(-1)} className="text-[#C89B3C] hover:text-[#F0E6D2] text-xl flex-shrink-0">‹</button>
            <div ref={stripRef} className="flex-1 flex gap-2 overflow-x-auto custom-scrollbar" style={{ scrollbarWidth: 'none' }}>
              {skinFiles.map((sf, i) => {
                const skin = skins.find(s => {
                  const a = sf.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                  const b = s.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                  return b.includes(a) || a.includes(b);
                });
                const num = skin?.num || 0;
                return (
                  <button key={i} onClick={() => { setSelectedSkinIdx(i); setShowChromas(false); }}
                    className="flex-shrink-0 w-24 rounded overflow-hidden transition-all"
                    style={{
                      border: i === selectedSkinIdx ? '2px solid #C89B3C' : '2px solid transparent',
                      opacity: i === selectedSkinIdx ? 1 : 0.6,
                    }}>
                    <img src={loadingUrl(selectedChamp.id, num)} className="w-full h-32 object-cover object-top"
                      onError={(e) => { (e.target as HTMLImageElement).src = loadingUrl(selectedChamp.id, 0); }}
                      loading="lazy" />
                    <div className="text-[9px] truncate px-1 py-0.5 text-center"
                      style={{ background: '#0A0E13', color: '#A09B8C' }}>
                      {sf.name}
                    </div>
                  </button>
                );
              })}
            </div>
            <button onClick={() => scrollStrip(1)} className="text-[#C89B3C] hover:text-[#F0E6D2] text-xl flex-shrink-0">›</button>
          </div>
        </div>
      </div>
    </div>
  );
}
