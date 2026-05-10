# Kuro — Claude context

This repo is a **fork of [seanime](https://github.com/5rahim/seanime)** rebranded
as **Kuro**, reshaped to look and feel like Netflix. The user (Dylan) is
French-speaking — **respond in French unless asked otherwise**.

The frontend is the primary battleground. The Go backend has been only
surface-trimmed (handler files + routes); deeper Go cleanup is deferred — except
for the Kuro-specific additions (Netflix profiles), which are real Go code.

---

## Repo / git

- **Origin remote** = upstream seanime (`5rahim/seanime`). Don't push to it.
- **`kuro` remote** (GitHub) = the user's fork at <https://github.com/dgadacha/kuro>.
- **`kuro-gitlab` remote** (GitLab) = mirror at <https://gitlab.com/kidnar/kuro>.
  Same project the docker registry lives under, so source + image are co-located.
- **Push to BOTH after every commit:** `git push kuro main && git push kuro-gitlab main`.
  Forgetting one means the user has to ask. The GitLab remote URL embeds a
  glpat token (visible via `git remote -v`); when rotating the token, update
  the URL with `git remote set-url kuro-gitlab https://oauth2:NEW@gitlab.com/kidnar/kuro.git`.
- Commits use `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` per
  the harness convention. Use `git commit -m "$(cat <<'EOF' … EOF)"` HEREDOC pattern.
- Push after each meaningful milestone (the user expects to see progress on
  both GitHub and GitLab).
- Branch: `main`. **Force-push is disabled on the GitLab `main`** (protected
  branch). If histories diverge, use `git pull --allow-unrelated-histories
  -X ours kuro-gitlab main --no-edit` to merge then push.

## How to run

### Local dev
```sh
make dev        # backend (43211) + frontend dev (43210), Ctrl+C stops both
make build      # builds web → moves to web/, builds Go binary
make run        # build then launch
make clean      # nuke artifacts (datadir untouched)
```

The Makefile lives at the **root**. Datadir defaults to `~/.seanime-data`. First
run auto-writes `config.toml` and auto-rewrites the port if it's not 43211.

### Container / k8s deploy
```sh
docker build -t registry.gitlab.com/kidnar/kuro:latest .
docker push   registry.gitlab.com/kidnar/kuro:latest
kubectl -n kuro rollout restart deployment/kuro
```

`Dockerfile` is multi-stage (Node 20 → Go 1.26 → Debian-slim, ~241 MB).
`.dockerignore` keeps node_modules / web/ / .git out of the build context.
`k8s/*.yaml` ships namespace + pvc + deployment + svc + ingress. Public traffic
goes through Cloudflare Tunnel (config in the `cloudflared` ns on the cluster);
the included ingress is internal Traefik (`kuro.maiz.local`).

## Critical port note

**Backend MUST run on `43211`.** Community extensions (Anime-Sama, Hianime, etc.)
hardcode `http://127.0.0.1:43211/api/v1/proxy` for cross-origin fetches. We
already moved off the original 43000 because of this; do not move it back.

If the Go config has been edited manually, `make init-config` will sed it back.
The k8s deployment's `initContainer` rewrites the `[server]` block on every
pod start so the manifest is the source of truth (host, port, secureMode,
externalURL, accessAllowlist).

## Architecture

```
.
├── main.go                                    # 16-line Go entrypoint
├── Dockerfile · .dockerignore                 # container build
├── k8s/                                       # ready-to-apply manifests
│   ├── namespace.yaml · pvc.yaml · deployment.yaml
│   └── service.yaml   · ingress.yaml
├── internal/
│   ├── handlers/                              # all REST routes registered here
│   │   ├── routes.go
│   │   └── kuro_profile.go                    # ★ /api/v1/kuro-profiles handlers
│   └── database/
│       ├── db/db.go                           # AutoMigrate list — KuroProfile* added
│       ├── db/kuro_profile.go                 # ★ profile + history CRUD
│       └── models/models.go                   # ★ KuroProfile + KuroProfileWatchHistory
├── seanime-web/
│   ├── src/
│   │   ├── app/(main)/                        # the app, route-group root
│   │   │   ├── _features/netflix/             # ★ all Kuro-specific UI
│   │   │   │   ├── netflix-top-bar.tsx        # fixed nav, transparent → opaque on scroll
│   │   │   │   ├── netflix-home.tsx           # hero + 7 rows incl. Continue Watching
│   │   │   │   ├── netflix-hero.tsx           # 85vh banner, slideshow, Lecture / Plus d'infos
│   │   │   │   ├── netflix-row.tsx            # horizontal scroller (NetflixRowShell shared)
│   │   │   │   ├── netflix-card.tsx           # 16:9 thumb, variant: "row" | "grid"
│   │   │   │   ├── netflix-lists.tsx          # /lists page
│   │   │   │   ├── netflix-search.tsx         # /search page
│   │   │   │   ├── netflix-more-like-this.tsx # entry page recs
│   │   │   │   ├── netflix-detail-modal.tsx   # click on card → modal
│   │   │   │   ├── netflix-continue-watching.tsx       # per-profile (or legacy fallback)
│   │   │   │   ├── netflix-profile-picker.tsx          # "Qui regarde ?"
│   │   │   │   ├── netflix-profile-history-saver.tsx   # 5s poll on /watch
│   │   │   │   ├── use-slideshow.ts           # paused on hover/hidden tab/reduced-motion
│   │   │   │   └── netflix.constants.ts       # sizes, intervals, format labels
│   │   │   ├── _features/layout/main-layout.tsx   # renders NetflixTopBar + useProfileGate
│   │   │   ├── profiles/page.tsx              # ★ /profiles route
│   │   │   ├── settings/page.tsx              # tabs translated, Denshi tab removed
│   │   │   └── …
│   │   ├── components/shared/
│   │   │   └── language-switcher.tsx          # FR | EN pill, in nav profile dropdown
│   │   ├── lib/
│   │   │   ├── i18n/                          # init react-i18next (default FR)
│   │   │   ├── profiles/profiles.ts           # ★ profile types + API hooks (jotai+RQ)
│   │   │   └── server/config.ts               # __DEV_SERVER_PORT = 43211
│   │   ├── routes/_main/profiles/             # ★ TanStack Router files for /profiles
│   │   └── routes/_main.tsx                   # adds pt-16 lg:pt-[68px] under fixed nav
│   ├── public/kuro-logo.svg                   # the K logo (Netflix red on dark)
│   └── package.json                           # only `dev` / `build` / `preview` scripts
├── codegen/                                   # Go-side type/hook generator
├── Makefile                                   # ★ user-facing entry (dev/build/run/clean)
└── README.md                                  # Kuro README, no upstream branding
```

## What was changed vs. upstream Seanime

A series of waves, all already pushed to `kuro/main`:

1. **Netflix UI base** — palette to red (`#E50914`), pure-black background, hero,
   horizontal rows, hover-zoom 16:9 cards, top bar that fades on scroll, profile
   dropdown.
2. **Removed manga entirely** — frontend routes/components/hooks gone, backend
   handler files for manga deleted, route registrations stripped. Internal Go
   `internal/manga/*` package **still on disk** because `internal/core/app.go`,
   `internal/plugin/*`, `internal/local/*` etc. import it. Touching that needs
   `go build` available to iterate.
3. **Removed scanner-bound features** — auto-downloader, qBittorrent/Transmission
   client, scan-summaries, library-explorer, sync (all backend handlers + frontend
   UI gone). Underlying Go packages (`internal/library/*`, `internal/torrent_clients/*`)
   left intact for the same reason.
4. **Removed schedule** — `/schedule` route + page deleted. `RecentReleases`
   container kept (still used by `/discover`).
5. **Removed Electron desktop client** — `seanime-denshi/` folder deleted entirely
   (~5900 LOC), `.env.{denshi,desktop,mobile,…}` deleted, npm scripts pruned.
   **`_electron/` and `native-player/` folders kept** — they're guarded by
   `__isElectronDesktop__` which evaluates to `false` in the web build, so dead
   branches that the bundler tree-shakes. Editing the 45 files referencing them
   wasn't worth the churn.
6. **Rebranded everywhere** — UI strings "Seanime" → "Kuro" via word-boundary
   perl. **Preserved on purpose**: HTTP headers `X-Seanime-Token`,
   `X-Seanime-Client-Id*` and the field name `richPresenceHideSeanimeRepositoryButton`
   — they're wire-protocol identifiers shared with the unmodified Go backend.
7. **i18n** — `react-i18next` + `i18next-browser-languagedetector`, FR default,
   localStorage key `kuro-lng`. Only the high-visibility surfaces are translated
   (nav, home, lists, search, settings tabs, onboarding, profiles). Long-tail
   (settings form help texts, modals, plugin UI) is still English.
8. **Onboarding** — 5 steps → 3 (Player, Debrid, Features). Library + Torrent
   Client steps dropped. CTA "Lancer Kuro".
9. **Entry page** — Characters + Relations sections gone. Replaced by
   `NetflixMoreLikeThis` (just recommendations, Netflix-style grid).
   `__anime_entryPageViewAtom` defaults to `"onlinestream"` so the right tab is
   pre-selected. Header trimmed (no more "#X Highest Rated of All Time" badges).
10. **Continue Watching row** — pre-row above Trending. Reads either the active
    profile's history (if a profile is selected) or the legacy
    `/api/v1/continuity/history` (single-user mode). New tab from a card → /watch
    splash with `?t=<resume seconds>`, player seeks on first canplay.
11. **Splash on /watch** — pre-play screen with a single "Lancer la lecture"
    button that doubles as the user-gesture browsers need to start an autoplay
    in a new tab.
12. **★ Netflix-style profiles** (server-backed) — picker page at `/profiles`,
    cap at 6 profiles, 24-emoji + 8-color palette, layout-level gate
    (`useProfileGate` in main-layout) that redirects to /profiles when a
    profile-having user has none active. /watch is exempt from the gate.
    Per-profile watch history is upserted server-side every 5s by
    `<NetflixProfileHistorySaver>` mounted on /watch.
13. **★ Container + k8s deploy** — `Dockerfile` (multi-stage Node→Go→Debian-slim,
    ~241 MB), `.dockerignore`, full `k8s/` set. The deployment's `initContainer`
    is the source of truth for the `[server]` block of `config.toml` (since the
    PVC mount shadows the image's pre-seed); change `secureMode`, `externalURL`,
    `accessAllowlist` there, never on the PVC.

## Profiles — implementation notes

- **Tables**: `kuro_profiles` (uid, name, avatar, color) and
  `kuro_profile_watch_histories` (composite UNIQUE on `(profile_uid, media_id)`).
  AutoMigrate'd alongside seanime's existing models.
- **API**: `GET|POST /api/v1/kuro-profiles`, `PATCH|DELETE …/:uid`,
  `GET|PUT …/:uid/history`, `DELETE …/:uid/history/:mediaId`. The frontend
  generates the `uid` (uuid) so a profile switch is local — no round-trip to
  read back an auto-id.
- **Active profile** lives in `localStorage["kuro-active-profile"]` — that's a
  UI preference (which profile is current in this browser tab), NOT shared
  state. Everything else (profile data + watch history) is in SQLite.
- **History saver** = `<NetflixProfileHistorySaver>`, mounted on /watch, polls
  the live `<video>` every 5s + on `pagehide`/`beforeunload`. Decoupled from
  video-core internals on purpose — it just queries `document.querySelector("video")`.
- **Continue Watching** reads the per-profile history when a profile is active,
  falls back to seanime's `/api/v1/continuity/history` when none is. Both modes
  render through the same `ResumeCard`.
- **Layout gate** = `useProfileGate()` in `main-layout.tsx`. 0 profiles → no
  gate (single-user mode preserved); 1+ profiles + none selected → redirect
  to /profiles. /watch, /auth, /offline and /profiles are carve-outs.

## Conventions / preferences

- **Language**: French in chat. UI strings: see `seanime-web/src/lib/i18n/locales/`.
- **Length**: keep responses tight, no fluff. The user gives short directives,
  expects brief acknowledgments + the actual change.
- **Commits**: incremental, one logical change per commit, push after each.
  Stack of 30+ commits already on `kuro` branch.
- **Branch hygiene**: never force-push, never edit `origin` (upstream).
- **Verification**: there's no `go build` / `npm install` available in the agent
  environment. The user runs `make dev` and screenshots errors. I find + fix.
  For the deployed instance, `kubectl logs -n kuro -l app=kuro` from the salon
  node is the fastest debug path.
- **Permissions**: `Bash(rm …)` in the user's repo is OK because everything is
  versioned. But never delete files outside this repo and never `git reset --hard`.

## Deploy infrastructure (the salon node — `192.168.1.3`)

- **Cluster**: k3s on a single control-plane node (`salon`), 2 worker nodes
  (`home1`, `home2`) currently NotReady. Workloads land on salon.
- **Ingress**: Traefik (k3s default). Public traffic proxied through a
  Cloudflare Tunnel (deploy in `cloudflared` namespace, configmap
  `cloudflared-config`). Tunnel id `a50ddbf0-d268-486b-a23d-6052a8e44752`.
- **DNS**: Cloudflare zone `nc-maiz.org`, CNAMEs for each subdomain pointing at
  `<tunnel>.cfargotunnel.com` (proxied 🟠).
- **Registry**: GitLab — `registry.gitlab.com/kidnar/kuro` (Kuro itself),
  `registry.gitlab.com/kidnar/facturaction/{backend,frontend,portal}` (the
  facturation app + the portal homepage at `appli.nc-maiz.org`).
- **Filesystem layout on salon**:
  - `/appli/kuro/` — git clone + Dockerfile + k8s/, deployed source. Pulled
    fresh from GitHub on each deploy iteration.
  - `/appli/Facturation/` — facturation app source (capital F).
  - `/appli/website/homepage/` — the portal app at appli.nc-maiz.org. Has a
    seeded `kuro` entry in its app DB (seed lives in the portal's `server.js`,
    pushed under `registry.gitlab.com/kidnar/facturaction/portal:latest`).
- **Cluster boundary on Kuro**: `secureMode = "lax"` is set in
  `k8s/deployment.yaml` because seanime's default boundary blocks any request
  not from a "trusted local origin", which kills the public Cloudflare-tunneled
  domain. If you want to harden: switch to `secureMode = "hardened"` and either
  set a `password` in the [server] block (then UI prompts on first visit) or
  use Cloudflare Access.

## Known traps

- **Hero / navbar overlap** — `NetflixTopBar` is `position: fixed`. Pages get
  `pt-16 lg:pt-[68px]` from `_main.tsx`. `NetflixHome` opts out with
  `-mt-16 lg:-mt-[68px]` on the hero so it lives flush behind the transparent nav.
  Don't change one without the other.
- **Card hover** — `NetflixCard` uses `hover:scale-[1.03]`. In a CSS grid the
  scale visually clips into adjacent cells unless the grid has vertical room.
  All Kuro grids use `gap-x-4 gap-y-6 py-2`. Stick to that.
- **TextInput leftIcon** — applies `pl-12` only at `size="lg"`. If you override
  with `px-N` you'll erase the left padding and the placeholder slides under
  the icon. See `netflix-search.tsx` for the right pattern (`size="lg"` +
  explicit `!pl-14 !pr-6`).
- **Dead code that's NOT dead** — `_features/anime-library/` and several other
  files look unused at first glance but provide types/atoms imported across the
  app (continue-watching infra, Nakama P2P, etc.). Grep before deleting.
- **CORS / headers** — `X-Seanime-*` HTTP headers stay on the wire. A perl
  rebrand sweep mistakenly renamed them to `X-Kuro-*` and broke every API call.
  The fix is in commit `8a3e79ac`. Don't repeat.
- **Frontend build flakiness** — `package.json`'s `build` script is
  `tsgo && rsbuild build`, but `tsgo` flags 30+ pre-existing TS errors that
  don't block dev. The Dockerfile bypasses tsgo with
  `npx --yes rsbuild build` directly.
- **PVC shadows the image's config.toml** — the runtime image pre-seeds
  `/data/config.toml` but the PVC mount hides it at runtime. The k8s
  `initContainer` rewrites `[server]` on every start to compensate.
- **PVC ownership** — runtime container runs as uid 999 (`kuro` user). When
  the init container (root) writes config.toml it stays root:root mode 600 →
  CrashLoopBackOff with "permission denied". The init script chowns to
  999:999 and chmod 0644 — keep it that way.
- **Silent `git pull` failure on the salon node** — `git pull --ff-only` in
  `/appli/kuro/` aborts (without setting a non-zero exit code that's obvious
  in the chained shell) if there are UNTRACKED files in the working tree
  that would be overwritten by the incoming commits. This bit us hard when
  `Dockerfile`, `.dockerignore` and `k8s/*.yaml` (which lived only on the
  server for ages) got tracked in commit `5f17b95b`: every subsequent pull
  silently aborted with "Les fichiers suivants non suivis seraient effacés"
  and HEAD stayed at `e5cb83a8` — the deployed pod kept compiling old
  source while we shipped 4+ "fix" commits. **Always check `git status`
  before assuming a pull worked**, or use `git pull --ff-only && git rev-parse HEAD`
  and compare to the local. If conflicts exist with untracked-becoming-tracked
  files, `rm -rf <path>` then pull (the tracked version is what we want).

## Next things the user is likely to ask

- **Backend deep cut (Niveau 3)** — actually delete `internal/manga/`,
  `internal/library/{scanner,autodownloader,autoscanner}/`, `internal/library_explorer/`,
  `internal/torrent_clients/{qbittorrent,transmission}/`. Each removal cascades
  into `internal/core/app.go`, `internal/plugin/`, `internal/local/*`, the
  AniList client (which fetches both anime+manga). The `make build` round-trip
  is now ~2 min on the user's box, so iteration is feasible.
- **Translate long-tail** — settings form help texts (~100+ strings), modals,
  entry page episode picker, error messages. Pattern is the same as before:
  add keys to `en.json` + `fr.json`, wrap with `t("…")`.
- **Per-profile AniList account** — currently all profiles share one AniList
  token (it's on the user's seanime account, not the profile). For true
  account isolation, store one Account row per profile and route AniList
  queries through the active profile's token.
- **Profile avatars from images** — current implementation is emoji + color.
  Could swap to image upload later by adding an `avatar_url` column.
- **Provider auto-fallback** — if the user installs more sources, a
  "Try another provider" button on stream errors would help (the backend
  already supports it, the UI flows through `onFatalError`).

## Quick command cheatsheet

```sh
# Sweep for broken imports after deleting files
grep -rn --include="*.ts" --include="*.tsx" \
  -E "from \"@/path/to/the-deleted-thing" seanime-web/src

# All routes registered
grep -nE "v1[A-Z]\w*\.|v1\." internal/handlers/routes.go

# All translated keys in use
grep -rn 't(\"' seanime-web/src/app | grep -oE "\"[a-z][a-z0-9_.]+\"" | sort -u

# Recent kuro commits
git log --oneline -20

# Force-rewrite config port (if user changes Makefile PORT default)
sed -i '' -E "s/^port = [0-9]+/port = 43211/" ~/.seanime-data/config.toml

# Deploy a fresh image — IMPORTANT: verify HEAD actually moved before
# trusting the build. `git pull --ff-only` can silently abort if untracked
# files conflict (see the silent-pull gotcha above).
cd /appli/kuro
git status --short                         # MUST be clean (or only stuff you'd expect)
git pull --ff-only && git log --oneline -1 # confirm HEAD is what you expect
docker build -t registry.gitlab.com/kidnar/kuro:latest .
docker push registry.gitlab.com/kidnar/kuro:latest
kubectl -n kuro rollout restart deployment/kuro

# Quickly verify the served bundle actually contains a known new string
# (the chunk hash in /static/js/index.<hash>.js will change between deploys
# only if the source actually changed)
curl -s https://kuro.nc-maiz.org/ | grep -oE '/static/js/index\.[a-z0-9]+\.js' | head -1

# Tail kuro logs in cluster (run from the salon node via SSH)
kubectl logs -n kuro -l app=kuro -c kuro --tail=200 -f

# Inspect the SQLite tables on the live pod
kubectl exec -n kuro deploy/kuro -c kuro -- /app/seanime --version
# DB itself: /data/seanime.db (sqlite3 not in the runtime image — use a
# debug pod with the same PVC mounted)
```

## Who is the user

Dylan (`encheres.nc@gmail.com`). French. Not a Go developer (works in JS/React
context) — explain Go errors plainly and propose pragmatic fixes. Likes Netflix
UX, hates surcharge / clutter. Prefers simplicity over configurability. Self-hosts
on a homelab cluster with public DNS (nc-maiz.org) and Cloudflare Tunnel.
