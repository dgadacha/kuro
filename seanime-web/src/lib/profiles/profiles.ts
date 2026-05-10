/**
 * Netflix-style multi-profile support.
 *
 * Profiles are CLIENT-side only: stored in localStorage, no server tables, no
 * backend changes. Each profile owns:
 *   - identity:    name + emoji avatar + accent color
 *   - history:     a per-profile mirror of "currentTime per (mediaId, episode)",
 *                  written by the watch page and read by the Continue Watching row.
 *
 * The AniList account, extensions and server settings remain shared across
 * profiles — that's by design (single Kuro instance, single AniList user).
 * If you want true account isolation later, swap the picker for a multi-token
 * AniList sign-in flow on top of this scaffolding.
 */
import { atom, useAtom, useAtomValue } from "jotai"
import { atomWithStorage } from "jotai/utils"
import * as React from "react"

export type Profile = {
    id: string
    name: string
    avatar: string  // emoji, e.g. "🐱"
    color: string   // hex, e.g. "#E50914"
    createdAt: number
}

/** Curated set of preset emojis for the picker — keep small + safe across all platforms. */
export const PROFILE_AVATARS = [
    "🐱", "🐶", "🦊", "🐰", "🐼", "🐯",
    "🐸", "🐙", "🦁", "🐺", "🦄", "🌸",
    "⚡", "🔥", "🎌", "📺", "🎮", "🍙",
    "🌙", "👤", "🎨", "🍿", "🥷", "👑",
] as const

/** Curated palette — Netflix red first, then a vibrant rainbow that reads well on black bg. */
export const PROFILE_COLORS = [
    "#E50914", "#F5A623", "#FBBF24", "#10B981",
    "#06B6D4", "#3B82F6", "#A855F7", "#EC4899",
] as const

const STORAGE_PROFILES = "kuro-profiles"
const STORAGE_ACTIVE = "kuro-active-profile"
const STORAGE_HISTORY_PREFIX = "kuro-history-"

// -----------------------------------------------------------------------------
// Atoms (jotai)
// -----------------------------------------------------------------------------

export const profilesAtom = atomWithStorage<Profile[]>(STORAGE_PROFILES, [])

export const activeProfileIdAtom = atomWithStorage<string | null>(STORAGE_ACTIVE, null)

/** Derived: resolves the active profile id to the actual Profile object (or null). */
export const activeProfileAtom = atom<Profile | null>(get => {
    const profiles = get(profilesAtom)
    const id = get(activeProfileIdAtom)
    if (!id) return null
    return profiles.find(p => p.id === id) ?? null
})

// -----------------------------------------------------------------------------
// Hooks
// -----------------------------------------------------------------------------

export function useProfiles() {
    return useAtomValue(profilesAtom)
}

export function useActiveProfile() {
    return useAtomValue(activeProfileAtom)
}

export function useActiveProfileId() {
    return useAtomValue(activeProfileIdAtom)
}

/** All mutations gated through one place, so storage and atom state stay in sync. */
export function useProfileActions() {
    const [profiles, setProfiles] = useAtom(profilesAtom)
    const [activeId, setActiveId] = useAtom(activeProfileIdAtom)

    const add = React.useCallback(
        (data: Pick<Profile, "name" | "avatar" | "color">): Profile => {
            const profile: Profile = {
                id: cryptoUid(),
                createdAt: Date.now(),
                ...data,
            }
            setProfiles(prev => [...prev, profile])
            return profile
        },
        [setProfiles],
    )

    const update = React.useCallback(
        (id: string, patch: Partial<Pick<Profile, "name" | "avatar" | "color">>) => {
            setProfiles(prev => prev.map(p => (p.id === id ? { ...p, ...patch } : p)))
        },
        [setProfiles],
    )

    const remove = React.useCallback(
        (id: string) => {
            setProfiles(prev => prev.filter(p => p.id !== id))
            if (activeId === id) setActiveId(null)
            // Burn the per-profile watch history so it doesn't linger forever.
            try {
                localStorage.removeItem(STORAGE_HISTORY_PREFIX + id)
            } catch { /* ignore */ }
        },
        [setProfiles, activeId, setActiveId],
    )

    const select = React.useCallback(
        (id: string | null) => setActiveId(id),
        [setActiveId],
    )

    return { profiles, activeId, add, update, remove, select }
}

// -----------------------------------------------------------------------------
// Per-profile watch history
// -----------------------------------------------------------------------------

export type ProfileWatchEntry = {
    mediaId: number
    episodeNumber: number
    currentTime: number
    duration: number
    timeUpdated: number  // ms since epoch
}

export type ProfileWatchHistory = Record<number, ProfileWatchEntry>

export function profileHistoryStorageKey(profileId: string): string {
    return STORAGE_HISTORY_PREFIX + profileId
}

export function readProfileHistory(profileId: string): ProfileWatchHistory {
    try {
        const raw = localStorage.getItem(profileHistoryStorageKey(profileId))
        return raw ? JSON.parse(raw) : {}
    } catch {
        return {}
    }
}

export function writeProfileHistory(profileId: string, history: ProfileWatchHistory): void {
    try {
        localStorage.setItem(profileHistoryStorageKey(profileId), JSON.stringify(history))
    } catch { /* quota exceeded — silently drop */ }
}

export function upsertProfileHistoryEntry(
    profileId: string,
    entry: ProfileWatchEntry,
): void {
    const history = readProfileHistory(profileId)
    history[entry.mediaId] = entry
    writeProfileHistory(profileId, history)
}

/**
 * Hook: live view of the active profile's history. Re-renders on:
 *   - active profile change
 *   - localStorage events (cross-tab sync)
 *   - same-tab sync via window event "kuro:profile-history-changed"
 */
export function useActiveProfileHistory(): ProfileWatchHistory {
    const profileId = useActiveProfileId()
    const [history, setHistory] = React.useState<ProfileWatchHistory>(() =>
        profileId ? readProfileHistory(profileId) : {},
    )

    React.useEffect(() => {
        if (!profileId) {
            setHistory({})
            return
        }
        setHistory(readProfileHistory(profileId))

        const key = profileHistoryStorageKey(profileId)
        const onStorage = (e: StorageEvent) => {
            if (e.key === key) setHistory(readProfileHistory(profileId))
        }
        const onLocal = () => setHistory(readProfileHistory(profileId))

        window.addEventListener("storage", onStorage)
        window.addEventListener("kuro:profile-history-changed", onLocal as EventListener)
        return () => {
            window.removeEventListener("storage", onStorage)
            window.removeEventListener("kuro:profile-history-changed", onLocal as EventListener)
        }
    }, [profileId])

    return history
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function cryptoUid(): string {
    // crypto.randomUUID is on every browser we target since 2022 — fall back just in case.
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID()
    }
    return Math.random().toString(36).slice(2) + Date.now().toString(36)
}
