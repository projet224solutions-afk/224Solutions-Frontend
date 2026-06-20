import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Money } from '@/components/Money';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Link2, Copy, ExternalLink, Plus, BarChart3,
  Users, MousePointer, TrendingUp, Loader2, RefreshCw,
  Calendar
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface AffiliateLink {
  id: string;
  token: string;
  name: string;
  target_role: string;
  commission_override: number | null;
  clicks_count: number;
  registrations_count: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  url: string;
  short_url: string;
}

interface Stats {
  active_links: number;
  total_clicks: number;
  total_registrations: number;
  affiliated_users: number;
  conversion_rate: string;
  commissions: {
    pending: number;
    validated: number;
    paid: number;
    total: number;
  };
}

interface AgentAffiliateLinksSectionProps {
  agentId: string;
  agentToken?: string; // Token d'accès de l'agent (pour auth via X-Agent-Token)
}

export function AgentAffiliateLinksSection({ agentId, agentToken }: AgentAffiliateLinksSectionProps) {
  const { t } = useTranslation();
  const [links, setLinks] = useState<AffiliateLink[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Formulaire de création
  const [newLink, setNewLink] = useState({
    name: '',
    target_role: 'all',
    commission_override: '',
    expires_days: ''
  });

  // Récupérer le token depuis l'URL si non fourni en props
  const getAgentToken = (): string | null => {
    if (agentToken) return agentToken;

    // Essayer de récupérer depuis l'URL
    const pathParts = window.location.pathname.split('/');
    const agentIndex = pathParts.indexOf('agent');
    if (agentIndex !== -1 && pathParts[agentIndex + 1]) {
      return pathParts[agentIndex + 1];
    }

    // Essayer depuis sessionStorage
    return sessionStorage.getItem('agent_access_token');
  };

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  // Migré vers le backend Node (« tout en backend ») : endpoint action-based.
  // Auth : JWT si l'agent a une session (dashboard), sinon agent_token (interface publique).
  const invokeWithAgentAuth = async (action: string, body?: any) => {
    const token = getAgentToken();
    const payload = { action, ...(body || {}), agent_token: token || undefined };

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { backendFetch } = await import('@/services/backendApi');
      const resp = await backendFetch<any>('/api/agents/affiliate-links', { method: 'POST', body: payload });
      return { data: resp.data, error: resp.success ? null : { message: resp.error } };
    }

    // Pas de session (interface agent publique) → appel direct avec agent_token
    const { resolveBackendUrl } = await import('@/config/backend');
    const res = await fetch(resolveBackendUrl('/api/agents/affiliate-links'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const json = await res.json();
    return { data: json.data, error: json.success ? null : { message: json.error || 'Erreur' } };
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Charger les liens
      const linksResponse = await invokeWithAgentAuth('list');
      if (linksResponse.data?.links) {
        // Générer les URLs côté client pour s'assurer qu'elles correspondent au domaine actuel
        const baseUrl = window.location.origin;
        const linksWithCorrectUrls = linksResponse.data.links.map((link: AffiliateLink) => ({
          ...link,
          url: `${baseUrl}/r/${link.token}`,
          short_url: `${baseUrl}/r/${link.token}`
        }));
        setLinks(linksWithCorrectUrls);
      } else if (linksResponse.error) {
        console.error('Erreur chargement liens:', linksResponse.error);
      }

      // Charger les stats
      const statsResponse = await invokeWithAgentAuth('stats');
      if (statsResponse.data?.stats) {
        setStats(statsResponse.data.stats);
      }
    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setLoading(false);
    }
  };

  const createLink = async () => {
    setCreating(true);
    try {
      const body: any = {
        name: newLink.name || `Lien ${new Date().toLocaleDateString('fr-FR')}`,
        target_role: newLink.target_role
      };

      if (newLink.commission_override) {
        body.commission_override = parseFloat(newLink.commission_override);
      }

      if (newLink.expires_days) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + parseInt(newLink.expires_days));
        body.expires_at = expiresAt.toISOString();
      }

      const response = await invokeWithAgentAuth('create', body);

      if (response.error) throw response.error;

      toast.success(t('agentAffiliateLinksSection.lienCreeAvecSucces'), {
        description: 'Copiez le lien et partagez-le avec vos prospects'
      });

      setShowCreateDialog(false);
      setNewLink({ name: '', target_role: 'all', commission_override: '', expires_days: '' });
      loadData();
    } catch (error: any) {
      toast.error(t('agentAffiliateLinksSection.erreurLorsDeLaCreation'), { description: error.message });
    } finally {
      setCreating(false);
    }
  };

  const copyLink = (url: string) => {
    // Fallback avec textarea (fonctionne mieux en HTTP/localhost)
    const textArea = document.createElement('textarea');
    textArea.value = url;
    textArea.style.position = 'fixed';
    textArea.style.left = '0';
    textArea.style.top = '0';
    textArea.style.opacity = '0';
    textArea.style.pointerEvents = 'none';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (successful) {
        toast.success(t('agentAffiliateLinksSection.lienCopie'), { description: url });
        return;
      }
    } catch (_err) {
      document.body.removeChild(textArea);
    }

    // Si execCommand échoue, essayer l'API moderne
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url)
        .then(() => toast.success(t('agentAffiliateLinksSection.lienCopie'), { description: url }))
        .catch(() => {
          toast.info('Copiez ce lien:', {
            description: url,
            duration: 15000,
            action: {
              label: 'OK',
              onClick: () => {}
            }
          });
        });
    } else {
      // Dernier recours: afficher pour copie manuelle
      toast.info('Copiez ce lien:', {
        description: url,
        duration: 15000,
        action: {
          label: 'OK',
          onClick: () => {}
        }
      });
    }
  };

  const toggleLinkStatus = async (linkId: string, isActive: boolean) => {
    try {
      await invokeWithAgentAuth('update', { link_id: linkId, is_active: !isActive });
      loadData();
      toast.success(isActive ? 'Lien désactivé' : 'Lien activé');
    } catch (error: any) {
      toast.error('Erreur', { description: error.message });
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      'all': 'Tous',
      'client': 'Clients',
      'vendeur': 'Vendeurs',
      'service': 'Prestataires'
    };
    return labels[role] || role;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats?.active_links || 0}</p>
                <p className="text-xs text-muted-foreground">Liens actifs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <MousePointer className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.total_clicks || 0}</p>
                <p className="text-xs text-muted-foreground">Total clics</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-[#ff4000]" />
              <div>
                <p className="text-2xl font-bold">{stats?.affiliated_users || 0}</p>
                <p className="text-xs text-muted-foreground">{t('agentAffiliateLinksSection.affilies')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.conversion_rate || '0'}%</p>
                <p className="text-xs text-muted-foreground">Conversion</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Commissions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Commissions d'affiliation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-[#ff4000]/10 border border-[#ff4000]/20">
              <p className="text-sm text-[#ff4000] font-medium">En attente</p>
              <p className="text-2xl font-bold text-[#ff4000]">
                <Money amount={stats?.commissions?.pending || 0} from="GNF" />
              </p>
            </div>
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-sm text-blue-600 font-medium">{t('agentAffiliateLinksSection.validees')}</p>
              <p className="text-2xl font-bold text-blue-700">
                <Money amount={stats?.commissions?.validated || 0} from="GNF" />
              </p>
            </div>
            <div className="p-4 rounded-lg bg-[#ff4000]/10 border border-[#ff4000]/20">
              <p className="text-sm text-[#ff4000] font-medium">{t('agentAffiliateLinksSection.payees')}</p>
              <p className="text-2xl font-bold text-[#ff4000]">
                <Money amount={stats?.commissions?.paid || 0} from="GNF" />
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Liens d'affiliation */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Mes liens d'affiliation
              </CardTitle>
              <CardDescription>
                Générez des liens uniques pour recruter des utilisateurs
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadData}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-[#ff4000] hover:bg-[#ff4000] shadow-lg shadow-[#ff4000]/40">
                    <Plus className="h-4 w-4 mr-2" />
                    Nouveau lien
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('agentAffiliateLinksSection.creerUnLienDAffiliation')}</DialogTitle>
                    <DialogDescription>
                      Personnalisez votre lien pour suivre vos campagnes
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    <div>
                      <Label>{t('agentAffiliateLinksSection.nomDuLienOptionnel')}</Label>
                      <Input
                        placeholder="Ex: Campagne Facebook Janvier"
                        value={newLink.name}
                        onChange={(e) => setNewLink({ ...newLink, name: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label>Cible</Label>
                      <Select
                        value={newLink.target_role}
                        onValueChange={(v) => setNewLink({ ...newLink, target_role: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t('agentAffiliateLinksSection.tousLesUtilisateurs')}</SelectItem>
                          <SelectItem value="client">Clients uniquement</SelectItem>
                          <SelectItem value="vendeur">Vendeurs uniquement</SelectItem>
                          <SelectItem value="service">Prestataires uniquement</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>{t('agentAffiliateLinksSection.commissionSpecifiqueOptionnel')}</Label>
                      <Input
                        type="number"
                        placeholder={t('agentAffiliateLinksSection.laisserVidePourUtiliserLe')}
                        value={newLink.commission_override}
                        onChange={(e) => setNewLink({ ...newLink, commission_override: e.target.value })}
                        min="0"
                        max="50"
                      />
                    </div>

                    <div>
                      <Label>Expiration (jours - optionnel)</Label>
                      <Input
                        type="number"
                        placeholder={t('agentAffiliateLinksSection.laisserVidePourPasD')}
                        value={newLink.expires_days}
                        onChange={(e) => setNewLink({ ...newLink, expires_days: e.target.value })}
                        min="1"
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                      Annuler
                    </Button>
                    <Button onClick={createLink} disabled={creating}>
                      {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Créer le lien
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {links.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Link2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>{t('agentAffiliateLinksSection.aucunLienDAffiliation')}</p>
              <p className="text-sm">{t('agentAffiliateLinksSection.creezVotrePremierLienPour')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {links.map((link) => (
                <div
                  key={link.id}
                  className={`p-4 border rounded-lg ${
                    link.is_active ? 'bg-card' : 'bg-muted/50 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium truncate">{link.name}</h4>
                        <Badge variant={link.is_active ? 'default' : 'secondary'}>
                          {link.is_active ? 'Actif' : 'Inactif'}
                        </Badge>
                        <Badge variant="outline">{getRoleLabel(link.target_role)}</Badge>
                      </div>

                      <div className="flex items-center gap-2 mb-3">
                        <Input
                          value={link.url}
                          readOnly
                          className="text-xs font-mono bg-muted"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyLink(link.url)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <a href={link.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>

                      <div className="flex items-center gap-6 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MousePointer className="h-4 w-4" />
                          {link.clicks_count} clics
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {link.registrations_count} inscriptions
                        </span>
                        {link.commission_override && (
                          <span className="text-primary font-medium">
                            {link.commission_override}% commission
                          </span>
                        )}
                        {link.expires_at && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            Expire: {new Date(link.expires_at).toLocaleDateString('fr-FR')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={link.is_active}
                        onCheckedChange={() => toggleLinkStatus(link.id, link.is_active)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
