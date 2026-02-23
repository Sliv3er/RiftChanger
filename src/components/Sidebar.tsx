import { useNavigate, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/', label: 'Dashboard', icon: '⚡' },
  { path: '/champions', label: 'Champions', icon: '🛡️' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
  { path: '/logs', label: 'Logs', icon: '📋' },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="w-56 bg-league-blue-deeper border-r border-league-border flex flex-col">
      {/* Logo area */}
      <div className="p-6 border-b border-league-border">
        <h1 className="font-beaufort text-2xl font-bold text-league-gold tracking-wider">
          RIFT
        </h1>
        <h1 className="font-beaufort text-2xl font-bold text-league-gold-light tracking-wider -mt-1">
          CHANGER
        </h1>
        <p className="text-league-grey text-xs mt-1">Skin Manager</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path === '/champions' && location.pathname.startsWith('/champion'));
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full px-6 py-3 flex items-center gap-3 text-left transition-all duration-200 ${
                isActive
                  ? 'bg-league-grey-cool border-l-2 border-league-gold text-league-gold-light'
                  : 'border-l-2 border-transparent text-league-grey hover:text-league-gold-light hover:bg-league-grey-cool/50'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="font-beaufort text-sm tracking-wide uppercase">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-league-border">
        <p className="text-league-grey-dark text-xs text-center">
          Powered by CSLoL Manager
        </p>
      </div>
    </div>
  );
}
