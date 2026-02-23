export default function Titlebar() {
  return (
    <div className="drag-region h-8 flex items-center justify-between bg-league-hextech-black border-b border-league-grey-dark/50 px-3 relative z-50">
      {/* Left: Logo */}
      <div className="flex items-center gap-2 no-drag">
        <div className="w-4 h-4 rotate-45 bg-league-gold-bright/80 flex items-center justify-center">
          <div className="w-2 h-2 bg-league-blue-darkest rotate-0" />
        </div>
        <span className="font-beaufort text-xs text-league-gold tracking-[0.2em] uppercase">RiftChanger</span>
      </div>

      {/* Right: Window Controls */}
      <div className="flex items-center no-drag">
        <button
          onClick={() => window.api?.minimize()}
          className="w-10 h-8 flex items-center justify-center text-league-grey-light hover:text-league-gold-light hover:bg-white/5 transition-colors"
        >
          <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor"><rect width="10" height="1"/></svg>
        </button>
        <button
          onClick={() => window.api?.maximize()}
          className="w-10 h-8 flex items-center justify-center text-league-grey-light hover:text-league-gold-light hover:bg-white/5 transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1"><rect x="0.5" y="0.5" width="9" height="9"/></svg>
        </button>
        <button
          onClick={() => window.api?.close()}
          className="w-10 h-8 flex items-center justify-center text-league-grey-light hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.2"><line x1="0" y1="0" x2="10" y2="10"/><line x1="10" y1="0" x2="0" y2="10"/></svg>
        </button>
      </div>
    </div>
  );
}
