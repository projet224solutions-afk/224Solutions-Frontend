import { useUserAddresses } from '@/hooks/useUserAddresses';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Plus, Trash2, Check } from 'lucide-react';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Composant de gestion des adresses multiples (style Amazon)
 */
export const AddressManager = () => {
  const { t } = useTranslation();
  const { addresses, defaultAddress, loading, addAddress, deleteAddress, setAsDefault } = useUserAddresses();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    label: '',
    recipient_name: '',
    phone: '',
    street: '',
    city: '',
    postal_code: '',
    country: 'Guinea'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await addAddress({
      ...formData,
      is_default: addresses.length === 0
    });
    if (success) {
      setIsDialogOpen(false);
      setFormData({
        label: '',
        recipient_name: '',
        phone: '',
        street: '',
        city: '',
        postal_code: '',
        country: 'Guinea'
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <MapPin className="w-6 h-6" />
          Mes Adresses
        </h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Ajouter une adresse
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('addressManager.nouvelleAdresseDeLivraison')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="label">{t('addressManager.libelle')}</Label>
                <Input
                  id="label"
                  placeholder="Maison, Bureau, etc."
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="recipient_name">{t('addressManager.nomDuDestinataire')}</Label>
                <Input
                  id="recipient_name"
                  value={formData.recipient_name}
                  onChange={(e) => setFormData({ ...formData, recipient_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">{t('addressManager.telephone')}</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="street">{t('addressManager.adresseComplete')}</Label>
                <Input
                  id="street"
                  value={formData.street}
                  onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">Ville</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="postal_code">Code postal</Label>
                  <Input
                    id="postal_code"
                    value={formData.postal_code}
                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full">
                Enregistrer
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading && <p>Chargement...</p>}

      {addresses.length === 0 && !loading && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Aucune adresse enregistrée. Ajoutez-en une pour faciliter vos commandes.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {addresses.map((address) => (
          <Card key={address.id} className={address.is_default ? 'border-primary' : ''}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span>{address.label}</span>
                {address.is_default && (
                  <Badge variant="default">
                    <Check className="w-3 h-3 mr-1" />
                    Par défaut
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm">
                <p className="font-semibold">{address.recipient_name}</p>
                <p className="text-muted-foreground">{address.phone}</p>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>{address.street}</p>
                <p>{address.city} {address.postal_code}</p>
                <p>{address.country}</p>
              </div>
              <div className="flex gap-2 pt-2">
                {!address.is_default && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAsDefault(address.id)}
                  >
                    Définir par défaut
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (confirm(t('addressManager.supprimerCetteAdresse'))) {
                      deleteAddress(address.id);
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
