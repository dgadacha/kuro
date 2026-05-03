<p align="center">
  <img src="seanime-web/public/kuro-logo.svg" alt="Kuro" width="96"/>
</p>

<h1 align="center">Kuro</h1>

<p align="center">
  A Netflix-style anime streaming app — French-first, no clutter, no local library required.
  <br/>
  <em>Fork of <a href="https://github.com/5rahim/seanime">Seanime</a>.</em>
</p>

---

## What it is

Self-hosted web app to discover, track and watch anime, with the visual language of Netflix. Stream from online sources or via torrent, sync your progress to AniList, watch offline.

## What's different from Seanime

This fork strips everything that doesn't fit a "watch anime quickly" use case:

- **Removed** — manga (entirely), the local-file scanner and library, the full torrent client (qBittorrent / Transmission), the auto-downloader, MyAnimeList sync, the schedule view, the Electron desktop client, all the related settings.
- **Reworked** — Netflix-style top bar (transparent over hero, opaque on scroll), Netflix-style home with hero + horizontal rows including "Continue watching", grid-based My Lists & Search, a flat brand-red theme on pure black.
- **Added** — bilingual French / English toggle, FR-first defaults, a one-command Makefile.

## Stack

- **Backend**: Go 1.23+ — Echo, GORM/SQLite, Goja (JS extensions), torrent client for streaming.
- **Frontend**: React + Tanstack Router + Tailwind, bundled with Rsbuild.
- **API ↔ UI**: REST with codegen-typed hooks, WebSocket for events.

## Install

### Prerequisites
- Go 1.23+
- Node.js 18+ + npm
- ffmpeg (for transcoding)

### Dev

```sh
make dev
```

First run installs npm deps, writes `~/.seanime-data/config.toml`, starts the Go backend (port `43211`) and the rsbuild dev server (port `43210`) in parallel. `Ctrl+C` stops both.

Open <http://127.0.0.1:43210>.

### Production build

```sh
make build   # produces ./seanime binary with embedded web UI
make run     # build then launch
```

### Other targets

```sh
make help    # list everything
make clean   # remove build artifacts (keeps your data dir)
```

Override defaults inline: `make dev DATADIR=/tmp/kuro PORT=43211`.

## First-time setup

1. Authenticate with AniList from the profile dropdown (top-right avatar). Required for "Continue watching" and progress sync.
2. **Extensions → Marketplace** — install at least one streaming source. For French content: search `anime-sama` (online streaming), `nyaa` (torrent search, filter by `VOSTFR` / `VF`).
3. **Settings → Online streaming** — enable.
4. Pick an anime → it lands on the **Online streaming** tab by default → choose your provider once and it sticks per-anime.

## Project layout

```
.
├── main.go                 # thin Go entrypoint
├── internal/               # backend modules (handlers, plugin runtime, torrent, …)
├── seanime-web/            # frontend (React + Rsbuild)
│   └── src/app/(main)/_features/netflix/   # the Kuro-specific UI
├── codegen/                # generates TS types/hooks from Go handlers
├── Makefile                # dev / build / run / clean
└── web/                    # built frontend, embedded into the Go binary at build
```

The Netflix-themed UI lives almost entirely in `seanime-web/src/app/(main)/_features/netflix/`. Translations are in `seanime-web/src/lib/i18n/locales/{en,fr}.json`.

## Credits & license

Kuro is a fork of [5rahim/seanime](https://github.com/5rahim/seanime) — all the heavy lifting (the Go server, the plugin runtime, the AniList client, the torrent streamer) is theirs.

Released under the same license as the upstream project — see [LICENSE](LICENSE).
