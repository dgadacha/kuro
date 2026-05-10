/**
 * Netflix-style multi-profile support — server-backed.
 *
 * Persistence layer: SQLite, exposed via `/api/v1/kuro-profiles` (see Go side
 * in `internal/database/db/kuro_profile.go` + `internal/handlers/kuro_profile.go`).
 * Profiles + watch history therefore survive browser changes, devices,
 * incognito, cache wipes — anything that's not "the server's PVC vanished".
 *
 * The frontend only stores ONE thing locally: the currently-active profile id
 * (a UI preference — which profile is selected for THIS browser session).
 */
import { useServerMutation, useServerQuery } from "@/api/client/requests"
import { useQueryClient } from "@tanstack/react-query"
import { atom, useAtom, useAtomValue } from "jotai"
import { atomWithStorage } from "jotai/utils"
import * as React from "react"

// -----------------------------------------------------------------------------
// Types — mirror the Go models 1:1
// -----------------------------------------------------------------------------

export type Profile = {
    id: number
    uid: string
    name: string
    avatar: string
    color: string
    createdAt: string
    updatedAt: string
}

export type ProfileWatchEntry = {
    id: number
    profileUid: string
    mediaId: number
    episodeNumber: number
    currentTime: number
    duration: number
    createdAt: string
    updatedAt: string
}

export const PROFILE_AVATARS = [
    "🐱", "🐶", "🦊", "🐰", "🐼", "🐯",
    "🐸", "🐙", "🦁", "🐺", "🦄", "🌸",
    "⚡", "🔥", "🎌", "📺", "🎮", "🍙",
    "🌙", "👤", "🎨", "🍿", "🥷", "👑",
] as const

export const PROFILE_COLORS = [
    "#E50914", "#F5A623", "#FBBF24", "#10B981",
    "#06B6D4", "#3B82F6", "#A855F7", "#EC4899",
] as const

// -----------------------------------------------------------------------------
// Endpoint constants (kept here so this whole feature is grep-able)
// -----------------------------------------------------------------------------

const EP_LIST = "/api/v1/kuro-profiles"
const EP_CREATE = "/api/v1/kuro-profiles"
const EP_PATCH = (uid: string) => `/api/v1/kuro-profiles/${encodeURIComponent(uid)}`
const EP_DELETE = (uid: string) => `/api/v1/kuro-profiles/${encodeURIComponent(uid)}`
const EP_HISTORY = (uid: string) => `/api/v1/kuro-profiles/${encodeURIComponent(uid)}/history`

const QK_PROFILES = ["kuro-profiles"] as const
const QK_HISTORY = (uid: string) => ["kuro-profiles", uid, "history"] as const

// -----------------------------------------------------------------------------
// Active-profile selection (purely client-side — which profile is "current")
// -----------------------------------------------------------------------------

const STORAGE_ACTIVE = "kuro-active-profile"

export const activeProfileUidAtom = atomWithStorage<string | null>(STORAGE_ACTIVE, null)

// Backwards-compat alias — the original atom name is still imported in some places.
export const activeProfileIdAtom = activeProfileUidAtom

export function useActiveProfileId(): string | null {
    return useAtomValue(activeProfileUidAtom)
}

// -----------------------------------------------------------------------------
// Queries
// -----------------------------------------------------------------------------

export function useProfiles() {
    const q = useServerQuery<Profile[]>({
        endpoint: EP_LIST,
        method: "GET",
        queryKey: [...QK_PROFILES],
    })
    return q.data ?? []
}

export function useActiveProfile(): Profile | null {
    const profiles = useProfiles()
    const uid = useActiveProfileId()
    if (!uid) return null
    return profiles.find(p => p.uid === uid) ?? null
}

/**
 * Live history for the active profile — most-recent first. Returns [] when no
 * profile is active so callers can render unconditionally.
 */
export function useActiveProfileHistory(): ProfileWatchEntry[] {
    const uid = useActiveProfileId()
    const q = useServerQuery<ProfileWatchEntry[]>({
        endpoint: uid ? EP_HISTORY(uid) : "",
        method: "GET",
        queryKey: uid ? [...QK_HISTORY(uid)] : ["kuro-profiles", "history", "noop"],
        enabled: !!uid,
    })
    return q.data ?? []
}

