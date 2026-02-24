import { useState, useEffect, useMemo, useRef } from 'react';
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
  const skinStripRef = useRef<HTMLDivElement>(null);

  // Filter champions by search
  const filtered = useMemo(() => {
    if (!search) return champions;
    const q = search.toLowerCase();
    return champions.filter(c => c.name.toLowerCase().includes(q));
  }, [champions, search]);

  // Skin count badge per champion
  const skinCounts = useMemo(() => {
    if (!scanResult) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const s of scanResult.skins) {
      if (!s.valid) continue;
      const key = s.championName.replace(/[^a-zA-Z]/g, '').toLowerCase();
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [scanResult]);

  // Load skins when champion selected
  useEffect(() => {
    if (!selChamp || !window.api) return;
    window.api.getChampionSkins(selChamp.id).then(s => {
      setSkins(s);
      // Select first non-default skin
      setSelSkin(s.find(x => x.num !== 0) || s[0] || null);
    });
  }, [selChamp]);

  // Scroll selected skin into view
  useEffect(() => {
    if (!selSkin || !skinStripRef.current) return;
    const el = skinStripRef.current.querySelector(`[data-skin-id="${selSkin.id}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [selSkin]);

  // Find matching zip for a skin
  const findZip = (champ: ChampionData, skin: SkinData): SkinEntry | null => {
    if (!scanResult) return null;
    const nc = champ.id.replace(/[^a-zA-Z]/g, '').toLowerCase();
    return scanResult.skins.find(s => {
      if (s.type !== 'skin' || !s.valid) return false;
      const sc = s.championName.replace(/[^a-zA-Z]/g, '').toLowerCase();
      if (sc !== nc) return false;
      const a = s.skinName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const b = skin.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      return a === b || a.includes(b) || b.includes(a);
    }) || null;
  };

  // Find chromas
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
    try {
      const ready = await window.api.injectorReady();
      if (!ready) {
        notify('Setting up injection...', true);
        const setup = await window.api.injectorSetup();
        if (!setup.success) { notify(setup.message, false); setApplying(false); return; }
      }
      const modName = `${selChamp.id} - ${entry.skinName}`;
      const imp = await window.api.importMod(entry.zipPath, modName);
      if (!imp.success) { notify(imp.message, false); setApplying(false); return; }
      const result = await window.api.applyMods([modName]);
      notify(result.message, result.success);
    } catch (e: any) {
      notify(e.message || 'Apply failed', false);
    }
    setApplying(false);
  };

  /* ══════════════════════════════════════════════
     CHAMPION GRID — like League champ select
     ══════════════════════════════════════════════ */
  if (!selChamp) {
    return (
      <div className="h-full flex flex-col anim-fade" style={{ background: '#010A13' }}>
        {/* Top area: search */}
        <div className="flex items-center justify-center pt-5 pb-3 flex-shrink-0">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#5B5A56]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search"
              className="lol-search"
              autoFocus
            />
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          <div className="grid gap-[2px]" style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(58px, 1fr))',
          }}>
            {filtered.map(c => {
              const nk = c.id.replace(/[^a-zA-Z]/g, '').toLowerCase();
              const count = skinCounts.get(nk) || 0;
              return (
                <div key={c.id} onClick={() => setSelChamp(c)}
                  className={`champ-tile ${count === 0 ? 'dimmed' : ''}`}>
                  <div className="aspect-square">
                    <img src={c.iconUrl} alt={c.name} loading="lazy"
                      draggable={false} />
                  </div>
                  <div className="champ-name">{c.name}</div>
                  {count > 0 && (
                    <div className="absolute top-0.5 left-0.5 px-1 text-[7px] font-medium rounded-sm"
                      style={{ background: 'rgba(200,155,60,0.85)', color: '#010A13', lineHeight: '12px' }}>
                      {count}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-2"
          style={{ borderTop: '1px solid #1E2328', background: 'linear-gradient(180deg, #0A1428 0%, #010A13 100%)' }}>
          <span style={{ fontSize: 10, color: '#5B5A56' }}>
            {champions.length} champions
          </span>
          <span style={{ fontSize: 10, color: '#5B5A56' }}>
            {scanResult ? `${scanResult.totalSkins} skins · ${scanResult.totalChromas} chromas` : '—'}
          </span>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════
     SKIN SELECT — full splash with bottom carousel
     ══════════════════════════════════════════════ */
  const localEntry = selSkin ? findZip(selChamp, selSkin) : null;
  const chromas = selSkin ? findChromas(selChamp, selSkin) : [];

  return (
    <div className="h-full flex flex-col anim-fade" style={{ background: '#010A13' }}>
      {/* Main splash area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Splash image */}
        {selSkin && (
          <img key={selSkin.id} src={selSkin.splashUrl} alt=""
            className="absolute inset-0 w-full h-full object-cover anim-fade"
            draggable={false} />
        )}

        {/* Gradient overlays */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(to top, #010A13 0%, transparent 40%, transparent 70%, rgba(1,10,19,0.4) 100%)'
        }} />
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(to right, rgba(1,10,19,0.7) 0%, transparent 30%)'
        }} />
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(to left, rgba(1,10,19,0.5) 0%, transparent 25%)'
        }} />

        {/* Back button — top left */}
        <button onClick={() => { setSelChamp(null); setSelSkin(null); setSkins([]); setSearch(''); }}
          className="absolute top-3 left-4 z-10 flex items-center gap-1.5 group"
          style={{ color: '#A09B8C', fontSize: 11 }}>
          <svg className="w-3.5 h-3.5 group-hover:text-[#C8AA6E] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M15 19l-7-7 7-7" />
          </svg>
          <span className="group-hover:text-[#C8AA6E] transition-colors">Champions</span>
        </button>

        {/* Skin info + lock in — center bottom */}
        <div className="absolute bottom-0 inset-x-0 flex flex-col items-center pb-3 z-10">
          {/* Champion name - small */}
          <span style={{ fontSize: 10, letterSpacing: '0.3em', color: '#5B5A56', textTransform: 'uppercase' }}>
            {selChamp.name}
          </span>

          {/* Skin name - large */}
          <h2 style={{
            fontSize: 22, fontWeight: 600, color: '#F0E6D2',
            letterSpacing: '0.08em', margin: '2px 0 10px',
            textShadow: '0 2px 12px rgba(0,0,0,0.8)',
          }}>
            {selSkin?.name}
          </h2>

          {/* Chromas */}
          {chromas.length > 0 && (
            <div className="flex gap-1.5 mb-3">
              {chromas.map((ch, i) => (
                <button key={i} onClick={() => handleApply(ch)}
                  className="chroma-circle"
                  style={{ background: 'linear-gradient(135deg, #C89B3C, #785A28)' }}
                  title={ch.skinName} />
              ))}
            </div>
          )}

          {/* Lock In */}
          {localEntry ? (
            <button onClick={() => handleApply(localEntry)} disabled={applying}
              className="btn-lockin">
              {applying ? 'APPLYING...' : 'LOCK IN'}
            </button>
          ) : (
            <span style={{ fontSize: 11, color: '#3C3C41', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              Not available
            </span>
          )}
        </div>
      </div>

      {/* Skin strip — horizontal carousel at bottom */}
      <div className="flex-shrink-0" style={{
        borderTop: '1px solid #1E2328',
        background: 'linear-gradient(180deg, #0A0E13 0%, #010A13 100%)',
      }}>
        <div ref={skinStripRef}
          className="flex overflow-x-auto py-2 px-3 gap-1"
          style={{ scrollbarWidth: 'none' }}>
          {skins.filter(s => s.num !== 0).map(skin => {
            const isActive = selSkin?.id === skin.id;
            const hasLocal = !!findZip(selChamp, skin);
            return (
              <div key={skin.id} data-skin-id={skin.id}
                onClick={() => setSelSkin(skin)}
                className={`skin-card ${isActive ? 'active' : ''}`}
                style={{ width: 64 }}>
                <div className="relative" style={{ aspectRatio: '2/3' }}>
                  <img src={skin.loadingUrl} alt={skin.name} loading="lazy" draggable={false}
                    onError={e => { (e.target as HTMLImageElement).src = skin.splashUrl; }} />
                  <div className="avail-dot" style={{ background: hasLocal ? '#0ACE83' : '#3C3C41' }} />
                </div>
                <div className="skin-label">
                  {skin.name.replace(selChamp.name, '').replace(/^\s+/, '') || skin.name}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
