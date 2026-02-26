import { useState, useEffect, useCallback } from 'react';

interface Props {
  notify: (msg: string, ok?: boolean) => void;
  onRescan: () => void;
}

export default function Settings({ notify, onRescan }: Props) {
  const [cslolPath, setCslolPath] = useState('');
  const [gamePath, setGamePath] = useState('');
  const [skinsPath, setSkinsPath] = useState('');
  const [toolsAvail, setToolsAvail] = useState<Record<string, boolean>>({});
  const [gamePathOk, setGamePathOk] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [dlProgress, setDlProgress] = useState(0);
  const [dlStatus, setDlStatus] = useState('');

  // Load settings on mount
  useEffect(() => {
    (async () => {
      const [settings, avail, sp] = await Promise.all([
        window.api.getSettings(),
        window.api.checkToolsAvailability(),
        window.api.getSkinsPath(),
      ]);
      setCslolPath(settings.cslolToolsPath || '');
      setGamePath(settings.leagueGamePath || 'C:\\Riot Games\\League of Legends\\Game');
      setSkinsPath(sp || '');
      setToolsAvail(avail);
      if (settings.leagueGamePath) {
        const r = await window.api.testLeaguePath(settings.leagueGamePath);
        setGamePathOk(r.success);
      }
    })();
  }, []);

  // Download progress listener
  useEffect(() => {
    const unsub = window.api.onDownloadProgress((data: any) => {
      setDlProgress(data.progress || 0);
      setDlStatus(data.status || '');
      if (data.status === 'completed') {
        setDownloading(null);
        refreshTools();
        notify('CSLoL Manager downloaded successfully');
      }
    });
    return unsub;
  }, [notify]);

  const refreshTools = useCallback(async () => {
    const avail = await window.api.checkToolsAvailability();
    setToolsAvail(avail);
  }, []);

  const saveSetting = useCallback(async (key: string, val: string) => {
    await window.api.updateSetting(key, val);
    if (key === 'leagueGamePath') {
      const r = await window.api.testLeaguePath(val);
      setGamePathOk(r.success);
    }
    refreshTools();
  }, [refreshTools]);

  const browseCslol = useCallback(async () => {
    const p = await window.api.selectFolder();
    if (p) { setCslolPath(p); saveSetting('cslolToolsPath', p); }
  }, [saveSetting]);

  const browseGame = useCallback(async () => {
    const p = await window.api.selectFolder();
    if (p) { setGamePath(p); saveSetting('leagueGamePath', p); }
  }, [saveSetting]);

  const downloadCslol = useCallback(async () => {
    setDownloading('cslol-manager');
    setDlProgress(0);
    setDlStatus('starting');
    const res = await window.api.downloadRepository('cslol-manager');
    if (!res.success) {
      setDownloading(null);
      notify('Download failed: ' + (res.error || 'Unknown error'), false);
    }
  }, [notify]);

  const Badge = ({ ok }: { ok: boolean }) => (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold"
      style={{ background: ok ? 'rgba(10,207,131,0.15)' : 'rgba(232,64,87,0.15)', color: ok ? '#0ACF83' : '#E84057' }}>
      <span className="w-2 h-2 rounded-full" style={{ background: ok ? '#0ACF83' : '#E84057' }} />
      {ok ? 'Available' : 'Not found'}
    </span>
  );

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-6" style={{ background: '#010A13' }}>
      <h1 className="text-xl font-bold mb-6" style={{ color: '#F0E6D2' }}>SETTINGS</h1>

      {/* CSLoL Tools Path */}
      <div className="rounded-lg p-5 mb-4" style={{ background: '#0A0E13', border: '1px solid #1E2328' }}>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-bold" style={{ color: '#C89B3C' }}>CSLoL TOOLS PATH</h2>
          <Badge ok={!!toolsAvail['cslol-manager']} />
        </div>
        <div className="flex gap-2 mb-2">
          <input value={cslolPath}
            onChange={e => { setCslolPath(e.target.value); saveSetting('cslolToolsPath', e.target.value); }}
            className="league-input flex-1" placeholder="Path to cslol-tools folder..." />
          <button onClick={browseCslol}
            className="px-4 py-2 text-sm font-bold rounded" style={{ background: '#1E2328', color: '#A09B8C' }}>
            Browse
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={downloadCslol} disabled={!!downloading}
            className="px-4 py-2 text-sm font-bold rounded disabled:opacity-50"
            style={{ background: 'linear-gradient(180deg, #C89B3C 0%, #785A28 100%)', color: '#010A13' }}>
            {downloading === 'cslol-manager' ? 'Downloading...' : 'Download Latest'}
          </button>
          <button onClick={refreshTools}
            className="px-4 py-2 text-sm rounded" style={{ background: '#1E2328', color: '#A09B8C' }}>
            Refresh Status
          </button>
        </div>
        {downloading === 'cslol-manager' && (
          <div className="mt-3">
            <div className="h-2 rounded-full overflow-hidden" style={{ background: '#1E2328' }}>
              <div className="h-full transition-all" style={{ width: `${dlProgress}%`, background: 'linear-gradient(90deg, #C89B3C, #F0E6D2)' }} />
            </div>
            <div className="text-xs mt-1" style={{ color: '#5B5A56' }}>{dlStatus} ({dlProgress}%)</div>
          </div>
        )}
      </div>

      {/* League Game Path */}
      <div className="rounded-lg p-5 mb-4" style={{ background: '#0A0E13', border: '1px solid #1E2328' }}>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-bold" style={{ color: '#C89B3C' }}>LEAGUE GAME PATH</h2>
          <Badge ok={gamePathOk} />
        </div>
        <div className="flex gap-2">
          <input value={gamePath}
            onChange={e => { setGamePath(e.target.value); saveSetting('leagueGamePath', e.target.value); }}
            className="league-input flex-1" placeholder="Path to League of Legends/Game..." />
          <button onClick={browseGame}
            className="px-4 py-2 text-sm font-bold rounded" style={{ background: '#1E2328', color: '#A09B8C' }}>
            Browse
          </button>
        </div>
      </div>

      {/* Skins Folder */}
      <div className="rounded-lg p-5 mb-4" style={{ background: '#0A0E13', border: '1px solid #1E2328' }}>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-bold" style={{ color: '#C89B3C' }}>SKINS FOLDER</h2>
          <Badge ok={!!toolsAvail['lol-skins']} />
        </div>
        <div className="flex gap-2">
          <input value={skinsPath} readOnly className="league-input flex-1 opacity-70" />
        </div>
        <p className="text-xs mt-2" style={{ color: '#5B5A56' }}>
          Located at: {skinsPath} (bundled with app)
        </p>
      </div>

      {/* Info */}
      <div className="rounded-lg p-5" style={{ background: '#0A0E13', border: '1px solid #1E2328' }}>
        <h2 className="text-sm font-bold mb-2" style={{ color: '#C89B3C' }}>ABOUT</h2>
        <p className="text-xs" style={{ color: '#5B5A56' }}>
          RiftChanger — Custom skin manager for League of Legends.<br />
          Uses CSLoL Tools for skin injection. Close the app to remove all applied skins.
        </p>
      </div>
    </div>
  );
}
