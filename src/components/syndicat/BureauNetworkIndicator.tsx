/**
 * INDICATEUR DE STATUT RÉSEAU - BUREAU SYNDICAT
 * Affiche le statut de connexion et les données en attente
 * 224SOLUTIONS - Bureau Syndicat
 */

import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, RefreshCw, AlertCircle } from "lucide-react";
import { useBureauOfflineSync } from '@/hooks/useBureauOfflineSync';

interface Props {
  bureauId: string;
}

export default function BureauNetworkIndicator({ bureauId }: Props) {
    const { isOnline, isSyncing, syncStats } = useBureauOfflineSync(bureauId);

    const getStatusColor = () => {
        if (isSyncing) return "bg-blue-500";
        if (!isOnline) return "bg-[#ff4000]";
        if (syncStats.pending > 0) return "bg-[#ff4000]";
        if (syncStats.failed > 0) return "bg-orange-500";
        return "bg-[#ff4000]";
    };

    const getStatusText = () => {
        if (isSyncing) return "Sync...";
        if (!isOnline) return "Hors ligne";
        if (syncStats.pending > 0) return `${syncStats.pending} en attente`;
        if (syncStats.failed > 0) return `${syncStats.failed} erreurs`;
        return "En ligne";
    };

    const getStatusIcon = () => {
        if (isSyncing) {
            return <RefreshCw className="w-3 h-3 animate-spin" />;
        }
        if (!isOnline) {
            return <WifiOff className="w-3 h-3" />;
        }
        if (syncStats.failed > 0) {
            return <AlertCircle className="w-3 h-3" />;
        }
        return <Wifi className="w-3 h-3" />;
    };

    return (
        <Badge
            className={`${getStatusColor()} text-white text-xs px-2 py-1 flex items-center gap-1`}
            variant="default"
        >
            {getStatusIcon()}
            {getStatusText()}
        </Badge>
    );
}
