import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useProspects, Prospect } from "@/hooks/useVendorData";
import { Plus, Phone, Mail, Calendar, TrendingUp, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const statusColors = {
  prospection: 'bg-blue-100 text-blue-800',
  proposition: 'bg-orange-100 text-[#ff4000]',
  négociation: 'bg-orange-100 text-orange-800',
  conclusion: 'bg-orange-100 text-[#ff4000]',
  perdu: 'bg-orange-100 text-[#ff4000]'
};

const statusLabels = {
  prospection: 'Prospection',
  proposition: 'Proposition',
  négociation: 'Négociation',
  conclusion: 'Conclusion',
  perdu: 'Perdu'
};

export default function ProspectManagement() {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  const { prospects, loading, error, createProspect, updateProspect } = useProspects();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProspect, setEditingProspect] = useState<Prospect | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    contact_email: '',
    contact_phone: '',
    company: '',
    status: 'prospection' as Prospect['status'],
    estimated_value: 0,
    success_probability: 30,
    notes: ''
  });

  const resetForm = () => {
    setFormData({
      name: '',
      contact_email: '',
      contact_phone: '',
      company: '',
      status: 'prospection',
      estimated_value: 0,
      success_probability: 30,
      notes: ''
    });
    setEditingProspect(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return; // anti double-soumission (évite un prospect en double)
    setSubmitting(true);
    try {
      if (editingProspect) {
        await updateProspect(editingProspect.id, formData);
        toast({
          title: t('prospectManagement.prospectMisAJour'),
          description: t('prospectManagement.lesInformationsDuProspectOnt')
        });
      } else {
        await createProspect(formData);
        toast({
          title: t('prospectManagement.prospectCree'),
          description: t('prospectManagement.leNouveauProspectAEte')
        });
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (_err) {
      toast({
        title: "Erreur",
        description: t('prospectManagement.uneErreurEstSurvenueLors'),
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (prospect: Prospect) => {
    setEditingProspect(prospect);
    setFormData({
      name: prospect.name,
      contact_email: prospect.contact_email || '',
      contact_phone: prospect.contact_phone || '',
      company: prospect.company || '',
      status: prospect.status,
      estimated_value: prospect.estimated_value,
      success_probability: prospect.success_probability,
      notes: prospect.notes || ''
    });
    setIsDialogOpen(true);
  };

  const updateStatus = async (prospect: Prospect, newStatus: Prospect['status']) => {
    try {
      await updateProspect(prospect.id, { status: newStatus });
      toast({
        title: t('prospectManagement.statutMisAJour'),
        description: `Le statut du prospect a été changé vers "${statusLabels[newStatus]}".`
      });
    } catch (_err) {
      toast({
        title: "Erreur",
        description: t('prospectManagement.impossibleDeMettreAJour'),
        variant: "destructive"
      });
    }
  };

  const totalValue = prospects.reduce((acc, p) => acc + p.estimated_value, 0);
  const avgProbability = prospects.length > 0
    ? prospects.reduce((acc, p) => acc + p.success_probability, 0) / prospects.length
    : 0;

  if (loading) return <div className="p-4">{t('prospectManagement.chargementDesProspects')}</div>;
  if (error) return <div className="p-4 text-[#ff4000]">Erreur: {error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">{t('prospectManagement.gestionDesProspects')}</h2>
          <p className="text-muted-foreground">{t('prospectManagement.gerezVotrePipelineCommercialEt')}</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              Nouveau prospect
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingProspect ? 'Modifier le prospect' : 'Nouveau prospect'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Nom *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="company">Entreprise</Label>
                <Input
                  id="company"
                  value={formData.company}
                  onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">{t('prospectManagement.telephone')}</Label>
                  <Input
                    id="phone"
                    value={formData.contact_phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="value">{t('prospectManagement.valeurEstimeeGnf')}</Label>
                  <Input
                    id="value"
                    type="number"
                    value={formData.estimated_value}
                    onChange={(e) => setFormData(prev => ({ ...prev, estimated_value: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label htmlFor="probability">{t('prospectManagement.probabilite')}</Label>
                  <Input
                    id="probability"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.success_probability}
                    onChange={(e) => setFormData(prev => ({ ...prev, success_probability: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="status">Statut</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: Prospect['status']) => setFormData(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting ? 'Enregistrement…' : (editingProspect ? 'Mettre à jour' : 'Créer')}
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Annuler
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total prospects</p>
                <p className="text-2xl font-bold">{prospects.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#ff4000]" />
              <div>
                <p className="text-sm text-muted-foreground">Valeur pipeline</p>
                <p className="text-2xl font-bold">{fc(totalValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-orange-600 rounded-full" />
              <div>
                <p className="text-sm text-muted-foreground">{t('prospectManagement.probabiliteMoyenne')}</p>
                <p className="text-2xl font-bold">{Math.round(avgProbability)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Liste des prospects */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {prospects.map((prospect) => (
          <Card key={prospect.id} className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{prospect.name}</CardTitle>
                <Select
                  value={prospect.status}
                  onValueChange={(value: Prospect['status']) => updateStatus(prospect, value)}
                >
                  <SelectTrigger className="w-auto">
                    <Badge className={statusColors[prospect.status]}>
                      {statusLabels[prospect.status]}
                    </Badge>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {prospect.company && (
                <p className="text-sm text-muted-foreground">{prospect.company}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t('prospectManagement.valeurEstimee')}</span>
                <span className="font-semibold text-[#ff4000]">
                  {fc(prospect.estimated_value)}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{t('prospectManagement.probabilite2')}</span>
                  <span className="text-sm font-medium">{prospect.success_probability}%</span>
                </div>
                <Progress value={prospect.success_probability} className="h-2" />
              </div>

              {prospect.notes && (
                <p className="text-sm text-muted-foreground line-clamp-2">{prospect.notes}</p>
              )}

              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => startEdit(prospect)}>
                  Modifier
                </Button>
                {prospect.contact_phone && (
                  <Button size="sm" variant="outline">
                    <Phone className="w-4 h-4" />
                  </Button>
                )}
                {prospect.contact_email && (
                  <Button size="sm" variant="outline">
                    <Mail className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {prospects.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t('prospectManagement.aucunProspect')}</h3>
            <p className="text-muted-foreground mb-4">
              Commencez à développer votre pipeline commercial en ajoutant des prospects.
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Ajouter votre premier prospect
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}