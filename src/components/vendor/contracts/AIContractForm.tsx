import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Zap, History, Phone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface AIContractFormProps {
  onSuccess: (contractId: string) => void;
}

const CONTRACT_TYPES = [
  { value: 'vente', label: 'Contrat de vente', description: 'Produit, prix, livraison, garantie' },
  { value: 'livraison', label: 'Contrat de livraison', description: 'Délais, transport, assurance' },
  { value: 'prestation', label: 'Contrat de prestation', description: 'Service, durée, obligations' },
  { value: 'agent', label: 'Contrat agent', description: 'Mission, commissions, reporting' },
  { value: 'partenariat', label: 'Entreprise partenaire', description: 'Collaboration, objectifs, paiement' },
];

interface RecentClient {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
}

export default function AIContractForm({ onSuccess }: AIContractFormProps) {
  const { t } = useTranslation();
  const [contractType, setContractType] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [recentClients, setRecentClients] = useState<RecentClient[]>([]);
  const [searchingClient, setSearchingClient] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadRecentClients();
  }, []);

  const loadRecentClients = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('clients')
        .select('id, name, phone, address')
        .eq('vendor_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setRecentClients(data || []);
    } catch (error) {
      console.error('Error loading recent clients:', error);
    }
  };

  const handlePhoneChange = async (phone: string) => {
    setClientPhone(phone);

    if (phone.length >= 8) {
      setSearchingClient(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('clients')
          .select('name, address')
          .eq('vendor_id', user.id)
          .eq('phone', phone)
          .single();

        if (data && !error) {
          setClientName(data.name || '');
          setClientAddress(data.address || '');
          toast({
            title: 'Client trouvé',
            description: 'Les informations ont été automatiquement remplies',
          });
        }
      } catch (_error) {
        // Client not found, no problem
      } finally {
        setSearchingClient(false);
      }
    }
  };

  const handleSelectRecentClient = (client: RecentClient) => {
    setClientName(client.name);
    setClientPhone(client.phone || '');
    setClientAddress(client.address || '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!contractType) {
      toast({
        title: 'Erreur',
        description: 'Veuillez sélectionner un type de contrat',
        variant: 'destructive',
      });
      return;
    }

    if (!clientName || !clientPhone || !clientAddress) {
      toast({
        title: 'Erreur',
        description: 'Veuillez remplir tous les champs',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke('generate-contract-with-ai', {
        body: {
          contract_type: contractType,
          client_name: clientName,
          client_phone: clientPhone,
          client_address: clientAddress,
        },
      });

      if (error) throw error;

      if (data?.success && data?.contract?.id) {
        toast({
          title: 'Contrat généré avec succès',
          description: 'Le contrat a été créé et peut maintenant être modifié',
        });

        // Reset form
        setContractType('');
        setClientName('');
        setClientPhone('');
        setClientAddress('');

        onSuccess(data.contract.id);
      } else {
        throw new Error('Erreur lors de la génération du contrat');
      }
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
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          <CardTitle>{t('aIContractForm.genererUnContratAvecL')}</CardTitle>
        </div>
        <CardDescription>
          Sélectionnez le type de contrat et entrez les informations du client
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Type de contrat */}
          <div className="space-y-2">
            <Label htmlFor="contractType">{t('aIContractForm.typeDeContrat')}</Label>
            <Select value={contractType} onValueChange={setContractType}>
              <SelectTrigger>
                <SelectValue placeholder={t('aIContractForm.selectionnezLeTypeDeContrat')} />
              </SelectTrigger>
              <SelectContent>
                {CONTRACT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{type.label}</span>
                      <span className="text-xs text-muted-foreground">{type.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Clients récents */}
          {recentClients.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-muted-foreground" />
                <Label>{t('aIContractForm.clientsRecents')}</Label>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentClients.map((client) => (
                  <Badge
                    key={client.id}
                    variant="outline"
                    className="cursor-pointer hover:bg-primary/10"
                    onClick={() => handleSelectRecentClient(client)}
                  >
                    {client.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Téléphone avec auto-remplissage */}
          <div className="space-y-2">
            <Label htmlFor="clientPhone">{t('aIContractForm.numeroDeTelephone')}</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input
                id="clientPhone"
                value={clientPhone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="+224 XXX XX XX XX"
                className="pl-10"
                required
              />
              {searchingClient && (
                <Loader2 className="absolute right-3 top-3 w-4 h-4 animate-spin text-primary" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Si ce numéro existe déjà, les informations seront remplies automatiquement
            </p>
          </div>

          {/* Nom du client */}
          <div className="space-y-2">
            <Label htmlFor="clientName">{t('aIContractForm.nomDuClient')}</Label>
            <Input
              id="clientName"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Ex: Jean Dupont"
              required
            />
          </div>

          {/* Adresse */}
          <div className="space-y-2">
            <Label htmlFor="clientAddress">{t('aIContractForm.adresseDuClient')}</Label>
            <Input
              id="clientAddress"
              value={clientAddress}
              onChange={(e) => setClientAddress(e.target.value)}
              placeholder="Ex: Quartier Madina, Conakry"
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading || !contractType}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Génération en cours...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Générer le contrat avec l'IA
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
