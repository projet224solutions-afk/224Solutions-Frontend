import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  UserPlus,
  Users,
  ShoppingBag,
  Truck,
  Car,
  Ship,
  Building2,
  Mail,
  Phone,
  MapPin,
  Lock,
  Eye,
  EyeOff,
  Copy,
  MessageCircle,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { useAgentActions, CreateUserData } from '@/hooks/useAgentActions';

const COUNTRY_OPTIONS = [
  { code: 'GN', name: 'Guinée', currency: 'GNF', flag: '🇬🇳' },
  { code: 'SN', name: 'Sénégal', currency: 'XOF', flag: '🇸🇳' },
  { code: 'CI', name: 'Côte d\'Ivoire', currency: 'XOF', flag: '🇨🇮' },
  { code: 'ML', name: 'Mali', currency: 'XOF', flag: '🇲🇱' },
  { code: 'BF', name: 'Burkina Faso', currency: 'XOF', flag: '🇧🇫' },
  { code: 'NE', name: 'Niger', currency: 'XOF', flag: '🇳🇪' },
  { code: 'TG', name: 'Togo', currency: 'XOF', flag: '🇹🇬' },
  { code: 'BJ', name: 'Bénin', currency: 'XOF', flag: '🇧🇯' },
  { code: 'CM', name: 'Cameroun', currency: 'XAF', flag: '🇨🇲' },
  { code: 'GA', name: 'Gabon', currency: 'XAF', flag: '🇬🇦' },
  { code: 'CG', name: 'Congo', currency: 'XAF', flag: '🇨🇬' },
  { code: 'TD', name: 'Tchad', currency: 'XAF', flag: '🇹🇩' },
  { code: 'CF', name: 'Centrafrique', currency: 'XAF', flag: '🇨🇫' },
  { code: 'GQ', name: 'Guinée Équatoriale', currency: 'XAF', flag: '🇬🇶' },
  { code: 'SL', name: 'Sierra Leone', currency: 'SLL', flag: '🇸🇱' },
  { code: 'NG', name: 'Nigéria', currency: 'NGN', flag: '🇳🇬' },
  { code: 'GH', name: 'Ghana', currency: 'GHS', flag: '🇬🇭' },
  { code: 'MA', name: 'Maroc', currency: 'MAD', flag: '🇲🇦' },
  { code: 'DZ', name: 'Algérie', currency: 'DZD', flag: '🇩🇿' },
  { code: 'TN', name: 'Tunisie', currency: 'TND', flag: '🇹🇳' },
  { code: 'FR', name: 'France', currency: 'EUR', flag: '🇫🇷' },
  { code: 'BE', name: 'Belgique', currency: 'EUR', flag: '🇧🇪' },
  { code: 'US', name: 'États-Unis', currency: 'USD', flag: '🇺🇸' },
  { code: 'GB', name: 'Royaume-Uni', currency: 'GBP', flag: '🇬🇧' },
  { code: 'KE', name: 'Kenya', currency: 'KES', flag: '🇰🇪' },
  { code: 'ZA', name: 'Afrique du Sud', currency: 'ZAR', flag: '🇿🇦' },
];

const USER_ROLES = [
  { value: 'client', label: "Client", icon: Users, description: 'Utilisateur acheteur', color: 'text-[#ff4000]' },
  { value: 'vendeur', label: "Vendeur", icon: ShoppingBag, description: 'Boutique/Commerce', color: 'text-blue-600' },
  { value: 'livreur', label: 'Livreur', icon: Truck, description: "Livraison de colis", color: 'text-[#ff4000]' },
  { value: 'taxi', label: 'Taxi', icon: Car, description: "Transport de personnes", color: 'text-[#04439e]' },
  { value: 'transitaire', label: 'Transitaire', icon: Ship, description: 'Logistique internationale', color: 'text-orange-600' },
  { value: 'syndicat', label: 'Syndicat', icon: Building2, description: 'Organisation syndicale', color: 'text-[#ff4000]' },
  { value: 'prestataire', label: 'Prestataire', icon: Building2, description: "Service de proximité", color: 'text-[#ff4000]' },
];

