<p align="center">
  <img src="seanime-web/public/kuro-logo.svg" alt="Kuro" width="96"/>
</p>

<h1 align="center">Kuro</h1>

<p align="center">
  Une app de streaming d'animes façon Netflix — pensée français, sans surcharge, sans bibliothèque locale obligatoire.
  <br/>
  <em>Fork de <a href="https://github.com/5rahim/seanime">Seanime</a>.</em>
</p>

<p align="center">
  <a href="https://github.com/dgadacha/kuro"><img alt="GitHub" src="https://img.shields.io/badge/GitHub-dgadacha%2Fkuro-181717?logo=github"/></a>
  &nbsp;
  <a href="https://gitlab.com/kidnar/kuro"><img alt="GitLab" src="https://img.shields.io/badge/GitLab-kidnar%2Fkuro-FC6D26?logo=gitlab"/></a>
  &nbsp;
  <a href="https://kuro.nc-maiz.org"><img alt="Démo" src="https://img.shields.io/badge/d%C3%A9mo-kuro.nc--maiz.org-E50914"/></a>
</p>

> La source vit en miroir sur GitHub (<code>dgadacha/kuro</code>) ET GitLab
> (<code>kidnar/kuro</code>) — même branche `main`, chaque push atterrit sur les
> deux. Le registre Docker est sous le projet GitLab :
> <code>registry.gitlab.com/kidnar/kuro</code>.

---

## C'est quoi

Une app web auto-hébergée pour découvrir, suivre et regarder des animes, avec le langage visuel de Netflix. Stream depuis des sources en ligne, synchronisation de ta progression sur AniList, gestion de plusieurs profils comme la vraie.

## Ce qui change par rapport à Seanime

Ce fork enlève tout ce qui ne sert pas au cas d'usage "je veux mater un anime, vite" :

- **Retiré** — le manga (entièrement), le scanner de fichiers locaux et la bibliothèque, le client torrent complet (qBittorrent / Transmission) et toute la surface torrent-streaming, l'auto-downloader, la synchro MyAnimeList, la vue planning, le client Electron desktop, tous les réglages liés.
- **Refait** — top bar à la Netflix (transparente sur le hero, opaque au scroll), accueil à la Netflix avec hero + rangées horizontales dont "Continuer à regarder", Mes listes & Recherche en grille, palette rouge plate sur fond noir.
- **Ajouté** — toggle français / anglais (FR par défaut), sélecteur multi-profils façon Netflix avec historique de visionnage par profil persisté en SQLite, stack de déploiement (Dockerfile + manifests Kubernetes), traduction DeepL des descriptions AniList, Makefile one-command.

## Stack

- **Backend** : Go 1.26 — Echo, GORM/SQLite, Goja (extensions JS). Un seul binaire avec le build React embarqué via `//go:embed`.
- **Frontend** : React + TanStack Router + Tailwind, bundlé avec Rsbuild. State via Jotai + React Query.
- **API ↔ UI** : REST avec hooks typés codegen, WebSocket pour les events.
- **Déploiement** : Dockerfile (multi-stage Node → Go → Debian-slim) + manifests k8s (namespace / deployment / svc / ingress / pvc).

## Architecture

### Topologie runtime

