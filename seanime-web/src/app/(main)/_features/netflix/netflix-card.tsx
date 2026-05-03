import { AL_BaseAnime } from "@/api/generated/types"
import { FORMAT_LABEL, ROW } from "@/app/(main)/_features/netflix/netflix.constants"
import { SeaImage } from "@/components/shared/sea-image"
import { SeaLink } from "@/components/shared/sea-link"
import { cn } from "@/components/ui/core/styling"
import React from "react"

type Props = {
    media: AL_BaseAnime
    /** Hint loader to fetch eagerly for above-the-fold rows. */
    priority?: boolean
}

export const NetflixCard = React.memo(function NetflixCard({ media, priority }: Props) {
    const img = media.bannerImage || media.coverImage?.extraLarge || media.coverImage?.large || ""
    const title = media.title?.userPreferred || ""

    const meta = React.useMemo(() => {
        const parts: string[] = []
        if (media.seasonYear) parts.push(String(media.seasonYear))
        if (media.format) parts.push(FORMAT_LABEL[media.format] ?? media.format)
        if (media.episodes) parts.push(`${media.episodes} ép.`)
        return parts.join(" • ")
    }, [media.seasonYear, media.format, media.episodes])

    return (
        <SeaLink
            href={`/entry?id=${media.id}`}
            aria-label={title}
            className={cn(
                "group relative flex-none snap-start",
                ROW.cardWidthClass,
                "aspect-video rounded-md overflow-hidden bg-gray-900",
                "ring-0 ring-brand-500 hover:ring-2 transition-[transform,box-shadow,outline] duration-200",
                "hover:scale-[1.05] hover:z-[2] hover:shadow-2xl transform-gpu",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500",
            )}
        >
            {img && (
                <SeaImage
                    src={img}
                    alt={title}
                    fill
                    priority={priority}
                    className="object-cover object-center"
                />
            )}

            <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/95 via-black/60 to-transparent">
                <p className="text-white font-semibold text-sm lg:text-base line-clamp-1 drop-shadow-md">
                    {title}
                </p>
                {!!meta && (
                    <p className="text-gray-300 text-xs mt-0.5 line-clamp-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        {meta}
                    </p>
                )}
            </div>
        </SeaLink>
    )
})
