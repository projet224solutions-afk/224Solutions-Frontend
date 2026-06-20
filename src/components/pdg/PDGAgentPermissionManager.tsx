import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Lock, Shield, AlertTriangle, Loader2, Trash2, Plus, ChevronDown } from 'lucide-react';
import { usePDGAgentPermissions } from '@/hooks/usePDGAgentPermissions';
import { usePDGAgentsData } from '@/hooks/usePDGAgentsData';
import { PERMISSION_CATEGORIES, getPermissionLabel } from '@/constants/agentPermissionCategories';

interface PermissionManagerProps {
  pdgId: string;
}

export function PDGAgentPermissionManager({ pdgId }: PermissionManagerProps) {
  const { t } = useTranslation();
  const { permissions, permissionCatalog, loading, grantPermission, revokePermission, loadPermissions } = usePDGAgentPermissions(pdgId);
  const { agents, loading: _agentsLoading } = usePDGAgentsData();

  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [grantingPermissions, setGrantingPermissions] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set(['Finance', 'Gestion']));

  useEffect(() => {
    if (pdgId) {
      loadPermissions();
    }
  }, [pdgId, loadPermissions]);

  const toggleCategory = (category: string) => {
    const newOpen = new Set(openCategories);
    if (newOpen.has(category)) {
      newOpen.delete(category);
    } else {
      newOpen.add(category);
    }
    setOpenCategories(newOpen);
  };

  const handleTogglePermission = (key: string) => {
    const newSet = new Set(selectedPermissions);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setSelectedPermissions(newSet);
  };

  const handleGrantPermissions = async () => {
    if (!selectedAgent || selectedPermissions.size === 0) return;

    setGrantingPermissions(true);
    let successCount = 0;

    for (const permKey of selectedPermissions) {
      const success = await grantPermission(selectedAgent, permKey);
      if (success) successCount++;
    }

    setGrantingPermissions(false);
    if (successCount > 0) {
      setSelectedPermissions(new Set());
      setShowDialog(false);
      await loadPermissions();
    }
  };

  const handleRevokePermission = async (permissionKey: string) => {
    if (!selectedAgent) return;
    const success = await revokePermission(selectedAgent, permissionKey, 'Révocation manuelle');
    if (success) {
      await loadPermissions();
    }
  };

  const getRiskColor = (risk: string) => {
    switch(risk) {
      case 'low': return 'bg-orange-100 text-[#ff4000]';
      case 'medium': return 'bg-orange-100 text-[#ff4000]';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'critical': return 'bg-orange-100 text-[#ff4000]';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const agentPermissions = permissions.filter(p => p.agent_id === selectedAgent);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Gestion des permissions agents
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Sélection de l'agent */}
          <div className="space-y-2">
            <Label>{t('pDGAgentPermissionManager.selectionnerUnAgent')}</Label>
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger>
                <SelectValue placeholder={t('pDGAgentPermissionManager.choisirUnAgent')} />
              </SelectTrigger>
              <SelectContent>
                {agents.map(agent => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name} ({agent.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedAgent && (
            <>
              {/* Permissions actuelles */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">
                    Permissions accordées ({agentPermissions.length})
                  </Label>
                  <Button
                    onClick={() => setShowDialog(true)}
                    size="sm"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter permission
                  </Button>
                </div>

                {agentPermissions.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {agentPermissions.map(perm => (
                      <Card key={perm.id} className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-semibold text-sm">{perm.permission_name}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              {perm.category}
                            </div>
                            <div className="flex gap-1 mt-2">
                              <Badge
                                variant="outline"
                                className={getRiskColor(perm.risk_level || 'medium')}
                              >
                                {perm.risk_level}
                              </Badge>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevokePermission(perm.permission_key)}
                          >
                            <Trash2 className="h-4 w-4 text-[#ff4000]" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Alert>
                    <AlertDescription>
                      Aucune permission accordée. Cliquez sur "Ajouter permission" pour en ajouter.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Avertissement pour permissions critiques */}
              {agentPermissions.some(p => p.risk_level === 'critical') && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Attention: Cet agent a accès à des permissions critiques. Assurez-vous que c'est intentionnel.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog pour ajouter permissions */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('pDGAgentPermissionManager.ajouterPermissions')}</DialogTitle>
            <DialogDescription>
              Sélectionnez les permissions à accorder à cet agent
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 max-h-[50vh]">
            <div className="space-y-2 pr-4">
              {PERMISSION_CATEGORIES.map((category) => (
                <Collapsible
                  key={category.key}
                  open={openCategories.has(category.label)}
                  onOpenChange={() => toggleCategory(category.label)}
                >
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <span className="font-medium text-sm">{category.label}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${openCategories.has(category.label) ? 'rotate-180' : ''}`} />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-2 pl-4 pt-2 pb-1 border-l-2 border-muted ml-2">
                      {category.permissions.map((permKey) => (
                        <div key={permKey} className="flex items-start space-x-2 p-2 border rounded-md">
                          <Checkbox
                            id={permKey}
                            checked={selectedPermissions.has(permKey)}
                            onCheckedChange={() => handleTogglePermission(permKey)}
                            disabled={grantingPermissions}
                          />
                          <div className="flex-1">
                            <Label
                              htmlFor={permKey}
                              className="font-semibold cursor-pointer text-sm"
                            >
                              {getPermissionLabel(permKey)}
                            </Label>
                            <div className="flex gap-1 mt-2">
                              {permKey.startsWith('manage_') && (
                                <Badge variant="outline" className="text-xs">
                                  <Lock className="h-3 w-3 mr-1" />
                                  Écriture
                                </Badge>
                              )}
                              <Badge
                                variant="outline"
                                className={`text-xs ${getRiskColor(permKey.startsWith('manage_') ? 'high' : 'low')}`}
                              >
                                {permKey.startsWith('manage_') ? 'high' : 'low'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </ScrollArea>

          {/* Boutons d'action */}
          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              disabled={grantingPermissions}
            >
              Annuler
            </Button>
            <Button
              onClick={handleGrantPermissions}
              disabled={selectedPermissions.size === 0 || grantingPermissions}
            >
              {grantingPermissions && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Accorder {selectedPermissions.size} permission{selectedPermissions.size !== 1 ? 's' : ''}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
