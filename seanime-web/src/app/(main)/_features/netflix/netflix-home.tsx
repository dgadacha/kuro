import { useGetAnimeCollection } from "@/api/hooks/anilist.hooks"
import { NetflixHero } from "@/app/(main)/_features/netflix/netflix-hero"
import { NetflixRow } from "@/app/(main)/_features/netflix/netflix-row"
import {
    useDiscoverCurrentSeasonAnime,
    useDiscoverPastSeasonAnime,
    useDiscoverPopularAnime,
    useDiscoverTrendingAnime,
    useDiscoverTrendingMovies,
    useDiscoverUpcomingAnime,
} from "@/app/(main)/discover/_lib/handle-discover-queries"
import React from "react"
import { useTranslation } from "react-i18next"

export function NetflixHome() {
    return (
        <div data-netflix-home className="contents">
            {/* Hero opts out of the route's top padding so it can sit flush
                under the transparent navbar — Netflix-style. */}
            <div className="-mt-16 lg:-mt-[68px]">
                <NetflixHero />
            </div>

            <div className="relative z-[2] mt-4 space-y-10 pb-20">
                <ContinueWatchingRow />
                <TrendingRow />
                <PopularRow />
                <CurrentSeasonRow />
                <PastSeasonRow />
                <MoviesRow />
                <UpcomingRow />
            </div>
        </div>
    )
}

/*
 * Each row owns its own ref + query. This keeps the lazy `useInView` ref
 * co-located with the element it observes, instead of plumbing 6 refs through
 * the parent. The first row uses priority image loading (above the fold).
 */

function ContinueWatchingRow() {
    const { t } = useTranslation()
    const { data, isLoading } = useGetAnimeCollection()

    const media = React.useMemo(() => {
        const lists = data?.MediaListCollection?.lists ?? []
        const current = lists.find(l => l?.status === "CURRENT")
        const repeating = lists.find(l => l?.status === "REPEATING")
        // AniList returns CURRENT in updated-desc order — preserve it.
        return [...(current?.entries ?? []), ...(repeating?.entries ?? [])]
            .filter(Boolean)
            .map(e => e!.media)
            .filter(Boolean)
    }, [data])

    if (!isLoading && media.length === 0) return null

    return (
        <NetflixRow
            title={t("home.rows.continue_watching")}
            media={media}
            isLoading={isLoading}
            priorityImages
        />
    )
}

function TrendingRow() {
    const { t } = useTranslation()
    const { data, isLoading } = useDiscoverTrendingAnime()
    return (
        <NetflixRow
            title={t("home.rows.trending")}
            media={data?.Page?.media}
            isLoading={isLoading}
        />
    )
}

function PopularRow() {
    const { t } = useTranslation()
    const ref = React.useRef<HTMLDivElement>(null)
    const { data, isLoading } = useDiscoverPopularAnime(ref)
    return <NetflixRow rootRef={ref} title={t("home.rows.popular")} media={data?.Page?.media} isLoading={isLoading} />
}

function CurrentSeasonRow() {
    const { t } = useTranslation()
    const ref = React.useRef<HTMLDivElement>(null)
    const { data, isLoading } = useDiscoverCurrentSeasonAnime(ref)
    return <NetflixRow rootRef={ref} title={t("home.rows.current_season")} media={data?.Page?.media} isLoading={isLoading} />
}

function PastSeasonRow() {
    const { t } = useTranslation()
    const ref = React.useRef<HTMLDivElement>(null)
    const { data, isLoading } = useDiscoverPastSeasonAnime(ref)
    return <NetflixRow rootRef={ref} title={t("home.rows.past_season")} media={data?.Page?.media} isLoading={isLoading} />
}

function MoviesRow() {
    const { t } = useTranslation()
    const ref = React.useRef<HTMLDivElement>(null)
    const { data, isLoading } = useDiscoverTrendingMovies(ref)
    return <NetflixRow rootRef={ref} title={t("home.rows.movies")} media={data?.Page?.media} isLoading={isLoading} />
}

function UpcomingRow() {
    const { t } = useTranslation()
    const ref = React.useRef<HTMLDivElement>(null)
    const { data, isLoading } = useDiscoverUpcomingAnime(ref)
    return <NetflixRow rootRef={ref} title={t("home.rows.upcoming")} media={data?.Page?.media} isLoading={isLoading} />
}
