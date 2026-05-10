<p align="center">
  <img src="seanime-web/public/kuro-logo.svg" alt="Kuro" width="96"/>
</p>

<h1 align="center">Kuro</h1>

<p align="center">
  A Netflix-style anime streaming app — French-first, no clutter, no local library required.
  <br/>
  <em>Fork of <a href="https://github.com/5rahim/seanime">Seanime</a>.</em>
</p>

<p align="center">
  <a href="https://github.com/dgadacha/kuro"><img alt="GitHub" src="https://img.shields.io/badge/GitHub-dgadacha%2Fkuro-181717?logo=github"/></a>
  &nbsp;
  <a href="https://gitlab.com/kidnar/kuro"><img alt="GitLab" src="https://img.shields.io/badge/GitLab-kidnar%2Fkuro-FC6D26?logo=gitlab"/></a>
  &nbsp;
  <a href="https://kuro.nc-maiz.org"><img alt="Demo" src="https://img.shields.io/badge/demo-kuro.nc--maiz.org-E50914"/></a>
</p>

> Source mirrored on both GitHub (<code>dgadacha/kuro</code>) and GitLab
> (<code>kidnar/kuro</code>) — same `main` branch, push lands on both.
> The container registry lives under the GitLab project:
> <code>registry.gitlab.com/kidnar/kuro</code>.

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

## Architecture

### Runtime topology

```
                                       ┌───────────────────────────────────┐
                                       │  Cloudflare edge (TLS, DDoS, WAF) │
  Browser ── HTTPS ────────────────────►│   kuro.nc-maiz.org → CNAME →     │
                                       │   <tunnel-id>.cfargotunnel.com    │
                                       └────────────────┬──────────────────┘
                                                        │ outbound-only
                                                        │ encrypted tunnel
                                                        ▼
                          ┌───────────────────────────────────────────┐
                          │  k3s cluster (single control-plane node)  │
                          │                                           │
                          │  ┌────────────────┐    ┌─────────────────┐│
                          │  │  cloudflared   │───►│  kuro Service   ││
                          │  │  Deployment    │    │   :80 → :43211  ││
                          │  │  (2 replicas)  │    └────────┬────────┘│
                          │  └────────────────┘             │         │
                          │                                 ▼         │
                          │                   ┌─────────────────────┐ │
                          │                   │  kuro Deployment    │ │
                          │                   │  init: write config │ │
                          │                   │  ───────────────    │ │
                          │                   │  /app/seanime       │ │
                          │                   │  bind 0.0.0.0:43211 │ │
                          │                   │  embedded React UI  │ │
                          │                   │  GORM + SQLite      │ │
                          │                   │  Goja JS extensions │ │
                          │                   └──────────┬──────────┘ │
                          │                              │             │
                          │                              ▼             │
                          │                   ┌─────────────────────┐ │
                          │                   │  PVC kuro-data      │ │
                          │                   │  /data (5 Gi RWO)   │ │
                          │                   │   ├ seanime.db      │ │
                          │                   │   ├ config.toml     │ │
                          │                   │   ├ extensions/     │ │
                          │                   │   ├ assets/         │ │
                          │                   │   └ cache/          │ │
                          │                   └─────────────────────┘ │
                          └───────────────────────────────────────────┘
```

The cluster never opens an inbound port to the public internet — Cloudflare's
tunnel daemon (running inside the cluster) dials *outbound* to Cloudflare's
edge and pulls traffic in from there. The included `k8s/ingress.yaml` is a
plain Traefik ingress for in-LAN access (`kuro.maiz.local`); public traffic
needs the tunnel config (out-of-tree, see "Public exposure" below).

### Container image

Multi-stage build (`Dockerfile`):

| Stage | Base | Purpose | Output |
|---|---|---|---|
| 1. `web-builder` | `node:20-bookworm-slim` | Install npm deps, run `rsbuild build` (skipping `tsgo` — see "Known traps" below) | `/app/seanime-web/out/` |
| 2. `go-builder`  | `golang:1.26-bookworm`   | `go mod download`, copy stage-1 output into `./web/`, `CGO_ENABLED=1 go build -trimpath -ldflags="-s -w"` | `/out/seanime` (single binary, ~50 MB) |
| 3. *runtime*     | `debian:bookworm-slim`   | `ca-certificates`, `tzdata`, non-root `kuro` user (uid 999), `EXPOSE 43211`, `VOLUME /data` | ~241 MB image |

