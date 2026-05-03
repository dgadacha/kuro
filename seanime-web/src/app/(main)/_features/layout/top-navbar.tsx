import { LayoutHeaderBackground } from "@/app/(main)/_features/layout/_components/layout-header-background"
import { TopMenu } from "@/app/(main)/_features/navigation/top-menu"
import { OfflineTopMenu } from "@/app/(main)/_features/offline/_components/offline-top-menu"
import { ManualProgressTrackingButton } from "@/app/(main)/_features/progress-tracking/manual-progress-tracking"
import { PlaybackManagerProgressTrackingButton } from "@/app/(main)/_features/progress-tracking/playback-manager-progress-tracking"
import { useServerStatus } from "@/app/(main)/_hooks/use-server-status"
import { AppSidebarTrigger } from "@/components/ui/app-layout"
import { cn } from "@/components/ui/core/styling"
import { useThemeSettings } from "@/lib/theme/theme-hooks"
import { __isDesktop__ } from "@/types/constants"
import React from "react"
import { PluginSidebarTray } from "../plugin/tray/plugin-sidebar-tray"

type TopNavbarProps = {
    children?: React.ReactNode
}

export function TopNavbar(_props: TopNavbarProps) {
    const serverStatus = useServerStatus()
    const isOffline = serverStatus?.isOffline
    const ts = useThemeSettings()

    return (
        <div
            data-top-navbar
            className={cn(
                "w-full h-[5rem] relative overflow-hidden flex items-center",
                (ts.hideTopNavbar || __isDesktop__) && "lg:hidden",
            )}
        >
            <div
                data-top-navbar-content-container
                className="relative z-10 px-4 w-full flex flex-row md:items-center overflow-x-auto overflow-y-hidden"
            >
                <div data-top-navbar-content className="flex items-center w-full gap-3 z-[90]" style={{ WebkitAppRegion: "no-drag" } as any}>
                    <AppSidebarTrigger />
                    {!isOffline ? <TopMenu /> : <OfflineTopMenu />}
                    <PlaybackManagerProgressTrackingButton />
                    <ManualProgressTrackingButton />
                    <div data-top-navbar-content-separator className="flex flex-1" />
                    <PluginSidebarTray place="top" />
                </div>
            </div>
            <LayoutHeaderBackground />
        </div>
    )
}


type SidebarNavbarProps = {
    isCollapsed: boolean
    handleExpandSidebar: () => void
    handleUnexpandedSidebar: () => void
}

export function SidebarNavbar(props: SidebarNavbarProps) {
    const { handleExpandSidebar, handleUnexpandedSidebar } = props

    const serverStatus = useServerStatus()
    const ts = useThemeSettings()

    if (!ts.hideTopNavbar && !__isDesktop__) return null

    return (
        <div
            data-sidebar-navbar
            className="flex flex-col gap-1"
            onMouseEnter={handleExpandSidebar}
            onMouseLeave={handleUnexpandedSidebar}
        >
            <div data-sidebar-navbar-playback-manager-progress-tracking-button className="flex justify-center">
                <PlaybackManagerProgressTrackingButton asSidebarButton />
            </div>
            <div data-sidebar-navbar-manual-progress-tracking-button className="flex justify-center">
                <ManualProgressTrackingButton asSidebarButton />
            </div>
        </div>
    )
}
