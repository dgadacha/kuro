# Kuro — Claude context

This repo is a **fork of [seanime](https://github.com/5rahim/seanime)** rebranded
as **Kuro**, reshaped to look and feel like Netflix. The user (Dylan) is
French-speaking — **respond in French unless asked otherwise**.

The frontend is the primary battleground. The Go backend has been only
surface-trimmed (handler files + routes); deeper Go cleanup is deferred.

---

## Repo / git

- **Origin remote** = upstream seanime (`5rahim/seanime`). Don't push to it.
- **`kuro` remote** = the user's fork at <https://github.com/dgadacha/kuro>. **Always push there.**
- Commits use `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` per
  the harness convention. Use `git commit -m "$(cat <<'EOF' … EOF)"` HEREDOC pattern.
- Push after each meaningful milestone (the user expects to see progress on GitHub).
- Branch: `main`.

## How to run

```sh
make dev        # backend (43211) + frontend dev (43210), Ctrl+C stops both
make build      # builds web → moves to web/, builds Go binary
make run        # build then launch
make clean      # nuke artifacts (datadir untouched)
```

The Makefile lives at the **root**. Datadir defaults to `~/.seanime-data`. First
run auto-writes `config.toml` and auto-rewrites the port if it's not 43211.

## Critical port note

**Backend MUST run on `43211`.** Community extensions (Anime-Sama, Hianime, etc.)
hardcode `http://127.0.0.1:43211/api/v1/proxy` for cross-origin fetches. We
already moved off the original 43000 because of this; do not move it back.

If the Go config has been edited manually, `make init-config` will sed it back.

## Architecture

```
.
├── main.go                                 # 16-line Go entrypoint
├── internal/                               # Go backend (handlers, plugin runtime, torrent…)
│   └── handlers/routes.go                  # all REST routes registered here
├── seanime-web/
│   ├── src/
│   │   ├── app/(main)/                     # the app, route-group root
│   │   │   ├── _features/netflix/          # ★ all Kuro-specific UI
│   │   │   │   ├── netflix-top-bar.tsx     # fixed nav, transparent → opaque on scroll
│   │   │   │   ├── netflix-home.tsx        # hero + 7 rows incl. Continue Watching
│   │   │   │   ├── netflix-hero.tsx        # 85vh banner, slideshow, Lecture / Plus d'infos
│   │   │   │   ├── netflix-row.tsx         # horizontal scroller
│   │   │   │   ├── netflix-card.tsx        # 16:9 thumb, variant: "row" | "grid"
│   │   │   │   ├── netflix-lists.tsx       # /lists page (replaces AnilistCollectionLists)
│   │   │   │   ├── netflix-search.tsx      # /search page (replaces AdvancedSearch*)
│   │   │   │   ├── netflix-more-like-this.tsx  # entry page recs (replaces Relations + Characters)
│   │   │   │   ├── use-slideshow.ts        # paused on hover/hidden tab/reduced-motion
│   │   │   │   └── netflix.constants.ts    # sizes, intervals, format labels
│   │   │   ├── _features/layout/main-layout.tsx   # renders NetflixTopBar
│   │   │   ├── settings/page.tsx           # tabs translated, Denshi tab removed
│   │   │   └── …
│   │   ├── components/shared/
│   │   │   ├── language-switcher.tsx       # FR | EN pill, in nav profile dropdown
│   │   │   └── …
│   │   ├── lib/i18n/
│   │   │   ├── index.ts                    # init react-i18next (default FR)
│   │   │   └── locales/{en,fr}.json
│   │   ├── lib/server/config.ts            # __DEV_SERVER_PORT = 43211
│   │   └── routes/_main.tsx                # adds pt-16 lg:pt-[68px] under fixed nav
│   ├── public/kuro-logo.svg                # the K logo (Netflix red on dark)
│   ├── package.json                        # only `dev` / `build` / `preview` scripts
│   └── .env.web                            # only env file left
├── codegen/                                # Go-side type/hook generator
├── Makefile                                # ★ user-facing entry (dev/build/run/clean)
└── README.md                               # Kuro README, no upstream branding
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
   (nav, home, lists, search, settings tabs, onboarding). Long-tail (settings
   form help texts, modals, plugin UI) is still English. Profile dropdown has
   the FR | EN switcher.
8. **Onboarding** — 5 steps → 3 (Player, Debrid, Features). Library + Torrent
   Client steps dropped. CTA "Lancer Kuro".
9. **Entry page** — Characters + Relations sections gone. Replaced by
   `NetflixMoreLikeThis` (just recommendations, Netflix-style grid).
   `__anime_entryPageViewAtom` defaults to `"onlinestream"` so the right tab is
   pre-selected. Header trimmed (no more "#X Highest Rated of All Time" badges).

## Conventions / preferences

- **Language**: French in chat. UI strings: see `seanime-web/src/lib/i18n/locales/`.
- **Length**: keep responses tight, no fluff. The user gives short directives,
  expects brief acknowledgments + the actual change.
- **Commits**: incremental, one logical change per commit, push after each.
  Stack of 25+ commits already on `kuro` branch.
- **Branch hygiene**: never force-push, never edit `origin` (upstream).
- **Verification**: there's no `go build` / `npm install` available in the agent
  environment. The user runs `make dev` and screenshots errors. I find + fix.
  After 3 of those round-trips ports + caches were stable; expect more if you
  do bigger changes.
- **Permissions**: `Bash(rm …)` in the user's repo is OK because everything is
  versioned. But never delete files outside this repo and never `git reset --hard`.

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

## Next things the user is likely to ask

- **Backend deep cut (Niveau 3)** — actually delete `internal/manga/`,
  `internal/library/{scanner,autodownloader,autoscanner}/`, `internal/library_explorer/`,
  `internal/torrent_clients/{qbittorrent,transmission}/`. Each removal cascades
  into `internal/core/app.go`, `internal/plugin/`, `internal/local/*`, the
  AniList client (which fetches both anime+manga). Without `go build` to iterate,
  this is best done at the user's terminal — they paste errors, you fix.
- **Translate long-tail** — settings form help texts (~100+ strings), modals,
  entry page episode picker, error messages. Pattern is the same as before:
  add keys to `en.json` + `fr.json`, wrap with `t("…")`. The `i18n.t` import-time
  side-effect is in `main.tsx` so any component is good to go.
- **Netflix episode list polish** — the player tab's episode list is already
  card-based but could use Netflix's exact "S1:E1 Episode Title" + duration +
  description layout. File: `seanime-web/src/app/(main)/onlinestream/_containers/onlinestream-page.tsx` (~750 lines).
- **Provider auto-fallback** — the user installed Anime-Sama. If they install
  more sources, a "Try another provider" button on stream errors would help
  (the backend already supports it, the UI flows through `onFatalError`).

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
```

## Who is the user

Dylan (`encheres.nc@gmail.com`). French. Not a Go developer (works in JS/React
context) — explain Go errors plainly and propose pragmatic fixes. Likes Netflix
UX, hates surcharge / clutter. Prefers simplicity over configurability.
