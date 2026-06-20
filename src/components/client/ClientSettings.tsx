/**
 * CLIENT SETTINGS - Paramètres du compte client
 * 224SOLUTIONS - Gestion du profil et des adresses de livraison
 */

import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { toast } from 'sonner';
import {
  Settings,
  User,
  Mail,
  Phone,
  MapPin,
  Camera,
  Plus,
  Edit2,
  Trash2,
  Star,
  Home,
  Building2,
  Briefcase,
  Save,
  Loader2,
  X,
  Check,
  Shield
} from 'lucide-react';

// Lazy loading du composant de changement de mot de passe
const ClientPasswordChange = lazy(() => import('./ClientPasswordChange'));
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useStorageUpload } from '@/hooks/useStorageUpload';

// Utilise la table user_addresses qui existe dans la DB
interface Address {
  id: string;
  user_id: string;
  label: string;
  recipient_name: string;
  phone: string;
  street: string;  // Colonne correcte dans user_addresses
  city: string;
  postal_code?: string;
  country: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface ProfileData {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  avatar_url?: string;
}

const addressLabels = [
  { value: 'domicile', label: 'Domicile', icon: Home },
  { value: 'bureau', label: 'Bureau', icon: Building2 },
  { value: 'travail', label: 'Lieu de travail', icon: Briefcase },
  { value: 'autre', label: 'Autre', icon: MapPin }
];

const countries = [
  { code: 'BJ', name: 'Bénin' },
  { code: 'TG', name: 'Togo' },
  { code: 'SN', name: 'Sénégal' },
  { code: 'CI', name: "Côte d'Ivoire" },
  { code: 'BF', name: 'Burkina Faso' },
  { code: 'ML', name: 'Mali' },
  { code: 'NE', name: 'Niger' },
  { code: 'GN', name: 'Guinée' },
  { code: 'CM', name: 'Cameroun' },
  { code: 'GA', name: 'Gabon' },
  { code: 'CG', name: 'Congo' },
  { code: 'CD', name: 'RD Congo' },
  { code: 'FR', name: 'France' },
  { code: 'BE', name: 'Belgique' },
  { code: 'CA', name: 'Canada' },
  { code: 'US', name: 'États-Unis' }
];

const ClientSettings: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, isUploading: avatarUploading } = useStorageUpload();

  // États du profil
  const [profileData, setProfileData] = useState<ProfileData>({
    id: '',
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    avatar_url: ''
  });
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);

  // États des adresses
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [addressSaving, setAddressSaving] = useState(false);

  // Formulaire d'adresse - adapté aux colonnes de user_addresses
  const [addressForm, setAddressForm] = useState({
    label: 'domicile',
    recipient_name: '',
    phone: '',
    street: '',  // Colonne correcte
    city: '',
    postal_code: '',
    country: 'GN',  // Guinée par défaut
    is_default: false
  });

  // Charger le profil
  useEffect(() => {
    if (user?.id) {
      loadProfile();
      loadAddresses();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadProfile = async () => {
    if (!user?.id) return;

    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      setProfileData({
        id: data.id,
        email: user.email || '',
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        phone: data.phone || '',
        avatar_url: data.avatar_url || ''
      });
    } catch (error: any) {
      console.error('Erreur chargement profil:', error);
      toast.error(t('clientSettings.erreurLorsDuChargementDu'));
    } finally {
      setProfileLoading(false);
    }
  };

  const loadAddresses = async () => {
    if (!user?.id) return;

    setAddressesLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAddresses(data || []);
    } catch (error: any) {
      console.error('Erreur chargement adresses:', error);
      toast.error(t('clientSettings.erreurLorsDuChargementDes'));
      setAddresses([]);
    } finally {
      setAddressesLoading(false);
    }
  };

  // Sauvegarder le profil
  const handleSaveProfile = async () => {
    if (!user?.id) return;

    setProfileSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: profileData.first_name,
          last_name: profileData.last_name,
          phone: profileData.phone,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      toast.success(t('clientSettings.profilMisAJourAvec'));
    } catch (error: any) {
      console.error('Erreur sauvegarde profil:', error);
      toast.error(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setProfileSaving(false);
    }
  };

  // Upload d'avatar vers Google Cloud Storage
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) return;

    try {
      // Upload vers GCS via le hook unifié
      const result = await uploadFile(file, {
        folder: 'avatars',
        subfolder: user.id,
      });

      if (!result.success || !result.publicUrl) {
        throw new Error(result.error || 'Échec de l\'upload');
      }

      // Mettre à jour le profil avec la nouvelle URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          avatar_url: result.publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setProfileData(prev => ({ ...prev, avatar_url: result.publicUrl! }));
      toast.success(t('clientSettings.photoDeProfilMiseA'));
    } catch (error: any) {
      console.error('Erreur upload avatar:', error);
      toast.error(error.message || 'Erreur lors de l\'upload');
    }
  };

  // Ouvrir le dialogue d'adresse (ajout ou édition)
  const openAddressDialog = (address?: Address) => {
    if (address) {
      setEditingAddress(address);
      setAddressForm({
        label: address.label,
        recipient_name: address.recipient_name,
        phone: address.phone,
        street: address.street,
        city: address.city,
        postal_code: address.postal_code || '',
        country: address.country,
        is_default: address.is_default
      });
    } else {
      setEditingAddress(null);
      setAddressForm({
        label: 'domicile',
        recipient_name: `${profileData.first_name} ${profileData.last_name}`.trim(),
        phone: profileData.phone,
        street: '',
        city: '',
        postal_code: '',
        country: 'GN',
        is_default: addresses.length === 0
      });
    }
    setAddressDialogOpen(true);
  };

  // Sauvegarder l'adresse
  const handleSaveAddress = async () => {
    if (!user?.id) return;

    // Validation
    if (!addressForm.recipient_name.trim()) {
      toast.error(t('clientSettings.leNomDuDestinataireEst'));
      return;
    }
    if (!addressForm.phone.trim()) {
      toast.error(t('clientSettings.leNumeroDeTelephoneEst'));
      return;
    }
    if (!addressForm.street.trim()) {
      toast.error('L\'adresse est requise');
      return;
    }
    if (!addressForm.city.trim()) {
      toast.error(t('clientSettings.laVilleEstRequise'));
      return;
    }

    setAddressSaving(true);
    try {
      // Si c'est la nouvelle adresse par défaut, retirer le statut des autres
      if (addressForm.is_default && !editingAddress?.is_default) {
        await supabase
          .from('user_addresses')
          .update({ is_default: false })
          .eq('user_id', user.id);
      }

      const addressData = {
        user_id: user.id,
        label: addressForm.label,
        recipient_name: addressForm.recipient_name.trim(),
        phone: addressForm.phone.trim(),
        street: addressForm.street.trim(),
        city: addressForm.city.trim(),
        postal_code: addressForm.postal_code.trim() || null,
        country: addressForm.country,
        is_default: addressForm.is_default,
        updated_at: new Date().toISOString()
      };

      if (editingAddress) {
        const { error } = await supabase
          .from('user_addresses')
          .update(addressData)
          .eq('id', editingAddress.id);

        if (error) throw error;
        toast.success(t('clientSettings.adresseMiseAJour'));
      } else {
        const { error } = await supabase
          .from('user_addresses')
          .insert({ ...addressData, created_at: new Date().toISOString() });

        if (error) throw error;
        toast.success(t('clientSettings.adresseAjoutee'));
      }

      setAddressDialogOpen(false);
      loadAddresses();
    } catch (error: any) {
      console.error('Erreur sauvegarde adresse:', error);
      toast.error(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setAddressSaving(false);
    }
  };

  // Supprimer une adresse
  const handleDeleteAddress = async (addressId: string) => {
    try {
      const { error } = await supabase
        .from('user_addresses')
        .delete()
        .eq('id', addressId);

      if (error) throw error;

      toast.success(t('clientSettings.adresseSupprimee'));
      loadAddresses();
    } catch (error: any) {
      console.error('Erreur suppression adresse:', error);
      toast.error(error.message || 'Erreur lors de la suppression');
    }
  };

  // Définir comme adresse par défaut
  const setDefaultAddress = async (addressId: string) => {
    if (!user?.id) return;

    try {
      // Retirer le statut par défaut de toutes les adresses
      await supabase
        .from('user_addresses')
        .update({ is_default: false })
        .eq('user_id', user.id);

      // Définir la nouvelle adresse par défaut
      const { error } = await supabase
        .from('user_addresses')
        .update({ is_default: true })
        .eq('id', addressId);

      if (error) throw error;

      toast.success(t('clientSettings.adresseParDefautMiseA'));
      loadAddresses();
    } catch (error: any) {
      console.error('Erreur mise à jour adresse par défaut:', error);
      toast.error(error.message || 'Erreur');
    }
  };

  const getInitials = () => {
    const first = profileData.first_name?.[0] || '';
    const last = profileData.last_name?.[0] || '';
    return (first + last).toUpperCase() || 'U';
  };

  const getLabelIcon = (label: string) => {
    switch (label.toLowerCase()) {
      case 'domicile':
        return <Home className="w-4 h-4" />;
      case 'bureau':
        return <Building2 className="w-4 h-4" />;
      case 'travail':
        return <Briefcase className="w-4 h-4" />;
      default:
        return <MapPin className="w-4 h-4" />;
    }
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="w-6 h-6" />
          Paramètres du compte
        </h2>
        <p className="text-muted-foreground">
          Gérez votre profil, vos adresses de livraison et la sécurité de votre compte
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Profil
          </TabsTrigger>
          <TabsTrigger value="addresses" className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Adresses
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Sécurité
          </TabsTrigger>
        </TabsList>

        {/* Onglet Profil */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informations personnelles</CardTitle>
              <CardDescription>
                Modifiez vos informations de profil
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Photo de profil */}
              <div className="flex items-center gap-6">
                <div className="relative">
                  <Avatar className="w-24 h-24">
                    <AvatarImage src={profileData.avatar_url} alt={profileData.first_name} />
                    <AvatarFallback className="text-2xl bg-primary/10">
                      {getInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute bottom-0 right-0 rounded-full w-8 h-8"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={avatarUploading}
                  >
                    {avatarUploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4" />
                    )}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                </div>
                <div>
                  <h3 className="font-medium">{t('clientSettings.photoDeProfil')}</h3>
                  <p className="text-sm text-muted-foreground">
                    JPG, PNG ou GIF. Max 2 Mo.
                  </p>
                </div>
              </div>

              {/* Formulaire */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="first_name">{t('clientSettings.prenom')}</Label>
                  <Input
                    id="first_name"
                    value={profileData.first_name}
                    onChange={(e) => setProfileData(prev => ({ ...prev, first_name: e.target.value }))}
                    placeholder={t('clientSettings.votrePrenom')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="last_name">Nom</Label>
                  <Input
                    id="last_name"
                    value={profileData.last_name}
                    onChange={(e) => setProfileData(prev => ({ ...prev, last_name: e.target.value }))}
                    placeholder={t('clientSettings.votreNom')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      value={profileData.email}
                      disabled
                      className="pl-10 bg-muted"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    L'email ne peut pas être modifié
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">{t('clientSettings.telephone')}</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      value={profileData.phone}
                      onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+229 XX XX XX XX"
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleSaveProfile}
                  disabled={profileSaving}
                >
                  {profileSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Enregistrer
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Adresses */}
        <TabsContent value="addresses" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t('clientSettings.adressesDeLivraison')}</CardTitle>
                <CardDescription>
                  Gérez vos adresses pour une livraison plus rapide
                </CardDescription>
              </div>
              <Button onClick={() => openAddressDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Ajouter
              </Button>
            </CardHeader>
            <CardContent>
              {addressesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : addresses.length === 0 ? (
                <div className="text-center py-8">
                  <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-medium mb-2">{t('clientSettings.aucuneAdresseEnregistree')}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Ajoutez une adresse pour faciliter vos livraisons
                  </p>
                  <Button onClick={() => openAddressDialog()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter une adresse
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {addresses.map((address) => (
                    <Card key={address.id} className={`relative ${address.is_default ? 'border-primary' : ''}`}>
                      {address.is_default && (
                        <Badge className="absolute -top-2 -right-2 bg-primary">
                          <Star className="w-3 h-3 mr-1" />
                          Par défaut
                        </Badge>
                      )}
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2 mb-2">
                            {getLabelIcon(address.label)}
                            <span className="font-medium capitalize">{address.label}</span>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="w-8 h-8"
                              onClick={() => openAddressDialog(address)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="w-8 h-8 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t('clientSettings.supprimerLAdresse')}</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Cette action est irréversible. L'adresse sera définitivement supprimée.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{t('clientSettings.annuler')}</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteAddress(address.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Supprimer
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>

                        <div className="space-y-1 text-sm">
                          <p className="font-medium">{address.recipient_name}</p>
                          <p className="text-muted-foreground">{address.phone}</p>
                          <p>{address.street}</p>
                          <p>
                            {address.city}
                            {address.postal_code && ` ${address.postal_code}`}
                          </p>
                          <p>{countries.find(c => c.code === address.country)?.name || address.country}</p>
                        </div>

                        {!address.is_default && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3 w-full"
                            onClick={() => setDefaultAddress(address.id)}
                          >
                            <Star className="w-4 h-4 mr-2" />
                            Définir par défaut
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Sécurité */}
        <TabsContent value="security" className="space-y-6">
          <Suspense fallback={
            <Card>
              <CardContent className="py-8 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </CardContent>
            </Card>
          }>
            <ClientPasswordChange />
          </Suspense>
        </TabsContent>
      </Tabs>

      {/* Dialog d'ajout/édition d'adresse */}
      <Dialog open={addressDialogOpen} onOpenChange={setAddressDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAddress ? 'Modifier l\'adresse' : 'Nouvelle adresse'}
            </DialogTitle>
            <DialogDescription>
              Cette adresse sera visible par les vendeurs lors de vos commandes
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Type d'adresse */}
            <div className="space-y-2">
              <Label>Type d'adresse</Label>
              <Select
                value={addressForm.label}
                onValueChange={(value) => setAddressForm(prev => ({ ...prev, label: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {addressLabels.map(({ value, label, icon: Icon }) => (
                    <SelectItem key={value} value={value}>
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        {label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Destinataire */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="recipient_name">{t('clientSettings.nomDuDestinataire')}</Label>
                <Input
                  id="recipient_name"
                  value={addressForm.recipient_name}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, recipient_name: e.target.value }))}
                  placeholder="Nom complet"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addr_phone">{t('clientSettings.telephone2')}</Label>
                <Input
                  id="addr_phone"
                  value={addressForm.phone}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+229 XX XX XX XX"
                />
              </div>
            </div>

            {/* Adresse */}
            <div className="space-y-2">
              <Label htmlFor="street">Adresse *</Label>
              <Input
                id="street"
                value={addressForm.street}
                onChange={(e) => setAddressForm(prev => ({ ...prev, street: e.target.value }))}
                placeholder={t('clientSettings.numeroEtNomDeRue')}
              />
            </div>

            {/* Ville */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="city">Ville *</Label>
                <Input
                  id="city"
                  value={addressForm.city}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, city: e.target.value }))}
                  placeholder="Conakry"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postal_code">Code postal</Label>
                <Input
                  id="postal_code"
                  value={addressForm.postal_code}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, postal_code: e.target.value }))}
                  placeholder="BP 1234"
                />
              </div>
            </div>

            {/* Pays */}
            <div className="space-y-2">
              <Label htmlFor="country">Pays *</Label>
              <Select
                value={addressForm.country}
                onValueChange={(value) => setAddressForm(prev => ({ ...prev, country: value }))}
              >
                <SelectTrigger id="country">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {countries.map((country) => (
                    <SelectItem key={country.code} value={country.code}>
                      {country.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Adresse par défaut */}
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="is_default">{t('clientSettings.adresseParDefaut')}</Label>
                <p className="text-sm text-muted-foreground">
                  Utiliser cette adresse par défaut pour les livraisons
                </p>
              </div>
              <Switch
                id="is_default"
                checked={addressForm.is_default}
                onCheckedChange={(checked) => setAddressForm(prev => ({ ...prev, is_default: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddressDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveAddress} disabled={addressSaving}>
              {addressSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  {editingAddress ? 'Mettre à jour' : 'Ajouter'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientSettings;
