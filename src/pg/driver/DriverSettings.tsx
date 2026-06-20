/**
 * PAGE PARAMÈTRES LIVREUR
 * Notifications, confidentialité, préférences
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Bell, Lock, Globe, Smartphone, Navigation, Volume2 } from 'lucide-react';
import { DriverLayout } from '@/components/driver/DriverLayout';
import { useTheme } from 'next-themes';

export default function DriverSettings() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <DriverLayout currentPage="settings">
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t('driverSettings.parametres')}</h1>
          <p className="text-muted-foreground">{t('driverSettings.configurezVotreApplication')}</p>
        </div>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>{t('driverSettings.gerezVosPreferencesDeNotification')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Nouvelles missions</Label>
                <p className="text-sm text-muted-foreground">{t('driverSettings.recevoirDesAlertesPourLes')}</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label>Notifications sonores</Label>
                <p className="text-sm text-muted-foreground">{t('driverSettings.sonsPourLesAlertesImportantes')}</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label>Notifications push</Label>
                <p className="text-sm text-muted-foreground">{t('driverSettings.recevoirDesNotificationsMemeHors')}</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* GPS & Navigation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Navigation className="h-5 w-5" />
              GPS & Navigation
            </CardTitle>
            <CardDescription>{t('driverSettings.optionsDeLocalisationEtNavigation')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Tracking GPS automatique</Label>
                <p className="text-sm text-muted-foreground">{t('driverSettings.partagerVotrePositionEnTemps')}</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label>Navigation Google Maps</Label>
                <p className="text-sm text-muted-foreground">Ouvrir automatiquement Google Maps</p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>

        {/* Confidentialite */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Confidentialité et sécurité
            </CardTitle>
            <CardDescription>{t('driverSettings.protegezVosDonneesPersonnelles')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>{t('driverSettings.profilVisible')}</Label>
                <p className="text-sm text-muted-foreground">{t('driverSettings.lesClientsPeuventVoirVotre')}</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label>{t('driverSettings.partageDeStatistiques')}</Label>
                <p className="text-sm text-muted-foreground">{t('driverSettings.partagerVosPerformancesAvec224solutions')}</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <Button variant="outline" className="w-full">
              Changer le mot de passe
            </Button>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Préférences
            </CardTitle>
            <CardDescription>{t('driverSettings.langueEtAffichage')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Langue</Label>
              <select className="w-full p-2 border rounded-lg">
                <option>{t('driverSettings.francais')}</option>
                <option>English</option>
              </select>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label>Mode sombre</Label>
                <p className="text-sm text-muted-foreground">{t('driverSettings.activerLeThemeSombre')}</p>
              </div>
              <Switch
                checked={isDark}
                onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4">
          <Button variant="outline" className="flex-1">{t('driverSettings.annuler')}</Button>
          <Button className="flex-1">{t('driverSettings.enregistrerLesModifications')}</Button>
        </div>
      </div>
    </DriverLayout>
  );
}
