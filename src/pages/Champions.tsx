import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ScanResult, ChampionData } from '../types/api';

interface Props {
  champions: ChampionData[];
  scanResult: ScanResult | null;
}

const ROLES = ['All', 'Fighter', 'Tank', 'Mage', 'Assassin', 'Marksman', 'Support'];

export default function Champions({ champions, scanResult }: Props) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [onlyWithSkins, setOnlyWithSkins] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'skins'>('name');

  const getSkinCount = (champId: string): number => {
    if (!scanResult) return 0;
    return scanResult.skins.filter(s => {
      const norm = s.championName.replace(/[^a-zA-Z]/g, '').toLowerCase();
      return norm === champId.toLowerCase().replace(/[^a-zA-Z]/g, '');
    }).length;
  };

  const filtered = useMemo(() => {
    let list = [...champions];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
    }
    if (roleFilter !== 'All') {
      list = list.filter(c => c.tags.includes(roleFilter));
    }
    if (onlyWithSkins) {
      list = list.filter(c => getSkinCount(c.id) > 0);
    }
    if (sortBy === 'skins') {
      list.sort((a, b) => getSkinCount(b.id) - getSkinCount(a.id));
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [champions, search, roleFilter, onlyWithSkins, sortBy, scanResult]);

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-beaufort text-3xl font-bold text-league-gold-light tracking-widest uppercase">
          Champions
        </h1>
        <p className="text-league-grey-light text-sm mt-1">
          {champions.length} champions • {filtered.length} shown
        </p>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="league-search flex-1 min-w-[200px]">
          <span className="league-search-icon">🔍</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search champions..."
          />
        </div>

        {/* Role pills */}
        <div className="flex gap-1">
          {ROLES.map(role => (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              className={`px-3 py-1.5 text-xs font-beaufort uppercase tracking-wider transition-all duration-200 ${
                roleFilter === role
                  ? 'bg-league-gold/20 text-league-gold border border-league-gold/50'
                  : 'text-league-grey-light border border-league-grey-dark hover:border-league-gold/30 hover:text-league-gold'
              }`}
            >
              {role}
            </button>
          ))}
        </div>

        <button
          onClick={() => setOnlyWithSkins(!onlyWithSkins)}
          className={`px-3 py-1.5 text-xs uppercase tracking-wider transition-all duration-200 border ${
            onlyWithSkins
              ? 'bg-league-green/20 text-league-green border-league-green/50'
              : 'text-league-grey-light border-league-grey-dark hover:text-league-gold'
          }`}
        >
          Has Skins
        </button>

        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as 'name' | 'skins')}
          className="league-input w-auto text-xs"
        >
          <option value="name">Sort: Name</option>
          <option value="skins">Sort: Skin Count</option>
        </select>
      </div>

      {/* Champion Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
        {filtered.map(champ => {
          const skinCount = getSkinCount(champ.id);
          return (
            <div
              key={champ.id}
              onClick={() => navigate(`/champion/${champ.id}`)}
              className="league-card group cursor-pointer overflow-hidden"
            >
              <div className="relative aspect-square overflow-hidden">
                <img
                  src={champ.iconUrl}
                  alt={champ.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-league-blue-darkest/90 via-transparent to-transparent" />

                {/* Skin count badge */}
                {skinCount > 0 && (
                  <div className="absolute top-1.5 right-1.5 bg-league-gold text-league-blue-darkest text-[10px] font-bold px-1.5 py-0.5 font-beaufort">
                    {skinCount}
                  </div>
                )}
              </div>
              <div className="p-2 text-center">
                <p className="font-beaufort text-xs text-league-gold-light truncate group-hover:text-league-gold transition-colors">
                  {champ.name}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20">
          <p className="text-league-grey-light text-lg">No champions match your filters</p>
        </div>
      )}
    </div>
  );
}
