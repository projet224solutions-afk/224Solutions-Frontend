/**
 * Formulaire spécialisé pour les produits d'affiliation
 * Inspiré de ClickBank, ShareASale, Impact
 */

import {} from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import {
  Link2,
  Globe,
  Percent,
  Tag,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  TrendingUp,
  Shield,
  Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CurrencySelect } from '@/components/ui/currency-select';
import { cn } from '@/lib/utils';

export interface AffiliateFormData {
  affiliateUrl: string;
  affiliatePlatform: string;
  affiliateNetwork: string;
  commissionRate: string;
  commissionType: 'percentage' | 'fixed' | 'recurring';
  cookieDuration: string;
  payoutThreshold: string;
  trackingId: string;
  displayPrice: string;
  displayCurrency: string;
}

interface AffiliateFormProps {
  data: AffiliateFormData;
  onChange: (data: Partial<AffiliateFormData>) => void;
  onValidateUrl?: () => void;
  urlValidationStatus?: 'idle' | 'validating' | 'valid' | 'invalid';
}

const affiliateNetworks = [
  { id: 'direct', name: 'Programme Direct', description: "Affiliation directe avec le vendeur" },
  { id: 'amazon', name: 'Amazon Associates', description: 'Programme d\'affiliation Amazon' },
  { id: 'clickbank', name: 'ClickBank', description: "Produits numériques, commissions élevées" },
  { id: 'cj', name: 'CJ Affiliate', description: 'Grandes marques internationales' },
  { id: 'shareasale', name: 'ShareASale', description: "Réseau diversifié de marchands" },
  { id: 'impact', name: 'Impact', description: "Partenariats de marques premium" },
  { id: 'systeme', name: 'Systeme.io', description: "Formations et produits numériques" },
  { id: 'booking', name: 'Booking.com', description: "Réservations hôtelières" },
  { id: 'awin', name: 'Awin', description: "Réseau européen majeur" },
  { id: 'rakuten', name: 'Rakuten', description: "Grands détaillants en ligne" },
  { id: 'other', name: 'Autre réseau', description: 'Autre plateforme d\'affiliation' }
];

const commissionTypes = [
  { id: 'percentage', label: 'Pourcentage', description: "Commission en % de la vente" },
  { id: 'fixed', label: "Montant fixe", description: 'Commission fixe par vente' },
  { id: 'recurring', label: "Récurrent", description: "Commission sur abonnements" }
];

