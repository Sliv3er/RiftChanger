import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { LibChampion, LibSkin } from '../types/api';

interface Props {
  champions: LibChampion[];
  onApply: (zipPath: string, skinName: string, champName: string) => void;
  addLog: (msg: string) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function ChampionDetail({ champions, onApply, addLog, showToast }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<string>('');
  const [expandedSkin, setExpandedSkin] = useState<number | null>(null);

  const champ = useMemo(() => champions.find(c => c.id === id), [champions, id]);

  if (!champ) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-league-grey-light">Champion not found. Build your library index first.</p>
        <button onClick={() => navigate('/champions')} className="btn-secondary">← Back</button>
      </div>
    );
  }

  const heroSplash = preview || (champ.skins[0]?.splashUrl || '');

  const handleApply = (skin: LibSkin) => {
    if (!skin.available || !skin.zipPath) {
      showToast(`${skin.name} not available. Generate it first.`, 'error');
      return;
    }
    onApply(skin.zipPath, skin.name, champ.id);
  };

  return (
    <div className="animate-fade-in space-y-5">
      {/* ── HERO ── */}
      <div className="relative overflow-hidden league-card" style={{ height: 260 }}>
        {heroSplash && (
          <img src={heroSplash} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-league-blue-darkest via-league-blue-darkest/50 to-league-blue-darkest/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-league-blue-darkest/70 to-transparent" />

        <div className="relative h-full flex flex-col justify-between p-6">
          <button onClick={() => navigate('/champions')}
                  className="text-league-grey-light hover:text-league-gold text-sm transition-colors self-start">
            ← Champions
          </button>
          <div>
            <h1 className="font-beaufort text-4xl font-bold text-league-gold-light tracking-widest uppercase drop-shadow-lg">
              {champ.name}
            </h1>
            <p className="text-league-grey-light text-sm italic">{champ.title}</p>
            <div className="flex gap-2 mt-2">
              {champ.tags.map(t => (
                <span key={t} className="badge-dark text-[10px]">{t}</span>
              ))}
              <span className="badge-gold text-[10px]">{champ.skins.length} skins</span>
              <span className="badge-blue text-[10px]">
                {champ.skins.filter(s => s.available).length} available
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── SKINS ── */}
      <div className="section-header"><h2>Skins</h2></div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {champ.skins.map(skin => (
          <div key={skin.id} className="space-y-1">
            <div
              className={`league-card group cursor-pointer overflow-hidden transition-all ${
                expandedSkin === skin.num ? 'border-league-gold shadow-gold' : ''
              }`}
              onClick={() => setPreview(skin.splashUrl)}
            >
              {/* Splash image */}
              <div className="relative aspect-[3/4] overflow-hidden bg-league-grey-dark">
                <img
                  src={skin.loadingUrl}
                  alt={skin.name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                  onError={(e) => { (e.target as HTMLImageElement).src = skin.splashUrl; }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-league-blue-darkest/90 via-transparent to-transparent" />

                {/* Status */}
                <div className={`absolute top-2 right-2 text-[9px] font-bold px-2 py-0.5 uppercase tracking-wider ${
                  skin.available ? 'bg-league-green text-white' : 'bg-league-grey-dark/80 text-league-grey-light'
                }`}>
                  {skin.available ? '✓' : '—'}
                </div>

                {/* Chroma count */}
                {skin.chromas.length > 0 && (
                  <div className="absolute top-2 left-2 bg-league-blue-darkest/80 border border-league-gold/30 text-league-gold text-[9px] px-1.5 py-0.5">
                    {skin.chromas.length}🎨
                  </div>
                )}
              </div>

              {/* Info + Actions */}
              <div className="p-2.5 space-y-2">
                <p className="font-beaufort text-xs text-league-gold-light truncate leading-tight">{skin.name}</p>
                <div className="flex gap-1">
                  {skin.available ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleApply(skin); }}
                      className="btn-primary text-[9px] py-1.5 px-3 flex-1"
                    >
                      Apply
                    </button>
                  ) : (
                    <span className="text-[10px] text-league-grey-lightest py-1">Not generated</span>
                  )}
                  {skin.chromas.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedSkin(expandedSkin === skin.num ? null : skin.num);
                      }}
                      className="btn-secondary text-[9px] py-1.5 px-2"
                    >
                      🎨
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Chroma expansion */}
            {expandedSkin === skin.num && skin.chromas.length > 0 && (
              <div className="league-card p-2.5 animate-slide-up space-y-1.5">
                <p className="text-[10px] text-league-gold font-beaufort tracking-wide uppercase">
                  Chromas ({skin.chromas.length})
                </p>
                <div className="grid grid-cols-2 gap-1">
                  {skin.chromas.map(ch => (
                    <button
                      key={ch.num}
                      onClick={() => {
                        if (ch.available && ch.zipPath) {
                          onApply(ch.zipPath, ch.name, champ.id);
                        } else {
                          showToast('Chroma not generated yet', 'error');
                        }
                      }}
                      className={`text-[9px] py-1.5 px-1.5 truncate transition-all border ${
                        ch.available
                          ? 'border-league-green/30 text-league-green hover:bg-league-green/10'
                          : 'border-league-grey-dark text-league-grey-lightest'
                      }`}
                    >
                      {ch.available ? '✓ ' : ''}{ch.name.split(' ').pop()}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {champ.skins.length === 0 && (
        <div className="text-center py-12 text-league-grey-light">No skins data. Build the library index.</div>
      )}
    </div>
  );
}
