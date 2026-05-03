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

export function NetflixHome() {
    return (
        <div data-netflix-home className="contents">
            <NetflixHero />

            {/* Pull rows up under the hero's bottom gradient for the signature Netflix overlap */}
            <div className="relative z-[2] -mt-32 space-y-10 pb-20">
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

function TrendingRow() {
    const { data, isLoading } = useDiscoverTrendingAnime()
    return (
        <NetflixRow
            title="Tendances actuelles"
            media={data?.Page?.media}
            isLoading={isLoading}
            priorityImages
        />
    )
}

function PopularRow() {
    const ref = React.useRef<HTMLDivElement>(null)
    const { data, isLoading } = useDiscoverPopularAnime(ref)
    return <NetflixRow rootRef={ref} title="Populaires" media={data?.Page?.media} isLoading={isLoading} />
}

function CurrentSeasonRow() {
    const ref = React.useRef<HTMLDivElement>(null)
    const { data, isLoading } = useDiscoverCurrentSeasonAnime(ref)
    return <NetflixRow rootRef={ref} title="Cette saison" media={data?.Page?.media} isLoading={isLoading} />
}

function PastSeasonRow() {
    const ref = React.useRef<HTMLDivElement>(null)
    const { data, isLoading } = useDiscoverPastSeasonAnime(ref)
    return <NetflixRow rootRef={ref} title="La saison passée" media={data?.Page?.media} isLoading={isLoading} />
}

function MoviesRow() {
    const ref = React.useRef<HTMLDivElement>(null)
    const { data, isLoading } = useDiscoverTrendingMovies(ref)
    return <NetflixRow rootRef={ref} title="Films d'animation" media={data?.Page?.media} isLoading={isLoading} />
}

function UpcomingRow() {
    const ref = React.useRef<HTMLDivElement>(null)
    const { data, isLoading } = useDiscoverUpcomingAnime(ref)
    return <NetflixRow rootRef={ref} title="Prochainement" media={data?.Page?.media} isLoading={isLoading} />
}
