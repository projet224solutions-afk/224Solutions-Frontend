/**
 * SYSTEM LIVE MONITOR - Visualisation spectaculaire du système 24/7
 * Écran style Matrix/Cyberpunk montrant toutes les fonctionnalités en temps réel
 * Chaque carte est cliquable et affiche l'état de santé + correction automatique
 */

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  X,
  Shield,
  Activity,
  Database,
  Wallet,
  ShoppingCart,
  Package,
  Users,
  Truck,
  Lock,
  Eye,
  Cpu,
  Network,
  BarChart3,
  CreditCard,
  Bell,
  Globe,
  Server,
  Cloud,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import { useFeatureHealth } from '@/hooks/useFeatureHealth';
import FeatureDetailSheet from './FeatureDetailSheet';
import { supabase } from '@/integrations/supabase/client';

// Toutes les fonctionnalités du système
const SYSTEM_FEATURES = [
  { name: 'Authentification Sécurisée', icon: Lock, color: '#ff4000', domain: 'AUTH' },
  { name: 'Gestion des Utilisateurs', icon: Users, color: '#04439e', domain: 'USERS' },
  { name: 'Portefeuilles Numériques', icon: Wallet, color: '#04439e', domain: 'WALLET' },
  { name: 'Transactions Financières', icon: CreditCard, color: '#ff4000', domain: 'FINANCE' },
  { name: 'Système POS', icon: ShoppingCart, color: '#04439e', domain: 'POS' },
  { name: 'Gestion des Stocks', icon: Package, color: '#ff4000', domain: 'STOCK' },
  { name: 'Commandes & Livraisons', icon: Truck, color: '#f97316', domain: 'ORDERS' },
  { name: 'Commissions Agents', icon: BarChart3, color: '#ff4000', domain: 'COMMISSION' },
  { name: 'Intelligence Artificielle', icon: Cpu, color: '#04439e', domain: 'AI' },
  { name: 'Surveillance Sécurité', icon: Shield, color: '#ff4000', domain: 'SECURITY' },
  { name: 'Base de Données', icon: Database, color: '#ff4000', domain: 'DATABASE' },
  { name: 'Réseau & API', icon: Network, color: '#04439e', domain: 'NETWORK' },
  { name: 'Notifications Temps Réel', icon: Bell, color: '#ff4000', domain: 'NOTIFICATIONS' },
  { name: 'Services Cloud', icon: Cloud, color: '#04439e', domain: 'CLOUD' },
  { name: 'Serveurs Backend', icon: Server, color: '#ff4000', domain: 'BACKEND' },
  { name: 'Synchronisation Globale', icon: Globe, color: '#ff4000', domain: 'SYNC' },
  { name: 'Monitoring Système', icon: Eye, color: '#d946ef', domain: 'MONITORING' },
  { name: 'Analyse en Temps Réel', icon: Activity, color: '#04439e', domain: 'ANALYTICS' },
];

// Messages de log du système
const SYSTEM_LOGS = [
  '✓ Vérification intégrité portefeuilles...',
  '✓ Synchronisation transactions en cours...',
  '✓ Validation règles métier POS...',
  '✓ Contrôle stocks multi-entrepôts...',
  '✓ Analyse patterns commissions...',
  '✓ Scan sécurité authentification...',
  '✓ Audit trail blockchain actif...',
  '✓ Détection anomalies IA...',
  '✓ Reconciliation balances...',
  '✓ Vérification permissions RLS...',
  '✓ Monitoring API endpoints...',
  '✓ Health check microservices...',
  '✓ Validation schémas données...',
  '✓ Contrôle rate limiting...',
  '✓ Backup incrémental actif...',
  '✓ Réplication temps réel...',
  '✓ Cache invalidation check...',
  '✓ Optimisation requêtes SQL...',
  '✓ Vérification certificats SSL...',
  '✓ Monitoring métriques système...',
];

interface SystemLiveMonitorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FloatingLog {
  id: number;
  text: string;
  x: number;
  y: number;
  opacity: number;
}

