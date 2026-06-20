import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, FileText } from 'lucide-react';

const CONTRACT_TYPES = [
  { value: 'vente_ai', label: '🤖 Contrat de vente (Généré par IA)', fields: [], isAI: true },
  { value: 'vente_achat', label: 'Contrat vente / achat', fields: ['description', 'amount', 'conditions'] },
  { value: 'livraison', label: 'Contrat livraison', fields: ['address', 'description', 'amount', 'delivery_date'] },
  { value: 'prestation', label: 'Contrat prestation', fields: ['description', 'duration', 'amount', 'price_details', 'payment_terms'] },
  { value: 'agent_sous_agent', label: 'Contrat agent / sous-agent', fields: ['description', 'commission', 'zone', 'duration'] },
  { value: 'service', label: 'Contrat service (abonnement)', fields: ['description', 'amount', 'period', 'duration', 'start_date', 'end_date', 'renewal_terms'] },
  { value: 'entreprise_partenaire', label: 'Contrat entreprise–partenaire', fields: ['description', 'company_commitments', 'partner_commitments', 'duration', 'financial_terms'] },
];

interface ContractFormProps {
  onSuccess: () => void;
}

export default function ContractForm({ onSuccess }: ContractFormProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState('');
  const { register, handleSubmit, reset, formState: { errors } } = useForm();
  const { toast } = useToast();

  const selectedContract = CONTRACT_TYPES.find(t => t.value === selectedType);

  const onSubmit = async (formData: any) => {
    try {
      setLoading(true);

      const { client_name, client_email, client_phone, client_info, amount, ...fields } = formData;

      const { data, error } = await supabase.functions.invoke('create-contract', {
        body: {
          contract_type: selectedType,
          client_name,
          client_email,
          client_phone,
          client_info,
          amount: amount ? parseFloat(amount) : null,
          fields,
        },
      });

      if (error) throw error;

      toast({
        title: 'Contrat créé',
        description: 'Le contrat a été créé avec succès',
      });

      reset();
      setSelectedType('');
      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Créer un nouveau contrat
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Type de contrat */}
          <div className="space-y-2">
            <Label>{t('contractForm.typeDeContrat')}</Label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger>
                <SelectValue placeholder={t('contractForm.selectionnerUnType')} />
              </SelectTrigger>
              <SelectContent>
                {CONTRACT_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedType && (
            <>
              {/* Informations client */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="client_name">{t('contractForm.nomDuClient')}</Label>
                  <Input
                    id="client_name"
                    {...register('client_name', { required: true })}
                    placeholder="Nom complet"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="client_email">{t('contractForm.emailDuClient')}</Label>
                  <Input
                    id="client_email"
                    type="email"
                    {...register('client_email')}
                    placeholder="email@exemple.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="client_phone">{t('contractForm.telephoneDuClient')}</Label>
                  <Input
                    id="client_phone"
                    {...register('client_phone')}
                    placeholder="+224 XXX XX XX XX"
                  />
                </div>

                {selectedContract?.fields.includes('amount') && (
                  <div className="space-y-2">
                    <Label htmlFor="amount">{t('contractForm.montantGnf')}</Label>
                    <Input
                      id="amount"
                      type="number"
                      {...register('amount')}
                      placeholder="0"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="client_info">{t('contractForm.informationsComplementaires')}</Label>
                <Textarea
                  id="client_info"
                  {...register('client_info')}
                  placeholder="Adresse, notes..."
                  rows={2}
                />
              </div>

              {/* Champs dynamiques selon le type */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold">{t('contractForm.detailsDuContrat')}</h3>

                {selectedContract?.fields.map(field => {
                  if (field === 'amount') return null; // Already handled above

                  return (
                    <div key={field} className="space-y-2">
                      <Label htmlFor={field}>
                        {field.charAt(0).toUpperCase() + field.slice(1).replace(/_/g, ' ')}
                      </Label>
                      {field === 'description' || field.includes('terms') || field.includes('commitments') ? (
                        <Textarea
                          id={field}
                          {...register(field)}
                          placeholder={`Entrez ${field}`}
                          rows={3}
                        />
                      ) : (
                        <Input
                          id={field}
                          {...register(field)}
                          placeholder={`Entrez ${field}`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Créer le contrat
              </Button>
            </>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
