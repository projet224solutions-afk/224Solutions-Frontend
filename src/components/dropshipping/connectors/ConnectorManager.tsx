import { useTranslation } from "@/hooks/useTranslation";
/**
 * CONNECTOR MANAGER COMPONENT
 * Interface admin pour gérer les connecteurs dropshipping
 *
 * @module ConnectorManager
 * @version 1.0.0
 * @author 224Solutions
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Power,
  PowerOff,
  RefreshCw,
  Settings,
  Check,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Info,
  Zap,
  Globe,
  Factory
} from 'lucide-react';
import { useConnectors } from '@/hooks/useConnectors';
import type { ConnectorType, ConnectorInfo, ConnectorConfig } from '@/services/connectors';

// ==================== INTERFACES ====================

interface ConnectorManagerProps {
  vendorId: string;
}

interface ConnectorCardProps {
  connector: ConnectorInfo;
  isActive: boolean;
  isLoading: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  onConfigure: () => void;
}

// ==================== CONNECTOR CARD ====================

function ConnectorCard({
  connector,
  isActive,
  isLoading,
  onActivate,
  onDeactivate,
  onConfigure
}: ConnectorCardProps) {
  const { t } = useTranslation();
  const getRegionIcon = () => {
    switch (connector.region) {
      case 'CHINA': return '🇨🇳';
      case 'LOCAL': return '🌍';
      case 'GLOBAL': return '🌐';
      default: return <Globe className="w-4 h-4" />;
    }
  };

  const getStatusBadge = () => {
    if (isActive) {
      return <Badge className="bg-[#ff4000]">Actif</Badge>;
    }
    switch (connector.status) {
      case 'stable': return <Badge variant="outline">Disponible</Badge>;
      case 'beta': return <Badge variant="secondary">Beta</Badge>;
      case 'deprecated': return <Badge variant="destructive">{t('connectorManager.obsolete')}</Badge>;
    }
  };

  return (
    <Card className={`transition-all ${isActive ? 'ring-2 ring-[#ff4000]' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{connector.logo}</span>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                {connector.name}
                {getStatusBadge()}
              </CardTitle>
              <CardDescription className="flex items-center gap-1 mt-1">
                {getRegionIcon()}
                <span className="text-xs">{connector.region}</span>
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isActive && (
              <Button
                variant="outline"
                size="sm"
                onClick={onConfigure}
              >
                <Settings className="w-4 h-4" />
              </Button>
            )}

            <Button
              variant={isActive ? 'destructive' : 'default'}
              size="sm"
              disabled={isLoading || connector.status === 'deprecated'}
              onClick={isActive ? onDeactivate : onActivate}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isActive ? (
                <><PowerOff className="w-4 h-4 mr-1" /> {t('connectorManager.desactiver')}</>
              ) : (
                <><Power className="w-4 h-4 mr-1" /> Activer</>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">
          {connector.description}
        </p>

        <div className="flex flex-wrap gap-1">
          {connector.features.slice(0, 4).map((feature, i) => (
            <Badge key={i} variant="outline" className="text-xs">
              {feature}
            </Badge>
          ))}
          {connector.features.length > 4 && (
            <Badge variant="outline" className="text-xs">
              +{connector.features.length - 4}
            </Badge>
          )}
        </div>

        {connector.requiresApiKey && !isActive && (
          <Alert className="mt-3">
            <Info className="w-4 h-4" />
            <AlertDescription className="text-xs">
              Ce connecteur nécessite une clé API
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

// ==================== MAIN COMPONENT ====================

export function ConnectorManager({ vendorId }: ConnectorManagerProps) {
  const { t } = useTranslation();
  const {
    loading,
    availableConnectors,
    activeConnectors,
    initConnector,
    disconnectConnector,
    isConnectorActive
  } = useConnectors(vendorId);

  const [configDialog, setConfigDialog] = useState<{
    open: boolean;
    connector: ConnectorType | null;
  }>({ open: false, connector: null });

  const [config, setConfig] = useState<Partial<ConnectorConfig>>({
    sandbox: true,
    autoSync: true,
    syncIntervalMinutes: 60
  });

  const [activatingConnector, setActivatingConnector] = useState<ConnectorType | null>(null);

  // Grouper les connecteurs par région
  const chinaConnectors = availableConnectors.filter(c => c.region === 'CHINA');
  const otherConnectors = availableConnectors.filter(c => c.region !== 'CHINA');

  const handleActivate = async (type: ConnectorType, info: ConnectorInfo) => {
    if (info.requiresApiKey) {
      // Ouvrir le dialog de configuration
      setConfigDialog({ open: true, connector: type });
    } else {
      // Activer directement
      setActivatingConnector(type);
      await initConnector(type, config);
      setActivatingConnector(null);
    }
  };

  const handleConfigSubmit = async () => {
    if (!configDialog.connector) return;

    setActivatingConnector(configDialog.connector);
    const success = await initConnector(configDialog.connector, config);

    if (success) {
      setConfigDialog({ open: false, connector: null });
    }
    setActivatingConnector(null);
  };

  const handleDeactivate = async (type: ConnectorType) => {
    setActivatingConnector(type);
    await disconnectConnector(type);
    setActivatingConnector(null);
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 text-[#ff4000]" />
            Connecteurs Dropshipping
          </h2>
          <p className="text-muted-foreground">
            Connectez vos fournisseurs externes pour importer des produits automatiquement
          </p>
        </div>

        <Badge variant="outline" className="text-lg px-4 py-2">
          {activeConnectors.length} actif{activeConnectors.length > 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Résumé des connecteurs actifs */}
      {activeConnectors.length > 0 && (
        <Alert className="bg-orange-50 border-orange-200">
          <Check className="w-4 h-4 text-[#ff4000]" />
          <AlertTitle className="text-[#ff4000]">Connecteurs actifs</AlertTitle>
          <AlertDescription className="text-[#ff4000]">
            {activeConnectors.map(c => {
              const info = availableConnectors.find(a => a.type === c);
              return info?.name;
            }).join(', ')}
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs par région */}
      <Tabs defaultValue="china" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="china" className="flex items-center gap-2">
            <Factory className="w-4 h-4" />
            Fournisseurs Chine ({chinaConnectors.length})
          </TabsTrigger>
          <TabsTrigger value="other" className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Autres ({otherConnectors.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="china" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {chinaConnectors.map(connector => (
              <ConnectorCard
                key={connector.type}
                connector={connector}
                isActive={isConnectorActive(connector.type)}
                isLoading={loading || activatingConnector === connector.type}
                onActivate={() => handleActivate(connector.type, connector)}
                onDeactivate={() => handleDeactivate(connector.type)}
                onConfigure={() => setConfigDialog({ open: true, connector: connector.type })}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="other" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {otherConnectors.map(connector => (
              <ConnectorCard
                key={connector.type}
                connector={connector}
                isActive={isConnectorActive(connector.type)}
                isLoading={loading || activatingConnector === connector.type}
                onActivate={() => handleActivate(connector.type, connector)}
                onDeactivate={() => handleDeactivate(connector.type)}
                onConfigure={() => setConfigDialog({ open: true, connector: connector.type })}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog de configuration */}
      <Dialog
        open={configDialog.open}
        onOpenChange={(open) => setConfigDialog({ open, connector: open ? configDialog.connector : null })}
      >
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configurer {configDialog.connector}</DialogTitle>
            <DialogDescription>
              Configurez les paramètres du connecteur
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey">{t('connectorManager.cleApi')}</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder={t('connectorManager.entrezVotreCleApi')}
                value={config.apiKey || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiSecret">Secret API (optionnel)</Label>
              <Input
                id="apiSecret"
                type="password"
                placeholder="Secret API"
                value={config.apiSecret || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, apiSecret: e.target.value }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="sandbox">Mode Sandbox (test)</Label>
              <Switch
                id="sandbox"
                checked={config.sandbox}
                onCheckedChange={(checked) => setConfig(prev => ({ ...prev, sandbox: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="autoSync">Synchronisation automatique</Label>
              <Switch
                id="autoSync"
                checked={config.autoSync}
                onCheckedChange={(checked) => setConfig(prev => ({ ...prev, autoSync: checked }))}
              />
            </div>

            {config.autoSync && (
              <div className="space-y-2">
                <Label htmlFor="syncInterval">{t('connectorManager.intervalleDeSyncMinutes')}</Label>
                <Input
                  id="syncInterval"
                  type="number"
                  min={15}
                  max={1440}
                  value={config.syncIntervalMinutes || 60}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    syncIntervalMinutes: parseInt(e.target.value) || 60
                  }))}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfigDialog({ open: false, connector: null })}
            >
              Annuler
            </Button>
            <Button
              onClick={handleConfigSubmit}
              disabled={activatingConnector !== null}
            >
              {activatingConnector ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Activation...</>
              ) : (
                'Activer'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ConnectorManager;
