export default function Titlebar() {
  return (
    <div className="drag-region h-7 flex items-center justify-between bg-[#010A13] border-b border-[#1E2328]/60 px-3 z-50 flex-shrink-0">
      <span className="no-drag font-beaufort text-[10px] text-league-gold/60 tracking-[0.25em] uppercase">RiftChanger</span>
      <div className="flex no-drag">
        <button onClick={() => window.api?.minimize()} className="w-8 h-7 flex items-center justify-center text-[#5B5A56] hover:text-[#A09B8C] transition-colors">
          <svg width="10" height="1"><rect width="10" height="1" fill="currentColor"/></svg>
        </button>
        <button onClick={() => window.api?.maximize()} className="w-8 h-7 flex items-center justify-center text-[#5B5A56] hover:text-[#A09B8C] transition-colors">
          <svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1"><rect x=".5" y=".5" width="8" height="8"/></svg>
        </button>
        <button onClick={() => window.api?.close()} className="w-8 h-7 flex items-center justify-center text-[#5B5A56] hover:text-[#C24B4B] transition-colors">
          <svg width="10" height="10" stroke="currentColor" strokeWidth="1.2"><line x1="0" y1="0" x2="10" y2="10"/><line x1="10" y1="0" x2="0" y2="10"/></svg>
        </button>
      </div>
    </div>
  );
}
