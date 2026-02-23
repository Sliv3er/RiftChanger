import { useState, useEffect, useMemo } from 'react';
import type { ChampionData, SkinData, ScanResult, SkinEntry } from '../types/api';

interface Props {
  champions: ChampionData[];
  scanResult: ScanResult | null;
  notify: (msg: string, ok?: boolean) => void;
}

export default function Collection({ champions, scanResult, notify }: Props) {
  const [search, setSearch] = useState('');
  const [selChamp, setSelChamp] = useState<ChampionData | null>(null);
  const [skins, setSkins] = useState<SkinData[]>([]);
  const [selSkin, setSelSkin] = useState<SkinData | null>(null);
  const [applying, setApplying] = useState(false);
  const [view, setView] = useState<'champs' | 'skins'>('champs');

  const filtered = useMemo(() => {
    if (!search) return champions;
    const q = search.toLowerCase();
    return champions.filter(c => c.name.toLowerCase().includes(q));
  }, [champions, search]);

  // Load skins on champ select
  useEffect(() => {
    if (!selChamp || !window.api) return;
    window.api.getChampionSkins(selChamp.id).then(s => {
      setSkins(s);
      setSelSkin(s.find(x => x.num !== 0) || s[0] || null);
      setView('skins');
    });
  }, [selChamp]);

  const findZip = (champ: ChampionData, skin: SkinData): SkinEntry | null => {
    if (!scanResult) return null;
    const nc = champ.id.replace(/[^a-zA-Z]/g, '').toLowerCase();
    return scanResult.skins.find(s => {
      const sc = s.championName.replace(/[^a-zA-Z]/g, '').toLowerCase();
      if (sc !== nc) return false;
      const a = s.skinName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const b = skin.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      return (a === b || a.includes(b) || b.includes(a)) && s.valid;
    }) || null;
  };

  const findChromas = (champ: ChampionData, skin: SkinData): SkinEntry[] => {
    if (!scanResult || !skin.chromas) return [];
    const nc = champ.id.replace(/[^a-zA-Z]/g, '').toLowerCase();
    const sn = skin.name.replace(/[^a-zA-Z]/g, '').toLowerCase();
    return scanResult.skins.filter(s => {
      if (s.type !== 'chroma' || !s.valid) return false;
      const sc = s.championName.replace(/[^a-zA-Z]/g, '').toLowerCase();
      if (sc !== nc) return false;
      const cn = s.skinName.replace(/\s*\d+$/, '').replace(/[^a-zA-Z]/g, '').toLowerCase();
      return cn.includes(sn) || sn.includes(cn);
    });
  };

  const handleApply = async (entry: SkinEntry) => {
    if (!window.api || !selChamp) return;
    setApplying(true);

    // Setup injector if needed
    const ready = await window.api.injectorReady();
    if (!ready) {
      notify('Setting up injection tools...', true);
      const setup = await window.api.injectorSetup();
      if (!setup.success) { notify(setup.message, false); setApplying(false); return; }
    }

    // Import mod
    const modName = `${selChamp.id} - ${entry.skinName}`;
    const imp = await window.api.importMod(entry.zipPath, modName);
    if (!imp.success) { notify(imp.message, false); setApplying(false); return; }

    // Build overlay and inject
    const result = await window.api.applyMods();
    notify(result.message, result.success);
    setApplying(false);
  };

  // ════════════════════════════════════════
  // CHAMPION SELECT VIEW
  // ════════════════════════════════════════
  if (view === 'champs') {
    return (
      <div className="h-full flex flex-col bg-[#010A13] animate-fade">
        {/* Search bar - top center like champ select */}
        <div className="flex justify-center py-4 flex-shrink-0">
          <div className="relative">
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search"
              className="w-64 px-4 py-2 bg-[#1E2328] border border-[#3C3C41] text-[#F0E6D2] text-xs text-center outline-none focus:border-[#C8AA6E]/50 placeholder-[#5B5A56]"
            />
          </div>
        </div>

        {/* Champion grid - like champ select */}
        <div className="flex-1 overflow-y-auto px-8 pb-6">
          <div className="grid gap-1" style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(62px, 1fr))',
          }}>
            {filtered.map(c => (
              <div
                key={c.id}
                onClick={() => setSelChamp(c)}
                className={`champ-cell ${selChamp?.id === c.id ? 'selected' : ''}`}
                title={c.name}
              >
                <div className="relative aspect-square bg-[#1E2328]">
                  <img src={c.iconUrl} alt={c.name}
                       className="w-full h-full object-cover" loading="lazy" />
                  {/* Gold frame overlay like League champ select */}
                  <div className="absolute inset-0 border border-[#463414]/60 pointer-events-none" />
                </div>
                <p className="text-[8px] text-center text-[#A09B8C] truncate py-0.5 bg-[#0A1428]/80 leading-none">{c.name}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════
  // SKIN SELECT VIEW
  // ════════════════════════════════════════
  const localEntry = selChamp && selSkin ? findZip(selChamp, selSkin) : null;
  const chromas = selChamp && selSkin ? findChromas(selChamp, selSkin) : [];

  return (
    <div className="h-full flex flex-col bg-[#010A13] animate-fade">
      {/* Splash area - takes most of the screen */}
      <div className="flex-1 relative overflow-hidden">
        {selSkin && (
          <img src={selSkin.splashUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        {/* Gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#010A13] via-transparent to-[#010A13]/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#010A13]/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-l from-[#010A13]/40 to-transparent" />

        {/* Back button */}
        <button onClick={() => { setView('champs'); setSelSkin(null); }}
          className="absolute top-4 left-4 z-10 text-[#A09B8C] hover:text-[#C8AA6E] text-xs transition-colors">
          ← Back to Champions
        </button>

        {/* Skin name + LOCK IN */}
        <div className="absolute bottom-0 inset-x-0 flex flex-col items-center pb-4 z-10">
          <p className="text-[#A09B8C] text-[10px] uppercase tracking-[0.3em] mb-1">
            {selChamp?.name}
          </p>
          <h2 className="font-beaufort text-2xl text-[#F0E6D2] tracking-wide mb-4">
            {selSkin?.name}
          </h2>

          {/* Chromas */}
          {chromas.length > 0 && (
            <div className="flex gap-1.5 mb-4">
              {chromas.map((ch, i) => (
                <button
                  key={i}
                  onClick={() => handleApply(ch)}
                  className="chroma-dot bg-gradient-to-br from-[#C89B3C] to-[#785A28]"
                  title={ch.skinName}
                />
              ))}
            </div>
          )}

          {/* LOCK IN / Apply button */}
          {localEntry ? (
            <button
              onClick={() => handleApply(localEntry)}
              disabled={applying}
              className="btn-lockin"
            >
              {applying ? 'APPLYING...' : 'LOCK IN'}
            </button>
          ) : (
            <div className="text-[#5B5A56] text-xs font-beaufort tracking-widest uppercase">
              Not in library
            </div>
          )}
        </div>
      </div>

      {/* Skin strip - bottom, horizontal scroll like skin selector */}
      <div className="flex-shrink-0 bg-[#010A13] border-t border-[#1E2328]/60">
        <div className="flex overflow-x-auto py-2 px-4 gap-1.5" style={{ scrollbarWidth: 'none' }}>
          {skins.filter(s => s.num !== 0).map(skin => {
            const isActive = selSkin?.id === skin.id;
            const hasLocal = selChamp ? !!findZip(selChamp, skin) : false;
            return (
              <div
                key={skin.id}
                onClick={() => setSelSkin(skin)}
                className={`skin-thumb ${isActive ? 'active' : ''}`}
                style={{ width: 70 }}
              >
                <div className="aspect-[2/3] bg-[#1E2328] overflow-hidden relative">
                  <img src={skin.loadingUrl} alt={skin.name}
                       className="w-full h-full object-cover"
                       loading="lazy"
                       onError={e => { (e.target as HTMLImageElement).src = skin.splashUrl; }} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  {/* Availability dot */}
                  <div className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${
                    hasLocal ? 'bg-[#0ACE83]' : 'bg-[#3C3C41]'
                  }`} />
                </div>
                <p className="text-[7px] text-center text-[#A09B8C] truncate py-0.5 leading-tight">
                  {skin.name.replace(selChamp?.name || '', '').trim() || skin.name}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
