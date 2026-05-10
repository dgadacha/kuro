/**
 * Mounted on /watch. Polls the active <video> element every 5s and writes
 * (mediaId, episodeNumber, currentTime, duration) to localStorage scoped to
 * the active profile. The Continue Watching row reads from this same store.
 *
 * Why poll instead of hooking video-core?
 *   The video-core layer already emits a `video-status` WS event every second.
 *   We could intercept it, but that would couple the profile feature to the
 *   internal player API. A 5s DOM poll on the public `<video>` element is
 *   trivially cheap, decoupled, and survives any video-core refactor.
 */
import { upsertProfileHistoryEntry, useActiveProfileId } from "@/lib/profiles/profiles"
import { useSearchParams } from "@/lib/navigation"
import * as React from "react"

const POLL_MS = 5000
const MIN_TIME_S = 5  // ignore the first ~5s — initial seek noise + ad slates.

export function NetflixProfileHistorySaver() {
    const profileId = useActiveProfileId()
    const searchParams = useSearchParams()
    const idParam = searchParams.get("id")
    const epParam = searchParams.get("episode") ?? searchParams.get("ep")

    const mediaId = idParam ? parseInt(idParam, 10) : NaN
    const episodeNumber = epParam ? parseInt(epParam, 10) : NaN

    React.useEffect(() => {
        if (!profileId) return
        if (Number.isNaN(mediaId) || Number.isNaN(episodeNumber)) return

        let cancelled = false

        const tick = () => {
            if (cancelled) return
            const video = document.querySelector("video") as HTMLVideoElement | null
            if (!video) return
            const { currentTime, duration } = video
            if (!Number.isFinite(duration) || duration <= 0) return
            if (currentTime < MIN_TIME_S) return

            upsertProfileHistoryEntry(profileId, {
                mediaId,
                episodeNumber,
                currentTime,
                duration,
                timeUpdated: Date.now(),
            })
            // Notify same-tab subscribers (the storage event only fires cross-tab).
            window.dispatchEvent(new CustomEvent("kuro:profile-history-changed"))
        }

        const interval = setInterval(tick, POLL_MS)

        // Also flush on unload — catches the "user closes tab mid-episode" case.
        const onUnload = () => tick()
        window.addEventListener("pagehide", onUnload)
        window.addEventListener("beforeunload", onUnload)

        return () => {
            cancelled = true
            clearInterval(interval)
            window.removeEventListener("pagehide", onUnload)
            window.removeEventListener("beforeunload", onUnload)
        }
    }, [profileId, mediaId, episodeNumber])

    return null
}
