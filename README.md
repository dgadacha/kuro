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

Self-hosted web app to discover, track and watch anime, with the visual language of Netflix. Stream from online sources, sync your progress to AniList, manage multiple watcher profiles like the real thing.

## What's different from Seanime

This fork strips everything that doesn't fit a "watch anime quickly" use case:

- **Removed** — manga (entirely), the local-file scanner and library, the full torrent client (qBittorrent / Transmission) and torrent-streaming surface, the auto-downloader, MyAnimeList sync, the schedule view, the Electron desktop client, all the related settings.
- **Reworked** — Netflix-style top bar (transparent over hero, opaque on scroll), Netflix-style home with hero + horizontal rows including "Continuer à regarder", grid-based My Lists & Search, a flat brand-red theme on pure black.
- **Added** — bilingual French / English toggle (FR-first), Netflix-style multi-profile picker with per-profile watch history persisted in SQLite, deploy stack (Dockerfile + Kubernetes manifests), DeepL translation of AniList descriptions, a one-command Makefile.

## Stack

- **Backend**: Go 1.26 — Echo, GORM/SQLite, Goja (JS extensions). Single binary with the React build embedded via `//go:embed`.
- **Frontend**: React + TanStack Router + Tailwind, bundled with Rsbuild. State via Jotai + React Query.
- **API ↔ UI**: REST with codegen-typed hooks, WebSocket for events.
- **Deploy**: Dockerfile (multi-stage Node → Go → Debian-slim) + k8s manifests (namespace / deployment / svc / ingress / pvc).

## Install

### Prerequisites
- Go 1.26+
- Node.js 20+ + npm
- ffmpeg (for transcoding)

### Dev

```sh
make dev
```

First run installs npm deps, writes `~/.seanime-data/config.toml`, starts the Go backend (port `43211`) and the rsbuild dev server (port `43210`) in parallel. `Ctrl+C` stops both.

Open <http://127.0.0.1:43210>.

### Production build (single binary)

```sh
make build   # produces ./seanime binary with embedded web UI
make run     # build then launch
```

### Container build

A multi-stage `Dockerfile` is included. The runtime image is `debian:bookworm-slim` (~241 MB) and runs as the non-root `kuro` user (uid 999).

```sh
docker build -t kuro:latest .
docker run -d --name kuro \
  -p 43211:43211 \
  -v kuro-data:/data \
  kuro:latest
```

Datadir defaults to `/data`. Mount a host volume or PVC there to persist the SQLite DB, profile data, watch history, configured extensions and the AniList token.

### Kubernetes

`k8s/` ships ready-to-apply manifests for a single-replica deployment (the SQLite DB lives on a `ReadWriteOnce` PVC). Edit the image reference in `k8s/deployment.yaml` if you push to your own registry.

```sh
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/pvc.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml      # internal Traefik ingress (kuro.maiz.local)
```

Public exposure is up to you — Cloudflare Tunnel and a CNAME pointing at `<tunnel-id>.cfargotunnel.com` works well; a `cert-manager` + LetsEncrypt ingress works too. The included ingress is internal-only.

The `initContainer` in `deployment.yaml` rewrites the `[server]` block of `config.toml` on every start so changes live in the manifest, not on the PVC. Tune `secureMode`, `externalURL` and `accessAllowlist` there.

### Other targets

```sh
make help    # list everything
make clean   # remove build artifacts (keeps your data dir)
```

Override defaults inline: `make dev DATADIR=/tmp/kuro PORT=43211`.

## First-time setup

1. Authenticate with AniList from the profile dropdown (top-right avatar). Required for the home rows and progress sync.
2. **Extensions → Marketplace** — install at least one streaming source. For French content: search `anime-sama` and `french-anime`.
3. **Settings → Online streaming** — enable.
4. Pick an anime → it lands on the **Online streaming** tab by default → choose your provider once and it sticks per-anime.
5. *(optional)* **Avatar → Activer les profils** — Netflix-style picker. Each profile gets its own watch history backed by SQLite.

## Project layout

```
.
├── main.go                                          # thin Go entrypoint
├── Dockerfile                                       # multi-stage build
├── .dockerignore
├── k8s/                                             # ready-to-apply manifests
│   ├── namespace.yaml · pvc.yaml · deployment.yaml
│   └── service.yaml   · ingress.yaml
├── internal/
│   ├── handlers/                                    # all REST handlers
│   │   ├── kuro_profile.go                          # NEW · /api/v1/kuro-profiles
│   │   └── routes.go                                # routes registry
│   └── database/
│       ├── models/models.go                         # KuroProfile + KuroProfileWatchHistory
│       └── db/kuro_profile.go                       # NEW · CRUD for both
├── seanime-web/                                     # frontend (React + Rsbuild)
│   └── src/
│       ├── app/(main)/
│       │   ├── _features/netflix/                   # Netflix-style UI
│       │   │   ├── netflix-home.tsx
│       │   │   ├── netflix-hero.tsx
│       │   │   ├── netflix-row.tsx
│       │   │   ├── netflix-card.tsx
│       │   │   ├── netflix-detail-modal.tsx
│       │   │   ├── netflix-continue-watching.tsx    # per-profile or legacy
│       │   │   ├── netflix-profile-picker.tsx       # "Qui regarde ?"
│       │   │   ├── netflix-profile-history-saver.tsx
│       │   │   └── netflix-top-bar.tsx
│       │   └── profiles/page.tsx
│       └── lib/profiles/profiles.ts                 # profile types + API hooks
├── codegen/                                         # generates TS types/hooks from Go
├── Makefile                                         # dev / build / run / clean
└── web/                                             # built frontend, embedded into the binary
```

The Netflix-themed UI lives almost entirely in `seanime-web/src/app/(main)/_features/netflix/`. Translations are in `seanime-web/src/lib/i18n/locales/{en,fr}.json`.

## Profiles (Netflix-style)

A user can register up to 6 profiles. Each profile owns its watch history (per `(profile_uid, mediaId)`); the AniList account, server settings and extensions are shared across profiles by design.

- Persistence: SQLite, on the same datadir / PVC as the rest of the app.
- Tables: `kuro_profiles`, `kuro_profile_watch_histories`.
- API: `GET|POST /api/v1/kuro-profiles`, `PATCH|DELETE /api/v1/kuro-profiles/:uid`, `GET|PUT /api/v1/kuro-profiles/:uid/history`, `DELETE /api/v1/kuro-profiles/:uid/history/:mediaId`.
- Active-profile selection (which profile is "current" in this browser tab) lives in `localStorage["kuro-active-profile"]` — the only thing not in the DB, because it's a UI preference, not shared state.

When no profile is active the app degrades to single-user mode and reads the legacy `/api/v1/continuity/history` endpoint, so existing users see no break.

## Credits & license

Kuro is a fork of [5rahim/seanime](https://github.com/5rahim/seanime) — all the heavy lifting (the Go server, the plugin runtime, the AniList client) is theirs.

Released under the same license as the upstream project — see [LICENSE](LICENSE).
