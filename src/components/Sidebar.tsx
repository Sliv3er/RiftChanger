import { NavLink } from 'react-router-dom';
import { useState } from 'react';

const NAV_ITEMS = [
  { to: '/', icon: '⬡', label: 'Home' },
  { to: '/champions', icon: '⚔', label: 'Champions' },
  { to: '/generator', icon: '⚙', label: 'Generator' },
  { to: '/settings', icon: '☰', label: 'Settings' },
  { to: '/logs', icon: '▤', label: 'Logs' },
];

interface Props {
  patch?: string;
}

export default function Sidebar({ patch }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <nav
      className="relative flex flex-col h-full bg-league-hextech-black border-r border-league-grey-dark/50 transition-all duration-300 ease-out z-40"
      style={{ width: expanded ? 200 : 64 }}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {/* Logo area */}
      <div className="h-14 flex items-center justify-center border-b border-league-grey-dark/30 px-3">
        <div className="w-8 h-8 flex items-center justify-center">
          <div className="w-5 h-5 rotate-45 border-2 border-league-gold bg-league-gold/10 transition-all duration-300"
               style={{ boxShadow: expanded ? '0 0 12px rgba(200,170,110,0.4)' : 'none' }} />
        </div>
        {expanded && (
          <span className="ml-3 font-beaufort text-sm text-league-gold tracking-[0.15em] uppercase animate-fade-in">
            Rift
          </span>
        )}
      </div>

      {/* Nav Items */}
      <div className="flex-1 py-4 space-y-1">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            {expanded && (
              <span className="nav-label animate-fade-in">{item.label}</span>
            )}
          </NavLink>
        ))}
      </div>

      {/* Bottom: Patch info */}
      <div className="border-t border-league-grey-dark/30 p-3 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-league-green animate-pulse" />
        {expanded && (
          <span className="text-xs text-league-grey-light animate-fade-in">
            Patch {patch || '...'}
          </span>
        )}
      </div>
    </nav>
  );
}
