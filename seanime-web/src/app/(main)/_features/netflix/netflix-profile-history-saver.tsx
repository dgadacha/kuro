/**
 * Mounted on /watch. Polls the active <video> element every 5s and sends an
 * upsert to /api/v1/kuro-profiles/:uid/history. The Continue Watching row
 * reads from the same endpoint, so progress survives browser changes / cache
 * wipes / device hops.
 *
 * Why poll instead of hooking video-core?
 *   The video-core layer already emits a `video-status` WS event every second.
 *   We could intercept it, but that would couple the profile feature to the
 *   internal player API. A 5s DOM poll on the public `<video>` element is
 *   trivially cheap, decoupled, and survives any video-core refactor.
 */
import { pushProfileHistoryEntry, useActiveProfileId } from "@/lib/profiles/profiles"
import { useSearchParams } from "@/lib/navigation"
import { useQueryClient } from "@tanstack/react-query"
import * as React from "react"

const POLL_MS = 5000
const MIN_TIME_S = 5  // ignore the first ~5s — initial seek noise + ad slates.
const INVALIDATE_EVERY_N = 6  // refetch the history once every ~30s of playback (cheap)

export function NetflixProfileHistorySaver() {
    const profileId = useActiveProfileId()
    const searchParams = useSearchParams()
    const idParam = searchParams.get("id")
    const epParam = searchParams.get("episode") ?? searchParams.get("ep")

    const mediaId = idParam ? parseInt(idParam, 10) : NaN
    const episodeNumber = epParam ? parseInt(epParam, 10) : NaN

    const queryClient = useQueryClient()

    React.useEffect(() => {
        if (!profileId) return
        if (Number.isNaN(mediaId) || Number.isNaN(episodeNumber)) return

        let cancelled = false
        let tickCount = 0

        const tick = () => {
            if (cancelled) return
            const video = document.querySelector("video") as HTMLVideoElement | null
            if (!video) return
            const { currentTime, duration } = video
            if (!Number.isFinite(duration) || duration <= 0) return
            if (currentTime < MIN_TIME_S) return

            void pushProfileHistoryEntry(profileId, {
                mediaId,
                episodeNumber,
                currentTime,
                duration,
            })

            // Periodically nudge the cache so any visible "Continue Watching" row
            // (e.g. on a second tab open on /) reflects fresh progress without
            // a manual refresh. We don't invalidate every 5s — that'd be wasteful.
            tickCount = (tickCount + 1) % INVALIDATE_EVERY_N
            if (tickCount === 0) {
                queryClient.invalidateQueries({ queryKey: ["kuro-profiles", profileId, "history"] })
            }
        }

        const interval = setInterval(tick, POLL_MS)

        // Also flush on tab close / nav away.
        const onUnload = () => tick()
        window.addEventListener("pagehide", onUnload)
        window.addEventListener("beforeunload", onUnload)

        return () => {
            cancelled = true
            clearInterval(interval)
            window.removeEventListener("pagehide", onUnload)
            window.removeEventListener("beforeunload", onUnload)
        }
    }, [profileId, mediaId, episodeNumber, queryClient])

    return null
}
