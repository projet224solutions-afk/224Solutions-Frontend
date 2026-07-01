import { useState, useEffect } from "react";
import { User, Settings, ShoppingBag, History, LogOut, Edit, Camera, ArrowLeft, Save, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useRoleRedirect } from "@/hooks/useRoleRedirect";
import QuickFooter from "@/components/QuickFooter";
import LanguageSelector from "@/components/LanguageSelector";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useStorageUpload } from "@/hooks/useStorageUpload";
import { useTranslation } from "@/hooks/useTranslation";

const userTypes = {
  client: {
    label: "Client",
    description: "Acheteur sur la plateforme",
    color: "bg-client-primary"
  },
  vendeur: {
    label: "Vendeur",
    description: "Vendeur de produits",
    color: "bg-vendeur-primary"
  },
  livreur: {
    label: "Livreur",
    description: "Livreur de commandes",
    color: "bg-livreur-primary"
  },
  taxi: {
    label: "Taxi-Moto",
    description: "Conducteur de taxi-moto",
    color: "bg-taxi-primary"
  },
  transitaire: {
    label: "Transitaire",
    description: "Transitaire international",
    color: "bg-transitaire-primary"
  },
  agent: {
    label: "Agent",
    description: "Agent commercial",
    color: "bg-[#04439e]"
  },
  service: {
    label: "Service Pro",
    description: "Prestataire de services professionnels",
    color: "bg-blue-600"
  },
  prestataire: {
    label: "Service Pro",
    description: "Prestataire de services professionnels",
    color: "bg-blue-600"
  },
  admin: {
    label: "PDG",
    description: "Président Directeur Général",
    color: "bg-primary"
  },
  pdg: {
    label: "PDG",
    description: "Président Directeur Général",
    color: "bg-primary"
  },
  vendor_agent: {
    label: "Agent Vendeur",
    description: "Agent commercial d'un vendeur",
    color: "bg-orange-500"
  }
};

const menuItems = [
  {
    id: 'orders',
    title: "Mes commandes",
    description: "Voir toutes mes commandes",
    icon: ShoppingBag
  },
  {
    id: 'history',
    title: 'Historique',
    description: "Historique des transactions",
    icon: History
  },
  {
    id: 'settings',
    title: "Paramètres",
    description: "Gérer mon compte",
    icon: Settings
  }
];

type ActivityItem = { id: string | number; type?: string; title: string; description?: string; timestamp: string; status?: string };

