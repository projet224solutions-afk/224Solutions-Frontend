import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Settings, Save, Plus, RefreshCw, Trash2, Database, Edit } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useConfigData } from '@/hooks/useConfigData';
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
import TransferFeeSettings from '@/components/admin/TransferFeeSettings';

export default function PDGConfig() {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  const { configs, stats, loading, refetch, createConfig, updateConfig, toggleActive, deleteConfig, initializeDefaultConfigs } = useConfigData(true);
  const [newConfig, setNewConfig] = useState({
    service_name: '',
    transaction_type: '',
    commission_type: 'percentage',
    commission_value: 0,
    min_amount: 0,
    max_amount: null as number | null
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editConfig, setEditConfig] = useState({
    service_name: '',
    transaction_type: '',
    commission_type: 'percentage',
    commission_value: 0,
    min_amount: 0,
    max_amount: null as number | null
  });

  const saveConfig = async () => {
    if (!newConfig.service_name || !newConfig.transaction_type || !newConfig.commission_value) {
      return;
    }

    await createConfig(newConfig);
    setNewConfig({
      service_name: '',
      transaction_type: '',
      commission_type: 'percentage',
      commission_value: 0,
      min_amount: 0,
      max_amount: null
    });
  };

  const startEdit = (config: any) => {
    setEditingId(config.id);
    setEditConfig({
      service_name: config.service_name,
      transaction_type: config.transaction_type,
      commission_type: config.commission_type,
      commission_value: config.commission_value,
      min_amount: config.min_amount || 0,
      max_amount: config.max_amount
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;

    await updateConfig(editingId, editConfig);
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t('pDGConfig.configurationSysteme')}</h2>
          <p className="text-muted-foreground">{t('pDGConfig.gestionDesCommissionsEtParametres')}</p>
        </div>
        <div className="flex gap-2">
          {configs.length === 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Database className="w-4 h-4" />
                  Initialiser
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('pDGConfig.initialiserLesConfigurationsParDefaut')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cela créera des configurations de commission standard pour tous les services.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('pDGConfig.annuler')}</AlertDialogCancel>
                  <AlertDialogAction onClick={initializeDefaultConfigs}>
                    Initialiser
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button onClick={refetch} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden border-border/40 bg-card/50 backdrop-blur-sm hover:shadow-xl transition-all duration-300 group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="pt-6 relative">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Settings className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total_configs}</p>
                <p className="text-sm text-muted-foreground">Configurations</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-border/40 bg-card/50 backdrop-blur-sm hover:shadow-xl transition-all duration-300 group">
          <div className="absolute inset-0 bg-gradient-to-br from-[#ff4000]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="pt-6 relative">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#ff4000]/10 flex items-center justify-center">
                <Settings className="w-6 h-6 text-[#ff4000]" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.active_configs}</p>
                <p className="text-sm text-muted-foreground">Actives</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-border/40 bg-card/50 backdrop-blur-sm hover:shadow-xl transition-all duration-300 group">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="pt-6 relative">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <Settings className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.inactive_configs}</p>
                <p className="text-sm text-muted-foreground">Inactives</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-border/40 bg-card/50 backdrop-blur-sm hover:shadow-xl transition-all duration-300 group">
          <div className="absolute inset-0 bg-gradient-to-br from-[#04439e]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="pt-6 relative">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#04439e]/10 flex items-center justify-center">
                <Database className="w-6 h-6 text-[#04439e]" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.services_count}</p>
                <p className="text-sm text-muted-foreground">{t('pDGConfig.services')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transfer Fee Settings */}
      <TransferFeeSettings />

      {/* New Config Form */}
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            Nouvelle Configuration de Commission
          </CardTitle>
          <CardDescription>{t('pDGConfig.ajouterUneRegleDeCommission')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="service">{t('pDGConfig.service')}</Label>
              <Input
                id="service"
                placeholder="ex: marketplace, taxi, delivery"
                value={newConfig.service_name}
                onChange={(e) => setNewConfig({ ...newConfig, service_name: e.target.value })}
                className="bg-background"
              />
            </div>
            <div>
              <Label htmlFor="transaction">{t('pDGConfig.typeDeTransaction')}</Label>
              <Input
                id="transaction"
                placeholder="ex: achat, vente, location"
                value={newConfig.transaction_type}
                onChange={(e) => setNewConfig({ ...newConfig, transaction_type: e.target.value })}
                className="bg-background"
              />
            </div>
            <div>
              <Label htmlFor="type">{t('pDGConfig.typeDeCommission')}</Label>
              <Select
                value={newConfig.commission_type}
                onValueChange={(value) => setNewConfig({ ...newConfig, commission_type: value })}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Pourcentage</SelectItem>
                  <SelectItem value="fixed">{t('pDGConfig.montantFixe')}</SelectItem>
                  <SelectItem value="hybrid">Hybride</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="value">
                Valeur ({newConfig.commission_type === 'percentage' ? '%' : 'GNF'})
              </Label>
              <Input
                id="value"
                type="number"
                step={newConfig.commission_type === 'percentage' ? '0.1' : '1'}
                value={newConfig.commission_value}
                onChange={(e) => setNewConfig({ ...newConfig, commission_value: Number(e.target.value) })}
                className="bg-background"
              />
            </div>
            <div>
              <Label htmlFor="min">{t('pDGConfig.montantMinimumGnf')}</Label>
              <Input
                id="min"
                type="number"
                value={newConfig.min_amount || 0}
                onChange={(e) => setNewConfig({ ...newConfig, min_amount: Number(e.target.value) })}
                className="bg-background"
              />
            </div>
            <div>
              <Label htmlFor="max">{t('pDGConfig.montantMaximumGnf')}</Label>
              <Input
                id="max"
                type="number"
                placeholder={t('pDGConfig.illimiteSiVide')}
                value={newConfig.max_amount || ''}
                onChange={(e) => setNewConfig({ ...newConfig, max_amount: e.target.value ? Number(e.target.value) : null })}
                className="bg-background"
              />
            </div>
          </div>
          <Button onClick={saveConfig} className="gap-2 shadow-lg">
            <Save className="w-4 h-4" />
            Enregistrer la Configuration
          </Button>
        </CardContent>
      </Card>

      {/* Existing Configs */}
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Configurations Existantes</CardTitle>
          <CardDescription>{t('pDGConfig.gestionDesReglesDeCommission')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {configs.map((config, index) => (
              <div
                key={config.id}
                className="p-4 rounded-xl border border-border/40 bg-muted/30 hover:bg-muted/50 transition-all duration-200 animate-fade-in"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                {editingId === config.id ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`edit-service-${config.id}`}>{t('pDGConfig.service')}</Label>
                        <Input
                          id={`edit-service-${config.id}`}
                          value={editConfig.service_name}
                          onChange={(e) => setEditConfig({ ...editConfig, service_name: e.target.value })}
                          className="bg-background"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`edit-transaction-${config.id}`}>{t('pDGConfig.typeDeTransaction')}</Label>
                        <Input
                          id={`edit-transaction-${config.id}`}
                          value={editConfig.transaction_type}
                          onChange={(e) => setEditConfig({ ...editConfig, transaction_type: e.target.value })}
                          className="bg-background"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`edit-type-${config.id}`}>{t('pDGConfig.typeDeCommission')}</Label>
                        <Select
                          value={editConfig.commission_type}
                          onValueChange={(value) => setEditConfig({ ...editConfig, commission_type: value })}
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">Pourcentage</SelectItem>
                            <SelectItem value="fixed">{t('pDGConfig.montantFixe')}</SelectItem>
                            <SelectItem value="hybrid">Hybride</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor={`edit-value-${config.id}`}>
                          Valeur ({editConfig.commission_type === 'percentage' ? '%' : 'GNF'})
                        </Label>
                        <Input
                          id={`edit-value-${config.id}`}
                          type="number"
                          step={editConfig.commission_type === 'percentage' ? '0.1' : '1'}
                          value={editConfig.commission_value}
                          onChange={(e) => setEditConfig({ ...editConfig, commission_value: Number(e.target.value) })}
                          className="bg-background"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`edit-min-${config.id}`}>{t('pDGConfig.montantMinimumGnf')}</Label>
                        <Input
                          id={`edit-min-${config.id}`}
                          type="number"
                          value={editConfig.min_amount || 0}
                          onChange={(e) => setEditConfig({ ...editConfig, min_amount: Number(e.target.value) })}
                          className="bg-background"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`edit-max-${config.id}`}>{t('pDGConfig.montantMaximumGnf')}</Label>
                        <Input
                          id={`edit-max-${config.id}`}
                          type="number"
                          placeholder={t('pDGConfig.illimiteSiVide')}
                          value={editConfig.max_amount || ''}
                          onChange={(e) => setEditConfig({ ...editConfig, max_amount: e.target.value ? Number(e.target.value) : null })}
                          className="bg-background"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={saveEdit} className="gap-2">
                        <Save className="w-4 h-4" />
                        Enregistrer
                      </Button>
                      <Button onClick={cancelEdit} variant="outline">
                        Annuler
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <h4 className="font-semibold">
                          {config.service_name} - {config.transaction_type}
                        </h4>
                        <Badge variant="outline" className={config.is_active ? 'bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20' : 'bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20'}>
                          {config.is_active ? 'Actif' : 'Inactif'}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium text-primary">
                        Commission: {config.commission_type === 'percentage'
                          ? `${config.commission_value}%`
                          : fc(config.commission_value)
                        }
                      </p>
                      {(config.min_amount || config.max_amount) && (
                        <p className="text-xs text-muted-foreground">
                          Montants: {config.min_amount ? fc(config.min_amount) : '0'}
                          {config.max_amount ? ` - ${fc(config.max_amount)}` : ' - Illimité'}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEdit(config)}
                        className="border-blue-500/50 hover:bg-blue-500/10"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleActive(config.id, config.is_active)}
                        className={config.is_active ? 'border-orange-500/50 hover:bg-orange-500/10' : 'border-[#ff4000]/50 hover:bg-[#ff4000]/10'}
                      >
                        {config.is_active ? 'Désactiver' : 'Activer'}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="border-[#ff4000]/50 hover:bg-[#ff4000]/10">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t('pDGConfig.supprimerCetteConfiguration')}</AlertDialogTitle>
                            <AlertDialogDescription>
                              Cette action est irréversible.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('pDGConfig.annuler')}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteConfig(config.id)}>
                              Supprimer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {configs.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                Aucune configuration trouvée
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
