/**
 * PAGE PROFIL LIVREUR
 * Informations personnelles, documents, statistiques
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useTranslation } from "@/hooks/useTranslation";
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { User, Mail, Phone, MapPin, Star, Award, TrendingUp, Bike } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useDriver } from '@/hooks/useDriver';
import { DriverLayout } from '@/components/driver/DriverLayout';

export default function DriverProfile() {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  const { profile } = useAuth();
  const { driver, stats } = useDriver();

  return (
    <DriverLayout currentPage="profile">
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t('driverProfile.monProfil')}</h1>
            <p className="text-muted-foreground">{t('driverProfile.gerezVosInformationsPersonnelles')}</p>
          </div>
          <Button>{t('driverProfile.modifierLeProfil')}</Button>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Carte Profil Principal */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Informations personnelles</CardTitle>
              <CardDescription>{t('driverProfile.vosDonneesDeLivreurProfessionnel')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar & Nom */}
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={profile?.avatar_url || ''} />
                  <AvatarFallback className="text-2xl">
                    {profile?.first_name?.[0]}{profile?.last_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold">{driver?.full_name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={driver?.is_verified ? 'default' : 'secondary'}>
                      {driver?.is_verified ? '✓ Vérifié' : 'En attente de vérification'}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-[#ff4000] fill-[#ff4000]" />
                      <span className="font-semibold">{driver?.rating || 0}</span>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Informations de contact */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </Label>
                  <Input value={driver?.email || ''} disabled />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Téléphone
                  </Label>
                  <Input value={driver?.phone_number || ''} disabled />
                </div>
              </div>

              {/* Informations véhicule */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Bike className="h-4 w-4" />
                  Informations véhicule
                </Label>
                <div className="grid gap-2 md:grid-cols-2">
                  <Input placeholder={t('driverProfile.typeDeVehicule')} value="Moto" disabled />
                  <Input placeholder="ID Livreur" value={driver?.id.slice(0, 8) || ''} disabled />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Statistiques */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  Performances
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Total livraisons</p>
                  <p className="text-2xl font-bold">{driver?.total_deliveries || 0}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground">Note moyenne</p>
                  <div className="flex items-center gap-1">
                    <Star className="h-5 w-5 text-[#ff4000] fill-[#ff4000]" />
                    <p className="text-2xl font-bold">{driver?.rating || 0}</p>
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground">{t('driverProfile.tauxDeCommission')}</p>
                  <p className="text-2xl font-bold">{driver?.commission_rate || 0}%</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Gains totaux
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-primary">
                  {fc(driver?.earnings_total || 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {fc(stats.monthEarnings)} ce mois
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Documents */}
        <Card>
          <CardHeader>
            <CardTitle>{t('driverProfile.documentsEtCertifications')}</CardTitle>
            <CardDescription>{t('driverProfile.vosDocumentsProfessionnels')}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="p-4 border rounded-lg">
              <p className="font-medium">{t('driverProfile.permisDeConduire')}</p>
              <Badge variant="outline" className="mt-2">{t('driverProfile.aJour')}</Badge>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="font-medium">{t('driverProfile.assuranceVehicule')}</p>
              <Badge variant="outline" className="mt-2">{t('driverProfile.aJour')}</Badge>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="font-medium">{t('driverProfile.controleTechnique')}</p>
              <Badge variant="destructive" className="mt-2">{t('driverProfile.expireBientot')}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </DriverLayout>
  );
}