export function AffiliateForm({
  data,
  onChange,
  onValidateUrl,
  urlValidationStatus = 'idle'
}: AffiliateFormProps) {
  const { t } = useTranslation();
  const selectedNetwork = affiliateNetworks.find(n => n.id === data.affiliateNetwork);

  const getUrlPlaceholder = () => {
    switch (data.affiliateNetwork) {
      case 'amazon':
        return 'https://www.amazon.fr/dp/XXXX?tag=votre-id';
      case 'clickbank':
        return 'https://hop.clickbank.net/?affiliate=xxx&vendor=xxx';
      case 'systeme':
        return 'https://systeme.io/votre-lien-affilie';
      case 'booking':
        return 'https://www.booking.com/...?aid=XXXXX';
      default:
        return 'https://example.com/votre-lien-affilie';
    }
  };

  return (
    <div className="space-y-4">
      {/* Sélection du réseau d'affiliation */}
      <Card className="rounded-[24px] border-[#dde7fb] bg-white shadow-[0_18px_40px_rgba(4,67,158,0.06)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            Réseau d'Affiliation
          </CardTitle>
          <CardDescription className="text-xs">
            Sélectionnez la plateforme d'où provient votre lien d'affiliation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={data.affiliateNetwork}
            onValueChange={(v) => onChange({ affiliateNetwork: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('affiliateForm.choisirUnReseau')} />
            </SelectTrigger>
            <SelectContent>
              {affiliateNetworks.map((network) => (
                <SelectItem key={network.id} value={network.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{network.name}</span>
                    <span className="text-xs text-muted-foreground">{network.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedNetwork && selectedNetwork.id !== 'direct' && (
            <div className="mt-3 p-2 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Réseau vérifié : {selectedNetwork.name}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lien d'affiliation */}
      <Card className="rounded-[24px] border-[#dde7fb] bg-white shadow-[0_18px_40px_rgba(4,67,158,0.06)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Link2 className="w-4 h-4 text-primary" />
            Lien d'Affiliation
          </CardTitle>
          <CardDescription className="text-xs">
            Collez votre lien d'affiliation complet avec votre ID de tracking
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="affiliateUrl" className="text-xs">
              URL d'affiliation <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-2 mt-1.5">
              <div className="relative flex-1">
                <Input
                  id="affiliateUrl"
                  value={data.affiliateUrl}
                  onChange={(e) => onChange({ affiliateUrl: e.target.value })}
                  placeholder={getUrlPlaceholder()}
                  className={cn(
                    'pr-10',
                    urlValidationStatus === 'valid' && 'border-[#04439e] focus-visible:ring-[#04439e]',
                    urlValidationStatus === 'invalid' && 'border-destructive focus-visible:ring-destructive'
                  )}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {urlValidationStatus === 'validating' && (
                    <RefreshCw className="w-4 h-4 text-muted-foreground animate-spin" />
                  )}
                  {urlValidationStatus === 'valid' && (
                    <CheckCircle2 className="w-4 h-4 text-[#04439e]" />
                  )}
                  {urlValidationStatus === 'invalid' && (
                    <AlertCircle className="w-4 h-4 text-destructive" />
                  )}
                </div>
              </div>
              {onValidateUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onValidateUrl}
                  disabled={!data.affiliateUrl || urlValidationStatus === 'validating'}
                >
                  Vérifier
                </Button>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="affiliatePlatform" className="text-xs">
              Nom du produit/service partenaire
            </Label>
            <Input
              id="affiliatePlatform"
              value={data.affiliatePlatform}
              onChange={(e) => onChange({ affiliatePlatform: e.target.value })}
              placeholder="Ex: Formation Marketing Digital Pro"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="trackingId" className="text-xs">
              ID de tracking (optionnel)
            </Label>
            <Input
              id="trackingId"
              value={data.trackingId}
              onChange={(e) => onChange({ trackingId: e.target.value })}
              placeholder="Ex: sub_id, aff_id, clickid..."
              className="mt-1.5"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Ajoutez un ID pour suivre vos performances sur cette promotion
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Prix affiché au client */}
      <Card className="rounded-[24px] border-[#dde7fb] bg-white shadow-[0_18px_40px_rgba(4,67,158,0.06)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Tag className="w-4 h-4 text-primary" />
            Prix affiché
          </CardTitle>
          <CardDescription className="text-xs">
            Prix indicatif affiché aux visiteurs (optionnel)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="displayPrice" className="text-xs">
                Montant
              </Label>
              <Input
                id="displayPrice"
                type="number"
                value={data.displayPrice}
                onChange={(e) => onChange({ displayPrice: e.target.value })}
                placeholder="Ex: 50000"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="displayCurrency" className="text-xs">
                Devise
              </Label>
              <CurrencySelect
                value={data.displayCurrency || 'USD'}
                onValueChange={(v) => onChange({ displayCurrency: v })}
                className="mt-1.5"
                showFlag={true}
              />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Ce prix est affiché pour information. Le prix réel est défini sur la plateforme partenaire.
          </p>
        </CardContent>
      </Card>

      {/* Informations sur les commissions */}
      <Card className="rounded-[24px] border-[#dde7fb] bg-white shadow-[0_18px_40px_rgba(4,67,158,0.06)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Percent className="w-4 h-4 text-primary" />
            Structure de Commission
          </CardTitle>
          <CardDescription className="text-xs">
            Définissez les termes de votre commission d'affiliation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Type de commission */}
          <div>
            <Label className="text-xs mb-2 block">{t('affiliateForm.typeDeCommission')}</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {commissionTypes.map((type) => (
                <div
                  key={type.id}
                  onClick={() => onChange({ commissionType: type.id as AffiliateFormData['commissionType'] })}
                  className={cn(
                    'p-2 rounded-lg border cursor-pointer text-center transition-all',
                    data.commissionType === type.id
                      ? 'border-[#cfe0fb] bg-[#f5f9ff]'
                      : 'border-[#e8eef8] hover:border-[#cfe0fb]'
                  )}
                >
                  <span className="text-xs font-medium">{type.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="commissionRate" className="text-xs">
                {data.commissionType === 'fixed' ? 'Montant (GNF)' : 'Taux (%)'}
              </Label>
              <div className="relative mt-1.5">
                <Input
                  id="commissionRate"
                  type="number"
                  value={data.commissionRate}
                  onChange={(e) => onChange({ commissionRate: e.target.value })}
                  placeholder={data.commissionType === 'fixed' ? '50000' : '30'}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {data.commissionType === 'fixed' ? 'GNF' : '%'}
                </span>
              </div>
            </div>

            <div>
              <Label htmlFor="cookieDuration" className="text-xs flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Durée du cookie
              </Label>
              <Select
                value={data.cookieDuration}
                onValueChange={(v) => onChange({ cookieDuration: v })}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder={t('affiliateForm.duree')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">24 heures</SelectItem>
                  <SelectItem value="7d">7 jours</SelectItem>
                  <SelectItem value="30d">30 jours</SelectItem>
                  <SelectItem value="60d">60 jours</SelectItem>
                  <SelectItem value="90d">90 jours</SelectItem>
                  <SelectItem value="lifetime">Lifetime</SelectItem>
                  <SelectItem value="unknown">{t('affiliateForm.nonSpecifie')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Info récurrent */}
          {data.commissionType === 'recurring' && (
            <Alert className="border-[#dbe6fb] bg-[#f7fbff]">
              <TrendingUp className="w-4 h-4" />
              <AlertDescription className="text-xs">
                Les commissions récurrentes sont versées chaque mois tant que le client reste abonné.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Alerte informative */}
      <Alert className="border-[#ffd9cc] bg-[#fff4ef]">
        <ExternalLink className="w-4 h-4 text-[#ff4000]" />
        <AlertDescription className="text-xs text-muted-foreground">
          <strong className="text-foreground">Note :</strong> Les visiteurs seront redirigés vers votre lien d'affiliation.
          Assurez-vous que votre lien est actif et correctement configuré sur la plateforme partenaire.
        </AlertDescription>
      </Alert>
    </div>
  );
}