// -----------------------------------------------------------------------------
// Mutations (returned as a single hook for convenience)
// -----------------------------------------------------------------------------

export function useProfileActions() {
    const queryClient = useQueryClient()
    const profiles = useProfiles()
    const [activeUid, setActiveUid] = useAtom(activeProfileUidAtom)

    const invalidate = React.useCallback(() => {
        queryClient.invalidateQueries({ queryKey: [...QK_PROFILES] })
    }, [queryClient])

    const createMut = useServerMutation<Profile, { uid: string; name: string; avatar: string; color: string }>({
        endpoint: EP_CREATE,
        method: "POST",
        mutationKey: ["kuro-profiles", "create"],
        onSuccess: () => invalidate(),
    })

    const updateMut = useServerMutation<Profile, { uid: string; name?: string; avatar?: string; color?: string }>({
        // Endpoint is dynamic — useServerMutation requires a stable string, so
        // we override at call time by mutating an outer ref. Simpler: build the
        // request manually via a small wrapper.
        endpoint: EP_PATCH("__placeholder__"),
        method: "PATCH",
        mutationKey: ["kuro-profiles", "update"],
        onSuccess: () => invalidate(),
    })

    const deleteMut = useServerMutation<boolean, void>({
        endpoint: EP_DELETE("__placeholder__"),
        method: "DELETE",
        mutationKey: ["kuro-profiles", "delete"],
        onSuccess: () => invalidate(),
    })

    const add = React.useCallback(
        async (data: { name: string; avatar: string; color: string }): Promise<Profile | null> => {
            const uid = cryptoUid()
            const created = await createMut.mutateAsync({ uid, ...data })
            return created ?? null
        },
        [createMut],
    )

    // The mutation's `endpoint` is fixed at hook-creation time, so we can't use
    // useServerMutation directly for parameterised PATCH/DELETE. Fall back to
    // a plain fetch for those — cheap, and we still invalidate the query cache.
    const update = React.useCallback(
        async (uid: string, patch: Partial<Pick<Profile, "name" | "avatar" | "color">>): Promise<void> => {
            const r = await fetch(EP_PATCH(uid), {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(patch),
            })
            if (!r.ok) throw new Error(`Profile update failed: ${r.status}`)
            invalidate()
        },
        [invalidate],
    )

    const remove = React.useCallback(
        async (uid: string): Promise<void> => {
            const r = await fetch(EP_DELETE(uid), { method: "DELETE" })
            if (!r.ok) throw new Error(`Profile delete failed: ${r.status}`)
            if (activeUid === uid) setActiveUid(null)
            invalidate()
            queryClient.invalidateQueries({ queryKey: ["kuro-profiles", uid, "history"] })
        },
        [activeUid, setActiveUid, invalidate, queryClient],
    )

    const select = React.useCallback(
        (uid: string | null) => setActiveUid(uid),
        [setActiveUid],
    )

    return {
        profiles,
        activeUid,
        // legacy alias kept for the existing UI code
        activeId: activeUid,
        add,
        update,
        remove,
        select,
    }
}

/**
 * Imperative upsert for the watch-history saver mounted on /watch.
 * Sends a PUT (idempotent on the composite (profileUid, mediaId) key).
 *
 * We bypass useServerMutation because (a) the endpoint is dynamic per profile
 * and (b) we don't want React-Query to display toasts on every 5-second tick.
 */
export async function pushProfileHistoryEntry(
    profileUid: string,
    entry: { mediaId: number; episodeNumber: number; currentTime: number; duration: number },
): Promise<void> {
    if (!profileUid) return
    try {
        await fetch(EP_HISTORY(profileUid), {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(entry),
        })
    } catch {
        // Network blip — drop on the floor; the next tick will retry.
    }
}

/** Hook exposing a stable upsert function bound to the active profile. */
export function useProfileHistoryUpsert() {
    const uid = useActiveProfileId()
    const queryClient = useQueryClient()
    return React.useCallback(
        async (entry: { mediaId: number; episodeNumber: number; currentTime: number; duration: number }) => {
            if (!uid) return
            await pushProfileHistoryEntry(uid, entry)
            queryClient.invalidateQueries({ queryKey: [...QK_HISTORY(uid)] })
        },
        [uid, queryClient],
    )
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function cryptoUid(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID()
    }
    return Math.random().toString(36).slice(2) + Date.now().toString(36)
}
