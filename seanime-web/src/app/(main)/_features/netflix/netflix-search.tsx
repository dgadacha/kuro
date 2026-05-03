import { AL_BaseAnime } from "@/api/generated/types"
import { useAnilistListAnime } from "@/api/hooks/anilist.hooks"
import { NetflixCard } from "@/app/(main)/_features/netflix/netflix-card"
import { Skeleton } from "@/components/ui/skeleton"
import { TextInput } from "@/components/ui/text-input"
import { useDebounce } from "@/hooks/use-debounce"
import React from "react"
import { useTranslation } from "react-i18next"
import { FiSearch } from "react-icons/fi"

export function NetflixSearch() {
    const { t } = useTranslation()
    const [input, setInput] = React.useState("")
    const debounced = useDebounce(input.trim(), 350)

    const enabled = debounced.length >= 2

    const { data, isFetching } = useAnilistListAnime(
        {
            search: debounced,
            page: 1,
            perPage: 36,
            sort: ["SEARCH_MATCH"],
            status: ["FINISHED", "RELEASING", "NOT_YET_RELEASED", "CANCELLED", "HIATUS"],
        },
        enabled,
    )

    const media = (data?.Page?.media ?? []).filter((m): m is AL_BaseAnime => !!m)

    return (
        <div className="px-6 lg:px-16 py-8 space-y-8">
            <div className="max-w-3xl mx-auto space-y-4 text-center">
                <h1 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
                    {t("search.title")}
                </h1>
                <TextInput
                    autoFocus
                    placeholder={t("search.placeholder")}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    leftIcon={<FiSearch className="size-5" />}
                    className="!h-14 !text-lg bg-white/5 border-white/10 !text-white placeholder:text-[--muted] rounded-full px-6"
                />
            </div>

            {!enabled && (
                <p className="text-center text-[--muted] py-12">
                    {t("search.start_typing")}
                </p>
            )}

            {enabled && isFetching && media.length === 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <Skeleton key={i} className="w-full aspect-video rounded-md" />
                    ))}
                </div>
            )}

            {enabled && !isFetching && media.length === 0 && (
                <p className="text-center text-[--muted] py-12">
                    {t("search.no_results")}
                </p>
            )}

            {media.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                    {media.map(m => <NetflixCard key={m.id} media={m} />)}
                </div>
            )}
        </div>
    )
}