export default function Profil() {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  useRoleRedirect();
  const { uploadFile, isUploading: _uploading } = useStorageUpload();
  const [isEditing, _setIsEditing] = useState(false);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [openDialog, setOpenDialog] = useState<string | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [agentTypeInfo, setAgentTypeInfo] = useState<{ label: string; description: string } | null>(null);
  const [userAddress, setUserAddress] = useState<{ street: string; city: string; country: string } | null>(null);

  // Charger l'adresse de l'utilisateur
  useEffect(() => {
    const fetchAddress = async () => {
      if (!user?.id) return;
      try {
        // D'abord l'adresse par défaut
        const { data } = await supabase
          .from('user_addresses')
          .select('street, city, country')
          .eq('user_id', user.id)
          .eq('is_default', true)
          .maybeSingle();

        if (data) {
          setUserAddress(data);
        } else {
          // Fallback: première adresse
          const { data: anyAddr } = await supabase
            .from('user_addresses')
            .select('street, city, country')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          setUserAddress(anyAddr || null);
        }
      } catch (err) {
        console.error('Erreur chargement adresse:', err);
      }
    };
    fetchAddress();
  }, [user?.id]);

  // Récupérer le type d'agent dynamiquement si l'utilisateur est un agent
  useEffect(() => {
    const fetchAgentType = async () => {
      if (profile?.role === 'agent' && user?.id) {
        try {
          const { data, error } = await supabase
            .from('agents_management')
            .select('type_agent, role')
            .eq('user_id', user.id)
            .single();

          if (data && !error) {
            const typeLabel = data.type_agent
              ? data.type_agent.charAt(0).toUpperCase() + data.type_agent.slice(1)
              : 'Agent';
            const roleLabel = data.role || '';
            setAgentTypeInfo({
              label: `Agent ${typeLabel}`,
              description: roleLabel || `Agent ${typeLabel.toLowerCase()}`
            });
          }
        } catch (err) {
          console.error('Erreur récupération type agent:', err);
        }
      }
    };
    fetchAgentType();
  }, [profile?.role, user?.id]);

  const baseUserTypeInfo = (profile?.role && userTypes[profile.role as keyof typeof userTypes])
    ? userTypes[profile.role as keyof typeof userTypes]
    : userTypes.client;

  // Utiliser les infos dynamiques de l'agent si disponibles
  const userTypeInfo = profile?.role === 'agent' && agentTypeInfo
    ? { ...baseUserTypeInfo, label: agentTypeInfo.label, description: agentTypeInfo.description }
    : baseUserTypeInfo;

  const _loadOrders = async () => {
    if (!user) return;
    setLoadingData(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          customer_id,
          vendor_id,
          total_amount,
          status,
          payment_status,
          shipping_address,
          created_at
        `)
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error loading orders:', error);
        toast.error(t('profile.errorLoadingOrders'));
        setOrders([]);
      } else {
        setOrders(data || []);
      }
    } catch (error) {
      console.error('Error loading orders:', error);
      toast.error(t('profile.errorLoadingOrders'));
      setOrders([]);
    } finally {
      setLoadingData(false);
    }
  };

  const loadTransactions = async () => {
    if (!user) return;
    setLoadingData(true);
    try {
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select(`
          id,
          user_id,
          amount,
          type,
          status,
          description,
          created_at,
          currency
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error loading transactions:', error);
        toast.error(t('profile.errorLoadingTransactions'));
        setTransactions([]);
      } else {
        setTransactions(data || []);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
      toast.error(t('profile.errorLoadingTransactions'));
      setTransactions([]);
    } finally {
      setLoadingData(false);
    }
  };

  const handleMenuClick = async (itemId: string) => {
    if (itemId === 'orders') {
      navigate('/mes-commandes');
      return;
    } else if (itemId === 'history') {
      await loadTransactions();
    } else if (itemId === 'settings') {
      setEditEmail(user?.email || '');
      setEditPhone(profile?.phone || '');
      setEditMode(false);
    }
    setOpenDialog(itemId);
  };

  const handleSaveSettings = async () => {
    if (!user) return;

    setSaving(true);
    try {
      // Mise à jour de l'email
      if (editEmail !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: editEmail
        });
        if (emailError) throw emailError;
        toast.success(t('profile.emailUpdated'));
      }

      // Mise à jour du téléphone dans le profil
      if (editPhone !== profile?.phone) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ phone: editPhone })
          .eq('id', user.id);

        if (profileError) throw profileError;
        toast.success(t('profile.phoneUpdated'));
      }

      setEditMode(false);
      window.location.reload();
    } catch (error: any) {
      console.error('Error updating settings:', error);
      toast.error(error?.message || 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const loadActivity = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from('audit_logs')
        .select('id, action, created_at, target_type')
        .eq('actor_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) {
        const { data: orders, error: e2 } = await supabase
          .from('orders')
          .select('id, status, created_at, total_amount')
          .order('created_at', { ascending: false })
          .limit(10);
        if (!e2 && orders) {
          setActivities(
            orders.map((o: any) => ({
              id: o.id,
              title: `Commande #${o.id}`,
              description: `Montant: ${fc(o.total_amount || 0)}`,
              timestamp: o.created_at,
              status: o.status
            }))
          );
        }
        return;
      }
      setActivities(
        (data || []).map((a: any) => ({
          id: a.id,
          title: a.action || 'Activité',
          description: a.target_type || '',
          timestamp: a.created_at
        }))
      );
    };
    loadActivity();
  }, [user]);

  const onAvatarClick = async () => {
    if (!isEditing) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file || !user) return;
      try {
        // Photos de profil : rester dans Supabase (pas GCS) — routage voulu.
        const result = await uploadFile(file, {
          folder: 'avatars',
          subfolder: user.id,
          preferSupabase: true,
        });

        if (!result.success || !result.publicUrl) {
          throw new Error(result.error || 'Échec de l\'upload');
        }

        const { error: updErr } = await supabase.from('profiles').update({ avatar_url: result.publicUrl }).eq('id', user.id);
        if (updErr) throw updErr;
        toast.success(t('profile.avatarUpdated'));
        window.location.reload();
      } catch (e: any) {
        toast.error(e?.message || 'Erreur upload avatar');
      }
    };
    input.click();
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleGoBack = async () => {
    // Rediriger selon le rôle de l'utilisateur
    if (profile?.role === 'vendor_agent') {
      // Récupérer le token d'accès et rediriger vers l'interface agent
      const { data: vendorAgent } = await supabase
        .from('vendor_agents')
        .select('access_token')
        .eq('user_id', user?.id)
        .maybeSingle();
      if (vendorAgent?.access_token) {
        navigate(`/vendor-agent/${vendorAgent.access_token}`);
        return;
      }
      navigate('/');
      return;
    } else if (profile?.role === 'vendeur') {
      navigate('/vendeur');
    } else if (profile?.role === 'admin') {
      navigate('/admin');
    } else if (profile?.role === 'livreur') {
      navigate('/livreur');
    } else if (profile?.role === 'taxi') {
      navigate('/taxi-moto-driver');
    } else {
      navigate('/');
    }
  };

  // Authentication check
  if (!user) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <header className="bg-card border-b border-border">
          <div className="px-4 py-6">
            <h1 className="text-2xl font-bold text-foreground">{t('nav.profile')}</h1>
          </div>
        </header>

        <section className="px-4 py-8">
          <Card>
            <CardContent className="text-center py-12">
              <User className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">{t('profile.pleaseLogin')}</h2>
              <p className="text-muted-foreground mb-6">
                {t('profile.loginRequired')}
              </p>
              <Button
                onClick={() => navigate('/auth')}
                className="bg-vendeur-primary hover:bg-vendeur-primary/90"
              >
                {t('auth.login')}
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="px-4 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">{t('profile.title')}</h1>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGoBack}
              className="ml-auto gap-2 px-4 py-2 rounded-lg border-border hover:bg-accent hover:text-accent-foreground transition-all duration-200 shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="font-medium">{t('common.back')}</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Profile Info */}
      <section className="px-3 sm:px-4 py-4 sm:py-6">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="relative shrink-0" onClick={onAvatarClick}>
                <Avatar className="w-16 h-16 sm:w-20 sm:h-20">
                  <AvatarImage src={profile?.avatar_url || ""} />
                  <AvatarFallback className="text-lg sm:text-xl">
                    {profile?.first_name?.[0] || user.email?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {isEditing && (
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute -bottom-2 -right-2 h-7 w-7 sm:h-8 sm:w-8 rounded-full"
                  >
                    <Camera className="w-3 h-3 sm:w-4 sm:h-4" />
                  </Button>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-2">
                  <h2 className="text-lg sm:text-xl font-bold truncate">
                    {profile?.first_name && profile?.last_name
                      ? `${profile.first_name} ${profile.last_name}`
                      : user.email
                    }
                  </h2>
                  <Badge className={`${userTypeInfo.color} text-white text-xs w-fit shrink-0`}>
                    {userTypeInfo.label}
                  </Badge>
                </div>

                <p className="text-sm sm:text-base text-muted-foreground mb-1 sm:mb-2 break-all">{user.email}</p>

                {profile?.phone && (
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1 sm:mb-2">{profile.phone}</p>
                )}

                {userAddress && (
                  <div className="flex items-center gap-1.5 mb-1 sm:mb-2">
                    <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground shrink-0" />
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">
                      {[userAddress.street, userAddress.city, userAddress.country].filter(Boolean).join(', ')}
                    </p>
                  </div>
                )}

                <p className="text-xs sm:text-sm text-muted-foreground">
                  {userTypeInfo.description}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* User ID Card */}
        <Card className="mt-3 sm:mt-4">
          <CardContent className="p-3 sm:p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs sm:text-sm font-medium text-muted-foreground">{t('profile.yourUserId')}</label>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 h-8 text-xs sm:text-sm"
                  onClick={() => {
                    navigator.clipboard.writeText(user.id);
                    toast.success(t('profile.idCopied'));
                  }}
                >
                  {t('common.copy')}
                </Button>
              </div>
              <div className="p-2 sm:p-3 bg-muted rounded-md font-mono text-[10px] sm:text-xs break-all leading-relaxed">
                {user.id}
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                💡 Partagez cet ID pour permettre à d'autres utilisateurs de vous contacter directement
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Menu Items */}
      <section className="px-4 py-2">
        <div className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.id} className="cursor-pointer hover:shadow-elegant transition-all" onClick={() => handleMenuClick(item.id)}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-accent rounded-lg">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Orders Dialog */}
      <Dialog open={openDialog === 'orders'} onOpenChange={(open) => !open && setOpenDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('profile.myOrders')}</DialogTitle>
          </DialogHeader>
          {loadingData ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : orders.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t('profile.noOrders')}</p>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <Card key={order.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium">Commande #{order.id.slice(0, 8)}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      <Badge>{order.status}</Badge>
                    </div>
                    <p className="text-lg font-bold">
                      {order.total_amount ? fc(order.total_amount) : 'N/A'}
                    </p>
                    {order.delivery_address && (
                      <p className="text-sm text-muted-foreground mt-1">
                        📍 {order.delivery_address}
                        {order.delivery_city ? `, ${order.delivery_city}` : ''}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Transactions Dialog */}
      <Dialog open={openDialog === 'history'} onOpenChange={(open) => !open && setOpenDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('profile.transactionHistory')}</DialogTitle>
          </DialogHeader>
          {loadingData ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t('profile.noTransactions')}</p>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <Card key={tx.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{tx.type}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(tx.created_at).toLocaleString('fr-FR')}
                        </p>
                        {tx.description && (
                          <p className="text-sm text-muted-foreground mt-1">{tx.description}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-bold ${tx.amount > 0 ? 'text-[#ff4000]' : 'text-[#ff4000]'}`}>
                          {tx.amount > 0 ? '+' : ''}{tx.amount ? tx.amount.toLocaleString() : '0'} {tx.currency || 'GNF'}
                        </p>
                        <Badge variant={tx.status === 'completed' ? 'default' : 'secondary'}>
                          {tx.status || 'pending'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={openDialog === 'settings'} onOpenChange={(open) => {
        if (!open) {
          setOpenDialog(null);
          setEditMode(false);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('profile.accountSettings')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-sm font-medium">{t('auth.email')}</Label>
              {editMode ? (
                <Input
                  id="email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="mt-1"
                />
              ) : (
                <p className="text-muted-foreground mt-1">{user?.email}</p>
              )}
            </div>
            <div>
              <Label htmlFor="phone" className="text-sm font-medium">{t('auth.phone')}</Label>
              {editMode ? (
                <Input
                  id="phone"
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="+224 XXX XX XX XX"
                  className="mt-1"
                />
              ) : (
                <p className="text-muted-foreground mt-1">{profile?.phone || t('profile.notProvided')}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">{t('profile.role')}</label>
              <p className="text-muted-foreground mt-1">{profile?.role || 'client'}</p>
            </div>

            {/* Sélecteur de langue */}
            <div className="pt-2 border-t border-border">
              <LanguageSelector variant="default" />
            </div>
          </div>
          <DialogFooter>
            {editMode ? (
              <>
                <Button variant="outline" onClick={() => setEditMode(false)} disabled={saving}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={handleSaveSettings} disabled={saving}>
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {t('profile.saving')}
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {t('common.save')}
                    </>
                  )}
                </Button>
              </>
            ) : (
              <Button onClick={() => setEditMode(true)}>
                <Edit className="w-4 h-4 mr-2" />
                {t('common.edit')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recent Activity */}
      <section className="px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('profile.recentActivity')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activities.length === 0 && (
                <div className="text-sm text-muted-foreground">{t('profile.noRecentActivity')}</div>
              )}
              {activities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 p-3 bg-accent rounded-lg">
                  <div className="w-2 h-2 bg-vendeur-primary rounded-full mt-2"></div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium text-sm">{activity.title}</h4>
                      <Badge variant="outline" className="text-xs">
                        {activity.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">{activity.description}</p>
                    <p className="text-xs text-muted-foreground">{activity.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Sign Out */}
      <section className="px-4 pb-6">
        <Button
          variant="outline"
          className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Se déconnecter
        </Button>
      </section>

      {/* Footer de navigation */}
      <QuickFooter />
    </div>
  );
}
