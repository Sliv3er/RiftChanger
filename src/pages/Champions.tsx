import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ChampionData, ScanResult } from '../types/api';

interface Props {
  champions: ChampionData[];
  scanResult: ScanResult | null;
}

export default function Champions({ champions, scanResult }: Props) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const navigate = useNavigate();

  const roles = ['All', 'Fighter', 'Mage', 'Assassin', 'Tank', 'Support', 'Marksman'];

  const filtered = useMemo(() => {
    return champions.filter(c => {
      const matchSearch = c.name.toLowerCase().includes(search.toLowerCase());
      const matchRole = roleFilter === 'All' || c.tags.includes(roleFilter);
      return matchSearch && matchRole;
    });
  }, [champions, search, roleFilter]);

  const getSkinCount = (champName: string): number => {
    if (!scanResult) return 0;
    return scanResult.skins.filter(s => s.championName === champName).length;
  };

  return (
    <div className="fade-in space-y-6">
      <div>
        <h1 className="font-beaufort text-3xl font-bold text-league-gold-light tracking-wide">
          CHAMPIONS
        </h1>
        <p className="text-league-grey text-sm mt-1">
          {filtered.length} champions • Browse and manage skins
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search champions..."
          className="search-input rounded w-64"
        />
        <div className="flex gap-1">
          {roles.map(role => (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              className={`px-3 py-1.5 text-xs font-beaufort uppercase tracking-wider rounded transition-all ${
                roleFilter === role
                  ? 'bg-league-gold text-league-blue-darkest'
                  : 'league-border text-league-grey hover:text-league-gold'
              }`}
            >
              {role}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {filtered.map(champ => {
          const skinCount = getSkinCount(champ.name);
          return (
            <button
              key={champ.id}
              onClick={() => navigate(`/champion/${champ.id}`)}
              className="skin-card bg-league-grey-cool rounded overflow-hidden group text-left"
            >
              <div className="relative aspect-square overflow-hidden">
                <img
                  src={champ.iconUrl}
                  alt={champ.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  loading="lazy"
                />
                {skinCount > 0 && (
                  <div className="absolute bottom-1 right-1 bg-league-blue-darkest/80 px-2 py-0.5 rounded text-xs text-league-gold">
                    {skinCount}
                  </div>
                )}
              </div>
              <div className="p-2">
                <p className="text-league-gold-light text-sm font-beaufort truncate">{champ.name}</p>
                <p className="text-league-grey text-xs truncate capitalize">{champ.title}</p>
              </div>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20">
          <p className="text-league-grey text-lg">No champions found</p>
        </div>
      )}
    </div>
  );
}