```
                                       ┌───────────────────────────────────┐
                                       │  Edge Cloudflare (TLS, DDoS, WAF) │
  Navigateur ── HTTPS ─────────────────►│   kuro.nc-maiz.org → CNAME →     │
                                       │   <tunnel-id>.cfargotunnel.com    │
                                       └────────────────┬──────────────────┘
                                                        │ sortie uniquement
                                                        │ tunnel chiffré
                                                        ▼
                          ┌───────────────────────────────────────────┐
                          │  Cluster k3s (1 nœud control-plane)       │
                          │                                           │
                          │  ┌────────────────┐    ┌─────────────────┐│
                          │  │  cloudflared   │───►│  Service kuro   ││
                          │  │  Deployment    │    │   :80 → :43211  ││
                          │  │  (2 replicas)  │    └────────┬────────┘│
                          │  └────────────────┘             │         │
                          │                                 ▼         │
                          │                   ┌─────────────────────┐ │
                          │                   │  Deployment kuro    │ │
                          │                   │  init: écrit config │ │
                          │                   │  ───────────────    │ │
                          │                   │  /app/seanime       │ │
                          │                   │  bind 0.0.0.0:43211 │ │
                          │                   │  UI React embarquée │ │
                          │                   │  GORM + SQLite      │ │
                          │                   │  extensions Goja JS │ │
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

Le cluster n'ouvre jamais aucun port entrant sur l'internet public — le daemon
cloudflared (qui tourne *dans* le cluster) compose en **sortie** vers l'edge
Cloudflare et tire le trafic depuis là. L'`k8s/ingress.yaml` inclus est un
ingress Traefik simple pour l'accès LAN (`kuro.maiz.local`) ; le trafic public
nécessite la conf du tunnel (hors du repo, voir « Exposition publique »
ci-dessous).

### Image conteneur

Build multi-stage (`Dockerfile`) :

| Stage | Base | Rôle | Sortie |
|---|---|---|---|
| 1. `web-builder` | `node:20-bookworm-slim` | Install npm, `rsbuild build` (en sautant `tsgo` — voir « Pièges connus » plus bas) | `/app/seanime-web/out/` |
| 2. `go-builder`  | `golang:1.26-bookworm`   | `go mod download`, copie le résultat du stage 1 dans `./web/`, `CGO_ENABLED=1 go build -trimpath -ldflags="-s -w"` | `/out/seanime` (binaire unique, ~50 MB) |
| 3. *runtime*     | `debian:bookworm-slim`   | `ca-certificates`, `tzdata`, user non-root `kuro` (uid 999), `EXPOSE 43211`, `VOLUME /data` | image ~241 MB |

CGO est requis parce que `mattn/go-sqlite3` se link contre la SQLite système —
d'où le runtime Debian-slim plutôt que `scratch`. Le frontend est embarqué dans
le binaire Go via `//go:embed all:web` — du coup le runtime n'a besoin que du
binaire (pas de `nginx`, pas de serveur de fichiers statiques).

### Persistance des données

Tout ce qui est spécifique à l'utilisateur vit sous `/data` (le mount du PVC en
k8s, un volume hôte avec `docker run`) :

| Chemin | Propriétaire | Contenu |
|---|---|---|
| `/data/seanime.db` | GORM | Compte/token AniList, thèmes, settings, plugin data, **kuro_profiles**, **kuro_profile_watch_histories** |
| `/data/config.toml` | seanime | Bind serveur, secure mode, allowlist, URL externe |
| `/data/extensions/` | seanime + user | Extensions JS installées (manifests + payloads). Deux slots : built-in + externes |
| `/data/assets/` | seanime | Cache des covers, bannières, avatars |
| `/data/cache/` | seanime | Cache des réponses API, cache transcoding |
| `/data/logs/` | seanime | Rotation des logs serveur |

L'`initContainer` k8s réécrit le bloc `[server]` de `config.toml` à chaque démarrage du pod, donc le manifest est la source de vérité pour `host`, `port`, `secureMode`, `externalURL` et `accessAllowlist`. **N'édite pas `config.toml` sur le PVC** — tes changements seront virés au prochain rollout. Édite `k8s/deployment.yaml` à la place.

### Boundary de sécu

seanime expose un setting `secureMode` qui gate l'accès API sans password :

- `""` (défaut, "baseline") — seules les requêtes depuis des origines locales de confiance (`127.0.0.1`, `localhost`, réseau privé) sont autorisées sans password.
- `"hardened"` — checks plus stricts sur l'origine + Sec-Fetch-Site ; n'accepte plus les requêtes browser cross-site du tout.
- `"strict"` — `hardened` + restrictions supplémentaires sur certains endpoints.
- `"lax"` — désactive complètement le boundary. **Requis pour servir derrière Cloudflare Tunnel** parce que l'origine de la requête est le pod tunnel, pas loopback. Le `k8s/deployment.yaml` inclus active ce mode.

