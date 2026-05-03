import { AL_BaseAnime } from "@/api/generated/types"
import { NetflixCard } from "@/app/(main)/_features/netflix/netflix-card"
import { ROW } from "@/app/(main)/_features/netflix/netflix.constants"
import { cn } from "@/components/ui/core/styling"
import { Skeleton } from "@/components/ui/skeleton"
import React from "react"

type Props = {
    title: string
    media: ReadonlyArray<AL_BaseAnime | null | undefined> | undefined
    isLoading?: boolean
    /** Forwarded to the section root for in-view lazy data hooks. */
    rootRef?: React.Ref<HTMLDivElement>
    /** Mark first row above the fold so its images load eagerly. */
    priorityImages?: boolean
}

export function NetflixRow({ title, media, isLoading, rootRef, priorityImages }: Props) {
    const items = React.useMemo(
        () => (media ?? []).filter((m): m is AL_BaseAnime => !!m),
        [media],
    )

    if (!isLoading && items.length === 0) return null

    return (
        <section ref={rootRef} className="space-y-3">
            <h2 className="text-xl lg:text-2xl font-bold text-white tracking-tight px-6 lg:px-16">
                {title}
            </h2>

            <div
                className={cn(
                    "flex gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory",
                    "px-6 lg:px-16",
                    ROW.scrollPaddingY,
                )}
            >
                {isLoading
                    ? Array.from({ length: ROW.skeletonCount }).map((_, i) => (
                        <Skeleton
                            key={i}
                            className={cn("flex-none aspect-video rounded-md", ROW.cardWidthClass)}
                        />
                    ))
                    : items.map(m => <NetflixCard key={m.id} media={m} priority={priorityImages} />)}
            </div>
        </section>
    )
}
