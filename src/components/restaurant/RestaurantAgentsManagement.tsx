import { useTranslation } from "@/hooks/useTranslation";
/**
 * Gestion des AGENTS du restaurant (par le restaurateur) : créer un agent (compte email+mot de passe),
 * lui accorder des permissions PAR MODULE, l'activer/désactiver, le supprimer.
 * Calqué sur AgentManagement (vendeur), adapté au restaurant.
 */
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { UserPlus, Trash2, Loader2, ShieldCheck, Users } from 'lucide-react';
import { useRestaurantAgents, RESTAURANT_AGENT_MODULES, type RestaurantAgentPermissions } from '@/hooks/useRestaurantAgents';

export function RestaurantAgentsManagement({ serviceId }: { serviceId: string }) {
  const { t } = useTranslation();
  const { agents, loading, createAgent, updateAgent, deleteAgent } = useRestaurantAgents(serviceId);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [perms, setPerms] = useState<RestaurantAgentPermissions>({});

  const reset = () => { setForm({ name: '', email: '', phone: '', password: '' }); setPerms({}); };

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim() || form.password.length < 8) return;
    setSaving(true);
    const ok = await createAgent({ name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), password: form.password, permissions: perms });
    setSaving(false);
    if (ok) { setOpen(false); reset(); }
  };

  const countPerms = (p: RestaurantAgentPermissions) => RESTAURANT_AGENT_MODULES.filter(m => p[m.key]).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-lg font-bold flex items-center gap-2"><Users className="w-5 h-5 text-primary shrink-0" /> {t('restaurantAgentsManagement.agentsDuRestaurant')}</h3>
          <p className="text-sm text-muted-foreground">{t('restaurantAgentsManagement.creezDesAgentsEtChoisissez')}</p>
        </div>
        <Button onClick={() => { reset(); setOpen(true); }} className="gap-1.5 shrink-0"><UserPlus className="w-4 h-4" /> {t('restaurantAgentsManagement.ajouterUnAgent')}</Button>
      </div>

      {loading ? (
        <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>
      ) : agents.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
          Aucun agent. Cliquez sur « Ajouter un agent » pour déléguer la gestion.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {agents.map(a => (
            <Card key={a.id}>
              <CardContent className="py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium flex items-center gap-2">{a.name}
                      <Badge variant={a.is_active ? 'default' : 'outline'}>{a.is_active ? 'Actif' : 'Inactif'}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{a.email}{a.phone ? ` · ${a.phone}` : ''}</div>
                  </div>
                  <Badge variant="secondary" className="gap-1"><ShieldCheck className="w-3 h-3" />{countPerms(a.permissions)} / {RESTAURANT_AGENT_MODULES.length} modules</Badge>
                  <Switch checked={a.is_active} onCheckedChange={(v) => updateAgent(a.id, { is_active: v })} />
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Supprimer l'agent ${a.name} ?`)) deleteAgent(a.id); }}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
                {/* Permissions éditables en ligne */}
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {RESTAURANT_AGENT_MODULES.map(m => (
                    <label key={m.key} className="flex items-center gap-2 text-sm rounded-md border px-2 py-1.5 cursor-pointer">
                      <input type="checkbox" checked={!!a.permissions[m.key]}
                        onChange={(e) => updateAgent(a.id, { permissions: { ...a.permissions, [m.key]: e.target.checked } })} />
                      {m.label}
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog création */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5" /> Nouvel agent</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Nom *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t('restaurantAgentsManagement.nomDeLAgent')} /></div>
              <div><Label>{t('restaurantAgentsManagement.telephone')}</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+224…" /></div>
            </div>
            <div><Label>Email *</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="agent@email.com" /></div>
            <div><Label>{t('restaurantAgentsManagement.motDePasseMin8')}</Label><Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" /></div>
            <div>
              <Label className="mb-1.5 block">{t('restaurantAgentsManagement.permissionsCeQueLAgent')}</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {RESTAURANT_AGENT_MODULES.map(m => (
                  <label key={m.key} className="flex items-center gap-2 text-sm rounded-md border px-2 py-1.5 cursor-pointer">
                    <input type="checkbox" checked={!!perms[m.key]} onChange={e => setPerms(p => ({ ...p, [m.key]: e.target.checked }))} />
                    {m.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>{t('restaurantAgentsManagement.annuler')}</Button>
            <Button onClick={submit} disabled={saving || !form.name.trim() || !form.email.trim() || form.password.length < 8} className="gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Créer l'agent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default RestaurantAgentsManagement;
