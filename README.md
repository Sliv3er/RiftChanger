# RiftChanger

<div align="center">
  <h3>⚡ League of Legends Custom Skin Manager</h3>
  <p>A premium Electron desktop app for managing, generating, and applying custom skins</p>

  <!-- ![RiftChanger Screenshot](docs/screenshot.png) -->
</div>

---

## Features

- 🎨 **Skin Library Scanner** — Scan and validate thousands of fantome-format skin ZIPs
- ⚡ **Skin Generation** — Generate skin mods directly from CDragon bin files for any patch
- 🖼️ **Champion Browser** — Browse 170+ champions with official splash arts from Data Dragon
- 🎭 **Chroma Support** — Full chroma browsing, generation, and application
- 🔧 **CSLoL Integration** — Uses CSLoL Manager as the injection backend (auto-downloaded)
- 🎮 **Game Detection** — Auto-detects League of Legends installation
- 💾 **Backup & Restore** — Create backups before applying skins, restore anytime
- 🌟 **League-Style UI** — Dark gold/blue aesthetic matching the League client

## Installation

### From Release

Download the latest `.exe` from [Releases](https://github.com/Sliv3er/RiftChanger/releases).

### From Source

```bash
git clone https://github.com/Sliv3er/RiftChanger.git
cd RiftChanger
npm install
npm run electron:dev
```

## Build

```bash
npm run electron:build
```

This produces a portable `.exe` in the `release/` directory.

## How Skin Generation Works

RiftChanger can generate fantome skin mods without needing the game files:

1. **Fetches skin bin files** from [Community Dragon](https://communitydragon.org/) (`data/characters/<champ>/skins/skinN.bin`)
2. **Packs the bin** into a WAD file using xxhash-wasm for path hashing, remapping `skinN` → `skin0` (the base skin slot)
3. **Wraps in fantome format** — a ZIP containing `META/info.json` + `WAD/<Champion>.wad.client`
4. **Organizes output** by champion, with chromas in subdirectories

This means skins can be regenerated per-patch to stay compatible with game updates.

## Tech Stack

- **Electron** — Desktop framework
- **React** — UI library
- **Vite** — Build tool
- **TypeScript** — Type safety
- **Tailwind CSS** — Styling
- **xxhash-wasm** — WAD path hashing

## Project Structure

```
RiftChanger/
├── electron/              # Main process
│   ├── main.ts            # Window + IPC handlers
│   ├── preload.ts         # Context bridge API
│   └── services/
│       ├── skinScanner.ts    # Scan & validate skin ZIPs
│       ├── skinGenerator.ts  # Generate skins from CDragon
│       ├── assetService.ts   # Data Dragon / CDragon API
│       ├── gameDetector.ts   # Find LoL installation
│       ├── cslolService.ts   # CSLoL Manager integration
│       └── backupService.ts  # Backup/restore
├── src/                   # Renderer (React + Vite)
│   ├── pages/             # Dashboard, Champions, Settings, Logs
│   └── components/        # Layout, Sidebar, Titlebar
└── package.json
```

## Credits

- [Community Dragon](https://communitydragon.org/) — Skin bin files and chroma data
- [CSLoL Manager](https://github.com/LeagueToolkit/cslol-manager) — Skin injection engine
- [Riot Data Dragon](https://developer.riotgames.com/docs/lol#data-dragon) — Champion and skin metadata

## License

MIT
