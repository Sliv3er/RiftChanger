import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LibChampion } from '../types/api';

interface Props {
  champions: LibChampion[];
  loading: boolean;
}

const ROLES = ['All', 'Fighter', 'Tank', 'Mage', 'Assassin', 'Marksman', 'Support'];

export default function Champions({ champions, loading }: Props) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('All');
  const [sort, setSort] = useState<'name' | 'skins'>('name');

  const filtered = useMemo(() => {
    let list = [...champions];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q));
    }
    if (role !== 'All') {
      list = list.filter(c => c.tags.includes(role));
    }
    if (sort === 'skins') {
      list.sort((a, b) => b.skins.filter(s => s.available).length - a.skins.filter(s => s.available).length);
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [champions, search, role, sort]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="league-spinner-lg" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-beaufort text-2xl text-league-gold-light tracking-widest uppercase">Champions</h1>
          <p className="text-league-grey-light text-xs mt-0.5">{filtered.length} of {champions.length}</p>
        </div>
        <select value={sort} onChange={e => setSort(e.target.value as any)}
                className="league-input w-40 text-xs py-1.5">
          <option value="name">A → Z</option>
          <option value="skins">Most Skins</option>
        </select>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="league-search flex-1 min-w-[180px]">
          <span className="league-search-icon">🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." />
        </div>
        <div className="flex gap-1">
          {ROLES.map(r => (
            <button key={r} onClick={() => setRole(r)}
              className={`px-2.5 py-1 text-[11px] font-beaufort uppercase tracking-wider border transition-all ${
                role === r
                  ? 'bg-league-gold/15 text-league-gold border-league-gold/50'
                  : 'text-league-grey-light border-league-grey-dark/50 hover:border-league-gold/30 hover:text-league-gold/80'
              }`}
            >{r}</button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
        {filtered.map(champ => {
          const avail = champ.skins.filter(s => s.available).length;
          const total = champ.skins.length;
          return (
            <div key={champ.id} onClick={() => navigate(`/champion/${champ.id}`)}
                 className="league-card group cursor-pointer overflow-hidden">
              <div className="relative aspect-square overflow-hidden">
                <img src={champ.iconUrl} alt={champ.name}
                     className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                     loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-league-blue-darkest/90 via-transparent to-transparent opacity-80" />

                {avail > 0 && (
                  <div className="absolute top-1 right-1 bg-league-gold text-league-blue-darkest text-[9px] font-bold px-1.5 py-px font-beaufort leading-tight">
                    {avail}
                  </div>
                )}

                <div className="absolute bottom-0 inset-x-0 p-1.5 text-center">
                  <p className="font-beaufort text-[10px] text-league-gold-light truncate leading-tight group-hover:text-league-gold transition-colors">
                    {champ.name}
                  </p>
                  <p className="text-[9px] text-league-grey-light">{total} skins</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-league-grey-light">No champions found</div>
      )}
    </div>
  );
}
