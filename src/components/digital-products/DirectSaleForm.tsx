/**
 * Formulaire spécialisé pour la vente directe
 * Inspiré de Gumroad, Teachable, Podia
 */

import {} from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import {
  Package,
  FileText,
  Upload,
  DollarSign,
  Clock,
  Shield,
  Users,
  Zap,
  Lock,
  Download,
  Mail,
  RefreshCw,
  AlertCircle,
  Share2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

export interface DirectSaleFormData {
  price: string;
  originalPrice: string;
  currency: string;
  pricingType: 'one_time' | 'subscription' | 'pay_what_you_want';
  subscriptionInterval: 'monthly' | 'yearly' | 'lifetime';
  minimumPrice: string;
  suggestedPrice: string;
  allowRefunds: boolean;
  refundPeriod: string;
  limitedQuantity: boolean;
  maxQuantity: string;
  requireEmail: boolean;
  instantDelivery: boolean;
  accessDuration: 'lifetime' | '1_year' | '6_months' | '3_months' | '1_month';
  // Affiliation (programme interne type Amazon Associates)
  affiliateEnabled: boolean;
  affiliateCommissionRate: string;
}

interface DirectSaleFormProps {
  data: DirectSaleFormData;
  onChange: (data: Partial<DirectSaleFormData>) => void;
}

const pricingTypes = [
  {
    id: 'one_time',
    label: "Paiement unique",
    icon: DollarSign,
    description: "Un seul paiement pour un accès complet"
  },
  {
    id: 'subscription',
    label: 'Abonnement',
    icon: RefreshCw,
    description: "Paiement récurrent mensuel ou annuel"
  },
  {
    id: 'pay_what_you_want',
    label: 'Prix libre',
    icon: Users,
    description: "Le client choisit son prix"
  }
];

const accessDurations = [
  { id: 'lifetime', label: "Accès à vie" },
  { id: '1_year', label: '1 an' },
  { id: '6_months', label: '6 mois' },
  { id: '3_months', label: '3 mois' },
  { id: '1_month', label: '1 mois' }
];

export function DirectSaleForm({ data, onChange }: DirectSaleFormProps) {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  return (
    <div className="space-y-4 sm:space-y-5">
      {data.pricingType === 'subscription' && (
        <Alert className="border-[#cfe0fb] bg-[#f5f9ff] shadow-[0_18px_35px_rgba(4,67,158,0.06)]">
          <RefreshCw className="h-4 w-4 text-[#04439e]" />
          <AlertDescription className="text-sm text-slate-700">
            Mode academie active: l'abonnement est ideal pour une bibliotheque de formations, des mises a jour mensuelles ou un coaching recurrent.
          </AlertDescription>
        </Alert>
      )}

      {/* Type de tarification */}
      <Card className="rounded-[24px] border-[#dde7fb] bg-white shadow-[0_18px_40px_rgba(4,67,158,0.06)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" />
            Modèle de Tarification
          </CardTitle>
          <CardDescription className="text-xs">
            Choisissez comment vous souhaitez être payé
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:gap-3">
            {pricingTypes.map((type) => {
              const Icon = type.icon;
              return (
                <div
                  key={type.id}
                  onClick={() => onChange({ pricingType: type.id as DirectSaleFormData['pricingType'] })}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border p-3 sm:p-4 cursor-pointer transition-all',
                    data.pricingType === type.id
                      ? 'border-[#cfe0fb] bg-[#f5f9ff] shadow-sm'
                      : 'border-[#e8eef8] hover:border-[#cfe0fb]'
                  )}
                >
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                    data.pricingType === type.id
                        ? 'bg-[#04439e] text-white'
                        : 'bg-[#f3f7ff] text-slate-500'
                  )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{type.label}</p>
                    <p className="text-xs text-muted-foreground">{type.description}</p>
                  </div>
                  {data.pricingType === type.id && (
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Prix */}
      <Card className="rounded-[24px] border-[#dde7fb] bg-white shadow-[0_18px_40px_rgba(4,67,158,0.06)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            Configuration du Prix
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Paiement unique ou abonnement */}
          {(data.pricingType === 'one_time' || data.pricingType === 'subscription') && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="price" className="text-xs">
                    Prix {data.pricingType === 'subscription' && '(par période)'} <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative mt-1.5">
                    <Input
                      id="price"
                      type="number"
                      value={data.price}
                      onChange={(e) => onChange({ price: e.target.value })}
                      placeholder="50000"
                      className="pr-12"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      GNF
                    </span>
                  </div>
                </div>
                <div>
                  <Label htmlFor="originalPrice" className="text-xs">
                    Prix barré (optionnel)
                  </Label>
                  <div className="relative mt-1.5">
                    <Input
                      id="originalPrice"
                      type="number"
                      value={data.originalPrice}
                      onChange={(e) => onChange({ originalPrice: e.target.value })}
                      placeholder="75000"
                      className="pr-12"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      GNF
                    </span>
                  </div>
                </div>
              </div>

              {data.pricingType === 'subscription' && (
                <div className="rounded-2xl border border-[#d9e6fb] bg-[#f8fbff] p-3 sm:p-4">
                  <Label className="text-xs">{t('directSaleForm.frequenceDeFacturation')}</Label>
                  <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {(['monthly', 'yearly', 'lifetime'] as const).map((interval) => (
                      <div
                        key={interval}
                        onClick={() => onChange({ subscriptionInterval: interval })}
                        className={cn(
                          'rounded-xl border p-3 text-center text-xs sm:text-sm cursor-pointer transition-all',
                          data.subscriptionInterval === interval
                            ? 'border-[#cfe0fb] bg-[#f5f9ff] font-medium text-[#04439e]'
                            : 'border-[#e8eef8] hover:border-[#cfe0fb]'
                        )}
                      >
                        {interval === 'monthly' && 'Mensuel'}
                        {interval === 'yearly' && 'Annuel'}
                        {interval === 'lifetime' && 'À vie'}
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    Pour une formation premium, combinez un plan mensuel d'entree et un plan annuel avec remise pour augmenter la conversion mobile.
                  </p>
                </div>
              )}
            </>
          )}

          {/* Prix libre */}
          {data.pricingType === 'pay_what_you_want' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="minimumPrice" className="text-xs">
                  Prix minimum <span className="text-destructive">*</span>
                </Label>
                <div className="relative mt-1.5">
                  <Input
                    id="minimumPrice"
                    type="number"
                    value={data.minimumPrice}
                    onChange={(e) => onChange({ minimumPrice: e.target.value })}
                    placeholder="0"
                    className="pr-12"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    GNF
                  </span>
                </div>
              </div>
              <div>
                <Label htmlFor="suggestedPrice" className="text-xs">
                  Prix suggéré
                </Label>
                <div className="relative mt-1.5">
                  <Input
                    id="suggestedPrice"
                    type="number"
                    value={data.suggestedPrice}
                    onChange={(e) => onChange({ suggestedPrice: e.target.value })}
                    placeholder="30000"
                    className="pr-12"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    GNF
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Réduction affichée */}
          {data.originalPrice && parseFloat(data.originalPrice) > parseFloat(data.price) && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-[#fff4ef]">
              <Badge variant="secondary" className="border-0 bg-[#ff4000]/12 text-[#ff4000]">
                -{Math.round((1 - parseFloat(data.price) / parseFloat(data.originalPrice)) * 100)}%
              </Badge>
              <span className="text-xs text-muted-foreground">
                Économie de {fc(parseFloat(data.originalPrice) - parseFloat(data.price))}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Options de livraison */}
      <Card className="rounded-[24px] border-[#dde7fb] bg-white shadow-[0_18px_40px_rgba(4,67,158,0.06)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Livraison & Accès
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3 p-3 bg-muted/50 rounded-xl">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-primary" />
              <div>
                <p className="text-sm font-medium">{t('directSaleForm.livraisonInstantanee')}</p>
                <p className="text-xs text-muted-foreground">{t('directSaleForm.accesImmediatApresPaiement')}</p>
              </div>
            </div>
            <Switch
              checked={data.instantDelivery}
              onCheckedChange={(v) => onChange({ instantDelivery: v })}
            />
          </div>

          <div>
            <Label className="text-xs">{t('directSaleForm.dureeDAccesAuContenu')}</Label>
            <Select
              value={data.accessDuration}
              onValueChange={(v) => onChange({ accessDuration: v as DirectSaleFormData['accessDuration'] })}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder={t('directSaleForm.choisirLaDuree')} />
              </SelectTrigger>
              <SelectContent>
                {accessDurations.map((duration) => (
                  <SelectItem key={duration.id} value={duration.id}>
                    {duration.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-3 p-3 bg-muted/50 rounded-xl">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              <div>
                <p className="text-sm font-medium">Email requis</p>
                <p className="text-xs text-muted-foreground">{t('directSaleForm.collecterLEmailPourLa')}</p>
              </div>
            </div>
            <Switch
              checked={data.requireEmail}
              onCheckedChange={(v) => onChange({ requireEmail: v })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Politique de remboursement */}
      <Card className="rounded-[24px] border-[#dde7fb] bg-white shadow-[0_18px_40px_rgba(4,67,158,0.06)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            Garantie & Remboursement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3 p-3 bg-muted/50 rounded-xl">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-primary" />
              <div>
                <p className="text-sm font-medium">{t('directSaleForm.autoriserLesRemboursements')}</p>
                <p className="text-xs text-muted-foreground">{t('directSaleForm.satisfaitOuRembourse')}</p>
              </div>
            </div>
            <Switch
              checked={data.allowRefunds}
              onCheckedChange={(v) => onChange({ allowRefunds: v })}
            />
          </div>

          {data.allowRefunds && (
            <div>
              <Label className="text-xs">{t('directSaleForm.periodeDeGarantie')}</Label>
              <Select
                value={data.refundPeriod}
                onValueChange={(v) => onChange({ refundPeriod: v })}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder={t('directSaleForm.choisirLaPeriode')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 jours</SelectItem>
                  <SelectItem value="14">14 jours</SelectItem>
                  <SelectItem value="30">30 jours</SelectItem>
                  <SelectItem value="60">60 jours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quantité limitée */}
      <Card className="rounded-[24px] border-[#dde7fb] bg-white shadow-[0_18px_40px_rgba(4,67,158,0.06)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" />
            Exclusivité (optionnel)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3 p-3 bg-muted/50 rounded-xl">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <div>
                <p className="text-sm font-medium">{t('directSaleForm.quantiteLimitee')}</p>
                <p className="text-xs text-muted-foreground">{t('directSaleForm.creerDeLUrgence')}</p>
              </div>
            </div>
            <Switch
              checked={data.limitedQuantity}
              onCheckedChange={(v) => onChange({ limitedQuantity: v })}
            />
          </div>

          {data.limitedQuantity && (
            <div>
              <Label htmlFor="maxQuantity" className="text-xs">
                Nombre maximum de ventes
              </Label>
              <Input
                id="maxQuantity"
                type="number"
                value={data.maxQuantity}
                onChange={(e) => onChange({ maxQuantity: e.target.value })}
                placeholder="100"
                className="mt-1.5"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Affiliation (programme interne) */}
      <Card className="rounded-[24px] border-[#dde7fb] bg-white shadow-[0_18px_40px_rgba(4,67,158,0.06)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Share2 className="w-4 h-4 text-primary" />
            Affiliation (optionnel)
          </CardTitle>
          <CardDescription className="text-xs">
            Réservé aux produits numériques : laissez d'autres utilisateurs promouvoir ce produit
            contre une commission, versée automatiquement après la fenêtre de protection acheteur.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3 p-3 bg-muted/50 rounded-xl">
            <div className="flex items-center gap-2">
              <Share2 className="w-4 h-4 text-primary" />
              <div>
                <p className="text-sm font-medium">Activer l'affiliation</p>
                <p className="text-xs text-muted-foreground">{t('directSaleForm.toutUtilisateurPeutGenererUn')}</p>
              </div>
            </div>
            <Switch
              checked={data.affiliateEnabled}
              onCheckedChange={(v) => onChange({ affiliateEnabled: v })}
            />
          </div>

          {data.affiliateEnabled && (
            <div>
              <Label htmlFor="affiliateCommissionRate" className="text-xs">
                Taux de commission affilié (%)
              </Label>
              <Input
                id="affiliateCommissionRate"
                type="number"
                min="0"
                max="90"
                step="0.5"
                value={data.affiliateCommissionRate}
                onChange={(e) => onChange({ affiliateCommissionRate: e.target.value })}
                placeholder="Ex: 20"
                className="mt-1.5 max-w-[200px]"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Pourcentage du montant de la vente reversé à l'affilié (max 90%), débité de votre
                portefeuille à la confirmation.
              </p>
              {data.affiliateCommissionRate && data.price && (
                <p className="mt-1 text-xs text-primary">
                  Soit {fc(parseFloat(data.price) * (parseFloat(data.affiliateCommissionRate || '0') / 100))} par vente
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <Alert className="border-[#dbe6fb] bg-[#f7fbff]">
        <Shield className="w-4 h-4 text-[#04439e]" />
        <AlertDescription className="text-xs text-muted-foreground">
          <strong className="text-foreground">{t('directSaleForm.protectionVendeur')}</strong> Tous les paiements sont sécurisés.
          Vous recevez vos fonds après validation de la livraison.
        </AlertDescription>
      </Alert>

      <div className="rounded-[24px] border border-dashed border-[#d7e3f9] bg-[#f8fbff] p-4">
        <div className="flex items-start gap-3">
          <Lock className="mt-0.5 h-4 w-4 text-[#04439e]" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Positionnement formation premium</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Structure recommandee: abonnement pour l'academie continue, achat unique pour le programme signature, garantie 14 a 30 jours et acces progressif au contenu pour maximiser la retention.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
