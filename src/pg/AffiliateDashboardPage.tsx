import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, Link2, Megaphone, UserCircle, Wallet, Copy, ExternalLink, TrendingUp, Users, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useAffiliateModule } from '@/hooks/useAffiliateModule';
import { AffiliateDashboard } from '@/components/travel/AffiliateDashboard';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export default function AffiliateDashboardPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { isAffiliateEnabled, affiliateCode, affiliateStatus } = useAffiliateModule();
  const [activeTab, setActiveTab] = useState('dashboard');

  const affiliateLink = useMemo(() => {
    if (!affiliateCode) return null;
    return `${window.location.origin}/travel?ref=${affiliateCode}`;
  }, [affiliateCode]);

  const copyLink = () => {
    if (affiliateLink) {
      navigator.clipboard.writeText(affiliateLink);
      toast.success(t('affiliateDashboardPage.lienAffilieCopie'));
    }
  };

  if (!isAffiliateEnabled) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="container max-w-3xl mx-auto p-4 space-y-6">
          <Button variant="ghost" size="sm" onClick={() => navigate('/client')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Retour client
          </Button>
          <Card>
            <CardHeader>
              <CardTitle>{t('affiliate.dashboard.notEnabledTitle')}</CardTitle>
              <CardDescription>
                {t('affiliate.dashboard.notEnabledDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate('/affiliate/activation')}>{t('affiliate.dashboard.activateNow')}</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="container max-w-6xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate('/client')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{t('affiliateDashboardPage.espaceAffilie')}</h1>
                <Badge variant="secondary" className="text-xs">
                  {affiliateStatus === 'approved' ? 'Actif' : affiliateStatus}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Bienvenue {profile?.first_name || 'Affilié'} — Code : <span className="font-mono font-semibold">{affiliateCode}</span>
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/client')}>
            Compte client
          </Button>
        </div>

        {/* Quick link copy */}
        {affiliateLink && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-3 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-1">{t('affiliateDashboardPage.votreLienDeParrainage')}</p>
                <p className="text-sm font-mono truncate">{affiliateLink}</p>
              </div>
              <Button size="sm" variant="outline" onClick={copyLink}>
                <Copy className="h-4 w-4 mr-1" /> Copier
              </Button>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="overflow-x-auto scrollbar-hide -mx-3 px-3 md:mx-0 md:px-0">
            <TabsList className="inline-flex w-max md:grid md:w-full md:grid-cols-6">
              <TabsTrigger value="dashboard"><BarChart3 className="h-4 w-4 mr-1" />Dashboard</TabsTrigger>
              <TabsTrigger value="products"><Megaphone className="h-4 w-4 mr-1" />{t('affiliateDashboardPage.produits')}</TabsTrigger>
              <TabsTrigger value="links"><Link2 className="h-4 w-4 mr-1" />Mes liens</TabsTrigger>
              <TabsTrigger value="stats"><TrendingUp className="h-4 w-4 mr-1" />Statistiques</TabsTrigger>
              <TabsTrigger value="payments"><Wallet className="h-4 w-4 mr-1" />{t('affiliateDashboardPage.paiements')}</TabsTrigger>
              <TabsTrigger value="profile"><UserCircle className="h-4 w-4 mr-1" />{t('affiliateDashboardPage.profil')}</TabsTrigger>
            </TabsList>
          </div>

          {/* Dashboard principal */}
          <TabsContent value="dashboard">
            <AffiliateDashboard onViewServices={() => navigate('/services-proximite')} />
          </TabsContent>

          {/* Produits à promouvoir */}
          <TabsContent value="products">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    Produits à promouvoir
                  </CardTitle>
                  <CardDescription>
                    Parcourez le catalogue et générez des liens d'affiliation pour les produits que vous souhaitez recommander.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button onClick={() => navigate('/marketplace')} className="h-auto py-4 flex-col gap-1">
                      <Package className="h-5 w-5" />
                      <span>{t('affiliateDashboardPage.produitsPhysiques')}</span>
                      <span className="text-xs opacity-70">{t('affiliateDashboardPage.marketplaceComplete')}</span>
                    </Button>
                    <Button variant="outline" onClick={() => navigate('/digital-products')} className="h-auto py-4 flex-col gap-1">
                      <Megaphone className="h-5 w-5" />
                      <span>{t('affiliateDashboardPage.produitsNumeriques')}</span>
                      <span className="text-xs opacity-70">{t('affiliateDashboardPage.modulesServicesDigitaux')}</span>
                    </Button>
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => navigate('/services-proximite')}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Services de proximité
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Liens affiliés */}
          <TabsContent value="links">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5 text-primary" />
                  Mes liens affiliés
                </CardTitle>
                <CardDescription>
                  Partagez ces liens pour gagner des commissions sur chaque inscription ou achat.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border p-4 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Lien principal</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm bg-muted p-2 rounded truncate">{affiliateLink || 'Génération...'}</code>
                    {affiliateLink && (
                      <Button size="sm" variant="outline" onClick={copyLink}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border p-4 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Lien Marketplace</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm bg-muted p-2 rounded truncate">
                      {affiliateCode ? `${window.location.origin}/marketplace?ref=${affiliateCode}` : '...'}
                    </code>
                    <Button size="sm" variant="outline" onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/marketplace?ref=${affiliateCode}`);
                      toast.success(t('affiliateDashboardPage.lienCopie'));
                    }}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border p-4 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">{t('affiliateDashboardPage.lienServices')}</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm bg-muted p-2 rounded truncate">
                      {affiliateCode ? `${window.location.origin}/services-proximite?ref=${affiliateCode}` : '...'}
                    </code>
                    <Button size="sm" variant="outline" onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/services-proximite?ref=${affiliateCode}`);
                      toast.success(t('affiliateDashboardPage.lienCopie'));
                    }}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Statistiques */}
          <TabsContent value="stats">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Statistiques détaillées
                </CardTitle>
                <CardDescription>
                  Vue d'ensemble de vos performances d'affiliation.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <Users className="h-5 w-5 mx-auto text-primary mb-1" />
                    <p className="text-xs text-muted-foreground">Filleuls</p>
                    <p className="text-lg font-bold">—</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <Link2 className="h-5 w-5 mx-auto text-primary mb-1" />
                    <p className="text-xs text-muted-foreground">Clics</p>
                    <p className="text-lg font-bold">—</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <TrendingUp className="h-5 w-5 mx-auto text-primary mb-1" />
                    <p className="text-xs text-muted-foreground">Conversions</p>
                    <p className="text-lg font-bold">—</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <Wallet className="h-5 w-5 mx-auto text-primary mb-1" />
                    <p className="text-xs text-muted-foreground">Revenus</p>
                    <p className="text-lg font-bold">—</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center mt-4">
                  Les statistiques détaillées s'afficheront au fur et à mesure de votre activité.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Paiements */}
          <TabsContent value="payments">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" />
                  Paiements & Commissions
                </CardTitle>
                <CardDescription>
                  Vos commissions sont créditées sur votre wallet principal. Aucune donnée client n'est affectée.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button onClick={() => navigate('/wallet')} className="w-full sm:w-auto">
                  <Wallet className="h-4 w-4 mr-2" />
                  Voir mon wallet
                </Button>
                <p className="text-xs text-muted-foreground">
                  Les commissions affiliées sont automatiquement ajoutées à votre wallet existant.
                  Consultez l'historique des transactions pour le détail.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Profil affilié */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCircle className="h-5 w-5 text-primary" />
                  Profil Affilié
                </CardTitle>
                <CardDescription>
                  Informations de votre compte affilié.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">{t('affiliateDashboardPage.codeAffilie')}</p>
                    <p className="font-mono font-semibold text-sm">{affiliateCode || 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Statut</p>
                    <Badge variant={affiliateStatus === 'approved' ? 'default' : 'secondary'}>
                      {affiliateStatus === 'approved' ? 'Actif' : affiliateStatus || 'N/A'}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Compte principal</p>
                    <p className="text-sm">{profile?.first_name} {profile?.last_name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">{t('affiliateDashboardPage.role')}</p>
                    <Badge variant="outline">{profile?.role || 'client'} + affilié</Badge>
                  </div>
                </div>
                <div className="pt-2 border-t">
                  <Button variant="outline" onClick={() => navigate('/profil')}>
                    Modifier mon profil principal
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
