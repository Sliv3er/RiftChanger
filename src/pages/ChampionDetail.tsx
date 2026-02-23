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
  const [previewSplash, setPreviewSplash] = useState<string>('');
  const [showChromas, setShowChromas] = useState(false);

  useEffect(() => {
    if (id && window.api) {
      window.api.getChampionSkins(id).then(skins => {
        setOfficialSkins(skins);
        if (skins.length > 0) {
          setPreviewSplash(skins[0].splashUrl);
        }
      }).catch(() => {});
    }
  }, [id]);

  if (!id) return null;

  // Find local skins for this champion
  const champName = id; // We need to map id to name
  const localSkins = scanResult?.skins.filter(s => {
    // Match by champion name - need fuzzy match since folder names might differ from API ids
    const normalized = s.championName.replace(/[^a-zA-Z]/g, '').toLowerCase();
    return normalized === id.toLowerCase().replace(/[^a-zA-Z]/g, '');
  }) || [];

  const baseSkins = localSkins.filter(s => s.type === 'skin');
  const chromas = localSkins.filter(s => s.type === 'chroma');
  const forms = localSkins.filter(s => s.type === 'form');
  const exalted = localSkins.filter(s => s.type === 'exalted');

  const handleApply = (skin: SkinEntry) => {
    if (!skin.valid) {
      addLog(`Cannot apply invalid skin: ${skin.skinName}`);
      return;
    }
    onApply([skin]);
  };

  // Match official skin to local skin
  const findLocalSkin = (officialName: string): SkinEntry | undefined => {
    return baseSkins.find(s => {
      const localName = s.skinName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const offName = officialName.toLowerCase().replace(/[^a-z0-9]/g, '');
      return localName.includes(offName) || offName.includes(localName);
    });
  };

  // Get chromas for a specific skin
  const getChromasForSkin = (skinName: string): SkinEntry[] => {
    return chromas.filter(c => {
      const chromaBase = c.skinName.replace(/\s*\d+$/, '').toLowerCase();
      return skinName.toLowerCase().includes(chromaBase) || chromaBase.includes(skinName.toLowerCase());
    });
  };

  return (
    <div className="fade-in space-y-6">
      {/* Back button + Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/champions')}
          className="text-league-gold hover:text-league-gold-light transition-colors"
        >
          ← Back
        </button>
        <div>
          <h1 className="font-beaufort text-3xl font-bold text-league-gold-light tracking-wide uppercase">
            {id}
          </h1>
          <p className="text-league-grey text-sm">
            {baseSkins.length} skins • {chromas.length} chromas available locally
          </p>
        </div>
      </div>

      {/* Splash Preview */}
      {previewSplash && (
        <div className="relative rounded overflow-hidden league-border-light" style={{ maxHeight: '300px' }}>
          <img
            src={previewSplash}
            alt="Skin preview"
            className="w-full object-cover"
            style={{ maxHeight: '300px' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-league-blue-darkest/80 to-transparent" />
          {selectedSkin && (
            <div className="absolute bottom-4 left-4">
              <p className="font-beaufort text-xl text-league-gold-light">{selectedSkin.skinName}</p>
              <p className="text-league-grey text-xs">
                {selectedSkin.valid ? '✅ Valid' : '❌ Invalid'} • {selectedSkin.type}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Official Skins from API with local availability */}
      <div>
        <h2 className="font-beaufort text-lg text-league-gold tracking-wide mb-3">SKINS</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {officialSkins.map(skin => {
            const localMatch = findLocalSkin(skin.name);
            const skinChromas = localMatch ? getChromasForSkin(localMatch.skinName) : [];
            return (
              <div
                key={skin.id}
                className={`skin-card bg-league-grey-cool rounded overflow-hidden cursor-pointer ${
                  selectedSkin?.skinName === localMatch?.skinName ? 'league-border-gold' : ''
                }`}
                onClick={() => {
                  setPreviewSplash(skin.splashUrl);
                  if (localMatch) setSelectedSkin(localMatch);
                }}
              >
                <div className="relative aspect-[3/4] overflow-hidden">
                  <img
                    src={skin.loadingUrl}
                    alt={skin.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = skin.splashUrl;
                    }}
                  />
                  {/* Availability badge */}
                  <div className={`absolute top-2 right-2 px-2 py-0.5 rounded text-xs ${
                    localMatch
                      ? localMatch.valid
                        ? 'bg-green-600/80 text-white'
                        : 'bg-yellow-600/80 text-white'
                      : 'bg-league-grey-dark/80 text-league-grey'
                  }`}>
                    {localMatch ? (localMatch.valid ? 'Available' : 'Invalid') : 'Not in library'}
                  </div>
                  {/* Chroma count */}
                  {skinChromas.length > 0 && (
                    <div className="absolute bottom-2 right-2 bg-league-blue-darkest/80 px-2 py-0.5 rounded text-xs text-league-gold">
                      {skinChromas.length} chromas
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-league-gold-light text-sm font-beaufort truncate">{skin.name}</p>
                  <div className="flex gap-2 mt-2">
                    {localMatch && localMatch.valid && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApply(localMatch);
                        }}
                        className="btn-league-primary text-xs py-1 px-3 flex-1"
                      >
                        Apply
                      </button>
                    )}
                    {skinChromas.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowChromas(!showChromas);
                          setSelectedSkin(localMatch || null);
                        }}
                        className="btn-league text-xs py-1 px-3"
                      >
                        Chromas
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chromas section */}
      {showChromas && selectedSkin && (
        <div className="league-border bg-league-blue-deeper rounded p-4 fade-in">
          <h3 className="font-beaufort text-lg text-league-gold mb-3">
            CHROMAS — {selectedSkin.skinName}
          </h3>
          <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-8 gap-2">
            {getChromasForSkin(selectedSkin.skinName).map(chroma => (
              <div
                key={chroma.zipPath}
                className="skin-card bg-league-grey-cool rounded p-2 text-center"
              >
                <p className="text-xs text-league-grey truncate">{chroma.chromaId || chroma.skinName}</p>
                <button
                  onClick={() => handleApply(chroma)}
                  disabled={!chroma.valid}
                  className={`mt-1 text-xs py-1 px-2 rounded w-full ${
                    chroma.valid
                      ? 'btn-league-primary'
                      : 'bg-league-grey-dark text-league-grey cursor-not-allowed'
                  }`}
                >
                  Apply
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Forms & Exalted */}
      {forms.length > 0 && (
        <div>
          <h2 className="font-beaufort text-lg text-league-gold tracking-wide mb-3">FORMS</h2>
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
            {forms.map(form => (
              <div key={form.zipPath} className="skin-card bg-league-grey-cool rounded p-3">
                <p className="text-league-gold-light text-sm truncate">{form.skinName}</p>
                <button
                  onClick={() => handleApply(form)}
                  disabled={!form.valid}
                  className="btn-league text-xs py-1 mt-2 w-full"
                >
                  Apply
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {exalted.length > 0 && (
        <div>
          <h2 className="font-beaufort text-lg text-league-gold tracking-wide mb-3">EXALTED</h2>
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
            {exalted.map(ex => (
              <div key={ex.zipPath} className="skin-card bg-league-grey-cool rounded p-3">
                <p className="text-league-gold-light text-sm truncate">{ex.skinName}</p>
                <button
                  onClick={() => handleApply(ex)}
                  disabled={!ex.valid}
                  className="btn-league text-xs py-1 mt-2 w-full"
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
