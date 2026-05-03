import { AL_BaseAnime, AL_MediaListStatus } from "@/api/generated/types"
import { useGetAnimeCollection } from "@/api/hooks/anilist.hooks"
import { NetflixCard } from "@/app/(main)/_features/netflix/netflix-card"
import { cn } from "@/components/ui/core/styling"
import { Skeleton } from "@/components/ui/skeleton"
import { TextInput } from "@/components/ui/text-input"
import { useDebounce } from "@/hooks/use-debounce"
import React from "react"
import { useTranslation } from "react-i18next"
import { FiSearch } from "react-icons/fi"

type ListKey = "all" | "current" | "planning" | "completed" | "paused" | "dropped"

const STATUS_BY_KEY: Record<Exclude<ListKey, "all">, AL_MediaListStatus> = {
    current: "CURRENT",
    planning: "PLANNING",
    completed: "COMPLETED",
    paused: "PAUSED",
    dropped: "DROPPED",
}

export function NetflixLists() {
    const { t } = useTranslation()
    const { data, isLoading } = useGetAnimeCollection()

    const [active, setActive] = React.useState<ListKey>("current")
    const [searchInput, setSearchInput] = React.useState("")
    const search = useDebounce(searchInput.trim().toLowerCase(), 250)

    const allEntries = React.useMemo(() => {
        const lists = data?.MediaListCollection?.lists ?? []
        if (active === "all") {
            return lists.flatMap(l => l?.entries ?? []).filter(Boolean)
        }
        const target = STATUS_BY_KEY[active]
        const list = lists.find(l => l?.status === target)
        return (list?.entries ?? []).filter(Boolean)
    }, [data, active])

    const media = React.useMemo<AL_BaseAnime[]>(() => {
        const items = allEntries.map(e => e!.media).filter(Boolean) as AL_BaseAnime[]
        if (!search) return items
        return items.filter(m => {
            const titles = [
                m.title?.userPreferred,
                m.title?.romaji,
                m.title?.english,
                m.title?.native,
            ].filter(Boolean) as string[]
            return titles.some(t => t.toLowerCase().includes(search))
        })
    }, [allEntries, search])

    const tabs: { key: ListKey; label: string }[] = [
        { key: "current", label: t("lists.tabs.current") },
        { key: "planning", label: t("lists.tabs.planning") },
        { key: "completed", label: t("lists.tabs.completed") },
        { key: "paused", label: t("lists.tabs.paused") },
        { key: "dropped", label: t("lists.tabs.dropped") },
        { key: "all", label: t("lists.tabs.all") },
    ]

    return (
        <div className="px-6 lg:px-16 py-8 space-y-8">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                <h1 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
                    {t("lists.title")}
                </h1>

                <div className="lg:w-80">
                    <TextInput
                        placeholder={t("lists.search_placeholder")}
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        leftIcon={<FiSearch />}
                        className="bg-white/5 border-white/10 !text-white placeholder:text-[--muted] rounded-md"
                    />
                </div>
            </div>

            {/* Pill tabs */}
            <div className="flex flex-wrap items-center gap-2">
                {tabs.map(tab => {
                    const isActive = active === tab.key
                    return (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActive(tab.key)}
                            className={cn(
                                "px-4 py-1.5 text-sm font-semibold rounded-full transition-colors",
                                isActive
                                    ? "bg-brand-500 text-white"
                                    : "bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white",
                            )}
                        >
                            {tab.label}
                        </button>
                    )
                })}
            </div>

            {/* Grid */}
            {isLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <Skeleton key={i} className="w-full aspect-video rounded-md" />
                    ))}
                </div>
            ) : media.length === 0 ? (
                <div className="text-center py-20 text-[--muted]">
                    {search ? t("lists.no_match") : t("lists.empty")}
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                    {media.map(m => <NetflixCard key={m.id} media={m} />)}
                </div>
            )}
        </div>
    )
}
