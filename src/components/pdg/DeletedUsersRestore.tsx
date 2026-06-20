/**
 * 🔄 RESTAURATION UTILISATEURS SUPPRIMÉS
 * Workflow: Recherche par ID/Email → Affichage profil → Restauration
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  RefreshCw, Search, UserX, RotateCcw, Clock, AlertTriangle,
  User, Mail, Phone, Calendar, Shield, Eye, Wallet, CheckCircle2,
  Database, XCircle, Package, CreditCard, ShoppingBag, ArrowRight
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Json } from '@/integrations/supabase/types';

interface DeletedUser {
  id: string;
  original_user_id: string;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  role: string | null;
  public_id: string | null;
  profile_data: Json | null;
  wallet_data: Json | null;
  user_ids_data: Json | null;
  role_specific_data: Json | null;
  deletion_reason: string | null;
  deletion_method: string | null;
  deleted_at: string;
  deleted_by: string | null;
  expires_at: string | null;
  is_restored: boolean;
  restored_at: string | null;
  restored_by: string | null;
  restoration_notes: string | null;
  original_created_at: string | null;
}

interface DataStatus {
  exists: boolean;
  data?: unknown;
  count?: number;
  table_name?: string;
}

interface UserDataAnalysis {
  // Données de base
  profile: DataStatus;
  wallet: DataStatus;
  user_ids: DataStatus;
  // Rôles spécifiques
  agent: DataStatus;
  vendor: DataStatus;
  taxi_driver: DataStatus;
  livreur: DataStatus;
  // Activité
  orders: DataStatus;
  transactions: DataStatus;
  notifications: DataStatus;
  conversations: DataStatus;
  messages: DataStatus;
  // Commerce
  products: DataStatus;
  reviews: DataStatus;
  favorites: DataStatus;
  cart: DataStatus;
  // Archives
  archived: DataStatus;
}

interface AnalysisSummary {
  total_tables_checked: number;
  existing_count: number;
  missing_count: number;
  deleted_count: number;
}

interface ActiveProfile {
  id: string;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  public_id: string | null;
  avatar_url: string | null;
  city: string | null;
  country: string | null;
  is_active: boolean | null;
  created_at: string | null;
  has_archived_data?: boolean;
  data_analysis?: {
    analysis: UserDataAnalysis;
    missing_data: string[];
    existing_data: string[];
    deleted_data: string[];
    has_issues: boolean;
    summary: AnalysisSummary;
  } | null;
  archived_data?: DeletedUser | null;
}

// Composant pour afficher le statut d'une donnée
function DataStatusBadge({
  status,
  label,
  icon,
  showIfZero = false
}: {
  status: DataStatus;
  label: string;
  icon?: React.ReactNode;
  showIfZero?: boolean;
}) {
  // Ne pas afficher si count est 0 et showIfZero est false
  if (!status.exists && !showIfZero && (status.count === undefined || status.count === 0)) {
    return null;
  }

  const bgClass = status.exists
    ? 'bg-[#ff4000]/10 text-[#ff4000]'
    : 'bg-muted text-muted-foreground';

  return (
    <div className={`flex items-center gap-2 p-2 rounded text-xs ${bgClass}`}>
      {status.exists ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        icon || <XCircle className="h-3 w-3 opacity-50" />
      )}
      {icon && status.exists && icon}
      <span>{label}</span>
    </div>
  );
}

export default function DeletedUsersRestore() {
  const [deletedUsers, setDeletedUsers] = useState<DeletedUser[]>([]);
  const [activeProfiles, setActiveProfiles] = useState<ActiveProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<DeletedUser | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<ActiveProfile | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [profileDetailsOpen, setProfileDetailsOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [restoreNotes, setRestoreNotes] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [showRestored, setShowRestored] = useState(false);
  const [searched, setSearched] = useState(false);

  // Charger les utilisateurs supprimés au montage
  useEffect(() => {
    fetchAllDeletedUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRestored]);

  const fetchAllDeletedUsers = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('deleted_users_archive')
        .select('*')
        .order('deleted_at', { ascending: false });

      if (!showRestored) {
        query = query.eq('is_restored', false);
      }

      const { data, error } = await query;

      if (error) throw error;

      setDeletedUsers(data || []);
      setSearched(false);
    } catch (error) {
      console.error('Erreur chargement:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  // Recherche par ID ou email via Edge Function
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setActiveProfiles([]);
      fetchAllDeletedUsers();
      return;
    }

    try {
      setLoading(true);
      setSearched(true);

      const { data, error } = await supabase.functions.invoke('restore-user', {
        body: { search_query: searchQuery.trim() }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Erreur de recherche');
      }

      // Stocker les profils actifs et les archives
      setActiveProfiles(data.active_profiles || []);
      setDeletedUsers(data.archived_users || []);

      const totalFound = (data.total_active || 0) + (data.total_archived || 0);

      if (totalFound === 0) {
        toast.info('Aucun utilisateur trouvé avec ces critères');
      } else {
        if (data.total_active > 0) {
          toast.success(`${data.total_active} profil(s) actif(s) trouvé(s)`);
        }
        if (data.total_archived > 0) {
          toast.info(`${data.total_archived} donnée(s) archivée(s) trouvée(s)`);
        }
      }
    } catch (error: unknown) {
      console.error('Erreur recherche:', error);
      const msg = error instanceof Error ? error.message : 'Erreur de recherche';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // Restauration de l'utilisateur
  const handleRestore = async () => {
    if (!selectedUser) return;

    try {
      setRestoring(true);

      const { data, error } = await supabase.functions.invoke('restore-user', {
        body: {
          archive_id: selectedUser.id,
          restoration_notes: restoreNotes || "Restauration depuis l'interface PDG",
        },
      });

      if (error) {
        throw new Error(error.message || 'Erreur lors de la restauration');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Erreur lors de la restauration');
      }

      toast.success(`✅ Utilisateur ${selectedUser.public_id || selectedUser.email} restauré!`);

      if (data?.data?.new_user_created) {
        toast.info("Un nouveau compte a été créé. L'utilisateur devra réinitialiser son mot de passe.", {
          duration: 6000,
        });
      }

      setRestoreDialogOpen(false);
      setDetailsOpen(false);
      setRestoreNotes('');
      setSelectedUser(null);

      // Rafraîchir la liste
      if (searched && searchQuery) {
        handleSearch();
      } else {
        fetchAllDeletedUsers();
      }
    } catch (error: unknown) {
      console.error('Erreur restauration:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      toast.error(`Erreur: ${errorMessage}`);
    } finally {
      setRestoring(false);
    }
  };

  const getRoleBadgeColor = (role: string | null) => {
    switch (role?.toLowerCase()) {
      case 'admin':
      case 'pdg':
        return 'bg-[#04439e]';
      case 'vendor':
        return 'bg-blue-500';
      case 'client':
        return 'bg-[#ff4000]';
      case 'driver':
      case 'taxi':
      case 'livreur':
        return 'bg-orange-500';
      case 'agent':
        return 'bg-[#ff4000]';
      default:
        return 'bg-gray-500';
    }
  };

  const getExpirationStatus = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const expDate = new Date(expiresAt);
    const now = new Date();
    const daysLeft = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysLeft <= 0) return { status: 'expired', text: 'Expiré', color: 'text-[#ff4000]' };
    if (daysLeft <= 7) return { status: 'warning', text: `${daysLeft}j restants`, color: 'text-orange-500' };
    return { status: 'ok', text: `${daysLeft}j restants`, color: 'text-muted-foreground' };
  };

  const openUserDetails = (user: DeletedUser) => {
    setSelectedUser(user);
    setDetailsOpen(true);
  };

  const openRestoreDialog = (user: DeletedUser) => {
    setSelectedUser(user);
    setRestoreDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header avec recherche */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-primary" />
            Restauration Utilisateurs
          </CardTitle>
          <CardDescription>
            Recherchez un utilisateur supprimé par son ID (USR0001) ou email pour le restaurer
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par ID (USR0001), email ou téléphone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSearch} disabled={loading}>
                <Search className="h-4 w-4 mr-2" />
                Rechercher
              </Button>
              <Button
                variant={showRestored ? "default" : "outline"}
                onClick={() => setShowRestored(!showRestored)}
                size="sm"
              >
                {showRestored ? 'Masquer restaurés' : 'Voir restaurés'}
              </Button>
              <Button variant="outline" onClick={fetchAllDeletedUsers} size="sm" disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-[#ff4000]" />
              <div>
                <p className="text-2xl font-bold">{deletedUsers.filter(u => !u.is_restored).length}</p>
                <p className="text-xs text-muted-foreground">À restaurer</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-[#ff4000]" />
              <div>
                <p className="text-2xl font-bold">{deletedUsers.filter(u => u.is_restored).length}</p>
                <p className="text-xs text-muted-foreground">Restaurés</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">
                  {deletedUsers.filter(u => {
                    const exp = getExpirationStatus(u.expires_at);
                    return exp?.status === 'warning' && !u.is_restored;
                  }).length}
                </p>
                <p className="text-xs text-muted-foreground">Expirent bientôt</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">30j</p>
                <p className="text-xs text-muted-foreground">Conservation max</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Résultats de recherche - Profils actifs avec analyse complète */}
      {searched && activeProfiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Profils utilisateurs trouvés ({activeProfiles.length})
            </CardTitle>
            <CardDescription>
              Analyse complète des données pour chaque utilisateur
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeProfiles.map((profile) => (
                <div
                  key={profile.id}
                  className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  {/* En-tête du profil */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {profile.first_name} {profile.last_name}
                          </span>
                          <Badge className={`${getRoleBadgeColor(profile.role)} text-white`}>
                            {profile.role || 'Inconnu'}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1 mt-1">
                          <div className="flex items-center gap-2">
                            <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono">
                              {profile.public_id || '-'}
                            </code>
                          </div>
                          <div className="flex items-center gap-4">
                            {profile.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" /> {profile.email}
                              </span>
                            )}
                            {profile.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" /> {profile.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedProfile(profile);
                        setProfileDetailsOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Détails complets
                    </Button>
                  </div>

                  {/* Analyse des données */}
                  {profile.data_analysis && (
                    <div className="mt-3 p-3 bg-muted/30 rounded-lg">
                      {/* En-tête avec résumé */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Analyse complète ({profile.data_analysis.summary?.total_tables_checked || 0} tables)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {profile.data_analysis.summary && (
                            <>
                              <Badge className="bg-[#ff4000]/20 text-[#ff4000] text-xs">
                                {profile.data_analysis.summary.existing_count} existant(s)
                              </Badge>
                              {profile.data_analysis.summary.missing_count > 0 && (
                                <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">
                                  {profile.data_analysis.summary.missing_count} manquant(s)
                                </Badge>
                              )}
                              {profile.data_analysis.summary.deleted_count > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  {profile.data_analysis.summary.deleted_count} supprimé(s)
                                </Badge>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Données existantes */}
                      {profile.data_analysis.existing_data && profile.data_analysis.existing_data.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs font-medium text-[#ff4000] mb-2 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Données existantes:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {profile.data_analysis.existing_data.map((item, idx) => (
                              <span key={idx} className="text-xs bg-[#ff4000]/10 text-[#ff4000] px-2 py-0.5 rounded">
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Grille des statuts principaux */}
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {/* Profil */}
                        <DataStatusBadge
                          status={profile.data_analysis.analysis.profile}
                          label="Profil"
                          icon={<User className="h-3 w-3" />}
                        />
                        {/* Wallet */}
                        <DataStatusBadge
                          status={profile.data_analysis.analysis.wallet}
                          label="Portefeuille"
                          icon={<Wallet className="h-3 w-3" />}
                        />
                        {/* User IDs */}
                        <DataStatusBadge
                          status={profile.data_analysis.analysis.user_ids}
                          label="ID Public"
                        />
                        {/* Commandes */}
                        <DataStatusBadge
                          status={profile.data_analysis.analysis.orders}
                          label={`Commandes (${profile.data_analysis.analysis.orders.count || 0})`}
                          icon={<ShoppingBag className="h-3 w-3" />}
                          showIfZero
                        />
                        {/* Transactions */}
                        <DataStatusBadge
                          status={profile.data_analysis.analysis.transactions}
                          label={`Transactions (${profile.data_analysis.analysis.transactions.count || 0})`}
                          icon={<CreditCard className="h-3 w-3" />}
                          showIfZero
                        />
                        {/* Notifications */}
                        <DataStatusBadge
                          status={profile.data_analysis.analysis.notifications}
                          label={`Notifs (${profile.data_analysis.analysis.notifications?.count || 0})`}
                          showIfZero
                        />
                        {/* Messages */}
                        <DataStatusBadge
                          status={profile.data_analysis.analysis.messages}
                          label={`Messages (${profile.data_analysis.analysis.messages?.count || 0})`}
                          icon={<Mail className="h-3 w-3" />}
                          showIfZero
                        />
                        {/* Conversations */}
                        <DataStatusBadge
                          status={profile.data_analysis.analysis.conversations}
                          label={`Convos (${profile.data_analysis.analysis.conversations?.count || 0})`}
                          showIfZero
                        />
                        {/* Rôles spécifiques */}
                        {profile.data_analysis.analysis.agent.exists && (
                          <DataStatusBadge
                            status={profile.data_analysis.analysis.agent}
                            label="Agent"
                            icon={<Shield className="h-3 w-3" />}
                          />
                        )}
                        {profile.data_analysis.analysis.vendor.exists && (
                          <DataStatusBadge
                            status={profile.data_analysis.analysis.vendor}
                            label="Vendeur"
                            icon={<Package className="h-3 w-3" />}
                          />
                        )}
                        {profile.data_analysis.analysis.taxi_driver?.exists && (
                          <DataStatusBadge
                            status={profile.data_analysis.analysis.taxi_driver}
                            label="Taxi"
                          />
                        )}
                        {profile.data_analysis.analysis.livreur?.exists && (
                          <DataStatusBadge
                            status={profile.data_analysis.analysis.livreur}
                            label="Livreur"
                          />
                        )}
                        {/* Commerce */}
                        {profile.data_analysis.analysis.products?.exists && (
                          <DataStatusBadge
                            status={profile.data_analysis.analysis.products}
                            label={`Produits (${profile.data_analysis.analysis.products.count || 0})`}
                          />
                        )}
                        {profile.data_analysis.analysis.favorites?.exists && (
                          <DataStatusBadge
                            status={profile.data_analysis.analysis.favorites}
                            label={`Favoris (${profile.data_analysis.analysis.favorites.count || 0})`}
                          />
                        )}
                        {/* Archives */}
                        {profile.data_analysis.analysis.archived.exists && (
                          <div className="flex items-center gap-2 p-2 rounded text-xs bg-orange-500/10 text-orange-700 col-span-2">
                            <AlertTriangle className="h-3 w-3" />
                            <span>Données supprimées archivées</span>
                          </div>
                        )}
                      </div>

                      {/* Message sur les données manquantes */}
                      {profile.data_analysis.missing_data.length > 0 && (
                        <div className="mt-3 p-2 border border-orange-500/30 rounded bg-orange-500/5">
                          <p className="text-xs text-orange-700 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Données manquantes: {profile.data_analysis.missing_data.join(', ')}
                          </p>
                        </div>
                      )}

                      {/* Données supprimées */}
                      {profile.data_analysis.deleted_data && profile.data_analysis.deleted_data.length > 0 && (
                        <div className="mt-3 p-2 border border-[#ff4000]/30 rounded bg-[#ff4000]/5">
                          <p className="text-xs text-[#ff4000] flex items-center gap-1 mb-1">
                            <XCircle className="h-3 w-3" />
                            Données supprimées (restaurables):
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {profile.data_analysis.deleted_data.map((item, idx) => (
                              <span key={idx} className="text-xs bg-[#ff4000]/10 text-[#ff4000] px-2 py-0.5 rounded">
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Lien vers archives si disponible */}
                      {profile.has_archived_data && profile.archived_data && (
                        <div className="mt-3 p-3 border border-primary/30 rounded bg-primary/5">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-primary flex items-center gap-1">
                                <RotateCcw className="h-4 w-4" />
                                Données archivées disponibles
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Supprimé le {format(new Date(profile.archived_data.deleted_at), 'dd/MM/yyyy', { locale: fr })}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedUser(profile.archived_data!);
                                openRestoreDialog(profile.archived_data!);
                              }}
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Restaurer
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Message si tout est OK */}
                      {!profile.data_analysis.has_issues && profile.data_analysis.existing_data && profile.data_analysis.existing_data.length > 0 && (
                        <div className="mt-3 p-2 border border-[#ff4000]/30 rounded bg-[#ff4000]/5">
                          <p className="text-xs text-[#ff4000] flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Toutes les données essentielles sont intactes. Aucune restauration nécessaire.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Message si pas d'analyse disponible */}
                  {!profile.data_analysis && (
                    <div className="mt-3 p-3 bg-muted/30 rounded-lg">
                      {profile.has_archived_data ? (
                        <div className="flex items-center gap-2 text-orange-600">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-sm">Données archivées disponibles pour restauration</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-[#ff4000]">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="text-sm">Aucune donnée supprimée détectée</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Liste des données archivées */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {searched ? 'Données archivées à restaurer' : 'Utilisateurs supprimés'} ({deletedUsers.length})
          </CardTitle>
          {searched && deletedUsers.length === 0 && activeProfiles.length > 0 && (
            <CardDescription className="text-[#ff4000]">
              ✓ Aucune donnée de cet utilisateur n'a été supprimée
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : deletedUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UserX className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="font-medium">
                {searched && activeProfiles.length > 0
                  ? "Aucune donnée supprimée pour cet utilisateur"
                  : "Aucun utilisateur supprimé trouvé"
                }
              </p>
              <p className="text-xs mt-2 max-w-md mx-auto">
                {searched
                  ? activeProfiles.length > 0
                    ? "Toutes les données de cet utilisateur sont intactes. Aucune restauration n'est nécessaire."
                    : "Aucun résultat pour votre recherche. Essayez avec un ID complet (USR0001) ou un email."
                  : "Les utilisateurs supprimés via l'application sont archivés pendant 30 jours pour restauration."
                }
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>ID Public</TableHead>
                    <TableHead>Supprimé</TableHead>
                    <TableHead>Expiration</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deletedUsers.map((user) => {
                    const expStatus = getExpirationStatus(user.expires_at);
                    return (
                      <TableRow key={user.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell onClick={() => openUserDetails(user)}>
                          <div className="flex flex-col">
                            <span className="font-medium">{user.full_name || 'Sans nom'}</span>
                            <span className="text-xs text-muted-foreground">{user.email || user.phone}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${getRoleBadgeColor(user.role)} text-white`}>
                            {user.role || 'Inconnu'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                            {user.public_id || '-'}
                          </code>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm">
                              {format(new Date(user.deleted_at), 'dd/MM/yyyy', { locale: fr })}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(user.deleted_at), { addSuffix: true, locale: fr })}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {expStatus && (
                            <span className={`text-sm ${expStatus.color}`}>
                              {expStatus.text}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.is_restored ? (
                            <Badge variant="outline" className="text-[#ff4000] border-[#ff4000]">
                              ✓ Restauré
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-orange-600 border-orange-600">
                              En attente
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openUserDetails(user)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {!user.is_restored && expStatus?.status !== 'expired' && (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => openRestoreDialog(user)}
                              >
                                <RotateCcw className="h-4 w-4 mr-1" />
                                Restaurer
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Dialog Profil actif avec analyse complète */}
      <Dialog open={profileDetailsOpen} onOpenChange={setProfileDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Analyse complète du profil
            </DialogTitle>
            <DialogDescription>
              État détaillé des données de l'utilisateur dans la base de données
            </DialogDescription>
          </DialogHeader>

          {selectedProfile && (
            <div className="space-y-4">
              {/* Informations principales */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Nom complet</label>
                  <p className="font-medium">{selectedProfile.first_name} {selectedProfile.last_name}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">ID Public</label>
                  <code className="bg-primary/10 px-2 py-1 rounded font-mono text-sm block w-fit">
                    {selectedProfile.public_id || '-'}
                  </code>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" /> Email
                  </label>
                  <p className="text-sm">{selectedProfile.email || 'Non renseigné'}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" /> Téléphone
                  </label>
                  <p className="text-sm">{selectedProfile.phone || 'Non renseigné'}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Shield className="h-3 w-3" /> Rôle
                  </label>
                  <Badge className={`${getRoleBadgeColor(selectedProfile.role)} text-white`}>
                    {selectedProfile.role || 'Inconnu'}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Statut</label>
                  <Badge variant={selectedProfile.is_active ? "default" : "secondary"}>
                    {selectedProfile.is_active ? 'Actif' : 'Inactif'}
                  </Badge>
                </div>
              </div>

              {/* Analyse détaillée des données */}
              {selectedProfile.data_analysis && (
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    État des données dans la base
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Profil */}
                    <div className={`p-3 rounded-lg border ${
                      selectedProfile.data_analysis.analysis.profile.exists
                        ? 'border-[#ff4000]/30 bg-[#ff4000]/5'
                        : 'border-[#ff4000]/30 bg-[#ff4000]/5'
                    }`}>
                      <div className="flex items-center gap-2">
                        {selectedProfile.data_analysis.analysis.profile.exists ? (
                          <CheckCircle2 className="h-4 w-4 text-[#ff4000]" />
                        ) : (
                          <XCircle className="h-4 w-4 text-[#ff4000]" />
                        )}
                        <span className="font-medium">Profil utilisateur</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {selectedProfile.data_analysis.analysis.profile.exists
                          ? 'Présent dans la table profiles'
                          : 'Absent de la table profiles'}
                      </p>
                    </div>

                    {/* Wallet */}
                    <div className={`p-3 rounded-lg border ${
                      selectedProfile.data_analysis.analysis.wallet.exists
                        ? 'border-[#ff4000]/30 bg-[#ff4000]/5'
                        : 'border-orange-500/30 bg-orange-500/5'
                    }`}>
                      <div className="flex items-center gap-2">
                        {selectedProfile.data_analysis.analysis.wallet.exists ? (
                          <CheckCircle2 className="h-4 w-4 text-[#ff4000]" />
                        ) : (
                          <XCircle className="h-4 w-4 text-orange-600" />
                        )}
                        <Wallet className="h-4 w-4" />
                        <span className="font-medium">Portefeuille</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {selectedProfile.data_analysis.analysis.wallet.exists
                          ? 'Wallet actif trouvé'
                          : 'Aucun wallet trouvé'}
                      </p>
                    </div>

                    {/* User IDs */}
                    <div className={`p-3 rounded-lg border ${
                      selectedProfile.data_analysis.analysis.user_ids.exists
                        ? 'border-[#ff4000]/30 bg-[#ff4000]/5'
                        : 'border-orange-500/30 bg-orange-500/5'
                    }`}>
                      <div className="flex items-center gap-2">
                        {selectedProfile.data_analysis.analysis.user_ids.exists ? (
                          <CheckCircle2 className="h-4 w-4 text-[#ff4000]" />
                        ) : (
                          <XCircle className="h-4 w-4 text-orange-600" />
                        )}
                        <span className="font-medium">Identifiant public</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {selectedProfile.data_analysis.analysis.user_ids.exists
                          ? 'ID synchronisé dans user_ids'
                          : 'Absent de la table user_ids'}
                      </p>
                    </div>

                    {/* Commandes */}
                    <div className={`p-3 rounded-lg border ${
                      selectedProfile.data_analysis.analysis.orders.exists
                        ? 'border-blue-500/30 bg-blue-500/5'
                        : 'border-muted'
                    }`}>
                      <div className="flex items-center gap-2">
                        <ShoppingBag className="h-4 w-4 text-blue-600" />
                        <span className="font-medium">Commandes</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {selectedProfile.data_analysis.analysis.orders.count || 0} commande(s) trouvée(s)
                      </p>
                    </div>

                    {/* Transactions */}
                    <div className={`p-3 rounded-lg border ${
                      selectedProfile.data_analysis.analysis.transactions.exists
                        ? 'border-blue-500/30 bg-blue-500/5'
                        : 'border-muted'
                    }`}>
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-blue-600" />
                        <span className="font-medium">Transactions</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {selectedProfile.data_analysis.analysis.transactions.count || 0} transaction(s) trouvée(s)
                      </p>
                    </div>

                    {/* Agent */}
                    {selectedProfile.data_analysis.analysis.agent.exists && (
                      <div className="p-3 rounded-lg border border-[#04439e]/30 bg-[#04439e]/5">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-[#04439e]" />
                          <span className="font-medium">Compte Agent</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Agent actif dans le système
                        </p>
                      </div>
                    )}

                    {/* Vendor */}
                    {selectedProfile.data_analysis.analysis.vendor.exists && (
                      <div className="p-3 rounded-lg border border-[#04439e]/30 bg-[#04439e]/5">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-[#04439e]" />
                          <span className="font-medium">Boutique Vendeur</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Boutique associée trouvée
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Données archivées */}
                  {selectedProfile.data_analysis.analysis.archived.exists && (
                    <div className="p-4 border border-orange-500/30 rounded-lg bg-orange-500/5">
                      <div className="flex items-center gap-2 text-orange-600 font-medium">
                        <AlertTriangle className="h-4 w-4" />
                        Données archivées détectées
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Des données de cet utilisateur ont été précédemment supprimées et sont disponibles pour restauration.
                      </p>
                      {selectedProfile.archived_data && (
                        <Button
                          className="mt-3"
                          size="sm"
                          onClick={() => {
                            setProfileDetailsOpen(false);
                            setSelectedUser(selectedProfile.archived_data!);
                            openRestoreDialog(selectedProfile.archived_data!);
                          }}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Restaurer les données archivées
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Données manquantes */}
                  {selectedProfile.data_analysis.missing_data.length > 0 && (
                    <div className="p-4 border border-[#ff4000]/30 rounded-lg bg-[#ff4000]/5">
                      <div className="flex items-center gap-2 text-[#ff4000] font-medium">
                        <XCircle className="h-4 w-4" />
                        Données manquantes détectées
                      </div>
                      <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                        {selectedProfile.data_analysis.missing_data.map((item, idx) => (
                          <li key={idx} className="flex items-center gap-2">
                            <ArrowRight className="h-3 w-3" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Tout OK */}
                  {!selectedProfile.data_analysis.has_issues && (
                    <div className="p-4 border border-[#ff4000]/30 rounded-lg bg-[#ff4000]/5">
                      <div className="flex items-center gap-2 text-[#ff4000] font-medium">
                        <CheckCircle2 className="h-4 w-4" />
                        Toutes les données sont intactes
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Aucune donnée supprimée ni manquante détectée pour cet utilisateur.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Fallback si pas d'analyse */}
              {!selectedProfile.data_analysis && (
                <>
                  {selectedProfile.has_archived_data ? (
                    <div className="p-4 border border-orange-500/30 rounded-lg bg-orange-500/5">
                      <div className="flex items-center gap-2 text-orange-600 font-medium">
                        <AlertTriangle className="h-4 w-4" />
                        Des données archivées existent
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Certaines données de cet utilisateur ont été supprimées et sont disponibles pour restauration.
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 border border-[#ff4000]/30 rounded-lg bg-[#ff4000]/5">
                      <div className="flex items-center gap-2 text-[#ff4000] font-medium">
                        <CheckCircle2 className="h-4 w-4" />
                        Aucune donnée supprimée
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Toutes les données de cet utilisateur sont intactes.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setProfileDetailsOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Détails de l'utilisateur */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profil utilisateur supprimé
            </DialogTitle>
            <DialogDescription>
              Données archivées avant suppression - Vérifiez les informations avant restauration
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-6">
              {/* Informations principales */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Nom complet</label>
                  <p className="font-medium text-lg">{selectedUser.full_name || 'Non renseigné'}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">ID Public</label>
                  <code className="text-lg bg-primary/10 px-3 py-1 rounded font-mono block w-fit">
                    {selectedUser.public_id || '-'}
                  </code>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" /> Email
                  </label>
                  <p>{selectedUser.email || 'Non renseigné'}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" /> Téléphone
                  </label>
                  <p>{selectedUser.phone || 'Non renseigné'}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Shield className="h-3 w-3" /> Rôle
                  </label>
                  <Badge className={`${getRoleBadgeColor(selectedUser.role)} text-white`}>
                    {selectedUser.role || 'Inconnu'}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Créé le
                  </label>
                  <p>
                    {selectedUser.original_created_at
                      ? format(new Date(selectedUser.original_created_at), 'dd MMMM yyyy', { locale: fr })
                      : 'Inconnu'
                    }
                  </p>
                </div>
              </div>

              {/* Données du wallet */}
              {selectedUser.wallet_data && (
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium flex items-center gap-2 mb-3">
                    <Wallet className="h-4 w-4" />
                    Données du portefeuille
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Solde:</span>
                      <span className="ml-2 font-medium">
                        {((selectedUser.wallet_data as Record<string, unknown>)?.balance as number || 0).toLocaleString()}
                        {' '}
                        {(selectedUser.wallet_data as Record<string, unknown>)?.currency as string || 'GNF'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Statut:</span>
                      <span className="ml-2">
                        {(selectedUser.wallet_data as Record<string, unknown>)?.wallet_status as string || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Informations de suppression */}
              <div className="p-4 border border-destructive/30 rounded-lg bg-destructive/5">
                <h4 className="font-medium text-destructive mb-3">Informations de suppression</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Supprimé le:</span>
                    <span className="ml-2">
                      {format(new Date(selectedUser.deleted_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Méthode:</span>
                    <span className="ml-2">{selectedUser.deletion_method || 'N/A'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Raison:</span>
                    <span className="ml-2">{selectedUser.deletion_reason || 'Non spécifiée'}</span>
                  </div>
                  {selectedUser.expires_at && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Expire le:</span>
                      <span className={`ml-2 ${getExpirationStatus(selectedUser.expires_at)?.color}`}>
                        {format(new Date(selectedUser.expires_at), 'dd MMMM yyyy', { locale: fr })}
                        {' '}({getExpirationStatus(selectedUser.expires_at)?.text})
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Statut de restauration */}
              {selectedUser.is_restored && (
                <div className="p-4 border border-[#ff4000]/30 rounded-lg bg-[#ff4000]/5">
                  <h4 className="font-medium text-[#ff4000] mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Restauré avec succès
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Restauré le:</span>
                      <span className="ml-2">
                        {selectedUser.restored_at
                          ? format(new Date(selectedUser.restored_at), 'dd/MM/yyyy à HH:mm', { locale: fr })
                          : 'N/A'
                        }
                      </span>
                    </div>
                    {selectedUser.restoration_notes && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Notes:</span>
                        <span className="ml-2">{selectedUser.restoration_notes}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>
              Fermer
            </Button>
            {selectedUser && !selectedUser.is_restored && getExpirationStatus(selectedUser.expires_at)?.status !== 'expired' && (
              <Button onClick={() => {
                setDetailsOpen(false);
                openRestoreDialog(selectedUser);
              }}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Restaurer cet utilisateur
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmation de restauration */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-primary" />
              Confirmer la restauration
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  Vous allez restaurer l'utilisateur{' '}
                  <strong>{selectedUser?.public_id || selectedUser?.email}</strong>.
                </p>

                <div className="p-3 bg-muted rounded-lg text-sm">
                  <p className="font-medium mb-2">Ce qui sera restauré:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Profil utilisateur (nom, email, téléphone)</li>
                    <li>Identifiant public ({selectedUser?.public_id})</li>
                    {selectedUser?.wallet_data && <li>Portefeuille et solde</li>}
                    <li>Compte d'authentification (mot de passe à réinitialiser)</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Notes de restauration (optionnel)</label>
                  <Textarea
                    placeholder="Raison de la restauration..."
                    value={restoreNotes}
                    onChange={(e) => setRestoreNotes(e.target.value)}
                    className="resize-none"
                    rows={2}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestore}
              disabled={restoring}
              className="bg-primary"
            >
              {restoring ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Restauration...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Confirmer la restauration
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
