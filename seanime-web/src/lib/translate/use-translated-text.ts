import { getServerBaseUrl } from "@/api/client/server-url"
import axios from "axios"
import i18n from "@/lib/i18n"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"

const STORAGE_KEY = "kuro-deepl-key"

/** Read the DeepL key the user pasted in Settings → DeepL. */
export function getDeeplKey(): string {
    if (typeof window === "undefined") return ""
    return window.localStorage.getItem(STORAGE_KEY) ?? ""
}

export function setDeeplKey(key: string) {
    if (typeof window === "undefined") return
    if (key) window.localStorage.setItem(STORAGE_KEY, key)
    else window.localStorage.removeItem(STORAGE_KEY)
}

/** Subscribe to changes from any tab so settings updates propagate. */
export function useDeeplKey(): [string, (k: string) => void] {
    const [key, setKey] = useState(getDeeplKey)

    useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            if (e.key === STORAGE_KEY) setKey(e.newValue ?? "")
        }
        window.addEventListener("storage", onStorage)
        return () => window.removeEventListener("storage", onStorage)
    }, [])

    return [
        key,
        (next: string) => {
            setDeeplKey(next)
            setKey(next)
        },
    ]
}

/**
 * Returns `text` translated to the user's current i18n language, or the
 * original `text` if no DeepL key is set / language is English / source is empty.
 *
 * Cached server-side by the backend (sha256(text|target), 30 days) AND
 * client-side by react-query (5 min stale, infinite gc until reload).
 */
export function useTranslatedText(text: string | undefined | null, opts?: { enabled?: boolean }): {
    text: string
    isTranslating: boolean
    error: unknown
} {
    const lang = (i18n.resolvedLanguage ?? i18n.language ?? "en").toLowerCase()
    const target = lang === "fr" ? "FR" : "EN"
    const original = (text ?? "").trim()
    const key = getDeeplKey()

    // Only translate if: text non-empty, target ≠ source assumed-English, key set, opt-in true.
    const shouldTranslate = !!original && target !== "EN" && !!key && (opts?.enabled ?? true)

    const { data, isFetching, error } = useQuery({
        queryKey: ["translate", target, original],
        enabled: shouldTranslate,
        staleTime: 5 * 60 * 1000,
        gcTime: Infinity,
        retry: 1,
        queryFn: async () => {
            const res = await axios.post<{ data: { translated: string } }>(
                `${getServerBaseUrl()}/api/v1/translate`,
                { text: original, target, key },
                { headers: { "Content-Type": "application/json" } },
            )
            return res.data?.data?.translated ?? original
        },
    })

    return {
        text: shouldTranslate ? (data ?? original) : original,
        isTranslating: shouldTranslate && isFetching,
        error,
    }
}
