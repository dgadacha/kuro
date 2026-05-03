import { useGetAnimeEntry } from "@/api/hooks/anime_entries.hooks"
import { LoadingOverlayWithLogo } from "@/components/shared/loading-overlay-with-logo"
import { OnlinestreamPage } from "@/app/(main)/onlinestream/_containers/onlinestream-page"
import {
    __onlinestream_selectedDubbedAtom,
    __onlinestream_selectedEpisodeNumberAtom,
    __onlinestream_selectedProviderAtom,
} from "@/app/(main)/onlinestream/_lib/onlinestream.atoms"
import { useSearchParams } from "@/lib/navigation"
import { useSetAtom } from "jotai/react"
import React from "react"

export default function WatchPage() {
    const searchParams = useSearchParams()
    const idParam = searchParams.get("id")
    // accept both ?episode= (matches OnlinestreamPage internal convention) and ?ep= (legacy)
    const epParam = searchParams.get("episode") ?? searchParams.get("ep")
    const providerParam = searchParams.get("provider")
    const dubParam = searchParams.get("dub")

    const mediaId = idParam ? parseInt(idParam, 10) : NaN

    const setEpisode = useSetAtom(__onlinestream_selectedEpisodeNumberAtom)
    const setProvider = useSetAtom(__onlinestream_selectedProviderAtom)
    const setDubbed = useSetAtom(__onlinestream_selectedDubbedAtom)

    // Apply URL hints on mount so the player jumps straight to the right episode/provider.
    React.useEffect(() => {
        if (epParam) {
            const n = parseInt(epParam, 10)
            if (!Number.isNaN(n)) setEpisode(n)
        }
        if (providerParam) setProvider(providerParam)
        if (dubParam === "1") setDubbed(true)
        // run once per id/ep param combination
    }, [idParam, epParam, providerParam, dubParam])

    const { data: animeEntry, isLoading } = useGetAnimeEntry(mediaId)

    if (Number.isNaN(mediaId)) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center text-[--muted]">
                Missing or invalid <code className="mx-1 px-1.5 py-0.5 bg-white/10 rounded">id</code> query param.
            </div>
        )
    }

    if (isLoading || !animeEntry) return <LoadingOverlayWithLogo />

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
