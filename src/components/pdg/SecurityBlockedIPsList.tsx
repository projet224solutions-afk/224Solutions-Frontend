// 🚫 Liste des IPs bloquées
import React, { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Ban, Unlock, Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { BlockedIP } from '@/hooks/useSecurityOps';

interface Props {
  blockedIPs: BlockedIP[];
  onBlock: (ip: string, reason: string, incidentId?: string, expiresHours?: number) => void;
  onUnblock: (ip: string) => void;
}

const SecurityBlockedIPsList: React.FC<Props> = ({ blockedIPs, onBlock, onUnblock }) => {
  const { t } = useTranslation();
  const [isBlockOpen, setIsBlockOpen] = useState(false);
  const [newBlock, setNewBlock] = useState({ ip: '', reason: '', hours: 24 });

  const handleBlock = () => {
    onBlock(newBlock.ip, newBlock.reason, undefined, newBlock.hours);
    setIsBlockOpen(false);
    setNewBlock({ ip: '', reason: '', hours: 24 });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-bold">{t('securityBlockedIPsList.ipsBloquees')}</h3>
          <p className="text-muted-foreground">{t('securityBlockedIPsList.gestionDesBlocagesIp')}</p>
        </div>
        <Dialog open={isBlockOpen} onOpenChange={setIsBlockOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Bloquer une IP
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('securityBlockedIPsList.bloquerUneAdresseIp')}</DialogTitle>
              <DialogDescription>{t('securityBlockedIPsList.ajouterUneIpALa')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Adresse IP</label>
                <Input
                  value={newBlock.ip}
                  onChange={(e) => setNewBlock({ ...newBlock, ip: e.target.value })}
                  placeholder="192.168.1.1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('securityBlockedIPsList.raisonDuBlocage')}</label>
                <Textarea
                  value={newBlock.reason}
                  onChange={(e) => setNewBlock({ ...newBlock, reason: e.target.value })}
                  placeholder={t('securityBlockedIPsList.tentativesDeBruteForceDetectees')}
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('securityBlockedIPsList.dureeHeures')}</label>
                <Input
                  type="number"
                  value={newBlock.hours}
                  onChange={(e) => setNewBlock({ ...newBlock, hours: parseInt(e.target.value) })}
                />
              </div>
              <Button onClick={handleBlock} className="w-full">
                <Ban className="h-4 w-4 mr-2" />
                Bloquer l'IP
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {blockedIPs.map((block) => (
          <Card key={block.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Ban className="h-5 w-5 text-destructive" />
                    {String(block.ip_address)}
                  </CardTitle>
                  <CardDescription>{block.reason}</CardDescription>
                </div>
                <div className="flex gap-2 items-center">
                  {(block as any).blocked_by_system && (
                    <Badge variant="secondary">Auto</Badge>
                  )}
                  <Button size="sm" variant="outline" onClick={() => onUnblock(String(block.ip_address))}>
                    <Unlock className="h-4 w-4 mr-1" />
                    Débloquer
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{t('securityBlockedIPsList.bloqueLe')}</span>
                  <span className="text-muted-foreground">
                    {new Date(block.blocked_at).toLocaleString('fr-FR')}
                  </span>
                </div>
                {block.expires_at && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{t('securityBlockedIPsList.expireLe')}</span>
                    <span className="text-muted-foreground">
                      {new Date(block.expires_at).toLocaleString('fr-FR')}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {blockedIPs.length === 0 && (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">{t('securityBlockedIPsList.aucuneIpBloquee')}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default SecurityBlockedIPsList;
