import { useState, useEffect, useMemo } from 'react';
import type { ChampionData, SkinData, ScanResult } from '../types/api';

interface Props {
  champions: ChampionData[];
  scanResult: ScanResult | null;
  onApply: (zipPath: string, skinName: string, champName: string) => void;
  notify: (msg: string, ok?: boolean) => void;
}

export default function Collection({ champions, scanResult, onApply, notify }: Props) {
  const [search, setSearch] = useState('');
  const [selectedChamp, setSelectedChamp] = useState<ChampionData | null>(null);
  const [skins, setSkins] = useState<SkinData[]>([]);
  const [activeSkin, setActiveSkin] = useState<SkinData | null>(null);

  const filtered = useMemo(() => {
    if (!search) return champions;
    const q = search.toLowerCase();
    return champions.filter(c => c.name.toLowerCase().includes(q));
  }, [champions, search]);

  // Auto-select first champion
  useEffect(() => {
    if (champions.length > 0 && !selectedChamp) {
      setSelectedChamp(champions[0]);
    }
  }, [champions]);

  // Load skins when champion changes
  useEffect(() => {
    if (!selectedChamp || !window.api) return;
    window.api.getChampionSkins(selectedChamp.id).then(s => {
      setSkins(s);
      setActiveSkin(s.length > 1 ? s[1] : s[0] || null); // Skip default, show first real skin
    });
  }, [selectedChamp]);

  // Find local skin zip for a given skin
  const findLocalZip = (champ: ChampionData, skin: SkinData): string | null => {
    if (!scanResult) return null;
    const entry = scanResult.skins.find(s => {
      const normChamp = s.championName.replace(/[^a-zA-Z]/g, '').toLowerCase();
      const normSkin = s.skinName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const targetChamp = champ.id.replace(/[^a-zA-Z]/g, '').toLowerCase();
      const targetSkin = skin.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      return normChamp === targetChamp && (normSkin === targetSkin || normSkin.includes(targetSkin) || targetSkin.includes(normSkin));
    });
    return entry?.valid ? entry.zipPath : null;
  };

  // Find chromas for a skin
  const findChromas = (champ: ChampionData, skin: SkinData) => {
    if (!scanResult || !skin.chromas) return [];
    const normChamp = champ.id.replace(/[^a-zA-Z]/g, '').toLowerCase();
    return scanResult.skins.filter(s => {
      if (s.type !== 'chroma') return false;
      const nc = s.championName.replace(/[^a-zA-Z]/g, '').toLowerCase();
      if (nc !== normChamp) return false;
      const skinBase = skin.name.replace(/[^a-zA-Z]/g, '').toLowerCase();
      const chromaBase = s.skinName.replace(/\s*\d+$/, '').replace(/[^a-zA-Z]/g, '').toLowerCase();
      return chromaBase.includes(skinBase) || skinBase.includes(chromaBase);
    });
  };

  const champSkinCount = (champ: ChampionData): number => {
    if (!scanResult) return 0;
    const nc = champ.id.replace(/[^a-zA-Z]/g, '').toLowerCase();
    return scanResult.skins.filter(s =>
      s.championName.replace(/[^a-zA-Z]/g, '').toLowerCase() === nc && s.valid
    ).length;
  };

  return (
    <div className="flex h-full">
      {/* ══════ LEFT: CHAMPION LIST ══════ */}
      <div className="w-56 flex-shrink-0 bg-league-hextech-black/60 border-r border-league-grey-dark/30 flex flex-col">
        {/* Search */}
        <div className="p-2.5 border-b border-league-grey-dark/30">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full px-3 py-1.5 bg-league-blue-darkest border border-league-grey-dark/50 text-league-gold-light text-xs outline-none focus:border-league-gold/40 placeholder-league-grey-lightest/40"
          />
        </div>

        {/* Champion list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.map(c => {
            const count = champSkinCount(c);
            const isSelected = selectedChamp?.id === c.id;
            return (
              <div
                key={c.id}
                onClick={() => setSelectedChamp(c)}
                className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-all border-l-2 ${
                  isSelected
                    ? 'bg-league-gold/10 border-league-gold text-league-gold'
                    : 'border-transparent text-league-grey-light hover:bg-league-gold/5 hover:text-league-gold-light'
                }`}
              >
                <img src={c.iconUrl} alt="" className="w-7 h-7 rounded-sm" loading="lazy" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{c.name}</p>
                </div>
                {count > 0 && (
                  <span className="text-[9px] bg-league-gold/20 text-league-gold px-1.5 py-px">{count}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ══════ RIGHT: SKINS PANEL ══════ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedChamp && activeSkin ? (
          <>
            {/* Splash preview */}
            <div className="relative flex-shrink-0" style={{ height: '45%' }}>
              <img
                src={activeSkin.splashUrl}
                alt={activeSkin.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-league-blue-darkest via-league-blue-darkest/30 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-league-blue-darkest/50 to-transparent" />

              {/* Skin info overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <p className="text-league-grey-light text-xs uppercase tracking-widest mb-1">{selectedChamp.name}</p>
                <h2 className="font-beaufort text-3xl text-league-gold-light tracking-wide">{activeSkin.name}</h2>

                <div className="flex gap-2 mt-3">
                  {(() => {
                    const zip = findLocalZip(selectedChamp, activeSkin);
                    return zip ? (
                      <button
                        onClick={() => onApply(zip, activeSkin.name, selectedChamp.id)}
                        className="btn-primary"
                      >
                        ✨ Apply Skin
                      </button>
                    ) : (
                      <span className="text-league-grey-lightest text-xs py-2">Not in library — generate it first</span>
                    );
                  })()}
                </div>

                {/* Chromas */}
                {(() => {
                  const chromas = findChromas(selectedChamp, activeSkin);
                  if (chromas.length === 0) return null;
                  return (
                    <div className="mt-3 flex flex-wrap gap-1">
                      <span className="text-[10px] text-league-gold mr-1 self-center">CHROMAS:</span>
                      {chromas.map((ch, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            if (ch.valid) onApply(ch.zipPath, ch.skinName, selectedChamp.id);
                            else notify('Chroma not available', false);
                          }}
                          className={`px-2 py-0.5 text-[10px] border transition-all ${
                            ch.valid
                              ? 'border-league-green/40 text-league-green hover:bg-league-green/10'
                              : 'border-league-grey-dark/40 text-league-grey-lightest'
                          }`}
                        >
                          {ch.chromaId || ch.skinName.split(' ').pop()}
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Skin selector strip */}
            <div className="flex-1 overflow-y-auto bg-league-blue-darker/50 p-4">
              <div className="flex flex-wrap gap-2">
                {skins.filter(s => s.num !== 0).map(skin => {
                  const isActive = activeSkin.id === skin.id;
                  const hasZip = !!findLocalZip(selectedChamp, skin);
                  return (
                    <div
                      key={skin.id}
                      onClick={() => setActiveSkin(skin)}
                      className={`relative w-28 cursor-pointer transition-all ${
                        isActive ? 'ring-2 ring-league-gold shadow-gold' : 'hover:ring-1 hover:ring-league-gold/40'
                      }`}
                    >
                      <div className="aspect-[2/3] overflow-hidden bg-league-grey-dark">
                        <img
                          src={skin.loadingUrl}
                          alt={skin.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={e => { (e.target as HTMLImageElement).src = skin.splashUrl; }}
                        />
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                      <div className="absolute bottom-0 inset-x-0 p-1.5">
                        <p className="text-[9px] text-white leading-tight truncate">{skin.name}</p>
                      </div>
                      {/* Available indicator */}
                      <div className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
                        hasZip ? 'bg-league-green' : 'bg-league-grey-dark border border-league-grey-lightest/30'
                      }`} />
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-league-grey-lightest">
            <p>Select a champion to browse skins</p>
          </div>
        )}
      </div>
    </div>
  );
}
