import { useEffect, useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { backendFetch } from '@/services/backendApi';
import { Search, UserCheck, UserX, Lock, Unlock, Shield, Trash2, Store, Package, Eye, _ChevronDown, ChevronUp, Globe, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { _Collapsible, _CollapsibleContent, _CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const COUNTRY_OPTIONS = [
  { code: 'GN', name: 'Guinée', currency: 'GNF', flag: '🇬🇳' },
  { code: 'SN', name: 'Sénégal', currency: 'XOF', flag: '🇸🇳' },
  { code: 'CI', name: 'Côte d\'Ivoire', currency: 'XOF', flag: '🇨🇮' },
  { code: 'ML', name: 'Mali', currency: 'XOF', flag: '🇲🇱' },
  { code: 'BF', name: 'Burkina Faso', currency: 'XOF', flag: '🇧🇫' },
  { code: 'NE', name: 'Niger', currency: 'XOF', flag: '🇳🇪' },
  { code: 'TG', name: 'Togo', currency: 'XOF', flag: '🇹🇬' },
  { code: 'BJ', name: 'Bénin', currency: 'XOF', flag: '🇧🇯' },
  { code: 'CM', name: 'Cameroun', currency: 'XAF', flag: '🇨🇲' },
  { code: 'GA', name: 'Gabon', currency: 'XAF', flag: '🇬🇦' },
  { code: 'CG', name: 'Congo', currency: 'XAF', flag: '🇨🇬' },
  { code: 'TD', name: 'Tchad', currency: 'XAF', flag: '🇹🇩' },
  { code: 'CF', name: 'Centrafrique', currency: 'XAF', flag: '🇨🇫' },
  { code: 'GQ', name: 'Guinée Équatoriale', currency: 'XAF', flag: '🇬🇶' },
  { code: 'SL', name: 'Sierra Leone', currency: 'SLL', flag: '🇸🇱' },
  { code: 'NG', name: 'Nigéria', currency: 'NGN', flag: '🇳🇬' },
  { code: 'GH', name: 'Ghana', currency: 'GHS', flag: '🇬🇭' },
  { code: 'MA', name: 'Maroc', currency: 'MAD', flag: '🇲🇦' },
  { code: 'DZ', name: 'Algérie', currency: 'DZD', flag: '🇩🇿' },
  { code: 'TN', name: 'Tunisie', currency: 'TND', flag: '🇹🇳' },
  { code: 'FR', name: 'France', currency: 'EUR', flag: '🇫🇷' },
  { code: 'BE', name: 'Belgique', currency: 'EUR', flag: '🇧🇪' },
  { code: 'US', name: 'États-Unis', currency: 'USD', flag: '🇺🇸' },
  { code: 'GB', name: 'Royaume-Uni', currency: 'GBP', flag: '🇬🇧' },
  { code: 'KE', name: 'Kenya', currency: 'KES', flag: '🇰🇪' },
  { code: 'ZA', name: 'Afrique du Sud', currency: 'ZAR', flag: '🇿🇦' },
];

export default function PDGUsers() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<unknown[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [userServices, setUserServices] = useState<Record<string, any[]>>({});
  const [vendorCodes, setVendorCodes] = useState<Record<string, string>>({});
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  const [currencyDialog, setCurrencyDialog] = useState<{
    open: boolean;
    user: any;
    selectedCountry: string;
    saving: boolean;
    error: string | null;
  }>({ open: false, user: null, selectedCountry: '', saving: false, error: null });

  const openCurrencyDialog = (user: any) => {
    setCurrencyDialog({ open: true, user, selectedCountry: '', saving: false, error: null });
  };

  const handleCurrencyChange = async () => {
    const { user, selectedCountry } = currencyDialog;
    if (!user || !selectedCountry) return;
    const country = COUNTRY_OPTIONS.find(c => c.code === selectedCountry);
    if (!country) return;

    setCurrencyDialog(d => ({ ...d, saving: true, error: null }));

    const result = await backendFetch<any>('/api/vendors/admin/change-currency', {
      method: 'POST',
      body: {
        vendor_id:        user.id,
        new_currency:     country.currency,
        new_country_code: country.code,
        reason:           'Changement manuel PDG',
        entity_type:      'user',
      },
    });

    setCurrencyDialog(d => ({ ...d, saving: false }));

    if (!result.success) {
      setCurrencyDialog(d => ({ ...d, error: result.error || 'Erreur inconnue' }));
      return;
    }

    if (!result.changed) {
      toast.info(result.message);
      setCurrencyDialog(d => ({ ...d, open: false }));
      return;
    }

    toast.success(
      [
        `Devise changée : ${result.old_currency} → ${result.new_currency}`,
        result.wallet_converted
          ? `Solde converti : ${result.old_balance?.toLocaleString()} ${result.old_currency} → ${result.new_balance?.toLocaleString()} ${result.new_currency}`
          : '',
      ].filter(Boolean).join('\n'),
      { duration: 6000 }
    );
    setCurrencyDialog(d => ({ ...d, open: false }));
    loadUsers();
  };

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, roleFilter, users]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      // Charger les profils + user_ids pour afficher un ID canonique fiable.
      const [profilesRes, userIdsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, first_name, last_name, email, role, is_active, status, public_id, custom_id, created_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('user_ids')
          .select('user_id, custom_id'),
      ]);

      const { data: profiles, error } = profilesRes;

      if (error) throw error;

      const canonicalByUserId = new Map(
        (userIdsRes.data || [])
          .filter((row: any) => row?.user_id && row?.custom_id)
          .map((row: any) => [row.user_id, String(row.custom_id).toUpperCase()])
      );

      const normalizedProfiles = (profiles || []).map((profile: any) => ({
        ...profile,
        public_id: canonicalByUserId.get(profile.id) || profile.public_id || profile.custom_id || null,
      }));

      setUsers(normalizedProfiles);

      // Charger les services pour chaque vendeur
      // NOTE: On utilise profiles.public_id comme source unique de vérité pour les IDs
      // Plus besoin de charger vendors.vendor_code car il est désynchronisé
      const vendorIds = normalizedProfiles.filter((p: any) => p.role === 'vendeur').map((p: any) => p.id) || [];
      if (vendorIds.length > 0) {
        // On utilise directement profiles.public_id, plus besoin de vendorCodes
        // Le code est gardé pour compatibilité mais on préfère public_id
        const codesMap: Record<string, string> = {};
        normalizedProfiles.filter((p: any) => p.role === 'vendeur').forEach((profile: any) => {
          // Priorité à public_id (source unique de vérité)
          if (profile.public_id) {
            codesMap[profile.id] = profile.public_id;
          }
        });
        setVendorCodes(codesMap);

        // Charger les services professionnels
        const { data: services } = await supabase
          .from('professional_services')
          .select(`
            id,
            user_id,
            business_name,
            status,
            created_at,
            rating,
            total_reviews,
            address,
            phone,
            service_types(name, code)
          `)
          .in('user_id', vendorIds);

        // Grouper les services par user_id
        const servicesMap: Record<string, any[]> = {};
        services?.forEach(service => {
          if (!servicesMap[service.user_id]) {
            servicesMap[service.user_id] = [];
          }
          servicesMap[service.user_id].push(service);
        });
        setUserServices(servicesMap);
      }
    } catch (error) {
      console.error('Erreur chargement utilisateurs:', error);
      toast.error(t('pDGUsers.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = users;

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(u =>
        u.email?.toLowerCase().includes(search) ||
        u.first_name?.toLowerCase().includes(search) ||
        u.last_name?.toLowerCase().includes(search) ||
        u.public_id?.toLowerCase().includes(search)
      );
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter(u => u.role === roleFilter);
    }

    setFilteredUsers(filtered);
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !currentStatus })
        .eq('id', userId);

      if (error) throw error;

      // Log action
      await supabase.from('audit_logs').insert({
        actor_id: (await supabase.auth.getUser()).data.user?.id,
        action: currentStatus ? 'USER_SUSPENDED' : 'USER_ACTIVATED',
        target_type: 'user',
        target_id: userId
      });

      toast.success(currentStatus ? 'Utilisateur suspendu' : 'Utilisateur activé');
      loadUsers();
    } catch (_error) {
      toast.error(t('pDGUsers.erreurLorsDeLaModification'));
    }
  };

  const deleteUser = async (userId: string, userEmail: string) => {
    try {
      // Migré Edge Function → backend Node.js (/api/admin/delete-user)
      const res = await backendFetch<{ message?: string }>('/api/admin/delete-user', {
        method: 'POST',
        body: { userId },
      });

      if (!res.success) {
        throw new Error(res.error || 'Échec de la suppression');
      }

      toast.success(`Utilisateur ${userEmail} supprimé avec succès`);
      loadUsers();
    } catch (error: any) {
      console.error('Erreur suppression utilisateur:', error);
      toast.error(error.message || 'Erreur lors de la suppression de l\'utilisateur');
    }
  };

  const toggleUserExpanded = (userId: string) => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedUsers(newExpanded);
  };

  const getRoleBadge = (role: string) => {
    const colors = {
      admin: 'bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20',
      vendeur: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      client: 'bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20',
      livreur: 'bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20',
      taxi: 'bg-[#04439e]/10 text-[#04439e] border-[#04439e]/20',
      transitaire: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
      syndicat: 'bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20'
    };
    return colors[role as keyof typeof colors] || 'bg-muted text-muted-foreground';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <UserCheck className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{users.filter(u => u.is_active).length}</p>
                <p className="text-sm text-muted-foreground">Utilisateurs Actifs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <UserX className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{users.filter(u => !u.is_active).length}</p>
                <p className="text-sm text-muted-foreground">Utilisateurs Suspendus</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Shield className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{users.length}</p>
                <p className="text-sm text-muted-foreground">Total Utilisateurs</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>{t('pDGUsers.gestionDesUtilisateurs')}</CardTitle>
          <CardDescription>{t('pDGUsers.rechercheEtFiltrage')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('pDGUsers.rechercherParEmailNom')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-background"
                />
              </div>
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-48 bg-background">
                <SelectValue placeholder={t('pDGUsers.filtrerParRole')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('pDGUsers.tousLesRoles')}</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="vendeur">{t('pDGUsers.vendeur')}</SelectItem>
                <SelectItem value="client">{t('pDGUsers.client')}</SelectItem>
                <SelectItem value="livreur">Livreur</SelectItem>
                <SelectItem value="taxi">Taxi</SelectItem>
                <SelectItem value="transitaire">Transitaire</SelectItem>
                <SelectItem value="syndicat">Syndicat</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <div className="grid gap-4">
        {filteredUsers.map((user, index) => (
          <Card
            key={user.id}
            className="border-border/40 bg-card/50 backdrop-blur-sm hover:shadow-xl transition-all duration-200 animate-fade-in"
            style={{ animationDelay: `${index * 30}ms` }}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
                      <Shield className="w-7 h-7 text-primary-foreground" />
                    </div>
                    {user.is_active && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#ff4000] rounded-full border-2 border-card" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">
                        {user.first_name} {user.last_name}
                      </h3>
                      {user.role === 'vendeur' && userServices[user.id] && (
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30">
                          <Store className="w-3 h-3 mr-1" />
                          {userServices[user.id].length} service(s)
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {/* Afficher vendor_code pour les vendeurs, sinon public_id */}
                      {user.role === 'vendeur' && vendorCodes[user.id] ? (
                        <Badge variant="outline" className="font-mono bg-primary/10 text-primary border-primary/30">
                          <Store className="w-3 h-3 mr-1" />
                          {vendorCodes[user.id]}
                        </Badge>
                      ) : user.public_id && (
                        <Badge variant="outline" className="font-mono bg-primary/10 text-primary border-primary/30">
                          {user.public_id}
                        </Badge>
                      )}
                      <Badge variant="outline" className={getRoleBadge(user.role)}>
                        {user.role}
                      </Badge>
                      <Badge variant="outline" className={user.is_active ? 'border-[#ff4000]/50 bg-[#ff4000]/10 text-[#ff4000]' : 'border-[#ff4000]/50 bg-[#ff4000]/10 text-[#ff4000]'}>
                        {user.is_active ? 'Actif' : 'Suspendu'}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {user.role === 'vendeur' && userServices[user.id] && userServices[user.id].length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleUserExpanded(user.id)}
                      className="border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-500"
                    >
                      {expandedUsers.has(user.id) ? (
                        <>
                          <ChevronUp className="w-4 h-4 mr-2" />
                          Masquer
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4 mr-2" />
                          Services
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openCurrencyDialog(user)}
                    className="border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-500"
                  >
                    <Globe className="w-4 h-4 mr-2" />
                    Devise
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleUserStatus(user.id, user.is_active)}
                    className={user.is_active ? 'border-[#ff4000]/50 hover:bg-[#ff4000]/10 hover:text-[#ff4000]' : 'border-[#ff4000]/50 hover:bg-[#ff4000]/10 hover:text-[#ff4000]'}
                  >
                    {user.is_active ? (
                      <>
                        <Lock className="w-4 h-4 mr-2" />
                        Suspendre
                      </>
                    ) : (
                      <>
                        <Unlock className="w-4 h-4 mr-2" />
                        Activer
                      </>
                    )}
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-[#ff4000]/50 hover:bg-[#ff4000]/10 hover:text-[#ff4000]"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Supprimer
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('pDGUsers.confirmerLaSuppression')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          Êtes-vous sûr de vouloir supprimer l'utilisateur <strong>{user.email}</strong> ?
                          Cette action est irréversible et supprimera toutes les données associées.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('pDGUsers.annuler')}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteUser(user.id, user.email)}
                          className="bg-[#ff4000] hover:bg-[#ff4000]"
                        >
                          Supprimer définitivement
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              {/* Section des services (affichée si étendue) */}
              {user.role === 'vendeur' && expandedUsers.has(user.id) && userServices[user.id] && (
                <div className="mt-4 pt-4 border-t border-border/40">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Store className="w-4 h-4" />
                    Services professionnels ({userServices[user.id].length})
                  </h4>
                  <div className="grid gap-3">
                    {userServices[user.id].map((service) => (
                      <div
                        key={service.id}
                        className="p-4 rounded-lg border border-border/40 bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h5 className="font-semibold text-sm">{service.business_name}</h5>
                              <Badge
                                variant="outline"
                                className={
                                  service.status === 'active'
                                    ? 'border-[#ff4000]/50 bg-[#ff4000]/10 text-[#ff4000] text-xs'
                                    : service.status === 'pending'
                                    ? 'border-[#ff4000]/50 bg-[#ff4000]/10 text-[#ff4000] text-xs'
                                    : 'border-[#ff4000]/50 bg-[#ff4000]/10 text-[#ff4000] text-xs'
                                }
                              >
                                {service.status}
                              </Badge>
                              {service.service_types && (
                                <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-500 border-blue-500/30">
                                  {service.service_types.name}
                                </Badge>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Package className="w-3 h-3" />
                                <span>ID: {service.id.substring(0, 8)}...</span>
                              </div>
                              {service.phone && (
                                <div className="flex items-center gap-1">
                                  <span>📞 {service.phone}</span>
                                </div>
                              )}
                              {service.address && (
                                <div className="col-span-2 flex items-center gap-1">
                                  <span>📍 {service.address}</span>
                                </div>
                              )}
                              {service.rating > 0 && (
                                <div className="flex items-center gap-1">
                                  <span>⭐ {service.rating.toFixed(1)} ({service.total_reviews || 0} avis)</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1">
                                <span>📅 Créé le {new Date(service.created_at).toLocaleDateString('fr-FR')}</span>
                              </div>
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              // Copier l'ID du service
                              navigator.clipboard.writeText(service.id);
                              toast.success(t('pDGUsers.idDuServiceCopie'));
                            }}
                            className="ml-2"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredUsers.length === 0 && (
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">{t('pDGUsers.aucunUtilisateurTrouve')}</p>
          </CardContent>
        </Card>
      )}

      {/* Dialog changement de devise */}
      <Dialog open={currencyDialog.open} onOpenChange={open => setCurrencyDialog(d => ({ ...d, open }))}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Changer la devise
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Utilisateur : <strong>{currencyDialog.user?.email}</strong>
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('pDGUsers.paysDeResidence')}</label>
              <Select
                value={currencyDialog.selectedCountry}
                onValueChange={v => setCurrencyDialog(d => ({ ...d, selectedCountry: v, error: null }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('pDGUsers.selectionnerUnPays')} />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRY_OPTIONS.map(c => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.flag} {c.name} — {c.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {currencyDialog.error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded p-2">{currencyDialog.error}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCurrencyDialog(d => ({ ...d, open: false }))}>
              Annuler
            </Button>
            <Button
              onClick={handleCurrencyChange}
              disabled={!currencyDialog.selectedCountry || currencyDialog.saving}
            >
              {currencyDialog.saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />En cours...</> : 'Confirmer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