CGO is required because `mattn/go-sqlite3` links against the system SQLite —
hence the Debian-slim runtime instead of `scratch`. The frontend is embedded
into the Go binary via `//go:embed all:web` so the runtime image only needs
the binary (no `nginx`, no static-file server).

### Data persistence

Everything user-specific lives under `/data` (the PVC mount in k8s, a host
volume in plain `docker run`):

| Path | Owner | What |
|---|---|---|
| `/data/seanime.db` | GORM | AniList account/token, themes, settings, plugin data, **kuro_profiles**, **kuro_profile_watch_histories** |
| `/data/config.toml` | seanime | Server bind, secure mode, allowlist, external URL |
| `/data/extensions/` | seanime + user | Installed JS extensions (manifests + payloads). Two slots: built-in + external |
| `/data/assets/` | seanime | Cached cover images, banners, avatars |
| `/data/cache/` | seanime | API response cache, transcode cache |
| `/data/logs/` | seanime | Server log rotation |

The k8s `initContainer` rewrites the `[server]` block of `config.toml` on
every pod start so the manifest is the source of truth for `host`, `port`,
`secureMode`, `externalURL` and `accessAllowlist`. **Don't edit `config.toml`
on the PVC** — your changes will be reverted at the next rollout. Edit
`k8s/deployment.yaml` instead.

### Security boundary

seanime ships a `secureMode` setting that gates passwordless API access:

- `""` (default, "baseline") — only requests from trusted local origins
  (`127.0.0.1`, `localhost`, private network) are allowed without a password.
- `"hardened"` — stricter origin + Sec-Fetch-Site checks; doesn't accept
  cross-site browser requests at all.
- `"strict"` — `hardened` + extra restrictions on certain endpoints.
- `"lax"` — disables the boundary entirely. **Required when serving over
  Cloudflare Tunnel** because the request's origin is the tunnel pod, not
  loopback. The included `k8s/deployment.yaml` sets this.

If you want a stricter posture for a public deployment, three options:

1. Set a `password` in the `[server]` block — UI prompts on first visit.
2. Put Cloudflare Access in front (Zero Trust, free up to 50 users).
3. Bind a dedicated subdomain to a private network access only (Tailscale
   serve, ZeroTier, …) and keep the tunnel for the family.

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

```sh
docker build -t kuro:latest .                # ~5-10 min on a cold cache
docker run -d --name kuro \
  -p 43211:43211 \
  -v kuro-data:/data \
  -e TZ=Pacific/Noumea \
  kuro:latest
```

The image starts the binary as `/app/seanime --datadir=/data`, which:
1. Reads `/data/config.toml` (creating one on first run with default
   `host=127.0.0.1 port=43211` — bind override needed for k8s, see below).
2. Auto-migrates the SQLite schema on `/data/seanime.db`.
3. Loads installed JS extensions from `/data/extensions/`.
4. Serves the embedded React UI + REST API on the configured bind.

Bind override (so the container is reachable from outside the network namespace):

```sh
docker run -d --name kuro \
  -p 43211:43211 \
  -v kuro-data:/data \
  -e SEANIME_SERVER_HOST=0.0.0.0 \
  kuro:latest
```

### Kubernetes

```sh
kubectl apply -f k8s/namespace.yaml          # ns/kuro
kubectl apply -f k8s/pvc.yaml                # 5 Gi RWO PVC
kubectl apply -f k8s/deployment.yaml         # 1 replica (Recreate strategy)
kubectl apply -f k8s/service.yaml            # ClusterIP 80 → 43211
kubectl apply -f k8s/ingress.yaml            # Traefik LAN (kuro.maiz.local)
```

`Recreate` (not `RollingUpdate`) because SQLite + RWO PVC = single writer at a
time. The init container is responsible for the canonical `[server]` block —
edit it there, never on the PVC.

If pulling from a private GitLab registry, create the imagePullSecret first:

```sh
kubectl create secret -n kuro docker-registry gitlab-registry \
  --docker-server=registry.gitlab.com \
  --docker-username=<your-gitlab-user-or-deploy-token-name> \
  --docker-password=<glpat-... or deploy-token-password>
```

