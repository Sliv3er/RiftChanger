import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { ChampionData, SkinFile } from '../types/api';

const DDRAGON = 'https://ddragon.leagueoflegends.com';

interface SkinData { id: number; num: number; name: string; chromas: boolean; }

// Role mapping — same as Rift
const ROLE_MAP: Record<string, string> = {
  'Aatrox':'TOP','Camille':'TOP','Darius':'TOP','Dr. Mundo':'TOP','Fiora':'TOP','Gangplank':'TOP',
  'Garen':'TOP','Gnar':'TOP','Gwen':'TOP','Illaoi':'TOP','Irelia':'TOP','Jax':'TOP','Jayce':'TOP',
  "K'Sante":'TOP','Kayle':'TOP','Kennen':'TOP','Kled':'TOP','Malphite':'TOP','Mordekaiser':'TOP',
  'Nasus':'TOP','Olaf':'TOP','Ornn':'TOP','Pantheon':'TOP','Poppy':'TOP','Quinn':'TOP',
  'Renekton':'TOP','Riven':'TOP','Rumble':'TOP','Sett':'TOP','Shen':'TOP','Singed':'TOP',
  'Sion':'TOP','Tahm Kench':'TOP','Teemo':'TOP','Trundle':'TOP','Tryndamere':'TOP','Urgot':'TOP',
  'Vladimir':'TOP','Volibear':'TOP','Warwick':'TOP','Wukong':'TOP','Yorick':'TOP',
  'Amumu':'JUNGLE','Diana':'JUNGLE','Ekko':'JUNGLE','Elise':'JUNGLE','Evelynn':'JUNGLE',
  'Fiddlesticks':'JUNGLE','Graves':'JUNGLE','Hecarim':'JUNGLE','Ivern':'JUNGLE',
  'Jarvan IV':'JUNGLE','Karthus':'JUNGLE','Kayn':'JUNGLE',"Kha'Zix":'JUNGLE','Kindred':'JUNGLE',
  'Lee Sin':'JUNGLE','Lillia':'JUNGLE','Master Yi':'JUNGLE','Nidalee':'JUNGLE','Nocturne':'JUNGLE',
  'Nunu & Willump':'JUNGLE','Rammus':'JUNGLE',"Rek'Sai":'JUNGLE','Rengar':'JUNGLE',
  'Sejuani':'JUNGLE','Shaco':'JUNGLE','Shyvana':'JUNGLE','Skarner':'JUNGLE','Udyr':'JUNGLE',
  'Vi':'JUNGLE','Viego':'JUNGLE','Xin Zhao':'JUNGLE','Zac':'JUNGLE',
  'Ahri':'MID','Akali':'MID','Akshan':'MID','Anivia':'MID','Annie':'MID','Aurelion Sol':'MID',
  'Azir':'MID','Cassiopeia':'MID','Corki':'MID','Fizz':'MID','Galio':'MID','Heimerdinger':'MID',
  'Kassadin':'MID','Katarina':'MID','LeBlanc':'MID','Lissandra':'MID','Lux':'MID','Malzahar':'MID',
  'Neeko':'MID','Orianna':'MID','Qiyana':'MID','Ryze':'MID','Sylas':'MID','Syndra':'MID',
  'Talon':'MID','Twisted Fate':'MID','Veigar':'MID',"Vel'Koz":'MID','Viktor':'MID',
  'Xerath':'MID','Yasuo':'MID','Yone':'MID','Zed':'MID','Ziggs':'MID','Zoe':'MID',
  'Aphelios':'ADC','Ashe':'ADC','Caitlyn':'ADC','Draven':'ADC','Ezreal':'ADC','Jhin':'ADC',
  'Jinx':'ADC',"Kai'Sa":'ADC','Kalista':'ADC',"Kog'Maw":'ADC','Lucian':'ADC',
  'Miss Fortune':'ADC','Nilah':'ADC','Samira':'ADC','Sivir':'ADC','Tristana':'ADC',
  'Twitch':'ADC','Varus':'ADC','Vayne':'ADC','Xayah':'ADC','Zeri':'ADC',
  'Alistar':'SUPPORT','Bard':'SUPPORT','Blitzcrank':'SUPPORT','Braum':'SUPPORT','Janna':'SUPPORT',
  'Karma':'SUPPORT','Leona':'SUPPORT','Lulu':'SUPPORT','Morgana':'SUPPORT','Nami':'SUPPORT',
  'Nautilus':'SUPPORT','Pyke':'SUPPORT','Rakan':'SUPPORT','Rell':'SUPPORT',
  'Senna':'SUPPORT','Seraphine':'SUPPORT','Sona':'SUPPORT','Soraka':'SUPPORT',
  'Thresh':'SUPPORT','Yuumi':'SUPPORT','Zilean':'SUPPORT','Zyra':'SUPPORT',
};

