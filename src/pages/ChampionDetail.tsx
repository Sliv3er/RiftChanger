import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { ScanResult, SkinData, SkinEntry } from '../types/api';

interface Props {
  scanResult: ScanResult | null;
  onApply: (skins: SkinEntry[]) => void;
  addLog: (msg: string) => void;
}

export default function ChampionDetail({ scanResult, onApply, addLog }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [officialSkins, setOfficialSkins] = useState<SkinData[]>([]);
  const [selectedSkin, setSelectedSkin] = useState<SkinEntry | null>(null);
  const [previewSplash, setPreviewSplash] = useState('');
  const [expandedChroma, setExpandedChroma] = useState<string | null>(null);

  useEffect(() => {
    if (id && window.api) {
      window.api.getChampionSkins(id).then(skins => {
        setOfficialSkins(skins);
        if (skins.length > 0) setPreviewSplash(skins[0].splashUrl);
      }).catch(() => {});
    }
  }, [id]);

  if (!id) return null;

  const localSkins = scanResult?.skins.filter(s => {
    const norm = s.championName.replace(/[^a-zA-Z]/g, '').toLowerCase();
    return norm === id.toLowerCase().replace(/[^a-zA-Z]/g, '');
  }) || [];

  const baseSkins = localSkins.filter(s => s.type === 'skin');
  const chromas = localSkins.filter(s => s.type === 'chroma');
  const forms = localSkins.filter(s => s.type === 'form');
  const exalted = localSkins.filter(s => s.type === 'exalted');

  const handleApply = (skin: SkinEntry) => {
    if (!skin.valid) { addLog(`Cannot apply invalid skin: ${skin.skinName}`); return; }
    onApply([skin]);
  };

  const findLocalSkin = (name: string): SkinEntry | undefined => {
    return baseSkins.find(s => {
      const a = s.skinName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const b = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return a.includes(b) || b.includes(a);
    });
  };

  const getChromasForSkin = (skinName: string): SkinEntry[] => {
    return chromas.filter(c => {
      const base = c.skinName.replace(/\s*\d+$/, '').toLowerCase();
      return skinName.toLowerCase().includes(base) || base.includes(skinName.toLowerCase());
    });
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* ══════ HERO BANNER ══════ */}
      <div className="relative overflow-hidden league-card p-0" style={{ minHeight: 280 }}>
        {previewSplash && (
          <img src={previewSplash} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-league-blue-darkest via-league-blue-darkest/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-league-blue-darkest/80 to-transparent" />

        <div className="relative z-10 p-8 flex flex-col justify-end h-full" style={{ minHeight: 280 }}>
          {/* Breadcrumb */}
          <button
            onClick={() => navigate('/champions')}
            className="text-league-grey-light hover:text-league-gold text-sm transition-colors mb-auto"
          >
            ← Champions / <span className="text-league-gold">{id}</span>
          </button>

          <div>
            <h1 className="font-beaufort text-5xl font-bold text-league-gold-light tracking-widest uppercase drop-shadow-lg">
              {id}
            </h1>
            <div className="flex gap-2 mt-3">
              <span className="badge-gold">{baseSkins.length} skins</span>
              <span className="badge-blue">{chromas.length} chromas</span>
              {forms.length > 0 && <span className="badge-dark">{forms.length} forms</span>}
              {exalted.length > 0 && <span className="badge-dark">{exalted.length} exalted</span>}
            </div>
          </div>
        </div>
      </div>

      {/* ══════ SKIN GRID ══════ */}
      <div className="section-header">
        <h2>Available Skins</h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {officialSkins.map(skin => {
          const local = findLocalSkin(skin.name);
          const skinChromas = local ? getChromasForSkin(local.skinName) : [];
          const isSelected = selectedSkin?.skinName === local?.skinName;

          return (
            <div key={skin.id} className="space-y-2">
              <div
                className={`league-card group cursor-pointer overflow-hidden transition-all duration-300 ${
                  isSelected ? 'border-league-gold shadow-gold-lg' : ''
                }`}
                onClick={() => {
                  setPreviewSplash(skin.splashUrl);
                  if (local) setSelectedSkin(local);
                }}
              >
                <div className="relative aspect-[3/4] overflow-hidden">
                  <img
                    src={skin.loadingUrl}
                    alt={skin.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).src = skin.splashUrl; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-league-blue-darkest/90 via-transparent to-transparent" />

                  {/* Status badge */}
                  <div className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider ${
                    local
                      ? local.valid ? 'bg-league-green text-white' : 'bg-yellow-600 text-white'
                      : 'bg-league-grey-dark text-league-grey-light'
                  }`}>
                    {local ? (local.valid ? '✓ Ready' : '⚠ Invalid') : 'Missing'}
                  </div>

                  {/* Chroma indicator */}
                  {skinChromas.length > 0 && (
                    <div className="absolute bottom-2 right-2 bg-league-blue-darkest/80 border border-league-gold/30 text-league-gold text-[10px] px-2 py-0.5">
                      {skinChromas.length} chromas
                    </div>
                  )}
                </div>

                <div className="p-3 space-y-2">
                  <p className="font-beaufort text-sm text-league-gold-light truncate">{skin.name}</p>
                  <div className="flex gap-1">
                    {local?.valid && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleApply(local); }}
                        className="btn-primary text-[10px] py-1.5 px-3 flex-1"
                      >
                        Apply
                      </button>
                    )}
                    {skinChromas.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedChroma(expandedChroma === skin.name ? null : skin.name);
                        }}
                        className="btn-secondary text-[10px] py-1.5 px-2"
                      >
                        🎨
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Chroma expansion */}
              {expandedChroma === skin.name && skinChromas.length > 0 && (
                <div className="league-card p-3 animate-slide-up space-y-2">
                  <p className="text-xs text-league-gold font-beaufort tracking-wide">Chromas</p>
                  <div className="grid grid-cols-2 gap-1">
                    {skinChromas.map(chroma => (
                      <button
                        key={chroma.zipPath}
                        onClick={() => handleApply(chroma)}
                        disabled={!chroma.valid}
                        className={`text-[10px] py-1.5 px-2 truncate transition-all ${
                          chroma.valid
                            ? 'btn-secondary'
                            : 'bg-league-grey-dark text-league-grey-lightest cursor-not-allowed border border-league-grey-dark'
                        }`}
                      >
                        {chroma.chromaId || chroma.skinName.split(' ').pop()}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ══════ FORMS ══════ */}
      {forms.length > 0 && (
        <div>
          <div className="section-header"><h2>Forms</h2></div>
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {forms.map(form => (
              <div key={form.zipPath} className="league-card p-3 text-center">
                <p className="text-league-gold-light text-xs font-beaufort truncate mb-2">{form.skinName}</p>
                <button
                  onClick={() => handleApply(form)}
                  disabled={!form.valid}
                  className="btn-secondary text-[10px] py-1 w-full"
                >
                  Apply
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════ EXALTED ══════ */}
      {exalted.length > 0 && (
        <div>
          <div className="section-header"><h2>Exalted</h2></div>
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {exalted.map(ex => (
              <div key={ex.zipPath} className="league-card p-3 text-center">
                <p className="text-league-gold-light text-xs font-beaufort truncate mb-2">{ex.skinName}</p>
                <button
                  onClick={() => handleApply(ex)}
                  disabled={!ex.valid}
                  className="btn-secondary text-[10px] py-1 w-full"
                >
                  Apply
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
