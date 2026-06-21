import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2, Sparkles, TrendingUp, Link2, Wallet, Users, Shield, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAffiliateModule } from '@/hooks/useAffiliateModule';
import { useTranslation } from '@/hooks/useTranslation';
import { toast } from 'sonner';

export default function AffiliateActivationPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const {
    loading,
    isAffiliateEnabled,
    activateWithExistingSubscription,
  } = useAffiliateModule();

  const [activating, setActivating] = useState(false);

  useEffect(() => {
    if (isAffiliateEnabled) {
      navigate('/affiliate/dashboard', { replace: true });
    }
  }, [isAffiliateEnabled, navigate]);

  const handleActivate = async () => {
    setActivating(true);
    try {
      await activateWithExistingSubscription();
      toast.success(t('affiliateActivationPage.moduleAffilieActiveAvecSucces'));
      navigate('/affiliate/dashboard');
    } catch (error: any) {
      toast.error(error.message || "Impossible d'activer le module affilié");
    } finally {
      setActivating(false);
    }
  };

  const steps = [
    {
      icon: <Gift className="h-5 w-5 text-primary" />,
      title: "Activez gratuitement",
      description: "Cliquez sur le bouton d'activation pour ouvrir votre espace affilié. Aucun frais, aucun engagement."
    },
    {
      icon: <Link2 className="h-5 w-5 text-primary" />,
      title: "Partagez vos liens",
      description: "Recevez un code affilié unique et des liens de parrainage à partager avec votre réseau."
    },
    {
      icon: <Users className="h-5 w-5 text-primary" />,
      title: "Parrainez des utilisateurs",
      description: "Chaque personne qui s'inscrit ou achète via votre lien vous rapporte une commission."
    },
    {
      icon: <Wallet className="h-5 w-5 text-primary" />,
      title: "Gagnez des commissions",
      description: "Vos gains sont crédités directement sur votre wallet. Retirez quand vous voulez."
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="container max-w-4xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/client')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{t('affiliateActivationPage.devenirAffilie')}</h1>
            <p className="text-muted-foreground text-sm">{t('affiliateActivationPage.gagnezDeLArgentEn')}</p>
          </div>
        </div>

        {/* Hero Card */}
        <Card className="border-primary/20 bg-primary/10 overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                <Sparkles className="h-3 w-3 mr-1" />
                Programme gratuit
              </Badge>
            </div>
            <CardTitle className="text-xl mt-2">Programme d'Affiliation</CardTitle>
            <CardDescription className="text-sm">
              Rejoignez notre programme d'affiliation et transformez votre réseau en source de revenus.
              Votre compte client reste intact — l'affiliation est un module complémentaire.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-background/60 border">
                <CheckCircle2 className="h-5 w-5 text-[#ff4000] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{t('affiliateActivationPage.commissionsSurChaqueVente')}</p>
                  <p className="text-xs text-muted-foreground">{t('affiliateActivationPage.gagnezUnPourcentageSurLes')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-background/60 border">
                <CheckCircle2 className="h-5 w-5 text-[#ff4000] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{t('affiliateActivationPage.tableauDeBordDedie')}</p>
                  <p className="text-xs text-muted-foreground">{t('affiliateActivationPage.suivezVosPerformancesLiensEt')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-background/60 border">
                <CheckCircle2 className="h-5 w-5 text-[#ff4000] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{t('affiliateActivationPage.liensDeParrainageIllimites')}</p>
                  <p className="text-xs text-muted-foreground">{t('affiliateActivationPage.creezAutantDeLiensQue')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-background/60 border">
                <CheckCircle2 className="h-5 w-5 text-[#ff4000] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{t('affiliateActivationPage.paiementDirectAuWallet')}</p>
                  <p className="text-xs text-muted-foreground">{t('affiliateActivationPage.commissionsCrediteesAutomatiquementSurVo')}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* How it works */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Comment ça marche ?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {steps.map((step, index) => (
                <div key={index} className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      {step.icon}
                    </div>
                    {index < steps.length - 1 && (
                      <div className="w-0.5 h-6 bg-border mt-1" />
                    )}
                  </div>
                  <div className="pt-1.5">
                    <p className="font-medium text-sm">{step.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Important info */}
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">{t('affiliateActivationPage.votreCompteClientResteIntact')}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  L'activation de l'affiliation est un module complémentaire. Vous conservez toutes vos fonctionnalités :
                  commandes, wallet, favoris, historique, paramètres et notifications.
                  Aucune donnée ne sera modifiée ou supprimée.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Activation CTA */}
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle>{t('affiliateActivationPage.pretACommencer')}</CardTitle>
              <CardDescription>
                Activez gratuitement votre module affilié en un clic et commencez à gagner des commissions dès maintenant.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-3">
              <Button onClick={handleActivate} disabled={activating} size="lg" className="flex-1 sm:flex-none">
                {activating ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Activation en cours...</>
                ) : (
                  <><Sparkles className="mr-2 h-4 w-4" />Activer l'affiliation gratuitement</>
                )}
              </Button>
              <Button variant="ghost" onClick={() => navigate('/client')}>
                Retour au compte client
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
