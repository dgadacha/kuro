import { NavigationMenu, NavigationMenuProps } from "@/components/ui/navigation-menu"
import { usePathname } from "@/lib/navigation"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

interface TopMenuProps {
    children?: React.ReactNode
}

export const TopMenu: React.FC<TopMenuProps> = () => {
    const { t } = useTranslation()
    const pathname = usePathname()

    const navigationItems = useMemo<NavigationMenuProps["items"]>(() => {
        return [
            { href: "/", isCurrent: pathname === "/", name: t("nav.home") },
            { href: "/schedule", icon: null, isCurrent: pathname.startsWith("/schedule"), name: t("nav.schedule") },
            { href: "/lists", icon: null, isCurrent: pathname.startsWith("/lists"), name: t("nav.lists") },
            {
                href: "/discover",
                icon: null,
                isCurrent: pathname.startsWith("/discover") || pathname.startsWith("/search"),
                name: t("nav.discover"),
            },
        ]
    }, [t, pathname])

    return (
        <NavigationMenu
            className="p-0 hidden lg:inline-block"
            items={navigationItems}
            desktopListClass="space-x-0"
            data-top-menu
        />
    )
}