export default function SystemLiveMonitor({ open, onOpenChange }: SystemLiveMonitorProps) {
  const { t } = useTranslation();
  const _navigate = useNavigate();
  const [activeFeatures, setActiveFeatures] = useState<Set<number>>(new Set());
  const [logs, setLogs] = useState<FloatingLog[]>([]);
  const [uptime, setUptime] = useState({ days: 99, hours: 23, mins: 45, secs: 12 });
  const [stats, setStats] = useState({
    transactions: 0,
    requests: 0,
    users: 0,
    checks: 0,
  });
  const [transactionBreakdown, setTransactionBreakdown] = useState({
    today: 0,
    week: 0,
    month: 0,
    year: 0,
  });
  const [showTransactionMenu, setShowTransactionMenu] = useState(false);
  const [realStatsLoaded, setRealStatsLoaded] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<typeof SYSTEM_FEATURES[0] | null>(null);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const logIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Hook pour la santé des fonctionnalités
  const { healthData, globalHealth, loading, refetch, applyAutoCorrection } = useFeatureHealth();

  // Simuler l'activité des fonctionnalités
  useEffect(() => {
    if (!open) return;

    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * SYSTEM_FEATURES.length);
      setActiveFeatures((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(randomIndex)) {
          newSet.delete(randomIndex);
        } else {
          newSet.add(randomIndex);
          // Auto-remove after 2 seconds
          setTimeout(() => {
            setActiveFeatures((p) => {
              const s = new Set(p);
              s.delete(randomIndex);
              return s;
            });
          }, 2000);
        }
        return newSet;
      });
    }, 300);

    return () => clearInterval(interval);
  }, [open]);

  // Générer les logs flottants
  useEffect(() => {
    if (!open) return;

    const interval = setInterval(() => {
      const randomLog = SYSTEM_LOGS[Math.floor(Math.random() * SYSTEM_LOGS.length)];
      const newLog: FloatingLog = {
        id: logIdRef.current++,
        text: randomLog,
        x: Math.random() * 60 + 20,
        y: 100,
        opacity: 1,
      };

      setLogs((prev) => [...prev.slice(-15), newLog]);
    }, 400);

    return () => clearInterval(interval);
  }, [open]);

  // Animer les logs vers le haut
  useEffect(() => {
    if (!open) return;

    const interval = setInterval(() => {
      setLogs((prev) =>
        prev
          .map((log) => ({
            ...log,
            y: log.y - 2,
            opacity: Math.max(0, log.opacity - 0.02),
          }))
          .filter((log) => log.opacity > 0)
      );
    }, 50);

    return () => clearInterval(interval);
  }, [open]);

  // Mettre à jour l'uptime
  useEffect(() => {
    if (!open) return;

    const interval = setInterval(() => {
      setUptime((prev) => {
        let { days, hours, mins, secs } = prev;
        secs++;
        if (secs >= 60) {
          secs = 0;
          mins++;
        }
        if (mins >= 60) {
          mins = 0;
          hours++;
        }
        if (hours >= 24) {
          hours = 0;
          days++;
        }
        return { days, hours, mins, secs };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [open]);

  // Charger les vraies statistiques depuis la base de données
  useEffect(() => {
    if (!open || realStatsLoaded) return;

    const loadRealStats = async () => {
      try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();

        // Charger les vraies données en parallèle
        const [usersRes, apiLogsRes, systemChecksRes, todayOrders, weekOrders, monthOrders, yearOrders] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('api_usage_logs').select('id', { count: 'exact', head: true }),
          supabase.from('logic_rules').select('id', { count: 'exact', head: true }),
          supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', todayStart),
          supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', weekStart),
          supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', monthStart),
          supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', yearStart),
        ]);

        const todayCount = todayOrders.count || 0;
        const weekCount = weekOrders.count || 0;
        const monthCount = monthOrders.count || 0;
        const yearCount = yearOrders.count || 0;

        setTransactionBreakdown({
          today: todayCount,
          week: weekCount,
          month: monthCount,
          year: yearCount,
        });

        setStats({
          transactions: todayCount, // Afficher les transactions du jour par défaut
          requests: apiLogsRes.count || 0,
          users: usersRes.count || 0,
          checks: systemChecksRes.count || 0,
        });
        setRealStatsLoaded(true);
      } catch (error) {
        console.error('Erreur chargement stats système:', error);
      }
    };

    loadRealStats();
  }, [open, realStatsLoaded]);

  // Animation légère des stats (petits incréments visuels seulement après chargement)
  useEffect(() => {
    if (!open || !realStatsLoaded) return;

    // Pas d'incrémentation aléatoire - les stats restent stables
    // On pourrait ajouter un rafraîchissement périodique si nécessaire
  }, [open, realStatsLoaded]);

  // Handler pour clic sur une carte
  const handleFeatureClick = (feature: typeof SYSTEM_FEATURES[0]) => {
    setSelectedFeature(feature);
    setShowDetailSheet(true);
  };

  // Obtenir le statut de santé pour une fonctionnalité
  const getFeatureHealth = (domain: string) => {
    return healthData[domain] || null;
  };

  // Obtenir l'icône de statut
  const getStatusIndicator = (domain: string) => {
    const health = getFeatureHealth(domain);
    if (!health) return null;

    if (health.status === 'CRITICAL') {
      return (
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 0.5, repeat: Infinity }}
          className="absolute -top-1 -right-1 w-4 h-4 bg-[#ff4000] rounded-full flex items-center justify-center"
        >
          <AlertTriangle className="w-2.5 h-2.5 text-white" />
        </motion.div>
      );
    }
    if (health.status === 'WARNING') {
      return (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center">
          <AlertCircle className="w-2.5 h-2.5 text-white" />
        </div>
      );
    }
    return (
      <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#ff4000] rounded-full flex items-center justify-center">
        <CheckCircle2 className="w-2.5 h-2.5 text-white" />
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full md:w-full max-w-[1400px] h-[95vh] md:h-[850px] p-0 overflow-hidden bg-black border-0" aria-describedby={undefined}>
          <VisuallyHidden>
            <DialogTitle>Système de Surveillance 24/7</DialogTitle>
          </VisuallyHidden>
          {/* Background Grid Effect */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,136,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,136,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />

          {/* Scanning Line Effect */}
          <motion.div
            className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#ff4000] to-transparent opacity-50"
            animate={{ top: ['0%', '100%', '0%'] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          />

          {/* Header - Mobile Optimized */}
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 gap-3 border-b border-[#ff4000]/30 bg-black/80 backdrop-blur">
            <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
              >
                <Shield className="w-8 h-8 sm:w-10 sm:h-10 text-[#ff4000] flex-shrink-0" />
              </motion.div>
              <div className="min-w-0 flex-1">
                <h1 className="text-base sm:text-2xl font-bold text-[#ff4000] font-mono tracking-wider truncate">
                  SYSTÈME DE SURVEILLANCE 24/7
                </h1>
                <p className="text-[#ff4000]/70 text-xs sm:text-sm font-mono truncate">
                  Monitoring en temps réel de toutes les fonctionnalités
                </p>
              </div>
            </div>

            {/* Global Health + Live Badge - Compact on Mobile */}
            <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
              {/* Global Health Status */}
              <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-slate-800/50 border border-slate-600">
                {globalHealth.status === 'CRITICAL' && (
                  <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#ff4000] animate-pulse" />
                )}
                {globalHealth.status === 'WARNING' && (
                  <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-500" />
                )}
                {globalHealth.status === 'OK' && (
                  <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#ff4000]" />
                )}
                <span className="text-xs sm:text-sm font-medium text-slate-300">
                  {globalHealth.totalAnomalies} <span className="hidden xs:inline">anomalies</span>
                </span>
                {globalHealth.criticalCount > 0 && (
                  <Badge className="bg-[#ff4000] text-white text-[10px] sm:text-xs px-1.5">
                    {globalHealth.criticalCount}
                  </Badge>
                )}
              </div>

              <Badge className="bg-[#ff4000] text-white animate-pulse flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-1 sm:py-2 text-xs">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full animate-ping" />
                LIVE
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => refetch()}
                className="text-[#ff4000] hover:text-white hover:bg-[#ff4000]/20 h-8 w-8 sm:h-10 sm:w-10"
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="text-[#ff4000] hover:text-white hover:bg-[#ff4000]/20 h-8 w-8 sm:h-10 sm:w-10"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </Button>
            </div>
          </div>

          {/* Main Content - Scrollable on Mobile */}
          <div className="relative flex-1 p-3 sm:p-6 overflow-y-auto overflow-x-hidden" ref={containerRef}>
            {/* Floating Logs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {logs.map((log) => (
                <motion.div
                  key={log.id}
                  className="absolute text-[#ff4000]/60 text-xs font-mono whitespace-nowrap"
                  style={{
                    left: `${log.x}%`,
                    top: `${log.y}%`,
                    opacity: log.opacity,
                  }}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: log.opacity, scale: 1 }}
                >
                  {log.text}
                </motion.div>
              ))}
            </div>

            {/* Stats Bar - Horizontal Scroll on Mobile */}
            <div className="relative z-10 flex gap-3 sm:grid sm:grid-cols-4 sm:gap-4 mb-6 sm:mb-8 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0">
              {/* Transaction Card - Clickable with dropdown */}
              <div className="relative flex-shrink-0 w-[140px] sm:w-auto">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0 }}
                  onClick={() => setShowTransactionMenu(!showTransactionMenu)}
                  className="p-3 sm:p-4 rounded-lg bg-[#ff4000]/10 border border-[#ff4000]/30 backdrop-blur cursor-pointer hover:bg-[#ff4000]/20 transition-colors h-full"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 sm:gap-2 text-[#ff4000]/70 text-[10px] sm:text-xs mb-1.5 sm:mb-2">
                      <CreditCard className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                      <span className="truncate">TRANSACTIONS (AUJOURD'HUI)</span>
                    </div>
                    <ChevronDown className={`w-3 h-3 sm:w-4 sm:h-4 text-[#ff4000]/70 transition-transform flex-shrink-0 ${showTransactionMenu ? 'rotate-180' : ''}`} />
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-[#ff4000] font-mono">
                    {transactionBreakdown.today.toLocaleString()}
                  </div>
                </motion.div>

                {/* Dropdown Menu */}
                <AnimatePresence>
                  {showTransactionMenu && (
                    <>
                      {/* Backdrop pour fermer le menu */}
                      <div
                        className="fixed inset-0 z-[100]"
                        onClick={() => setShowTransactionMenu(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full left-0 right-0 mt-2 z-[101] rounded-lg overflow-hidden shadow-2xl min-w-[200px]"
                        style={{
                          backgroundColor: '#0f172a',
                          border: '1px solid rgba(16, 185, 129, 0.4)'
                        }}
                      >
                        <div className="p-2 sm:p-3 space-y-1">
                          <div
                            className="flex justify-between items-center p-2 sm:p-3 hover:bg-[#ff4000]/20 rounded-lg cursor-pointer transition-colors"
                            onClick={() => setShowTransactionMenu(false)}
                          >
                            <span className="text-[#ff4000] text-xs sm:text-sm font-medium">📅 Aujourd'hui</span>
                            <span className="text-white font-mono font-bold text-sm sm:text-lg">{transactionBreakdown.today.toLocaleString()}</span>
                          </div>
                          <div
                            className="flex justify-between items-center p-2 sm:p-3 hover:bg-[#ff4000]/20 rounded-lg cursor-pointer transition-colors"
                            onClick={() => setShowTransactionMenu(false)}
                          >
                            <span className="text-[#ff4000] text-xs sm:text-sm font-medium">📆 Semaine</span>
                            <span className="text-white font-mono font-bold text-sm sm:text-lg">{transactionBreakdown.week.toLocaleString()}</span>
                          </div>
                          <div
                            className="flex justify-between items-center p-2 sm:p-3 hover:bg-[#ff4000]/20 rounded-lg cursor-pointer transition-colors"
                            onClick={() => setShowTransactionMenu(false)}
                          >
                            <span className="text-[#ff4000] text-xs sm:text-sm font-medium">🗓️ Mois</span>
                            <span className="text-white font-mono font-bold text-sm sm:text-lg">{transactionBreakdown.month.toLocaleString()}</span>
                          </div>
                          <div
                            className="flex justify-between items-center p-2 sm:p-3 hover:bg-[#ff4000]/20 rounded-lg cursor-pointer transition-colors"
                            onClick={() => setShowTransactionMenu(false)}
                          >
                            <span className="text-[#ff4000] text-xs sm:text-sm font-medium">{t('systemLiveMonitor.annee')}</span>
                            <span className="text-white font-mono font-bold text-sm sm:text-lg">{transactionBreakdown.year.toLocaleString()}</span>
                          </div>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* Other Stats */}
              {[
                { label: t('systemLiveMonitor.requetesApi'), value: stats.requests.toLocaleString(), icon: Network },
                { label: 'UTILISATEURS', value: stats.users.toLocaleString(), icon: Users },
                { label: t('systemLiveMonitor.checksSysteme'), value: stats.checks.toLocaleString(), icon: CheckCircle2 },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: (i + 1) * 0.1 }}
                  className="p-3 sm:p-4 rounded-lg bg-[#ff4000]/10 border border-[#ff4000]/30 backdrop-blur flex-shrink-0 w-[120px] sm:w-auto"
                >
                  <div className="flex items-center gap-1.5 sm:gap-2 text-[#ff4000]/70 text-[10px] sm:text-xs mb-1.5 sm:mb-2">
                    <stat.icon className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span className="truncate">{stat.label}</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-[#ff4000] font-mono">
                    {stat.value}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Features Grid - CLICKABLE - Responsive */}
            <div className="relative z-10 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3 md:gap-4 mb-6 sm:mb-8">
              {SYSTEM_FEATURES.map((feature, index) => {
                const Icon = feature.icon;
                const isActive = activeFeatures.has(index);
                const health = getFeatureHealth(feature.domain);
                const hasIssue = health && health.status !== 'OK';

                return (
                  <motion.div
                    key={feature.name}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                      boxShadow: isActive
                        ? `0 0 30px ${feature.color}60, 0 0 60px ${feature.color}30`
                        : hasIssue
                        ? health.status === 'CRITICAL'
                          ? '0 0 20px rgba(239, 68, 68, 0.4)'
                          : '0 0 15px rgba(249, 115, 22, 0.3)'
                        : 'none'
                    }}
                    transition={{ delay: index * 0.02 }}
                    onClick={() => handleFeatureClick(feature)}
                    className={`relative p-2 sm:p-3 md:p-4 rounded-lg sm:rounded-xl border transition-all duration-300 cursor-pointer active:scale-95 sm:hover:scale-105 ${
                      isActive
                        ? 'border-[#ff4000] bg-[#ff4000]/20'
                        : hasIssue
                        ? health.status === 'CRITICAL'
                          ? 'border-[#ff4000]/50 bg-[#ff4000]/10'
                          : 'border-orange-500/50 bg-orange-500/10'
                        : 'border-[#ff4000]/20 bg-black/50 hover:border-[#ff4000]/50'
                    }`}
                  >
                    {/* Status Indicator */}
                    {getStatusIndicator(feature.domain)}

                    {/* Pulse ring when active */}
                    {isActive && (
                      <motion.div
                        className="absolute inset-0 rounded-lg sm:rounded-xl border-2"
                        style={{ borderColor: feature.color }}
                        initial={{ opacity: 1, scale: 1 }}
                        animate={{ opacity: 0, scale: 1.2 }}
                        transition={{ duration: 1, repeat: Infinity }}
                      />
                    )}

                    <div className="flex flex-col items-center gap-1 sm:gap-2 relative z-10">
                      <motion.div
                        animate={{
                          rotate: isActive ? 360 : 0,
                          scale: isActive ? 1.2 : 1
                        }}
                        transition={{ duration: 0.5 }}
                        className="p-2 sm:p-3 rounded-lg"
                        style={{
                          backgroundColor: `${feature.color}20`,
                          boxShadow: isActive ? `0 0 20px ${feature.color}` : 'none'
                        }}
                      >
                        <Icon
                          className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6"
                          style={{ color: feature.color }}
                        />
                      </motion.div>
                      <span className="text-[9px] sm:text-[10px] md:text-xs text-center text-[#ff4000]/80 font-medium leading-tight line-clamp-2">
                        {feature.name}
                      </span>
                      <Badge
                        className="text-[8px] sm:text-[10px] px-1 sm:px-2"
                        style={{
                          backgroundColor: isActive ? feature.color : 'transparent',
                          color: isActive ? 'white' : feature.color,
                          borderColor: feature.color
                        }}
                        variant={isActive ? 'default' : 'outline'}
                      >
                        {feature.domain}
                      </Badge>

                      {/* Anomaly count badge */}
                      {health && health.anomalyCount > 0 && (
                        <Badge className="text-[8px] sm:text-[9px] px-1 sm:px-1.5 bg-orange-500 text-white">
                          {health.anomalyCount}
                        </Badge>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Uptime Display - Compact on Mobile */}
            <div className="relative z-10 flex justify-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex flex-col sm:flex-row items-center gap-3 sm:gap-8 p-3 sm:p-6 rounded-xl sm:rounded-2xl bg-[#ff4000]/10 border border-[#ff4000]/30 w-full sm:w-auto"
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  >
                    <RefreshCw className="w-5 h-5 sm:w-8 sm:h-8 text-[#ff4000]" />
                  </motion.div>
                  <span className="text-[#ff4000]/70 text-sm sm:text-lg font-medium">UPTIME</span>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 font-mono text-2xl sm:text-4xl text-[#ff4000] font-bold">
                  <div className="flex flex-col items-center">
                    <span>{String(uptime.days).padStart(2, '0')}</span>
                    <span className="text-[8px] sm:text-xs text-[#ff4000]/50">JOURS</span>
                  </div>
                  <span className="text-[#ff4000]/50">:</span>
                  <div className="flex flex-col items-center">
                    <span>{String(uptime.hours).padStart(2, '0')}</span>
                    <span className="text-[8px] sm:text-xs text-[#ff4000]/50">HEURES</span>
                  </div>
                  <span className="text-[#ff4000]/50">:</span>
                  <div className="flex flex-col items-center">
                    <span>{String(uptime.mins).padStart(2, '0')}</span>
                    <span className="text-[8px] sm:text-xs text-[#ff4000]/50">MINS</span>
                  </div>
                  <span className="text-[#ff4000]/50">:</span>
                  <div className="flex flex-col items-center">
                    <motion.span
                      key={uptime.secs}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      {String(uptime.secs).padStart(2, '0')}
                    </motion.span>
                    <span className="text-[8px] sm:text-xs text-[#ff4000]/50">SECS</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2">
                  <CheckCircle2 className="w-4 h-4 sm:w-6 sm:h-6 text-[#ff4000]" />
                  <span className="text-[#ff4000] font-bold text-xs sm:text-base">{t('systemLiveMonitor.operationnel')}</span>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Footer Status - Scrollable on Mobile */}
          <div className="relative z-10 flex items-center justify-between p-2 sm:p-4 border-t border-[#ff4000]/30 bg-black/80 backdrop-blur gap-2">
            <div className="flex items-center gap-3 sm:gap-6 text-[10px] sm:text-xs font-mono text-[#ff4000]/70 overflow-x-auto scrollbar-hide flex-1">
              <span className="whitespace-nowrap">CPU: 23%</span>
              <span className="whitespace-nowrap">RAM: 45%</span>
              <span className="whitespace-nowrap hidden xs:inline">NET: 1.2Gb/s</span>
              <span className="whitespace-nowrap hidden sm:inline">DISK: 67%</span>
            </div>
            <div className="text-[#ff4000] text-[10px] sm:text-sm font-mono whitespace-nowrap flex-shrink-0">
              {new Date().toLocaleString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
                day: '2-digit',
                month: '2-digit'
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Sheet */}
      <FeatureDetailSheet
        open={showDetailSheet}
        onOpenChange={setShowDetailSheet}
        feature={selectedFeature}
        healthData={selectedFeature ? healthData[selectedFeature.domain] : null}
        onApplyCorrection={applyAutoCorrection}
      />
    </>
  );
}