const getRole = (name: string, tags: string[]) => {
  if (ROLE_MAP[name]) return ROLE_MAP[name];
  if (tags?.includes('Marksman')) return 'ADC';
  if (tags?.includes('Support')) return 'SUPPORT';
  if (tags?.includes('Assassin')) return 'MID';
  if (tags?.includes('Mage')) return 'MID';
  if (tags?.includes('Tank')) return 'TOP';
  if (tags?.includes('Fighter')) return 'TOP';
  return 'MID';
};

const ROLES = ['ALL', 'TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'] as const;

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
  const [selectedChamp, setSelectedChamp] = useState<any>(null);
  const [skins, setSkins] = useState<SkinData[]>([]);
  const [skinFiles, setSkinFiles] = useState<SkinFile[]>([]);
  const [selectedSkin, setSelectedSkin] = useState<SkinData | null>(null);
  const [chromaFiles, setChromaFiles] = useState<SkinFile[]>([]);
  const [expandedChroma, setExpandedChroma] = useState<number | null>(null);
  const [applying, setApplying] = useState(false);
  const [skinPageIndex, setSkinPageIndex] = useState(0);
  const chromaRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    let list = [...champions];
    if (roleFilter !== 'ALL') list = list.filter(c => getRole(c.name, c.tags) === roleFilter);
    if (search) { const q = search.toLowerCase(); list = list.filter(c => c.name.toLowerCase().includes(q)); }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [champions, roleFilter, search]);

  // Load champion detail when selected
  const selectChampion = useCallback(async (champ: ChampionData) => {
    try {
      const detail = await fetch(`${DDRAGON}/cdn/${patch}/data/en_US/champion/${champ.id}.json`)
        .then(r => r.json()).then(d => d.data[champ.id]);
      setSelectedChamp(detail);
      setSelectedSkin(detail.skins[0]);
      setSkinPageIndex(0);
      setExpandedChroma(null);
      // Load skin files
      const files = await window.api.findSkinFiles(skinsPath, champ.name);
      setSkinFiles(files?.skinFiles || []);
    } catch { setSelectedChamp(null); }
  }, [patch, skinsPath]);

  // Load chromas when skin changes
  useEffect(() => {
    if (!selectedChamp || !selectedSkin) return;
    const skinName = selectedSkin.name === 'default' ? 'Classic' : selectedSkin.name;
    window.api.findChromaFiles(skinsPath, selectedChamp.name, skinName)
      .then(r => setChromaFiles(r?.chromaFiles || []))
      .catch(() => setChromaFiles([]));
  }, [selectedChamp, selectedSkin, skinsPath]);

  // Close chroma on click outside / escape
  useEffect(() => {
    if (expandedChroma === null) return;
    const handleClick = (e: MouseEvent) => {
      if (chromaRef.current && !chromaRef.current.contains(e.target as Node)) setExpandedChroma(null);
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpandedChroma(null); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleKey); };
  }, [expandedChroma]);

  const normalizeName = (s: string) => s?.toLowerCase().replace(/['"\\/]/g, '').replace(/\s+/g, ' ').trim() || '';

  const findSkinFileForSkin = (skinName: string): SkinFile | null => {
    const norm = normalizeName(skinName);
    return skinFiles.find(f => normalizeName(f.name) === norm)
      || skinFiles.find(f => normalizeName(f.name).includes(norm) || norm.includes(normalizeName(f.name)))
      || null;
  };

  const handleApply = useCallback(async (zipPath: string, skinName: string) => {
    if (!selectedChamp) return;
    setApplying(true);
    try { await onApply(selectedChamp.name, skinName, zipPath); }
    finally { setApplying(false); }
  }, [selectedChamp, onApply]);

  // Champion Grid View
  if (!selectedChamp) {
    return (
      <div className="w-full text-white flex flex-col relative"
        style={{ height: 'calc(100vh - 32px - 36px)', background: 'linear-gradient(135deg, #0a0e13 0%, #1e2328 50%, #0a0e13 100%)' }}>
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url(https://cdna.artstation.com/p/assets/images/images/018/338/344/large/alex-flores-godkingdarius-alexflores.jpg)', opacity: 0.25, filter: 'blur(0.5px)' }} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/35 to-black/60" />
        <div className="absolute top-0 left-0 right-0 h-1"
          style={{ background: 'linear-gradient(90deg, transparent 0%, #c89b3c 20%, #f0e6d2 50%, #c89b3c 80%, transparent 100%)', boxShadow: '0 0 10px rgba(200, 155, 60, 0.4)' }} />

        <div className="relative z-10 flex-shrink-0 py-4">
          <div className="text-center mb-4">
            <h1 className="text-3xl font-bold tracking-wide"
              style={{ background: 'linear-gradient(135deg, #f0e6d2 0%, #c89b3c 50%, #f0e6d2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '1px' }}>
              PICK YOUR CHAMPION
            </h1>
          </div>

          <div className="px-6">
            <div className="flex items-center justify-between max-w-5xl mx-auto">
              <div className="flex items-center space-x-2">
                {ROLES.map(r => (
                  <button key={r} onClick={() => setRoleFilter(r)}
                    className="relative w-10 h-10 flex items-center justify-center transition-transform duration-150 rounded-lg"
                    style={{
                      background: roleFilter === r ? '#c89b3c' : 'rgba(30, 35, 40, 0.9)',
                      border: roleFilter === r ? '1px solid #f0e6d2' : '1px solid rgba(70, 55, 20, 0.6)',
                      boxShadow: roleFilter === r ? '0 2px 8px rgba(200, 155, 60, 0.4)' : '0 1px 4px rgba(0, 0, 0, 0.2)',
                      transform: roleFilter === r ? 'scale(1.05)' : undefined,
                    }}>
                    <span className="text-xs font-bold" style={{ color: roleFilter === r ? '#0a0e13' : '#f0e6d2' }}>
                      {r === 'JUNGLE' ? 'JNG' : r === 'SUPPORT' ? 'SUP' : r}
                    </span>
                  </button>
                ))}
              </div>

              <div className="relative">
                <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
                  className="px-3 py-2 pr-8 text-xs rounded-lg focus:outline-none transition-shadow w-40"
                  style={{ background: 'rgba(15, 20, 25, 0.95)', border: '1px solid rgba(200, 155, 60, 0.3)', color: '#f0e6d2' }} />
              </div>
            </div>
          </div>
        </div>

        <div className="electron-scroll" style={{ position: 'absolute', top: '180px', left: '20px', right: '20px', bottom: '20px', overflowY: 'scroll', padding: '20px', zIndex: 20 }}>
          <div className="grid grid-cols-8 gap-3 max-w-5xl mx-auto pb-8">
            {filtered.map(c => (
              <div key={c.id} className="relative flex flex-col items-center group">
                <div onClick={() => selectChampion(c)}
                  className="relative w-16 h-16 cursor-pointer rounded-lg overflow-hidden transform transition-all duration-300 hover:scale-110 hover:-translate-y-1 active:scale-95"
                  style={{ border: '1px solid rgba(200, 155, 60, 0.4)', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)', background: 'rgba(30, 35, 40, 0.95)' }}>
                  <img src={`${DDRAGON}/cdn/${patch}/img/champion/${c.id}.png`} alt={c.name}
                    className="w-full h-full object-cover" loading="lazy"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
                <p className="text-xs text-center mt-2 font-medium w-full truncate text-gray-200 transition-colors group-hover:text-gold-300">{c.name}</p>
                {appliedMods[c.name] && (
                  <div className="absolute top-0 right-0 w-3 h-3 bg-emerald-400 rounded-full shadow-lg" style={{ boxShadow: '0 0 8px rgba(10,207,131,0.6)' }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Champion Detail View
  const appliedSkin = appliedMods[selectedChamp.name];
  const skinName = selectedSkin?.name === 'default' ? 'Classic' : (selectedSkin?.name || 'Classic');
  const skinNum = selectedSkin?.num || 0;
  const skinFile = findSkinFileForSkin(skinName);
  const isApplied = appliedSkin?.skinName === skinName;
  const hasAnyApplied = !!appliedSkin;
  const skinsPerPage = 5;
  const visibleSkins = selectedChamp.skins.slice(skinPageIndex * skinsPerPage, (skinPageIndex + 1) * skinsPerPage);

  return (
    <div className="absolute inset-0 bg-black text-white overflow-hidden">
      {/* Splash background */}
      <div className="absolute inset-0">
        <img src={`${DDRAGON}/cdn/img/champion/splash/${selectedChamp.id}_${skinNum}.jpg`} alt="" className="w-full h-full object-cover"
          onError={e => { (e.target as HTMLImageElement).src = `${DDRAGON}/cdn/img/champion/splash/${selectedChamp.id}_0.jpg`; }} />
        <div className="absolute inset-0 bg-black/60" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80" />
      </div>

      {/* Back button */}
      <div className="absolute top-6 left-6 z-20">
        <button onClick={() => setSelectedChamp(null)}
          className="flex items-center space-x-2 px-4 py-2 bg-black/50 hover:bg-black/70 text-white rounded border border-yellow-600/50 hover:border-yellow-500 transition-all">
          <span className="text-xl">‹</span><span>Back</span>
        </button>
      </div>

      {/* Center display */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center pb-20">
        <div className="relative w-96 h-96 mb-4">
          <div className="absolute inset-0 rounded-full" style={{ background: 'conic-gradient(from 0deg, #fbbf24, #f59e0b, #fbbf24, #f59e0b, #fbbf24)', padding: '4px' }}>
            <div className="w-full h-full rounded-full overflow-hidden bg-black">
              <img src={`${DDRAGON}/cdn/img/champion/splash/${selectedChamp.id}_${skinNum}.jpg`} alt={skinName} className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).src = `${DDRAGON}/cdn/img/champion/splash/${selectedChamp.id}_0.jpg`; }} />
            </div>
          </div>
          <div className="absolute inset-0">
            {[...Array(72)].map((_, i) => (
              <div key={i} className={`absolute ${i % 6 === 0 ? 'w-1 h-6 bg-gold-400' : 'w-0.5 h-3 bg-gold-400/60'}`}
                style={{ top: '-12px', left: '50%', transformOrigin: '50% 204px', transform: `translateX(-50%) rotate(${i * 5}deg)` }} />
            ))}
          </div>
        </div>
        <h1 className="text-5xl font-bold text-white mb-4 drop-shadow-lg text-center" style={{ fontFamily: 'Beaufort', letterSpacing: '0.05em' }}>{skinName}</h1>
        
        {/* Action Button - LoL Champion Select Lock In Style */}
        <div className="mb-8 h-14 flex items-center justify-center">
          {!hasAnyApplied && skinName !== 'Classic' && skinFile && (
            <button onClick={() => handleApply(skinFile.path, skinName)} disabled={applying}
              className="group relative min-w-[280px] py-3 px-12 font-bold text-lg tracking-[0.15em] uppercase transition-all duration-200 hover:brightness-125 active:scale-[0.98] disabled:opacity-50 disabled:cursor-wait"
              style={{
                background: 'linear-gradient(180deg, #C89B3C 0%, #A07628 40%, #785A28 100%)',
                border: '2px solid #C8AA6E',
                color: '#FFFFFF',
                boxShadow: '0 0 15px rgba(200, 155, 60, 0.4), inset 0 1px 0 rgba(240, 230, 210, 0.3), inset 0 -1px 0 rgba(0, 0, 0, 0.3)',
                textShadow: '0 1px 3px rgba(0, 0, 0, 0.5)',
              }}>
              {applying ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>PATCHING...</span>
                </div>
              ) : (
                <span>LOCK IN</span>
              )}
            </button>
          )}
          
          {isApplied && (
            <button onClick={() => onRemove(selectedChamp.name)}
              className="group relative min-w-[280px] py-3 px-12 font-bold text-lg tracking-[0.15em] uppercase transition-all duration-200 hover:brightness-125 active:scale-[0.98]"
              style={{
                background: 'linear-gradient(180deg, #8B3A3A 0%, #6B2020 40%, #4A1515 100%)',
                border: '2px solid #C24B4B',
                color: '#FFFFFF',
                boxShadow: '0 0 15px rgba(194, 75, 75, 0.4), inset 0 1px 0 rgba(255, 150, 150, 0.2), inset 0 -1px 0 rgba(0, 0, 0, 0.3)',
                textShadow: '0 1px 3px rgba(0, 0, 0, 0.5)',
              }}>
              <span>REMOVE</span>
            </button>
          )}
        </div>

        <div className="flex justify-center space-x-2">
          {selectedChamp.skins.map((skin: any) => (
            <div key={skin.id} onClick={() => { setSelectedSkin(skin); setExpandedChroma(null); }}
              className={`w-2.5 h-2.5 rotate-45 transition-all cursor-pointer border border-transparent hover:border-gold-400 ${selectedSkin?.id === skin.id ? 'bg-gold-400 scale-125 border-gold-200 shadow-[0_0_8px_rgba(200,170,110,0.6)]' : 'bg-[#5B5A56]'}`} />
          ))}
        </div>
      </div>

      {/* Bottom strip */}
      <div className="absolute bottom-0 left-0 right-0 z-30" style={{ height: '140px' }}>
        <div className="flex items-center justify-center py-4 px-8 space-x-6 h-full">
          <button onClick={() => setSkinPageIndex(Math.max(0, skinPageIndex - 1))}
            className={`w-10 h-10 flex items-center justify-center rounded-full border-2 transition-all ${skinPageIndex > 0 ? 'border-gold-400 text-gold-400 hover:bg-gold-400/20' : 'border-gray-600 text-gray-600 cursor-not-allowed'}`}
            disabled={skinPageIndex === 0}>‹</button>
          <div className="flex space-x-4">
            {visibleSkins.map((skin: any) => {
              const isSelected = selectedSkin?.id === skin.id;
              const sName = skin.name === 'default' ? 'Classic' : skin.name;
              const isThisApplied = appliedSkin?.skinName === sName;
              return (
                <div key={skin.id} className="relative">
                  <div onClick={() => { setSelectedSkin(skin); setExpandedChroma(null); }}
                    className={`relative w-24 h-28 cursor-pointer transition-all duration-300 ${hasAnyApplied && !isThisApplied ? 'opacity-60' : ''} ${isSelected ? 'transform scale-110' : 'hover:scale-105'}`}>
                    {isThisApplied && <div className="absolute top-1 right-1 w-3 h-3 bg-emerald-400 rounded-full shadow-lg z-20" />}
                    <div className={`absolute inset-0 rounded ${isThisApplied ? 'bg-emerald-500 p-1' : isSelected ? 'bg-yellow-400 p-1' : 'bg-gray-700 p-1'}`}>
                      <div className="w-full h-full rounded overflow-hidden">
                        <img src={`${DDRAGON}/cdn/img/champion/splash/${selectedChamp.id}_${skin.num}.jpg`} alt={sName} className="w-full h-full object-cover"
                          onError={e => { (e.target as HTMLImageElement).src = `${DDRAGON}/cdn/img/champion/splash/${selectedChamp.id}_0.jpg`; }} />
                      </div>
                    </div>
                    {isSelected && chromaFiles.length > 0 && sName !== 'Classic' && !hasAnyApplied && (
                      <button onClick={e => { e.stopPropagation(); setExpandedChroma(expandedChroma === skin.id ? null : skin.id); }}
                        className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 w-8 h-8 rounded-full bg-gold-500 text-black font-bold">🎨</button>
                    )}
                  </div>
                  {expandedChroma === skin.id && (
                    <div ref={chromaRef} className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 bg-black/90 border border-gold-500 p-3 rounded-lg min-w-[200px]">
                      <div className="flex flex-wrap gap-2 justify-center">
                        {chromaFiles.map((cf, i) => (
                          <button key={i} onClick={() => { handleApply(cf.path, `${cf.name} (${sName})`); setExpandedChroma(null); }}
                            className="w-12 h-12 rounded border border-gray-600 hover:border-gold-400 text-[8px] p-1 bg-gray-800 break-all">{cf.name}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button onClick={() => setSkinPageIndex(Math.min(Math.ceil(selectedChamp.skins.length / skinsPerPage) - 1, skinPageIndex + 1))}
            className={`w-10 h-10 flex items-center justify-center rounded-full border-2 transition-all ${(skinPageIndex + 1) * skinsPerPage < selectedChamp.skins.length ? 'border-gold-400 text-gold-400 hover:bg-gold-400/20' : 'border-gray-600 text-gray-600 cursor-not-allowed'}`}
            disabled={(skinPageIndex + 1) * skinsPerPage >= selectedChamp.skins.length}>›</button>
        </div>
      </div>
    </div>
  );
}
