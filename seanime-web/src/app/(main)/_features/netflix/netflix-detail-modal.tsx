import { Anime_Entry } from "@/api/generated/types"
import { useGetAnilistAnimeDetails } from "@/api/hooks/anilist.hooks"
import { useGetAnimeEntry } from "@/api/hooks/anime_entries.hooks"
import { NetflixEpisodeList } from "@/app/(main)/_features/netflix/netflix-episode-list"
import { NetflixListPickerButton } from "@/app/(main)/_features/netflix/netflix-list-picker-button"
import { NetflixMoreLikeThis } from "@/app/(main)/_features/netflix/netflix-more-like-this"
import { SeaImage } from "@/components/shared/sea-image"
import { IconButton } from "@/components/ui/button"
import { cn } from "@/components/ui/core/styling"
import { Modal } from "@/components/ui/modal"
import { Skeleton } from "@/components/ui/skeleton"
import { useTranslatedText } from "@/lib/translate/use-translated-text"
import { atom, useAtom, useSetAtom } from "jotai"
import React from "react"
import { useTranslation } from "react-i18next"
import { BiX } from "react-icons/bi"

const __netflixDetailModalAtom = atom<number | null>(null)

export function useNetflixDetailModal() {
    const set = useSetAtom(__netflixDetailModalAtom)
    return {
        openDetail: (mediaId: number) => set(mediaId),
        closeDetail: () => set(null),
    }
}

/**
 * Netflix-style anime detail modal — opens over the current page
 * (browse / search / lists). Replaces the old full-page navigation
 * to /entry for the discovery experience.
 */
export function NetflixDetailModal() {
    const [mediaId, setMediaId] = useAtom(__netflixDetailModalAtom)
    const open = mediaId !== null

    return (
        <Modal
            open={open}
            onOpenChange={(v) => { if (!v) setMediaId(null) }}
            contentClass="!max-w-5xl !p-0 !rounded-xl overflow-hidden bg-[#0a0a0a] border-white/5"
            hideCloseButton
        >
            {open && (
                <>
                    <IconButton
                        intent="gray-subtle"
                        size="sm"
                        className="absolute right-3 top-3 z-[20] rounded-full bg-black/70 hover:bg-black !text-white"
                        icon={<BiX className="text-xl" />}
                        onClick={() => setMediaId(null)}
                        aria-label="Close"
                    />
                    <Body mediaId={mediaId!} />
                </>
            )}
        </Modal>
    )
}

function Body({ mediaId }: { mediaId: number }) {
    const { t } = useTranslation()
    const { data: entry, isLoading: entryLoading } = useGetAnimeEntry(mediaId)
    const { data: details } = useGetAnilistAnimeDetails(mediaId)

    // Hooks MUST be called unconditionally (before any early return) to keep
    // their order stable across renders.
    const rawDescription = entry?.media?.description?.replace(/(<([^>]+)>)/gi, "") ?? ""
    const { text: description, isTranslating } = useTranslatedText(rawDescription)

    if (entryLoading || !entry) return <BodySkeleton />

    const banner = entry.media?.bannerImage || entry.media?.coverImage?.extraLarge
    const title = entry.media?.title?.userPreferred ?? ""
    const year = entry.media?.startDate?.year
    const episodes = entry.media?.episodes
    const score = entry.media?.meanScore
    const genres = entry.media?.genres ?? []

    return (
        <div className="max-h-[85vh] overflow-y-auto">
            {/* Hero */}
            <div className="relative w-full aspect-[16/8] bg-black">
                {banner && (
                    <SeaImage src={banner} alt="" fill priority className="object-cover object-center" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/30 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6 lg:p-10 space-y-4">
                    <h1 className="text-3xl lg:text-5xl font-extrabold text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] max-w-2xl">
                        {title}
                    </h1>
                    <div className="flex items-center gap-3 flex-wrap">
                        <NetflixListPickerButton
                            mediaId={mediaId}
                            currentStatus={entry.listData?.status ?? null}
                        />
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="p-6 lg:p-10 space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-3">
                        <div className="flex items-center gap-3 flex-wrap text-sm text-[--muted]">
                            {year && <span className="text-white">{year}</span>}
                            {episodes && <span>{episodes} {t("modal.episodes_count")}</span>}
                            {score != null && (
                                <span className="px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 font-semibold text-xs">
                                    {score / 10}/10
                                </span>
                            )}
                        </div>
                        <p className={cn("text-gray-200 leading-relaxed text-sm lg:text-base", isTranslating && "opacity-60")}>
                            {description}
                        </p>
                    </div>
                    <div className="space-y-2 text-sm">
                        {genres.length > 0 && (
                            <div>
                                <span className="text-[--muted]">{t("modal.genres")}: </span>
                                <span className="text-white">{genres.join(", ")}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Episodes */}
                <section className="space-y-3">
                    <h2 className="text-xl font-bold text-white">{t("modal.episodes")}</h2>
                    <NetflixEpisodeList animeEntry={entry as Anime_Entry} />
                </section>

                {/* More like this */}
                {!!details && (
                    <div className={cn("-mx-6 lg:-mx-10")}>
                        <NetflixMoreLikeThis details={details} />
                    </div>
                )}
            </div>
        </div>
    )
}

function BodySkeleton() {
    return (
        <div className="space-y-6">
            <Skeleton className="w-full aspect-[16/8] rounded-none" />
            <div className="px-10 pb-10 space-y-3">
                <Skeleton className="h-8 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-3/4" />
            </div>
        </div>
    )
}