Si tu veux durcir pour un déploiement public, trois options :

1. Mettre un `password` dans le bloc `[server]` — l'UI demande à la première visite.
2. Mettre Cloudflare Access devant (Zero Trust, gratuit jusqu'à 50 users).
3. Binder un sous-domaine dédié à un accès réseau privé uniquement (Tailscale serve, ZeroTier, …) et garder le tunnel pour la famille.

## Installation

### Prérequis
- Go 1.26+
- Node.js 20+ + npm
- ffmpeg (pour le transcoding)

### Dev

```sh
make dev
```

Au premier run, ça installe les deps npm, écrit `~/.seanime-data/config.toml`, démarre le backend Go (port `43211`) et le serveur dev rsbuild (port `43210`) en parallèle. `Ctrl+C` arrête les deux.

Ouvre <http://127.0.0.1:43210>.

### Build prod (binaire unique)

```sh
make build   # produit ./seanime, web UI embarquée
make run     # build puis lance
```

### Build conteneur

```sh
docker build -t kuro:latest .                # ~5-10 min sur cache vide
docker run -d --name kuro \
  -p 43211:43211 \
  -v kuro-data:/data \
  -e TZ=Pacific/Noumea \
  kuro:latest
```

L'image lance le binaire en `/app/seanime --datadir=/data`, qui :
1. Lit `/data/config.toml` (en crée un au premier run avec les défauts `host=127.0.0.1 port=43211` — override du bind nécessaire en k8s, voir plus bas).
2. Auto-migre le schéma SQLite sur `/data/seanime.db`.
3. Charge les extensions JS installées depuis `/data/extensions/`.
4. Sert l'UI React embarquée + l'API REST sur le bind configuré.

Override du bind (pour que le conteneur soit joignable depuis l'extérieur de son namespace réseau) :

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
kubectl apply -f k8s/pvc.yaml                # PVC 5 Gi RWO
kubectl apply -f k8s/deployment.yaml         # 1 replica (stratégie Recreate)
kubectl apply -f k8s/service.yaml            # ClusterIP 80 → 43211
kubectl apply -f k8s/ingress.yaml            # Traefik LAN (kuro.maiz.local)
```

`Recreate` (pas `RollingUpdate`) parce que SQLite + PVC RWO = un seul writer à la fois. L'init container est responsable du bloc `[server]` canonique — édite-le là, jamais sur le PVC.

Si tu pull depuis un registre GitLab privé, crée d'abord l'imagePullSecret :

```sh
kubectl create secret -n kuro docker-registry gitlab-registry \
  --docker-server=registry.gitlab.com \
  --docker-username=<ton-user-gitlab-ou-nom-deploy-token> \
  --docker-password=<glpat-... ou password du deploy token>
```

#### Exposition publique

L'ingress inclus est **interne uniquement** (LAN). Pour le public, trois options :

**A. Cloudflare Tunnel** (recommandé — c'est ce que `kuro.nc-maiz.org` utilise) :

1. Dans le configmap `cloudflared`, ajoute une règle ingress :
   ```yaml
   ingress:
     - hostname: kuro.example.com
       service: http://kuro.kuro.svc.cluster.local:80
     - service: http_status:404
   ```
2. Dans le DNS Cloudflare, ajoute un CNAME `kuro` → `<tunnel-id>.cfargotunnel.com` (proxied 🟠).
3. **Important** : `secureMode = "lax"` dans `k8s/deployment.yaml` est requis sinon le boundary de seanime rejette le trafic qui vient du tunnel.

**B. cert-manager + ingress LetsEncrypt** — annote `k8s/ingress.yaml` avec `cert-manager.io/cluster-issuer: letsencrypt-prod`, change le host pour ton vrai domaine, pointe ton record A sur l'IP externe du cluster.

**C. Reverse proxy classique** (nginx/Caddy sur l'host) — `proxy_pass` vers le NodePort du Service ou l'IP du pod.

#### kubectl utiles

```sh
# tail des logs
kubectl -n kuro logs -l app=kuro -c kuro --tail=200 -f

# rollout d'une nouvelle image (après `docker push`)
kubectl -n kuro rollout restart deployment/kuro
kubectl -n kuro rollout status   deployment/kuro

# inspection rapide sans entrer dans le pod
kubectl -n kuro exec deploy/kuro -- /app/seanime --version
```

### Autres targets Make

```sh
make help    # liste tout
make clean   # vire les artefacts de build (datadir intact)
```

Override des défauts inline : `make dev DATADIR=/tmp/kuro PORT=43211`.

### Variables d'environnement

| Var | Défaut | Effet |
|---|---|---|
| `SEANIME_DATA_DIR` | `~/.seanime-data` (dev), `/data` (conteneur) | Override du datadir ; le flag `--datadir` est prioritaire. |
| `SEANIME_SERVER_HOST` | `127.0.0.1` | Bind host. À mettre à `0.0.0.0` dans les conteneurs. |
| `SEANIME_SERVER_PORT` | `43211` | Bind port. **Ne pas changer** — les extensions communautaires hardcodent `127.0.0.1:43211/api/v1/proxy`. |
| `TZ` | `UTC` | Timezone pour les timestamps des logs + refresh planifiés. |

Les flags CLI overrident les env vars ; les env vars overrident `config.toml`.

### Référence API (endpoints spécifiques à Kuro)

Le fork Kuro ajoute UN groupe de routes par-dessus l'API Seanime upstream. Référence complète des endpoints Seanime : voir `internal/handlers/routes.go`.

```
GET    /api/v1/kuro-profiles                         Liste tous les profils
POST   /api/v1/kuro-profiles                         Crée — body {uid,name,avatar,color}
PATCH  /api/v1/kuro-profiles/:uid                    Modifie — body {name?,avatar?,color?}
DELETE /api/v1/kuro-profiles/:uid                    Supprime (cascade sur l'historique)

GET    /api/v1/kuro-profiles/:uid/history            Historique du profil (récent → ancien)
PUT    /api/v1/kuro-profiles/:uid/history            Upsert d'une ligne (mediaId, episode)
POST   /api/v1/kuro-profiles/:uid/history            Pareil que PUT — pour navigator.sendBeacon
DELETE /api/v1/kuro-profiles/:uid/history            Wipe complet de l'historique du profil
DELETE /api/v1/kuro-profiles/:uid/history/:mediaId   Drop tous les épisodes d'une série
DELETE /api/v1/kuro-profiles/:uid/history/:mediaId/episode/:episodeNumber
                                                     Drop une seule ligne d'épisode

GET    /api/v1/kuro-profiles/:uid/list               Liste les entrées de "Mes listes" du profil
PUT    /api/v1/kuro-profiles/:uid/list                Upsert (mediaId, status) — appelé en
                                                     dual-write avec AniList par le frontend
DELETE /api/v1/kuro-profiles/:uid/list/:mediaId      Retire l'anime de la vue du profil
                                                     (n'efface PAS l'entrée AniList globale)
```

Forme de la réponse (toujours wrappée dans `{ "data": ... }`) :

```jsonc
{ "id":1, "uid":"…", "name":"…", "avatar":"📺", "color":"#E50914",
  "createdAt":"…", "updatedAt":"…" }

{ "id":1, "profileUid":"…", "mediaId":21, "episodeNumber":3,
  "currentTime":482.7, "duration":1409, "createdAt":"…", "updatedAt":"…" }
```

## Premier setup

1. S'authentifier sur AniList depuis le dropdown profil (avatar en haut à droite). Requis pour les rangées d'accueil et la synchro de progression.
2. **Extensions → Marketplace** — installe au moins une source de streaming. Pour du contenu FR : cherche `anime-sama` et `french-anime`.
3. **Réglages → Streaming en ligne** — active.
4. Choisis un anime → il atterrit sur l'onglet **Streaming en ligne** par défaut → choisis ton provider une fois et il est mémorisé par anime.
5. *(optionnel)* **Avatar → Activer les profils** — sélecteur façon Netflix. Chaque profil a son propre historique persisté en SQLite.

## Arborescence du projet

```
.
├── main.go                                          # entrypoint Go, 16 lignes
├── Dockerfile                                       # build multi-stage
├── .dockerignore
├── k8s/                                             # manifests prêts à apply
│   ├── namespace.yaml · pvc.yaml · deployment.yaml
│   └── service.yaml   · ingress.yaml
├── internal/
│   ├── handlers/                                    # tous les handlers REST
│   │   ├── kuro_profile.go                          # NEW · /api/v1/kuro-profiles
│   │   └── routes.go                                # registre des routes
│   └── database/
│       ├── models/models.go                         # KuroProfile + KuroProfileWatchHistory
│       └── db/kuro_profile.go                       # NEW · CRUD pour les deux
├── seanime-web/                                     # frontend (React + Rsbuild)
│   └── src/
│       ├── app/(main)/
│       │   ├── _features/netflix/                   # toute l'UI Netflix
│       │   │   ├── netflix-home.tsx
│       │   │   ├── netflix-hero.tsx
│       │   │   ├── netflix-row.tsx
│       │   │   ├── netflix-card.tsx
│       │   │   ├── netflix-detail-modal.tsx
│       │   │   ├── netflix-continue-watching.tsx    # par profil OU legacy
│       │   │   ├── netflix-profile-picker.tsx       # "Qui regarde ?"
│       │   │   ├── netflix-profile-history-saver.tsx
│       │   │   └── netflix-top-bar.tsx
│       │   └── profiles/page.tsx
│       └── lib/profiles/profiles.ts                 # types des profils + hooks API
├── codegen/                                         # génère les types/hooks TS depuis Go
├── Makefile                                         # dev / build / run / clean
└── web/                                             # frontend buildé, embarqué dans le binaire
```

L'UI à la Netflix vit presque entièrement dans `seanime-web/src/app/(main)/_features/netflix/`. Les traductions sont dans `seanime-web/src/lib/i18n/locales/{en,fr}.json`.

## Profils (façon Netflix)

Un user peut enregistrer jusqu'à 6 profils. Chaque profil a :
- son propre **historique de visionnage** (par `(profile_uid, mediaId, episodeNumber)`)
- sa propre **vue "Mes listes"** (par `(profile_uid, mediaId)`, avec son propre status)

Ce qui reste **partagé** entre profils par design :
- Le compte AniList (un seul token au niveau serveur — la progression sync va sur ce compte)
- Les extensions installées
- Les réglages serveur

> Quand profil A ajoute Naruto à "En cours" et profil B le mette à "À regarder",
> chacun voit son propre statut sur sa page Mes listes — alors qu'en interne
> AniList a Naruto une seule fois (le dernier write gagne au niveau du
> compte global, mais l'UI affiche la valeur kuro per-profil).

Persistance : SQLite, sur le même datadir / PVC que le reste de l'app.
- Tables : `kuro_profiles`, `kuro_profile_watch_histories`, `kuro_profile_list_entries`.
- Sélection du profil actif (quel profil est "courant" dans cet onglet du navigateur) vit dans `localStorage["kuro-active-profile"]` — le seul truc qui n'est pas en BDD, parce que c'est une préférence UI, pas un état partagé.

Quand aucun profil n'est actif l'app dégrade en mode mono-utilisateur, lit l'endpoint legacy `/api/v1/continuity/history` pour la reprise de lecture, et `/api/v1/anilist/anime-collection` pour Mes listes — comme avant l'arrivée des profils. Donc les anciens users ne voient aucune coupure.

## Crédits & licence

Kuro est un fork de [5rahim/seanime](https://github.com/5rahim/seanime) — tout le boulot lourd (le serveur Go, le runtime de plugins, le client AniList) est le sien.

Source en miroir sur :
- GitHub — [dgadacha/kuro](https://github.com/dgadacha/kuro)
- GitLab — [kidnar/kuro](https://gitlab.com/kidnar/kuro) (héberge aussi l'image conteneur `registry.gitlab.com/kidnar/kuro`)

Distribué sous la même licence que le projet upstream — voir [LICENSE](LICENSE).
