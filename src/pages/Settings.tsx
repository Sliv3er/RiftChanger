import { useState, useEffect, useCallback } from 'react';

interface Props { notify: (msg: string, ok?: boolean) => void; onRescan: () => void; onToolsChanged?: () => void; }

export default function Settings({ notify, onRescan, onToolsChanged }: Props) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [toolsAvail, setToolsAvail] = useState<any>({});
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string } | null>>({});
  const [downloading, setDownloading] = useState<Set<string>>(new Set());
  const [dlProgress, setDlProgress] = useState<Record<string, number>>({});
  const [dlStatus, setDlStatus] = useState<Record<string, string>>({});

  const checkTools = useCallback(async () => {
    try { 
      const a = await window.api.checkToolsAvailability(); 
      setToolsAvail(a); 
      if (a['cslol-manager'] && a.path && !settings.cslolToolsPath) {
        setSettings(p => ({ ...p, cslolToolsPath: a.path! }));
        await window.api.updateSetting('cslolToolsPath', a.path!);
      }
      onToolsChanged?.(); 
    } catch {}
  }, [onToolsChanged, settings.cslolToolsPath]);

  useEffect(() => {
    (async () => {
      const [s, sp] = await Promise.all([
        window.api.getSettings().catch(() => ({})),
        window.api.getSkinsPath().catch(() => ''),
      ]);
      setSettings({ ...s, skinsFolder: sp });
      checkTools();
      if ((s as any).leagueGamePath) testPath('leagueGame', (s as any).leagueGamePath);
      if ((s as any).cslolToolsPath) testPath('cslolTools', (s as any).cslolToolsPath);
    })();
  }, [checkTools]);

  useEffect(() => {
    const unsub = window.api.onDownloadProgress((data: any) => {
      if (data.repoType) {
        setDlProgress(p => ({ ...p, [data.repoType]: data.progress || 0 }));
        setDlStatus(p => ({ ...p, [data.repoType]: data.status || '' }));
        if (data.status === 'completed') {
          setDownloading(s => { const n = new Set(s); n.delete(data.repoType); return n; });
          checkTools();
          notify(`${data.repoType} downloaded successfully`);
        }
      }
    });
    return unsub;
  }, [notify, checkTools]);

  const handleChange = useCallback(async (key: string, val: string, pathType?: string) => {
    setSettings(p => ({ ...p, [key]: val }));
    await window.api.updateSetting(key, val);
    if (pathType && val.trim()) setTimeout(() => testPath(pathType, val), 300);
    checkTools();
  }, [checkTools]);

  const browse = useCallback(async (key: string, pathType?: string) => {
    const p = await window.api.selectFolder();
    if (p) handleChange(key, p, pathType);
  }, [handleChange]);

  const testPath = async (type: string, path: string) => {
    setTestResults(p => ({ ...p, [type]: null }));
    try {
      if (type === 'leagueGame') {
        const r = await window.api.testLeaguePath(path);
        setTestResults(p => ({ ...p, [type]: { success: r.success, message: r.success ? 'League of Legends game path is valid' : 'League of Legends.exe not found' } }));
      } else if (type === 'cslolTools') {
        const r = await window.api.scanSkinsFolder(path);
        if (r.success && r.path) {
          if (r.path !== path) {
            handleChange('cslolToolsPath', r.path);
          }
          setTestResults(p => ({ ...p, [type]: { success: true, message: 'CSLoL Tools path is valid' } }));
        } else {
          setTestResults(p => ({ ...p, [type]: { success: false, message: 'mod-tools.exe not found in specified path' } }));
        }
      }
    } catch {}
  };

  const download = useCallback(async (repoType: string) => {
    setDownloading(s => new Set([...s, repoType]));
    setDlProgress(p => ({ ...p, [repoType]: 0 }));
    const res = await window.api.downloadRepository(repoType);
    if (!res.success) {
      setDownloading(s => { const n = new Set(s); n.delete(repoType); return n; });
      notify(`Download failed: ${res.error}`, false);
    } else {
      checkTools();
    }
  }, [notify, checkTools]);

  const Badge = ({ ok }: { ok: boolean }) => (
    <div className={`px-2 py-1 rounded text-xs font-medium ${ok ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'}`}>
      {ok ? '✅ Available' : '⚪ Not found'}
    </div>
  );

  const ProgressBar = ({ repoType }: { repoType: string }) => {
    if (!downloading.has(repoType)) return null;
    const status = dlStatus[repoType] || '';
    const labels: Record<string, string> = { starting: 'Starting download...', downloading: `Downloading ${repoType}...`, extracting: 'Extracting files...', organizing: 'Organizing folders...', completed: 'Download completed!' };
    return (
      <div className="mt-2 p-3 rounded-lg text-sm bg-gold-500/10 text-gold-400 border border-gold-500/20">
        <div className="flex items-center justify-between mb-2">
          <span className="flex items-center">
            <div className="w-4 h-4 border-2 border-gold-400 border-t-transparent rounded-full animate-spin mr-2" />
            {labels[status] || 'Processing...'}
          </span>
          <span className="font-medium">{dlProgress[repoType] || 0}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
          <div className="bg-gradient-to-r from-gold-500 to-gold-400 h-2 rounded-full transition-all duration-300" style={{ width: `${dlProgress[repoType] || 0}%` }} />
        </div>
        <div className="text-xs opacity-80 mt-1">Downloading to portable directory next to RiftChanger.exe</div>
      </div>
    );
  };

  const TestResult = ({ type }: { type: string }) => {
    const r = testResults[type];
    if (!r) return null;
    return (
      <div className={`mt-2 p-3 rounded-lg text-sm ${r.success ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
        {r.message}
      </div>
    );
  };

  return (
    <div className="h-full overflow-auto scrollbar-thin" style={{ background: '#0a0a0a' }}>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
          <p className="text-gray-400">Configure RiftChanger paths and preferences</p>
        </div>

        <div className="space-y-8">
          {/* Path Configuration */}
          <div className="glass-card p-6">
            <h3 className="text-xl font-semibold text-white mb-6">Path Configuration</h3>
            <div className="space-y-6">

              {/* CSLoL Tools */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-300">CSLoL Tools Path <span className="text-red-400">*</span></label>
                  <Badge ok={!!toolsAvail['cslol-manager']} />
                </div>
                <p className="text-sm text-gray-500 mb-3">Path to your CSLoL Tools installation (folder containing mod-tools.exe)</p>
                <div className="flex space-x-3">
                  <input type="text" value={settings.cslolToolsPath || ''} onChange={e => handleChange('cslolToolsPath', e.target.value, 'cslolTools')}
                    placeholder="C:\path\to\cslol-tools" className="input-field flex-1" />
                  <button onClick={() => browse('cslolToolsPath', 'cslolTools')} className="btn-secondary px-4 py-2 whitespace-nowrap">Browse</button>
                  <button onClick={() => download('cslol-manager')} disabled={downloading.has('cslol-manager') || !!toolsAvail['cslol-manager']}
                    className={`font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center ${toolsAvail['cslol-manager'] ? 'bg-gray-600 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`}>
                    {downloading.has('cslol-manager') ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> :
                     toolsAvail['cslol-manager'] ? <><svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Installed</> :
                     <><svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>Download</>}
                  </button>
                </div>
                <TestResult type="cslolTools" />
                <ProgressBar repoType="cslol-manager" />
              </div>

              {/* League Game Path */}
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">League of Legends Game Path <span className="text-red-400">*</span></label>
                <p className="text-sm text-gray-500 mb-3">Path to your League of Legends game installation (folder containing League of Legends.exe)</p>
                <div className="flex space-x-3">
                  <input type="text" value={settings.leagueGamePath || ''} onChange={e => handleChange('leagueGamePath', e.target.value, 'leagueGame')}
                    placeholder="C:\Riot Games\League of Legends\Game" className="input-field flex-1" />
                  <button onClick={() => browse('leagueGamePath', 'leagueGame')} className="btn-secondary px-4 py-2 whitespace-nowrap">Browse</button>
                </div>
                <TestResult type="leagueGame" />
              </div>

              {/* Skins Folder */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-300">Skins Folder Path <span className="text-red-400">*</span></label>
                  <Badge ok={!!toolsAvail['lol-skins']} />
                </div>
                <p className="text-sm text-gray-500 mb-3">Path to your custom skins folder (should contain champion subfolders)</p>
                <div className="flex space-x-3">
                  <input type="text" value={settings.skinsFolder || ''} readOnly className="input-field flex-1 opacity-70" />
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex justify-between items-center mt-6">
              <button onClick={checkTools} className="btn-secondary px-4 py-2 flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh Tools Status
              </button>
              <div className="text-sm text-gold-400 font-medium flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Settings auto-save & auto-test
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