// Codes synchronisés avec service_types en BDD
const VENDOR_SERVICE_TYPES = [
  { value: 'ecommerce', label: 'Boutique / E-commerce' },
  { value: 'restaurant', label: 'Restaurant / Alimentation' },
  { value: 'beaute', label: "Beauté & Bien-être" },
  { value: 'reparation', label: 'Réparation / Mécanique' },
  { value: 'location', label: "Location Immobilière" },
  { value: 'freelance', label: "Services Professionnels" },
  { value: 'media', label: 'Photographe / Vidéaste' },
  { value: 'education', label: 'Éducation / Formation' },
  { value: 'sante', label: "Santé & Bien-être" },
  { value: 'voyage', label: 'Voyage / Tourisme' },
  { value: 'menage', label: "Ménage & Entretien" },
  { value: 'informatique', label: 'Informatique / Tech' },
  { value: 'construction', label: 'Construction / BTP' },
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'livraison', label: 'Livraison / Coursier' },
  { value: 'vtc', label: 'VTC / Transport' },
] as const;
interface CreateUserFormProps {
  agentId: string;
  agentCode: string;
  accessToken?: string; // Token d'accès pour les agents/sous-agents publics
  onUserCreated?: () => void; // Callback après création réussie
}

export function CreateUserForm({ agentId, agentCode, accessToken, onUserCreated }: CreateUserFormProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // ✅ State récapitulatif affiché après création réussie
  const [createdUser, setCreatedUser] = useState<{
    email: string;
    password: string;
    role: string;
    publicId?: string;
  } | null>(null);
  const [showRecap, setShowRecap] = useState(false);
  const [copied,    setCopied]    = useState(false);

  const { createUser } = useAgentActions({
    onUserCreated: (info) => {
      // ✅ Stocker les infos pour le récapitulatif
      setCreatedUser({
        email:    info.email,
        password: formData.password, // mot de passe saisi par l'agent
        role:     info.role,
        publicId: info.publicId,
      });
      setShowRecap(true);
      // ✅ Conserver le callback parent (rafraîchissement de la liste, etc.)
      onUserCreated?.();
    }
  });

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    role: 'client' as CreateUserData['role'],
    country_code: 'GN',
    city: '',
    // Données syndicat
    bureau_code: '',
    prefecture: '',
    commune: '',
    full_location: '',
    // Données vendeur
    business_name: '',
    business_description: '',
    business_address: '',
    service_type: '',
    // Données taxi/livreur
    license_number: '',
    vehicle_type: 'moto',
    vehicle_brand: '',
    vehicle_model: '',
    vehicle_year: '',
    vehicle_plate: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Validation du mot de passe
    if (!formData.password || formData.password.length < 8) {
      toast.error(t('createUserForm.leMotDePasseDoit'));
      setIsSubmitting(false);
      return;
    }

    try {
      const selectedCountry = COUNTRY_OPTIONS.find(c => c.code === formData.country_code);
      // Préparer les données selon le rôle
      const userData: CreateUserData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        role: formData.role,
        country: selectedCountry?.name || 'Guinée',
        country_code: formData.country_code,
        city: formData.city
      };

      // Ajouter données spécifiques selon le rôle
      if (formData.role === 'syndicat') {
        userData.syndicatData = {
          bureau_code: formData.bureau_code,
          prefecture: formData.prefecture,
          commune: formData.commune,
          full_location: formData.full_location
        };
      } else if (formData.role === 'vendeur' || formData.role === 'prestataire') {
        userData.vendeurData = {
          business_name: formData.business_name,
          business_description: formData.business_description,
          business_address: formData.business_address,
          service_type: formData.service_type,
        };
      } else if (formData.role === 'taxi' || formData.role === 'livreur') {
        userData.driverData = {
          license_number: formData.license_number,
          vehicle_type: formData.vehicle_type,
          vehicle_brand: formData.vehicle_brand,
          vehicle_model: formData.vehicle_model,
          vehicle_year: formData.vehicle_year,
          vehicle_plate: formData.vehicle_plate
        };
      }

      // Appeler le hook
      const result = await createUser(userData, agentId, agentCode, accessToken);

      if (result.success) {
        // ✅ Toast de succès émis par le hook (source unique) — pas de doublon ici.
        // ✅ Fermer le dialog du formulaire : démonte le DialogContent Radix → supprime
        // le focus-trap, le récap (showRecap) devient le seul overlay, pleinement
        // accessible (souris, tactile ET clavier). Le récap reste affiché car il dépend
        // de showRecap && createdUser, indépendamment de isOpen.
        setIsOpen(false);
        // Le reset du formulaire se fait quand l'agent ferme le récapitulatif (closeRecap).
      } else {
        // ✅ Message d'erreur adapté selon le type
        const errorMsg = result.error || 'Erreur lors de la création';
        const isEmailDuplicate =
          errorMsg.toLowerCase().includes('existe déjà') ||
          errorMsg.toLowerCase().includes('email_exists') ||
          errorMsg.toLowerCase().includes('already registered');

        if (isEmailDuplicate) {
          toast.error(
            `❌ Cet email est déjà enregistré dans le système. Vérifiez avec l'utilisateur s'il a déjà un compte.`,
            { duration: 6000 }
          );
        } else {
          toast.error(errorMsg, { duration: 4000 });
        }
      }
    } catch (error: any) {
      console.error('Erreur création utilisateur:', error);
      toast.error(error.message || 'Erreur lors de la création de l\'utilisateur');
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeRecap = () => {
    setShowRecap(false);
    setCreatedUser(null);
    setCopied(false);
    // Reset du formulaire après que l'agent a noté les identifiants
    setFormData({
      firstName: '', lastName: '', email: '', phone: '', password: '',
      role: 'client', country_code: 'GN', city: '',
      bureau_code: '', prefecture: '', commune: '', full_location: '',
      business_name: '', business_description: '', business_address: '',
      service_type: '', license_number: '', vehicle_type: 'moto',
      vehicle_brand: '', vehicle_model: '', vehicle_year: '', vehicle_plate: '',
    });
    setShowPassword(false);
    setIsOpen(false);
  };

  const copyCredentials = async () => {
    if (!createdUser) return;
    const text = [
      `📱 Compte 224Solutions créé`,
      `Email : ${createdUser.email}`,
      `Mot de passe : ${createdUser.password}`,
      `Rôle : ${createdUser.role}`,
      createdUser.publicId ? `ID : ${createdUser.publicId}` : '',
      `Téléchargez l'app : www.224solution.net`,
    ].filter(Boolean).join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Identifiants copiés !');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error('Impossible de copier');
    }
  };

  const shareViaWhatsApp = () => {
    if (!createdUser) return;
    const msg = encodeURIComponent([
      `Bonjour, votre compte 224Solutions a été créé.`,
      `📧 Email : ${createdUser.email}`,
      `🔑 Mot de passe : ${createdUser.password}`,
      `📱 Téléchargez l'app sur www.224solution.net`,
      `Connectez-vous et changez votre mot de passe.`,
    ].join('\n'));
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  const selectedRole = USER_ROLES.find(r => r.value === formData.role);
  const RoleIcon = selectedRole?.icon || Users;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="w-full" size="lg">
          <UserPlus className="w-5 h-5 mr-2" />
          Créer un Utilisateur
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl w-[95vw] h-[80vh] flex flex-col p-0 top-[10%] translate-y-0 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex-shrink-0 bg-[#ff4000] text-white p-4 rounded-t-lg">
          <DialogTitle className="text-lg font-bold">{t('createUserForm.creerUnNouvelUtilisateur')}</DialogTitle>
          <DialogDescription className="text-orange-100">
            Sélectionnez le type d'utilisateur et remplissez les informations
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Sélection du type d'utilisateur */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Type d'utilisateur *</Label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {USER_ROLES.map((role) => {
                const Icon = role.icon;
                const isSelected = formData.role === role.value;
                return (
                  <button
                    key={role.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, role: role.value as CreateUserData['role'] })}
                    className={`p-2 rounded-lg border-2 transition-all text-center ${
                      isSelected
                        ? 'border-primary bg-primary/10 shadow-md ring-2 ring-primary/30'
                        : 'border-border hover:border-primary/50 hover:bg-accent'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary/20' : 'bg-muted'}`}>
                        <Icon className={`w-5 h-5 ${isSelected ? role.color : 'text-muted-foreground'}`} />
                      </div>
                      <p className={`font-semibold text-xs ${isSelected ? 'text-primary' : ''}`}>
                        {role.label}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Informations de base */}
          <div className="space-y-4 p-4 bg-accent/50 rounded-lg border border-border">
            <div className="flex items-center gap-2 mb-2">
              <RoleIcon className={`w-5 h-5 ${selectedRole?.color}`} />
              <h3 className="font-semibold">Informations {selectedRole?.label}</h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="firstName" className="flex items-center gap-1 text-sm">
                  <Users className="w-3 h-3" />
                  Prénom *
                </Label>
                <Input
                  id="firstName"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  placeholder={t('createUserForm.prenom')}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName" className="flex items-center gap-1 text-sm">
                  <Users className="w-3 h-3" />
                  Nom
                </Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  placeholder="Nom"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="flex items-center gap-1 text-sm">
                  <Mail className="w-3 h-3" />
                  Email *
                </Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemple.com"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="flex items-center gap-1 text-sm">
                  <Phone className="w-3 h-3" />
                  Téléphone *
                </Label>
                <Input
                  id="phone"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="622123456"
                  className="h-9"
                />
              </div>
            </div>

            {/* Champ Mot de passe */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="flex items-center gap-1 text-sm">
                <Lock className="w-3 h-3" />
                Mot de passe *
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={t('createUserForm.minimum8Caracteres')}
                  className="h-9 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Ce mot de passe sera utilisé par l'utilisateur pour se connecter
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="country" className="flex items-center gap-1 text-sm">
                  <MapPin className="w-3 h-3" />
                  Pays
                </Label>
                <Select
                  value={formData.country_code}
                  onValueChange={(code) => setFormData({ ...formData, country_code: code })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={t('createUserForm.selectionner')} />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRY_OPTIONS.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.flag} {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city" className="flex items-center gap-1 text-sm">
                  <MapPin className="w-3 h-3" />
                  Ville
                </Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Conakry"
                  className="h-9"
                />
              </div>
            </div>
          </div>

          {/* Champs spécifiques au rôle Syndicat */}
          {formData.role === 'syndicat' && (
            <div className="space-y-3 p-4 bg-orange-50 dark:bg-[#ff4000]/20 rounded-lg border-2 border-orange-200 dark:border-[#ff4000]">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#ff4000]" />
                <h3 className="font-semibold text-[#ff4000] dark:text-orange-100">{t('createUserForm.informationsDuBureauSyndical')}</h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="bureau_code" className="text-sm">Code Bureau *</Label>
                  <Input
                    id="bureau_code"
                    required
                    value={formData.bureau_code}
                    onChange={(e) => setFormData({ ...formData, bureau_code: e.target.value })}
                    placeholder="Ex: BUR-CON-001"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prefecture" className="text-sm">{t('createUserForm.prefecture')}</Label>
                  <Input
                    id="prefecture"
                    required
                    value={formData.prefecture}
                    onChange={(e) => setFormData({ ...formData, prefecture: e.target.value })}
                    placeholder="Ex: Conakry"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="commune" className="text-sm">Commune *</Label>
                  <Input
                    id="commune"
                    required
                    value={formData.commune}
                    onChange={(e) => setFormData({ ...formData, commune: e.target.value })}
                    placeholder="Ex: Matam"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="full_location" className="text-sm">Localisation</Label>
                  <Input
                    id="full_location"
                    value={formData.full_location}
                    onChange={(e) => setFormData({ ...formData, full_location: e.target.value })}
                    placeholder={t('createUserForm.exPresDuMarche')}
                    className="h-9"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Champs spécifiques au rôle Vendeur */}
          {formData.role === 'vendeur' && (
            <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border-2 border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-blue-900 dark:text-blue-100">{t('createUserForm.informationsDeLEntreprise')}</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="service_type" className="text-sm">{t('createUserForm.typeDeService')}</Label>
                  <select
                    id="service_type"
                    className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                    value={formData.service_type}
                    onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                    required
                  >
                    <option value="">{t('createUserForm.selectionnez')}</option>
                    {VENDOR_SERVICE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="business_name" className="text-sm">{t('createUserForm.nomDeLEntreprise')}</Label>
                  <Input
                    id="business_name"
                    required
                    value={formData.business_name}
                    onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                    placeholder={t('createUserForm.exBoutiqueCentrale')}
                    className="h-9"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="business_description" className="text-sm">{t('createUserForm.descriptionDeLActivite')}</Label>
                  <Input
                    id="business_description"
                    value={formData.business_description}
                    onChange={(e) => setFormData({ ...formData, business_description: e.target.value })}
                    placeholder={t('createUserForm.exVenteDeProduitsAlimentaires')}
                    className="h-9"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="business_address" className="text-sm">{t('createUserForm.adresseDeLEntreprise')}</Label>
                  <Input
                    id="business_address"
                    value={formData.business_address}
                    onChange={(e) => setFormData({ ...formData, business_address: e.target.value })}
                    placeholder={t('createUserForm.exMarcheMadinaConakry')}
                    className="h-9"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Champs spécifiques au rôle Prestataire */}
          {formData.role === 'prestataire' && (
            <div className="space-y-3 p-4 bg-orange-50 dark:bg-[#ff4000]/20 rounded-lg border-2 border-orange-200 dark:border-[#ff4000]">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#ff4000]" />
                <h3 className="font-semibold text-[#ff4000] dark:text-orange-100">{t('createUserForm.informationsDuService')}</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="service_type_prest" className="text-sm">{t('createUserForm.typeDeService')}</Label>
                  <select
                    id="service_type_prest"
                    className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                    value={formData.service_type}
                    onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                    required
                  >
                    <option value="">{t('createUserForm.selectionnez')}</option>
                    {VENDOR_SERVICE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="business_name_prest" className="text-sm">{t('createUserForm.nomDuService')}</Label>
                  <Input
                    id="business_name_prest"
                    required
                    value={formData.business_name}
                    onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                    placeholder={t('createUserForm.exSalonDeCoiffureAminata')}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="business_description_prest" className="text-sm">Description</Label>
                  <Input
                    id="business_description_prest"
                    value={formData.business_description}
                    onChange={(e) => setFormData({ ...formData, business_description: e.target.value })}
                    placeholder={t('createUserForm.decrivezVotreService')}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="business_address_prest" className="text-sm">Adresse</Label>
                  <Input
                    id="business_address_prest"
                    value={formData.business_address}
                    onChange={(e) => setFormData({ ...formData, business_address: e.target.value })}
                    placeholder="Ex: Quartier Madina, Conakry"
                    className="h-9"
                  />
                </div>
              </div>
            </div>
          )}
          {/* Champs spécifiques aux rôles Taxi et Livreur */}
          {(formData.role === 'taxi' || formData.role === 'livreur') && (
            <div className="space-y-3 p-4 bg-orange-50 dark:bg-[#ff4000]/20 rounded-lg border-2 border-orange-200 dark:border-[#ff4000]">
              <div className="flex items-center gap-2">
                {formData.role === 'taxi' ? (
                  <Car className="w-5 h-5 text-[#ff4000]" />
                ) : (
                  <Truck className="w-5 h-5 text-[#ff4000]" />
                )}
                <h3 className="font-semibold text-[#ff4000] dark:text-orange-100">
                  Informations du Véhicule
                </h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="license_number" className="text-sm">{t('createUserForm.numeroDePermis')}</Label>
                  <Input
                    id="license_number"
                    required
                    value={formData.license_number}
                    onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                    placeholder="Ex: GN123456"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="vehicle_type" className="text-sm">{t('createUserForm.typeDeVehicule')}</Label>
                  <select
                    id="vehicle_type"
                    className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                    value={formData.vehicle_type}
                    onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                  >
                    <option value="moto">Moto</option>
                    <option value="car">Voiture</option>
                    <option value="van">Camionnette</option>
                    <option value="truck">Camion</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="vehicle_brand" className="text-sm">Marque</Label>
                  <Input
                    id="vehicle_brand"
                    value={formData.vehicle_brand}
                    onChange={(e) => setFormData({ ...formData, vehicle_brand: e.target.value })}
                    placeholder="Ex: Toyota"
                    className="h-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="vehicle_model" className="text-sm">{t('createUserForm.modele')}</Label>
                  <Input
                    id="vehicle_model"
                    value={formData.vehicle_model}
                    onChange={(e) => setFormData({ ...formData, vehicle_model: e.target.value })}
                    placeholder="Ex: Corolla"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="vehicle_year" className="text-sm">{t('createUserForm.annee')}</Label>
                  <Input
                    id="vehicle_year"
                    value={formData.vehicle_year}
                    onChange={(e) => setFormData({ ...formData, vehicle_year: e.target.value })}
                    placeholder="Ex: 2020"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="vehicle_plate" className="text-sm">Plaque</Label>
                  <Input
                    id="vehicle_plate"
                    value={formData.vehicle_plate}
                    onChange={(e) => setFormData({ ...formData, vehicle_plate: e.target.value })}
                    placeholder="Ex: AB-1234-CD"
                    className="h-9"
                  />
                </div>
              </div>
            </div>
          )}
        </form>
        </div>

        {/* Boutons d'action - toujours visibles en bas */}
        <div className="flex-shrink-0 flex justify-end gap-3 p-4 border-t bg-background rounded-b-lg">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isSubmitting}
            className="h-11"
          >
            Annuler
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="min-w-[160px] h-11"
            onClick={handleSubmit}
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Création...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-2" />
                Créer l'utilisateur
              </>
            )}
          </Button>
        </div>
      </DialogContent>

      {/* ✅ Dialog récapitulatif identifiants — affiché après création */}
      {showRecap && createdUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm bg-background rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-green-600 p-5 text-center">
              <CheckCircle2 className="w-12 h-12 text-white mx-auto mb-2" />
              <h3 className="text-lg font-bold text-white">
                Compte créé avec succès !
              </h3>
              <p className="text-green-100 text-sm mt-1">
                Communiquez ces identifiants à l'utilisateur
              </p>
            </div>

            {/* Contenu */}
            <div className="p-5 space-y-4">
              {/* Rôle */}
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm text-muted-foreground">Rôle</span>
                <span className="text-sm font-semibold capitalize text-[#04439e]">
                  {createdUser.role}
                </span>
              </div>

              {/* Email */}
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm text-muted-foreground">Email</span>
                <span className="text-sm font-mono font-semibold">
                  {createdUser.email}
                </span>
              </div>

              {/* Mot de passe */}
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm text-muted-foreground">Mot de passe</span>
                <span className="text-sm font-mono font-bold text-[#ff4000] bg-red-50 px-2 py-0.5 rounded">
                  {createdUser.password}
                </span>
              </div>

              {/* ID public */}
              {createdUser.publicId && (
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-sm text-muted-foreground">ID public</span>
                  <span className="text-xs font-mono text-muted-foreground">
                    {createdUser.publicId}
                  </span>
                </div>
              )}

              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-3">
                ⚠️ Notez ce mot de passe maintenant. Il ne sera plus affiché.
                L'utilisateur pourra le modifier depuis son profil.
              </p>
            </div>

            {/* Actions */}
            <div className="px-5 pb-5 flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={copyCredentials}
                >
                  {copied
                    ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                    : <Copy className="w-4 h-4" />
                  }
                  {copied ? 'Copié !' : 'Copier'}
                </Button>

                <Button
                  className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                  onClick={shareViaWhatsApp}
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp
                </Button>
              </div>

              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={closeRecap}
              >
                Fermer et créer un autre utilisateur
              </Button>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