#### Public exposure

The included ingress is **internal-only** (LAN). Public exposure is one of:

**A. Cloudflare Tunnel** (recommended — what `kuro.nc-maiz.org` uses):

1. In your `cloudflared` configmap, add an ingress rule:
   ```yaml
   ingress:
     - hostname: kuro.example.com
       service: http://kuro.kuro.svc.cluster.local:80
     - service: http_status:404
   ```
2. In Cloudflare DNS, add a CNAME `kuro` → `<tunnel-id>.cfargotunnel.com`
   (proxied 🟠).
3. **Important**: `secureMode = "lax"` in `k8s/deployment.yaml` is required
   so seanime's request boundary doesn't reject the tunnel-originated traffic.

**B. cert-manager + LetsEncrypt ingress** — annotate `k8s/ingress.yaml` with
`cert-manager.io/cluster-issuer: letsencrypt-prod`, swap the host to your
real domain, point your A record at the cluster's external IP.

**C. Plain reverse proxy** (nginx/Caddy on the host) — `proxy_pass` to the
Service's NodePort or the pod IP.

#### Useful kubectl

```sh
# tail logs
kubectl -n kuro logs -l app=kuro -c kuro --tail=200 -f

# rollout a fresh image (after `docker push`)
kubectl -n kuro rollout restart deployment/kuro
kubectl -n kuro rollout status   deployment/kuro

# inspect persisted state without entering the pod
kubectl -n kuro exec deploy/kuro -- /app/seanime --version
```

### Other targets

```sh
make help    # list everything
make clean   # remove build artifacts (keeps your data dir)
```

Override defaults inline: `make dev DATADIR=/tmp/kuro PORT=43211`.

### Environment variables

| Var | Default | Effect |
|---|---|---|
| `SEANIME_DATA_DIR` | `~/.seanime-data` (dev), `/data` (container) | Datadir override; flag `--datadir` takes precedence. |
| `SEANIME_SERVER_HOST` | `127.0.0.1` | Bind host. Set to `0.0.0.0` in containers. |
| `SEANIME_SERVER_PORT` | `43211` | Bind port. **Don't change** — community extensions hardcode `127.0.0.1:43211/api/v1/proxy`. |
| `TZ` | `UTC` | Timezone for log timestamps + scheduled refreshes. |

CLI flags override env vars; env vars override `config.toml`.

### API reference (Kuro-specific endpoints)

The Kuro fork adds one route group on top of the upstream Seanime API. Full
Seanime endpoint reference: see `internal/handlers/routes.go`.

```
GET    /api/v1/kuro-profiles                         List all profiles
POST   /api/v1/kuro-profiles                         Create — body {uid,name,avatar,color}
PATCH  /api/v1/kuro-profiles/:uid                    Update — body {name?,avatar?,color?}
DELETE /api/v1/kuro-profiles/:uid                    Delete (cascades history)

GET    /api/v1/kuro-profiles/:uid/history            List watch history (most-recent first)
PUT    /api/v1/kuro-profiles/:uid/history            Upsert one (mediaId, episode) row
POST   /api/v1/kuro-profiles/:uid/history            Same as PUT — for navigator.sendBeacon
DELETE /api/v1/kuro-profiles/:uid/history            Wipe profile's history
DELETE /api/v1/kuro-profiles/:uid/history/:mediaId   Drop all episodes of a series
DELETE /api/v1/kuro-profiles/:uid/history/:mediaId/episode/:episodeNumber
                                                     Drop a single episode row
```

Response shape (always wrapped in `{ "data": ... }`):

```jsonc
{ "id":1, "uid":"…", "name":"…", "avatar":"📺", "color":"#E50914",
  "createdAt":"…", "updatedAt":"…" }

{ "id":1, "profileUid":"…", "mediaId":21, "episodeNumber":3,
  "currentTime":482.7, "duration":1409, "createdAt":"…", "updatedAt":"…" }
```

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

Source code mirrored on:
- GitHub — [dgadacha/kuro](https://github.com/dgadacha/kuro)
- GitLab — [kidnar/kuro](https://gitlab.com/kidnar/kuro) (also hosts the `registry.gitlab.com/kidnar/kuro` container image)

Released under the same license as the upstream project — see [LICENSE](LICENSE).
