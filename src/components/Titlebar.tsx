export default function Titlebar() {
  return (
    <div className="titlebar h-8 bg-league-blue-darkest flex items-center justify-between px-4 border-b border-league-border">
      <div className="flex items-center gap-2">
        <span className="text-league-gold font-beaufort text-sm font-bold tracking-wider">
          RIFTCHANGER
        </span>
        <span className="text-league-grey text-xs">v1.0.0</span>
      </div>
      <div className="flex gap-1">
        <button
          onClick={() => window.api?.minimize()}
          className="w-8 h-6 flex items-center justify-center text-league-grey hover:text-league-gold-light hover:bg-league-grey-cool transition-colors text-xs"
        >
          ─
        </button>
        <button
          onClick={() => window.api?.maximize()}
          className="w-8 h-6 flex items-center justify-center text-league-grey hover:text-league-gold-light hover:bg-league-grey-cool transition-colors text-xs"
        >
          □
        </button>
        <button
          onClick={() => window.api?.close()}
          className="w-8 h-6 flex items-center justify-center text-league-grey hover:text-red-500 hover:bg-red-500/20 transition-colors text-xs"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
