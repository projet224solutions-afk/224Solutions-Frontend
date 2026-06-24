import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { ArrowLeft, Send, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function Devis() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    service_type: "",
    description: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    budget: ""
  });

  const serviceTypes = [
    { value: "transport", label: "Transport / Livraison" },
    { value: "taxi", label: "Course Taxi-Moto" },
    { value: "commerce", label: t('devis.venteDeProduits') },
    { value: "transitaire", label: t('devis.servicesDeTransitaire') },
    { value: "autre", label: t('devis.autreService') }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.service_type || !formData.description || !formData.email) {
      toast.error(t('devis.veuillezRemplirTousLesChamps'));
      return;
    }

    try {
      setLoading(true);

      // Enregistrer la demande de devis
      const { error } = await supabase
        .from('devis_requests')
        .insert({
          service_type: formData.service_type,
          description: formData.description,
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          phone: formData.phone,
          budget: formData.budget ? parseFloat(formData.budget) : null,
          status: 'pending'
        });

      if (error) throw error;

      toast.success(t('devis.demandeDeDevisEnvoyeeAvec'));

      // Reinitialiser le formulaire
      setFormData({
        service_type: "",
        description: "",
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        budget: ""
      });

    } catch (error) {
      console.error('Erreur envoi devis:', error);
      toast.error(t('devis.erreurLorsDeLEnvoi'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
              <span className="ml-2">{t('devis.retour')}</span>
            </Button>
            <h1 className="text-2xl font-bold text-foreground">{t('devis.demandeDeDevis')}</h1>
          </div>
        </div>
      </header>

      {/* Form */}
      <section className="px-4 py-6 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              Obtenir un devis gratuit
            </CardTitle>
            <CardDescription>
              Remplissez ce formulaire pour recevoir un devis personnalisé pour vos besoins
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Type de service */}
              <div className="space-y-2">
                <Label htmlFor="service_type">{t('devis.typeDeService')}</Label>
                <Select
                  value={formData.service_type}
                  onValueChange={(value) => setFormData({...formData, service_type: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('devis.selectionnezUnService')} />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">{t('devis.descriptionDeVotreBesoin')}</Label>
                <Textarea
                  id="description"
                  placeholder={t('devis.decrivezEnDetailVotreProjet')}
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={5}
                  required
                />
              </div>

              {/* Coordonnees */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">{t('devis.prenom')}</Label>
                  <Input
                    id="first_name"
                    type="text"
                    placeholder={t('devis.votrePrenom')}
                    value={formData.first_name}
                    onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="last_name">Nom</Label>
                  <Input
                    id="last_name"
                    type="text"
                    placeholder={t('devis.votreNom')}
                    value={formData.last_name}
                    onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t('devis.votreEmailCom')}
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">{t('devis.telephone')}</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder={t('devis.votreNumero')}
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
              </div>

              {/* Budget */}
              <div className="space-y-2">
                <Label htmlFor="budget">{t('devis.budgetEstimeGnf')}</Label>
                <Input
                  id="budget"
                  type="number"
                  placeholder={t('devis.votreBudgetApproximatif')}
                  value={formData.budget}
                  onChange={(e) => setFormData({...formData, budget: e.target.value})}
                />
              </div>

              {/* Submit */}
              <Button type="submit" className="w-full" disabled={loading}>
                <Send className="w-4 h-4 mr-2" />
                {loading ? "Envoi en cours..." : "Envoyer la demande"}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                * Champs obligatoires. Nous vous répondrons dans les plus brefs délais.
              </p>
            </form>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="mt-6 bg-primary/5 border-primary/20">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-2">{t('devis.pourquoiDemanderUnDevis')}</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>{t('devis.estimationGratuiteEtSansEngagement')}</li>
              <li>{t('devis.reponsePersonnaliseeSous2448h')}</li>
              <li>{t('devis.conseilsDExpertsPourVotre')}</li>
              <li>{t('devis.tarificationTransparenteEtCompetitive')}</li>
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
