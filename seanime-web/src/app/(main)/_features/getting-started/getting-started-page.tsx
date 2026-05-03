import { Status } from "@/api/generated/types"
import { useGettingStarted } from "@/api/hooks/settings.hooks"
import { useSetServerStatus } from "@/app/(main)/_hooks/use-server-status"
import { LoadingOverlayWithLogo } from "@/components/shared/loading-overlay-with-logo"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { cn } from "@/components/ui/core/styling"
import { Field, Form } from "@/components/ui/form"
import { useRouter } from "@/lib/navigation"
import {
    DEFAULT_TORRENT_PROVIDER,
    getDefaultIinaSocket,
    getDefaultMpvSocket,
    getDefaultSettings,
    gettingStartedSchema,
    useDefaultSettingsPaths,
} from "@/lib/server/settings"
import { __isDesktop__, __isElectronDesktop__ } from "@/types/constants"
import { AnimatePresence, motion } from "motion/react"
import React from "react"
import { useWatch } from "react-hook-form"
import { BiChevronLeft, BiChevronRight, BiPlay, BiRocket } from "react-icons/bi"
import { FaDiscord } from "react-icons/fa"
import { HiOutlineDesktopComputer } from "react-icons/hi"
import { HiEye, HiGlobeAlt, HiServerStack } from "react-icons/hi2"
import { ImDownload } from "react-icons/im"
import { IoPlayForwardCircleSharp } from "react-icons/io5"
import { MdOutlineBroadcastOnHome } from "react-icons/md"
import { SiMpv, SiVlcmediaplayer } from "react-icons/si"

const STEPS = [
    { id: "player", title: "Lecteur", subtitle: "Choisis ton lecteur vidéo" },
    { id: "debrid", title: "Debrid", subtitle: "Optionnel — service de cache premium" },
    { id: "features", title: "Fonctionnalités", subtitle: "Active ce qui t'intéresse" },
] as const

const stepVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 24 : -24, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir < 0 ? 24 : -24, opacity: 0 }),
}

function NetflixHeader({ currentStep }: { currentStep: number }) {
    return (
        <div className="space-y-8 mb-12 text-center">
            <div className="flex items-center justify-center gap-3">
                <img src="/kuro-logo.svg" alt="Kuro" className="size-14" />
                <span className="text-5xl font-extrabold tracking-tight text-white">KURO</span>
            </div>

            {/* Linear progress bar — Netflix-style */}
            <div className="max-w-md mx-auto px-6">
                <div className="flex items-center justify-between mb-3 text-xs uppercase tracking-widest text-[--muted]">
                    <span>Étape {currentStep + 1} / {STEPS.length}</span>
                    <span className="text-white font-semibold">{STEPS[currentStep].title}</span>
                </div>
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-brand-500"
                        initial={false}
                        animate={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                    />
                </div>
            </div>

            <p className="text-[--muted] text-sm">
                Tous ces réglages sont modifiables plus tard dans Settings.
            </p>
        </div>
    )
}

function StepShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center space-y-3">
                <h2 className="text-3xl lg:text-4xl font-extrabold text-white">{title}</h2>
                <p className="text-[--muted] text-sm">{description}</p>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/10 p-6">
                {children}
            </div>
        </div>
    )
}

