import { AL_BaseAnime } from "@/api/generated/types"
import { useGetAnimeCollection } from "@/api/hooks/anilist.hooks"
import { useGetContinuityWatchHistory } from "@/api/hooks/continuity.hooks"
import { ROW } from "@/app/(main)/_features/netflix/netflix.constants"
import { SeaImage } from "@/components/shared/sea-image"
import { cn } from "@/components/ui/core/styling"
import React from "react"
import { useTranslation } from "react-i18next"
import { BiPlay } from "react-icons/bi"

// We hide an entry once the user is within FINISHED_THRESHOLD seconds of the end
// — assume they've finished and don't want it cluttering the row.
const FINISHED_THRESHOLD = 60

type ResumeItem = {
    media: AL_BaseAnime
    episodeNumber: number
    currentTime: number
    duration: number
    progress: number      // 0-1
    timeUpdated: number   // ms since epoch
}

export function NetflixContinueWatching() {
    const { t } = useTranslation()
    const { data: history } = useGetContinuityWatchHistory()
    const { data: collection } = useGetAnimeCollection()

    const items = React.useMemo<ResumeItem[]>(() => {
        if (!history || !collection) return []

        // Build mediaId → AL_BaseAnime map from the user's AniList lists.
        const mediaById = new Map<number, AL_BaseAnime>()
        for (const list of collection.MediaListCollection?.lists ?? []) {
            for (const entry of list?.entries ?? []) {
                if (entry?.media?.id != null) mediaById.set(entry.media.id, entry.media)
            }
        }

        return Object.values(history)
            .filter(h => h && h.duration > 0 && h.currentTime > 0
                && h.currentTime < h.duration - FINISHED_THRESHOLD)
            .map(h => {
                const media = mediaById.get(h.mediaId)
                if (!media) return null
                return {
                    media,
                    episodeNumber: h.episodeNumber,
                    currentTime: h.currentTime,
                    duration: h.duration,
                    progress: Math.max(0, Math.min(1, h.currentTime / h.duration)),
                    timeUpdated: h.timeUpdated ? new Date(h.timeUpdated).getTime() : 0,
                } as ResumeItem
            })
            .filter((x): x is ResumeItem => !!x)
            .sort((a, b) => b.timeUpdated - a.timeUpdated)
    }, [history, collection])

    if (items.length === 0) return null

    return (
        <section className="space-y-3">
            <h2 className="text-xl lg:text-2xl font-bold text-white tracking-tight px-6 lg:px-16">
                {t("home.rows.continue_watching")}
            </h2>
            <div className={cn(
                "flex gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory",
                "px-6 lg:px-16 py-3",
            )}>
                {items.map(item => <ResumeCard key={item.media.id} item={item} />)}
            </div>
        </section>
    )
}

function ResumeCard({ item }: { item: ResumeItem }) {
    const { t } = useTranslation()
    const { media, episodeNumber, currentTime, progress } = item
    const img = media.bannerImage || media.coverImage?.extraLarge || media.coverImage?.large || ""
    const title = media.title?.userPreferred || ""

    // Round to nearest second so the URL stays stable across re-renders.
    const resumeTime = Math.floor(currentTime)
    const watchHref = `/watch?id=${media.id}&episode=${episodeNumber}&t=${resumeTime}`

    return (
        <a
            href={watchHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${t("home.hero.play")} – ${title} – ${t("entry.episode_short")} ${episodeNumber}`}
            className={cn(
                "group relative snap-start flex-none block",
                ROW.cardWidthClass,
                "aspect-video rounded-md overflow-hidden bg-gray-900",
                "ring-0 ring-brand-500 hover:ring-2 transition-[transform,box-shadow,outline] duration-200",
                "hover:scale-[1.03] hover:z-[2] hover:shadow-2xl transform-gpu origin-center",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500",
            )}
        >
            {img && (
                <SeaImage src={img} alt={title} fill priority className="object-cover object-center" />
            )}

            {/* Centered play button on hover (Netflix-style resume affordance). */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="size-14 rounded-full bg-white/90 flex items-center justify-center text-black shadow-lg">
                    <BiPlay className="text-3xl translate-x-0.5" />
                </span>
            </div>

            {/* Title + episode + red progress bar — always visible. */}
            <div className="absolute inset-x-0 bottom-0 p-3 pb-4 bg-gradient-to-t from-black/95 via-black/60 to-transparent space-y-1.5">
                <p className="text-white font-semibold text-sm lg:text-base line-clamp-1 drop-shadow-md">
                    {title}
                </p>
                <p className="text-gray-300 text-xs">
                    {t("entry.episode_short")} {episodeNumber}
                </p>
                <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500" style={{ width: `${progress * 100}%` }} />
                </div>
            </div>
        </a>
    )
}
