import { useGetAnimeEntry } from "@/api/hooks/anime_entries.hooks"
import { OnlinestreamPage } from "@/app/(main)/onlinestream/_containers/onlinestream-page"
import {
    __onlinestream_selectedDubbedAtom,
    __onlinestream_selectedEpisodeNumberAtom,
    __onlinestream_selectedProviderAtom,
} from "@/app/(main)/onlinestream/_lib/onlinestream.atoms"
import { LoadingOverlayWithLogo } from "@/components/shared/loading-overlay-with-logo"
import { SeaImage } from "@/components/shared/sea-image"
import { Button } from "@/components/ui/button"
import { useSearchParams } from "@/lib/navigation"
import { useSetAtom } from "jotai/react"
import React from "react"
import { useTranslation } from "react-i18next"
import { BiPlay } from "react-icons/bi"

export default function WatchPage() {
    const { t } = useTranslation()
    const searchParams = useSearchParams()
    const idParam = searchParams.get("id")
    // accept both ?episode= (matches OnlinestreamPage internal convention) and ?ep= (legacy)
    const epParam = searchParams.get("episode") ?? searchParams.get("ep")
    const providerParam = searchParams.get("provider")
    const dubParam = searchParams.get("dub")

    const mediaId = idParam ? parseInt(idParam, 10) : NaN
    const epNumber = epParam ? parseInt(epParam, 10) : NaN

    const setEpisode = useSetAtom(__onlinestream_selectedEpisodeNumberAtom)
    const setProvider = useSetAtom(__onlinestream_selectedProviderAtom)
    const setDubbed = useSetAtom(__onlinestream_selectedDubbedAtom)

    // The player only mounts after the user clicks. The click counts as a
    // browser user-gesture, which lets the player call .play() with sound.
    const [started, setStarted] = React.useState(false)

    const handleStart = React.useCallback(() => {
        // Atoms must be set BEFORE the player mounts so its first render picks them up.
        if (!Number.isNaN(epNumber)) setEpisode(epNumber)
        if (providerParam) setProvider(providerParam)
        if (dubParam === "1") setDubbed(true)
        setStarted(true)
    }, [epNumber, providerParam, dubParam, setEpisode, setProvider, setDubbed])

    const { data: animeEntry, isLoading } = useGetAnimeEntry(mediaId)

    if (Number.isNaN(mediaId)) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center text-[--muted]">
                Missing or invalid <code className="mx-1 px-1.5 py-0.5 bg-white/10 rounded">id</code> query param.
            </div>
        )
    }

    if (isLoading || !animeEntry) return <LoadingOverlayWithLogo />

    if (started) {
        return (
            <div data-watch-page className="min-h-screen bg-black -mt-16 lg:-mt-[68px]">
                <OnlinestreamPage
                    animeEntry={animeEntry}
                    animeEntryLoading={isLoading}
                    hideBackButton
                />
            </div>
        )
    }

    // Pre-play splash — Netflix/YouTube-style
    const banner = animeEntry.media?.bannerImage || animeEntry.media?.coverImage?.extraLarge || ""
    const title = animeEntry.media?.title?.userPreferred ?? ""

    return (
        <div data-watch-splash className="min-h-screen bg-black -mt-16 lg:-mt-[68px] relative overflow-hidden">
            {banner && (
                <SeaImage
                    src={banner}
                    alt=""
                    fill
                    priority
                    className="object-cover object-center opacity-50"
                />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/30" />

            <div className="relative z-[1] min-h-screen flex flex-col items-center justify-center px-6 text-center gap-6">
                <p className="uppercase tracking-widest text-xs lg:text-sm text-brand-400 font-semibold">
                    {t("entry.episode_short")} {Number.isNaN(epNumber) ? "?" : epNumber}
                </p>
                <h1 className="text-3xl lg:text-5xl font-extrabold text-white max-w-3xl drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
                    {title}
                </h1>

                <Button
                    onClick={handleStart}
                    size="xl"
                    leftIcon={<BiPlay className="text-3xl" />}
                    className="bg-white !text-black hover:!bg-white/90 font-bold px-10 rounded-md mt-4"
                    autoFocus
                >
                    {t("watch.start")}
                </Button>

                <p className="text-xs text-[--muted] max-w-md mt-2">
                    {t("watch.click_hint")}
                </p>
            </div>
        </div>
    )
}