function PlayerStep({ status }: { status: Status }) {
    const defaultPlayer = useWatch({ name: "defaultPlayer" })

    return (
        <StepShell
            title={`${__isDesktop__ ? "Lecteur " : ""}externe`}
            description="Configure le lecteur qui prendra en charge la lecture vidéo et le suivi de progression."
        >
            {__isElectronDesktop__ && (
                <Alert
                    intent="info-basic"
                    className="mb-4"
                    description="Kuro Denshi inclut un lecteur natif activé par défaut. Tu peux quand même configurer un lecteur externe ici."
                />
            )}

            <div className="space-y-6">
                <Field.Select
                    name="defaultPlayer"
                    label="Lecteur"
                    help={status?.os !== "darwin"
                        ? "MPV est recommandé pour les sous-titres et le torrent streaming."
                        : "MPV ou IINA recommandés sur macOS."}
                    required
                    leftIcon={<BiPlay className="text-brand-500" />}
                    options={[
                        { label: "MPV (recommandé)", value: "mpv" },
                        { label: "VLC", value: "vlc" },
                        ...(status?.os === "windows" ? [{ label: "MPC-HC", value: "mpc-hc" }] : []),
                        ...(status?.os === "darwin" ? [{ label: "IINA", value: "iina" }] : []),
                    ]}
                />

                <AnimatePresence mode="wait">
                    {defaultPlayer === "mpv" && (
                        <motion.div
                            key="mpv"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-3 p-4 rounded-lg bg-black/40 border border-white/5"
                        >
                            <div className="flex items-center gap-3">
                                <SiMpv className="size-5 text-brand-400" />
                                <h4 className="font-semibold text-white">MPV</h4>
                            </div>
                            <p className="text-xs text-[--muted]">
                                Sur Windows, installe MPV via Scoop ou Chocolatey. Sur macOS, via Homebrew.
                            </p>
                            <Field.Text name="mpvSocket" label="Socket / Pipe" />
                        </motion.div>
                    )}

                    {defaultPlayer === "iina" && (
                        <motion.div
                            key="iina"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-3 p-4 rounded-lg bg-black/40 border border-white/5"
                        >
                            <div className="flex items-center gap-3">
                                <IoPlayForwardCircleSharp className="size-5 text-brand-400" />
                                <h4 className="font-semibold text-white">IINA</h4>
                            </div>
                            <Field.Text name="iinaSocket" label="Socket / Pipe" />
                            <Alert
                                intent="info-basic"
                                description={
                                    <p className="text-xs">
                                        Dans IINA → Préférences générales : <strong>Quitter après fermeture</strong> doit être <span
                                        className="underline"
                                    >coché</span>, et <strong>Garder la fenêtre ouverte après lecture</strong> <span className="underline">décoché</span>.
                                    </p>
                                }
                            />
                        </motion.div>
                    )}

                    {defaultPlayer === "vlc" && (
                        <motion.div
                            key="vlc"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-3 p-4 rounded-lg bg-black/40 border border-white/5"
                        >
                            <div className="flex items-center gap-3">
                                <SiVlcmediaplayer className="size-5 text-brand-400" />
                                <h4 className="font-semibold text-white">VLC</h4>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Field.Text name="mediaPlayerHost" label="Host" />
                                <Field.Number name="vlcPort" label="Port" formatOptions={{ useGrouping: false }} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Field.Text name="vlcUsername" label="Username" />
                                <Field.Text name="vlcPassword" label="Password" type="password" />
                            </div>
                            <Field.Text name="vlcPath" label="Chemin VLC" />
                        </motion.div>
                    )}

                    {defaultPlayer === "mpc-hc" && (
                        <motion.div
                            key="mpc-hc"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-3 p-4 rounded-lg bg-black/40 border border-white/5"
                        >
                            <div className="flex items-center gap-3">
                                <HiOutlineDesktopComputer className="size-5 text-brand-400" />
                                <h4 className="font-semibold text-white">MPC-HC</h4>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Field.Text name="mediaPlayerHost" label="Host" />
                                <Field.Number name="mpcPort" label="Port" formatOptions={{ useGrouping: false }} />
                            </div>
                            <Field.Text name="mpcPath" label="Chemin MPC-HC" />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </StepShell>
    )
}

function DebridStep() {
    const debridProvider = useWatch({ name: "debridProvider" })

    return (
        <StepShell
            title="Debrid (optionnel)"
            description="Les services de debrid (Real-Debrid, AllDebrid, TorBox) offrent du streaming instantané depuis le cloud. Laisse vide si tu n'en as pas."
        >
            <div className="space-y-5">
                <Field.Select
                    name="debridProvider"
                    label="Service"
                    leftIcon={<HiServerStack className="text-brand-500" />}
                    options={[
                        { label: "Aucun", value: "none" },
                        { label: "TorBox", value: "torbox" },
                        { label: "Real-Debrid", value: "realdebrid" },
                        { label: "AllDebrid", value: "alldebrid" },
                    ]}
                />

                <AnimatePresence>
                    {debridProvider && debridProvider !== "none" && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="p-4 rounded-lg bg-black/40 border border-white/5"
                        >
                            <Field.Text
                                name="debridApiKey"
                                label="Clé API"
                                help="Fournie par ton service debrid."
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </StepShell>
    )
}

const FEATURES = [
    {
        name: "enableTorrentStreaming",
        icon: ImDownload,
        title: "Torrent streaming",
        description: "Lance la lecture pendant que le torrent se télécharge",
    },
    {
        name: "enableOnlinestream",
        icon: HiGlobeAlt,
        title: "Online streaming",
        description: "Regarde via les sources en ligne (extensions)",
    },
    {
        name: "enableAdultContent",
        icon: HiEye,
        title: "Contenu NSFW",
        description: "Affiche le contenu adulte dans les recherches",
    },
    {
        name: "enableRichPresence",
        icon: FaDiscord,
        title: "Discord Rich Presence",
        description: "Affiche ce que tu regardes sur Discord",
    },
    {
        name: "enableTranscode",
        icon: MdOutlineBroadcastOnHome,
        title: "Transcoding",
        description: "Stream les fichiers locaux vers d'autres appareils",
    },
] as const

function FeaturesStep() {
    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="text-center space-y-3">
                <h2 className="text-3xl lg:text-4xl font-extrabold text-white">Fonctionnalités</h2>
                <p className="text-[--muted] text-sm">
                    Active ce que tu veux. Modifiable plus tard dans Settings.
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {FEATURES.map((feature) => (
                    <Field.Checkbox
                        key={feature.name}
                        name={feature.name}
                        size="lg"
                        label={
                            <div className="flex items-start gap-3 p-4">
                                <div className="size-10 rounded-lg flex items-center justify-center bg-brand-500/15 border border-brand-500/30 text-brand-400 shrink-0">
                                    <feature.icon className="size-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-sm text-white">{feature.title}</h3>
                                    <p className="text-xs text-[--muted] mt-0.5 leading-relaxed">
                                        {feature.description}
                                    </p>
                                </div>
                            </div>
                        }
                        labelClass={cn(
                            "block cursor-pointer transition-all duration-200 overflow-hidden w-full rounded-xl",
                            "bg-white/[0.03] hover:bg-white/[0.06]",
                            "border border-white/10",
                            "data-[checked=true]:bg-brand-500/10 data-[checked=true]:border-brand-500/50",
                        )}
                        containerClass="flex items-center justify-between h-full"
                        className="absolute top-2 right-2 z-10"
                        fieldClass="relative"
                    />
                ))}
            </div>
        </div>
    )
}

export function GettingStartedPage({ status }: { status: Status }) {
    const router = useRouter()
    const { getDefaultVlcPath, getDefaultQBittorrentPath, getDefaultTransmissionPath } = useDefaultSettingsPaths()
    const setServerStatus = useSetServerStatus()
    const { mutate, data, isPending } = useGettingStarted()

    const [currentStep, setCurrentStep] = React.useState(0)
    const [direction, setDirection] = React.useState(0)

    React.useEffect(() => {
        if (!isPending && !!data?.settings) {
            setServerStatus(data)
            router.push("/")
        }
    }, [data, isPending])

    const vlcDefaultPath = React.useMemo(() => getDefaultVlcPath(status.os), [status.os])
    const qbittorrentDefaultPath = React.useMemo(() => getDefaultQBittorrentPath(status.os), [status.os])
    const transmissionDefaultPath = React.useMemo(() => getDefaultTransmissionPath(status.os), [status.os])
    const mpvSocketPath = React.useMemo(() => getDefaultMpvSocket(status.os), [status.os])
    const iinaSocketPath = React.useMemo(() => getDefaultIinaSocket(status.os), [status.os])

    const isLast = currentStep === STEPS.length - 1
    const isFirst = currentStep === 0

    const next = () => {
        if (!isLast) {
            setDirection(1)
            setCurrentStep((s) => s + 1)
        }
    }
    const prev = () => {
        if (!isFirst) {
            setDirection(-1)
            setCurrentStep((s) => s - 1)
        }
    }

    if (isPending) return <LoadingOverlayWithLogo />

    if (!data) return (
        <div className="min-h-screen bg-black relative overflow-hidden">
            {/* Subtle red ambient glow — Netflix wash */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute -top-32 left-1/2 -translate-x-1/2 size-[60rem] bg-brand-500/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-0 right-0 size-[40rem] bg-brand-700/10 rounded-full blur-[100px]" />
            </div>

            <div className="container max-w-5xl mx-auto px-4 py-10 relative z-10">
                <Form
                    schema={gettingStartedSchema}
                    onSubmit={(d) => {
                        if (isLast) mutate(getDefaultSettings(d))
                        else next()
                    }}
                    defaultValues={{
                        mediaPlayerHost: "127.0.0.1",
                        vlcPort: 8080,
                        mpcPort: 13579,
                        defaultPlayer: "mpv",
                        vlcPath: vlcDefaultPath,
                        qbittorrentPath: qbittorrentDefaultPath,
                        qbittorrentHost: "127.0.0.1",
                        qbittorrentPort: 8081,
                        transmissionPath: transmissionDefaultPath,
                        transmissionHost: "127.0.0.1",
                        transmissionPort: 9091,
                        mpcPath: "C:/Program Files/MPC-HC/mpc-hc64.exe",
                        torrentProvider: DEFAULT_TORRENT_PROVIDER,
                        mpvSocket: mpvSocketPath,
                        iinaSocket: iinaSocketPath,
                        enableRichPresence: false,
                        autoScan: false,
                        enableManga: false,
                        enableOnlinestream: true,
                        enableAdultContent: false,
                        enableTorrentStreaming: true,
                        enableTranscode: false,
                        debridProvider: "none",
                        debridApiKey: "",
                        nakamaUsername: "",
                        enableWatchContinuity: true,
                    }}
                >
                    {() => (
                        <div className="space-y-10">
                            <NetflixHeader currentStep={currentStep} />

                            <AnimatePresence mode="wait" custom={direction}>
                                <motion.div
                                    key={currentStep}
                                    custom={direction}
                                    variants={stepVariants}
                                    initial="enter"
                                    animate="center"
                                    exit="exit"
                                    transition={{ x: { duration: 0.3, ease: "easeOut" }, opacity: { duration: 0.2 } }}
                                >
                                    {currentStep === 0 && <PlayerStep status={status} />}
                                    {currentStep === 1 && <DebridStep />}
                                    {currentStep === 2 && <FeaturesStep />}
                                </motion.div>
                            </AnimatePresence>

                            <motion.div
                                className="flex justify-between items-center max-w-2xl mx-auto pt-8"
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                            >
                                <Button
                                    type="button"
                                    intent="gray-subtle"
                                    onClick={(e) => { e.preventDefault(); prev() }}
                                    disabled={isFirst}
                                    leftIcon={<BiChevronLeft className="text-xl" />}
                                    className="bg-white/10 hover:bg-white/20 !text-white"
                                >
                                    Précédent
                                </Button>

                                {isLast ? (
                                    <Button
                                        type="submit"
                                        loading={isPending}
                                        rightIcon={<BiRocket className="size-5" />}
                                        className="bg-brand-500 hover:bg-brand-600 !text-white font-bold px-8 rounded-md"
                                    >
                                        Lancer Kuro
                                    </Button>
                                ) : (
                                    <Button
                                        type="button"
                                        onClick={(e) => { e.preventDefault(); next() }}
                                        rightIcon={<BiChevronRight className="text-xl" />}
                                        className="bg-brand-500 hover:bg-brand-600 !text-white font-bold px-8 rounded-md"
                                    >
                                        Continuer
                                    </Button>
                                )}
                            </motion.div>
                        </div>
                    )}
                </Form>

                <p className="text-center text-[--muted]/60 text-xs mt-12">
                    Kuro · forké de Kuro
                </p>
            </div>
        </div>
    )
}

