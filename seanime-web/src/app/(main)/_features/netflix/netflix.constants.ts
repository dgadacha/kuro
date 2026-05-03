export const HERO = {
    rotateMs: 12_000,
    poolSize: 8,
    /** Heights tuned to match 16:9 banner aspect on common viewports. */
    heightClass: "h-[85vh] min-h-[560px]",
} as const

export const ROW = {
    cardWidthClass: "w-[260px] lg:w-[340px]",
    /** Vertical breathing room so hover-scale doesn't get clipped by overflow. */
    scrollPaddingY: "py-3",
    skeletonCount: 8,
} as const

export const FORMAT_LABEL: Record<string, string> = {
    TV: "Série",
    TV_SHORT: "Court",
    MOVIE: "Film",
    SPECIAL: "Spécial",
    OVA: "OVA",
    ONA: "ONA",
    MUSIC: "Musique",
}
