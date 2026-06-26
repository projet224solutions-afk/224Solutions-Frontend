/**
 * DÉTECTEUR AUTOMATIQUE DE TÉLÉCHARGEMENT
 * Détecte l'OS de l'utilisateur et propose la version appropriée
 * 224Solutions - Auto Download System
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
    Download,
    Smartphone,
    Monitor,
    Tablet,
    Apple,
    Chrome,
    Zap,
    CheckCircle,
    ExternalLink,
    QrCode,
    Globe,
    Wifi,
    WifiOff
} from "lucide-react";
import { toast } from "sonner";

interface DownloadOption {
    platform: string;
    name: string;
    icon: React.ReactNode;
    description: string;
    fileSize: string;
    downloadUrl: string;
    installInstructions: string[];
    requirements: string[];
    features: string[];
}

interface DeviceInfo {
    os: string;
    browser: string;
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
}

export default function AutoDownloadDetector() {
    const { t } = useTranslation();
    const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
    const [recommendedDownload, setRecommendedDownload] = useState<DownloadOption | null>(null);
    const [allDownloads, setAllDownloads] = useState<DownloadOption[]>([]);
    const [showAllOptions, setShowAllOptions] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        detectDevice();
        setupDownloadOptions();

        // Écouter les changements de connexion
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /**
     * Détecte les informations de l'appareil
     */
    const detectDevice = () => {
        const userAgent = navigator.userAgent.toLowerCase();
        const platform = navigator.platform.toLowerCase();

        let os = 'unknown';
        let browser = 'unknown';

        // Détection de l'OS
        if (userAgent.includes('android')) {
            os = 'android';
        } else if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
            os = 'ios';
        } else if (platform.includes('win')) {
            os = 'windows';
        } else if (platform.includes('mac')) {
            os = 'macos';
        } else if (platform.includes('linux')) {
            os = 'linux';
        }

        // Détection du navigateur
        if (userAgent.includes('chrome')) {
            browser = 'chrome';
        } else if (userAgent.includes('firefox')) {
            browser = 'firefox';
        } else if (userAgent.includes('safari')) {
            browser = 'safari';
        } else if (userAgent.includes('edge')) {
            browser = 'edge';
        }

        // Détection du type d'appareil
        const isMobile = /android|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
        const isTablet = /ipad|android(?!.*mobile)|tablet/i.test(userAgent);
        const isDesktop = !isMobile && !isTablet;

        const info: DeviceInfo = {
            os,
            browser,
            isMobile,
            isTablet,
            isDesktop
        };

        setDeviceInfo(info);
        console.log('📱 Appareil détecté:', info);
    };

    /**
     * Configure les options de téléchargement
     */
    const setupDownloadOptions = () => {
        const downloads: DownloadOption[] = [
            {
                platform: 'android',
                name: 'Android APK',
                icon: <Smartphone className="w-6 h-6 text-[#ff4000]" />,
                description: t('autoDownloadDetector.applicationNativeAndroidAvecToutes'),
                fileSize: '25 MB',
                downloadUrl: 'https://github.com/projet224solutions-afk/vista-flows/releases/latest/download/224solutions-android.apk',
                installInstructions: [
                    'Téléchargez le fichier APK',
                    'Activez "Sources inconnues" dans Paramètres > Sécurité',
                    'Ouvrez le fichier APK téléchargé',
                    'Suivez les instructions d\'installation',
                    'Lancez l\'application 224Solutions'
                ],
                requirements: [
                    'Android 7.0 ou supérieur',
                    '100 MB d\'espace libre',
                    'Connexion Internet pour la synchronisation'
                ],
                features: [
                    'Interface native Android',
                    'Notifications push',
                    'Mode hors ligne',
                    'Authentification biométrique',
                    'Synchronisation automatique'
                ]
            },
            {
                platform: 'ios',
                name: 'iOS IPA',
                icon: <Apple className="w-6 h-6 text-blue-600" />,
                description: t('autoDownloadDetector.applicationNativeIosOptimiseePour'),
                fileSize: '30 MB',
                downloadUrl: 'https://testflight.apple.com/join/224solutions',
                installInstructions: [
                    'Installez TestFlight depuis l\'App Store',
                    'Cliquez sur le lien d\'invitation',
                    'Acceptez l\'invitation dans TestFlight',
                    'Téléchargez et installez l\'app',
                    'Lancez 224Solutions depuis l\'écran d\'accueil'
                ],
                requirements: [
                    'iOS 13.0 ou supérieur',
                    '150 MB d\'espace libre',
                    'Compte Apple ID',
                    'TestFlight installé'
                ],
                features: [
                    'Interface native iOS',
                    'Touch ID / Face ID',
                    'Notifications push',
                    'Mode hors ligne',
                    'Widgets iOS',
                    'Siri Shortcuts'
                ]
            },
            {
                platform: 'windows',
                name: 'Windows EXE',
                icon: <Monitor className="w-6 h-6 text-blue-500" />,
                description: t('autoDownloadDetector.applicationDesktopWindowsAvecInterface'),
                fileSize: '85 MB',
                downloadUrl: 'https://github.com/projet224solutions-afk/vista-flows/releases/latest/download/224solutions-windows.exe',
                installInstructions: [
                    'Téléchargez le fichier .exe',
                    'Exécutez l\'installateur en tant qu\'administrateur',
                    'Suivez l\'assistant d\'installation',
                    'Créez un raccourci sur le bureau',
                    'Lancez 224Solutions'
                ],
                requirements: [
                    'Windows 10 ou supérieur',
                    '200 MB d\'espace libre',
                    '4 GB de RAM minimum',
                    'Connexion Internet'
                ],
                features: [
                    'Interface desktop native',
                    'Raccourcis clavier',
                    'Notifications système',
                    'Multi-fenêtres',
                    'Impression intégrée',
                    'Export de données'
                ]
            },
            {
                platform: 'macos',
                name: 'macOS DMG',
                icon: <Apple className="w-6 h-6 text-gray-600" />,
                description: t('autoDownloadDetector.applicationMacosOptimiseePourMac'),
                fileSize: '90 MB',
                downloadUrl: 'https://github.com/projet224solutions-afk/vista-flows/releases/latest/download/224solutions-macos.dmg',
                installInstructions: [
                    'Téléchargez le fichier .dmg',
                    'Montez l\'image disque',
                    'Glissez 224Solutions vers Applications',
                    'Lancez depuis le Launchpad',
                    'Autorisez l\'app dans Préférences Système si nécessaire'
                ],
                requirements: [
                    'macOS 11.0 ou supérieur',
                    '200 MB d\'espace libre',
                    '4 GB de RAM minimum',
                    'Connexion Internet'
                ],
                features: [
                    'Interface native macOS',
                    'Touch Bar support',
                    'Notifications système',
                    'Spotlight integration',
                    'iCloud sync',
                    'Dark mode'
                ]
            },
            {
                platform: 'web',
                name: 'Application Web',
                icon: <Globe className="w-6 h-6 text-[#04439e]" />,
                description: t('autoDownloadDetector.accesDirectViaNavigateurAucune'),
                fileSize: 'Streaming',
                downloadUrl: window.location.origin,
                installInstructions: [
                    'Ouvrez votre navigateur web',
                    'Visitez 224solution.net',
                    'Connectez-vous à votre compte',
                    'Ajoutez à l\'écran d\'accueil (optionnel)',
                    'Utilisez directement en ligne'
                ],
                requirements: [
                    'Navigateur moderne (Chrome, Firefox, Safari, Edge)',
                    'Connexion Internet stable',
                    'JavaScript activé'
                ],
                features: [
                    'Accès instantané',
                    'Toujours à jour',
                    'Multi-plateforme',
                    'Aucune installation',
                    'Synchronisation temps réel',
                    'PWA compatible'
                ]
            }
        ];

        setAllDownloads(downloads);

        // Recommander la meilleure option selon l'appareil
        if (deviceInfo) {
            const recommended = downloads.find(d => d.platform === deviceInfo.os) || downloads.find(d => d.platform === 'web');
            setRecommendedDownload(recommended || downloads[downloads.length - 1]);
        }
    };

    /**
     * Lance le téléchargement
     */
    const startDownload = (download: DownloadOption) => {
        if (!isOnline && download.platform !== 'web') {
            toast.error(t('autoDownloadDetector.connexionInternetRequise'), {
                description: t('autoDownloadDetector.veuillezVousConnecterAInternet')
            });
            return;
        }

        toast.info(`🚀 Téléchargement en cours...`, {
            description: `${download.name} - ${download.fileSize}`,
            duration: 5000
        });

        // Ouvrir le lien de téléchargement
        window.open(download.downloadUrl, '_blank', 'noopener,noreferrer');

        // Afficher les instructions
        setTimeout(() => {
            toast.success(t('autoDownloadDetector.telechargementDemarre'), {
                description: t('autoDownloadDetector.consultezLesInstructionsDInstallation'),
                duration: 10000
            });
        }, 1000);
    };

    /**
     * Génère un QR Code pour le téléchargement mobile
     */
    const generateQRCode = (url: string) => {
        // En production, utiliser une vraie librairie QR Code
        return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
    };

    if (!deviceInfo) {
        return (
            <Card className="border-0 shadow-xl rounded-2xl">
                <CardContent className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">{t('autoDownloadDetector.detectionDeVotreAppareil')}</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Statut de connexion */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {isOnline ? (
                        <Wifi className="w-5 h-5 text-[#ff4000]" />
                    ) : (
                        <WifiOff className="w-5 h-5 text-[#ff4000]" />
                    )}
                    <span className={`text-sm font-medium ${isOnline ? 'text-[#ff4000]' : 'text-[#ff4000]'}`}>
                        {isOnline ? 'En ligne' : 'Hors ligne'}
                    </span>
                </div>

                <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                    {deviceInfo.os.charAt(0).toUpperCase() + deviceInfo.os.slice(1)} - {deviceInfo.browser}
                </Badge>
            </div>

            {/* Recommandation automatique */}
            {recommendedDownload && (
                <Card className="border-0 shadow-xl rounded-2xl bg-[#04439e]/5 border-blue-200">
                    <CardHeader>
                        <CardTitle className="text-xl font-bold text-gray-800 flex items-center gap-3">
                            <Zap className="w-6 h-6 text-[#ff4000]" />
                            Recommandé pour votre appareil
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-start gap-6">
                            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg">
                                {recommendedDownload.icon}
                            </div>
                            <div className="flex-1">
                                <h3 className="text-2xl font-bold text-gray-800 mb-2">
                                    {recommendedDownload.name}
                                </h3>
                                <p className="text-gray-600 mb-4">
                                    {recommendedDownload.description}
                                </p>
                                <div className="flex items-center gap-4 text-sm text-gray-500">
                                    <span>📦 {recommendedDownload.fileSize}</span>
                                    <span>📱 {deviceInfo.isMobile ? 'Mobile' : deviceInfo.isTablet ? 'Tablette' : 'Desktop'}</span>
                                    <span>🌐 {deviceInfo.os}</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Fonctionnalités */}
                            <div>
                                <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4 text-[#ff4000]" />
                                    Fonctionnalités
                                </h4>
                                <ul className="space-y-2">
                                    {recommendedDownload.features.slice(0, 4).map((feature, index) => (
                                        <li key={index} className="text-sm text-gray-600 flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                                            {feature}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Prérequis */}
                            <div>
                                <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4 text-orange-600" />
                                    Prérequis
                                </h4>
                                <ul className="space-y-2">
                                    {recommendedDownload.requirements.map((req, index) => (
                                        <li key={index} className="text-sm text-gray-600 flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                                            {req}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* QR Code pour mobile */}
                            {(deviceInfo.isMobile || deviceInfo.isTablet) && (
                                <div className="text-center">
                                    <h4 className="font-semibold text-gray-800 mb-3 flex items-center justify-center gap-2">
                                        <QrCode className="w-4 h-4 text-[#04439e]" />
                                        QR Code
                                    </h4>
                                    <img
                                        src={generateQRCode(recommendedDownload.downloadUrl)}
                                        alt="QR Code"
                                        className="w-24 h-24 mx-auto rounded-lg shadow-md"
                                    />
                                    <p className="text-xs text-gray-500 mt-2">{t('autoDownloadDetector.scannezPourTelecharger')}</p>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-4">
                            <Button
                                onClick={() => startDownload(recommendedDownload)}
                                className="flex-1 bg-[#04439e] rounded-xl py-3 text-lg font-semibold shadow-lg"
                                disabled={!isOnline && recommendedDownload.platform !== 'web'}
                            >
                                <Download className="w-5 h-5 mr-2" />
                                Télécharger Maintenant
                            </Button>

                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="outline" className="rounded-xl border-gray-300 hover:bg-gray-50">
                                        Instructions
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
                                    <DialogHeader>
                                        <DialogTitle className="text-xl font-bold text-gray-800">
                                            Instructions d'installation - {recommendedDownload.name}
                                        </DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                        <ol className="space-y-3">
                                            {recommendedDownload.installInstructions.map((instruction, index) => (
                                                <li key={index} className="flex items-start gap-3">
                                                    <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
                                                        {index + 1}
                                                    </div>
                                                    <span className="text-gray-700">{instruction}</span>
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Toutes les options */}
            <Card className="border-0 shadow-xl rounded-2xl">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-xl font-bold text-gray-800">
                            Toutes les Versions Disponibles
                        </CardTitle>
                        <Button
                            variant="outline"
                            onClick={() => setShowAllOptions(!showAllOptions)}
                            className="rounded-xl"
                        >
                            {showAllOptions ? 'Masquer' : 'Afficher Tout'}
                        </Button>
                    </div>
                </CardHeader>
                {showAllOptions && (
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {allDownloads.map((download) => (
                                <Card key={download.platform} className="border border-gray-200 hover:shadow-lg transition-all duration-300">
                                    <CardContent className="p-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            {download.icon}
                                            <h3 className="font-bold text-gray-800">{download.name}</h3>
                                        </div>
                                        <p className="text-sm text-gray-600 mb-4">{download.description}</p>
                                        <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                                            <span>📦 {download.fileSize}</span>
                                            <Badge className="bg-gray-100 text-gray-700 text-xs">
                                                {download.platform}
                                            </Badge>
                                        </div>
                                        <Button
                                            onClick={() => startDownload(download)}
                                            variant="outline"
                                            className="w-full rounded-xl"
                                            disabled={!isOnline && download.platform !== 'web'}
                                        >
                                            <Download className="w-4 h-4 mr-2" />
                                            Télécharger
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </CardContent>
                )}
            </Card>
        </div>
    );
}
