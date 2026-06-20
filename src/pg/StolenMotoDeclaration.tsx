/**
 * PAGE DÉCLARATION DE MOTO VOLÉE
 * Page dédiée pour la déclaration officielle de vol de moto
 * 224Solutions - Système de Sécurité
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertTriangle,
  Search,
  CheckCircle,
  XCircle,
  Shield,
  ShieldAlert,
  Bike,
  User,
  Building2,
  MapPin,
  Calendar,
  Phone,
  ArrowLeft,
  Loader2,
  Lock,
  Camera,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface VehicleData {
  id: string;
  serial_number: string;
  license_plate: string;
  brand: string;
  model: string;
  color: string;
  chassis_number?: string;
  photo_url?: string;
  status: string;
  stolen_status?: string;
  owner_member_id?: string;
  bureau_id: string;
}

interface MemberData {
  id: string;
  name: string;
  custom_id?: string;
  phone?: string;
  photo_url?: string;
}

interface BureauData {
  id: string;
  bureau_code: string;
  prefecture: string;
  commune: string;
  president_name?: string;
  president_phone?: string;
}

export default function StolenMotoDeclaration() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // États de recherche
  const [searchId, setSearchId] = useState(searchParams.get('id') || '');
  const [searchPlate, setSearchPlate] = useState(searchParams.get('plate') || '');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Données trouvées
  const [vehicle, setVehicle] = useState<VehicleData | null>(null);
  const [member, setMember] = useState<MemberData | null>(null);
  const [bureau, setBureau] = useState<BureauData | null>(null);
  const [verified, setVerified] = useState(false);

  // Formulaire de déclaration
  const [confirmStolen, setConfirmStolen] = useState(false);
  const [stolenLocation, setStolenLocation] = useState('');
  const [stolenDate, setStolenDate] = useState('');
  const [stolenTime, setStolenTime] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Bureau connecté
  const [currentBureauId, setCurrentBureauId] = useState<string | null>(null);

  useEffect(() => {
    // Récupérer le bureau connecté depuis localStorage/sessionStorage
    const bureauSession = localStorage.getItem('bureauSession') || sessionStorage.getItem('bureauSession');
    if (bureauSession) {
      try {
        const session = JSON.parse(bureauSession);
        setCurrentBureauId(session.bureauId);
      } catch (e) {
        console.error('Erreur parsing session bureau:', e);
      }
    }

    // Si des paramètres sont passés, lancer la recherche automatiquement
    if (searchParams.get('id') && searchParams.get('plate')) {
      handleSearch();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = async () => {
    if (!searchId.trim() && !searchPlate.trim()) {
      toast.error(t('stolenMotoDeclaration.veuillezEntrerUnIdOu'));
      return;
    }

    setSearching(true);
    setSearchError(null);
    setVehicle(null);
    setMember(null);
    setBureau(null);
    setVerified(false);

    try {
      // Recherche du véhicule
      let query = supabase
        .from('vehicles')
        .select('*');

      if (searchId.trim() && searchPlate.trim()) {
        // Recherche avec les deux critères (plus précis)
        query = query
          .or(`serial_number.ilike.%${searchId.trim()}%,id.eq.${searchId.trim().length === 36 ? searchId.trim() : '00000000-0000-0000-0000-000000000000'}`)
          .ilike('license_plate', `%${searchPlate.trim()}%`);
      } else if (searchId.trim()) {
        query = query.or(`serial_number.ilike.%${searchId.trim()}%,id.eq.${searchId.trim().length === 36 ? searchId.trim() : '00000000-0000-0000-0000-000000000000'}`);
      } else {
        query = query.ilike('license_plate', `%${searchPlate.trim()}%`);
      }

      const { data: vehicles, error: vehicleError } = await query.limit(1);

      if (vehicleError) throw vehicleError;

      if (!vehicles || vehicles.length === 0) {
        setSearchError('✕ Moto introuvable ou informations incorrectes');
        return;
      }

      const foundVehicle = vehicles[0] as VehicleData;

      // Vérifier si déjà volée
      if (foundVehicle.stolen_status === 'stolen') {
        setSearchError('⚠️ Cette moto est déjà déclarée comme volée');
        return;
      }

      setVehicle(foundVehicle);

      // Charger les informations du propriétaire (maintenant depuis syndicate_workers)
      if (foundVehicle.owner_member_id) {
        const { data: workerData } = await supabase
          .from('syndicate_workers')
          .select('id, nom, custom_id, telephone')
          .eq('id', foundVehicle.owner_member_id)
          .single();

        if (workerData) {
          // Mapper les champs syndicate_workers vers MemberData
          setMember({
            id: workerData.id,
            name: workerData.nom,
            custom_id: workerData.custom_id,
            phone: workerData.telephone
          } as MemberData);
        }
      }

      // Charger les informations du bureau
      if (foundVehicle.bureau_id) {
        const { data: bureauData } = await supabase
          .from('bureaus')
          .select('id, bureau_code, prefecture, commune, president_name, president_phone')
          .eq('id', foundVehicle.bureau_id)
          .single();

        if (bureauData) {
          setBureau(bureauData as BureauData);
        }
      }

      setVerified(true);
      toast.success(t('stolenMotoDeclaration.motoTrouveeEtVerifiee'));

    } catch (error: any) {
      console.error('Erreur recherche:', error);
      setSearchError('Erreur lors de la recherche: ' + error.message);
    } finally {
      setSearching(false);
    }
  };

  const handleSubmitDeclaration = async () => {
    if (!vehicle) {
      toast.error(t('stolenMotoDeclaration.aucuneMotoSelectionnee'));
      return;
    }

    if (!confirmStolen) {
      toast.error(t('stolenMotoDeclaration.vousDevezConfirmerQueCette'));
      return;
    }

    if (!stolenLocation.trim()) {
      toast.error(t('stolenMotoDeclaration.veuillezIndiquerLeLieuDu'));
      return;
    }

    setSubmitting(true);

    try {
      // Construire la raison avec toutes les informations
      const reason = `Déclaration officielle de vol. Lieu: ${stolenLocation}${stolenDate ? `. Date: ${stolenDate}` : ''}${stolenTime ? ` à ${stolenTime}` : ''}${additionalNotes ? `. Notes: ${additionalNotes}` : ''}`;

      // Appeler la fonction RPC pour déclarer le vol
      const { data, error } = await supabase.rpc('declare_vehicle_stolen', {
        p_vehicle_id: vehicle.id,
        p_bureau_id: currentBureauId || vehicle.bureau_id,
        p_declared_by: currentBureauId || vehicle.bureau_id,
        p_reason: reason,
        p_location: stolenLocation,
        p_ip_address: null,
        p_user_agent: navigator.userAgent
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; message?: string };

      if (result.success) {
        toast.success(t('stolenMotoDeclaration.motoDeclareeVolee'), {
          description: `Plaque: ${vehicle.license_plate} - Blocage global activé. Tous les bureaux sont alertés.`,
          duration: 10000
        });

        // Rediriger vers la page de sécurité
        setTimeout(() => {
          navigate(-1);
        }, 2000);
      } else {
        throw new Error(result.error || 'Erreur lors de la déclaration');
      }

    } catch (error: any) {
      console.error('Erreur déclaration vol:', error);
      toast.error(error.message || 'Erreur lors de la déclaration du vol');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50 to-orange-50 pt-6 pb-32 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(-1)}
            className="shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-2">
              <ShieldAlert className="w-8 h-8 text-[#ff4000]" />
              Déclaration de Moto Volée
            </h1>
            <p className="text-slate-600 text-sm mt-1">
              224Solutions - Système de Sécurité Officiel
            </p>
          </div>
        </div>

        {/* Alerte d'avertissement */}
        <Alert className="border-orange-300 bg-orange-50">
          <AlertTriangle className="h-5 w-5 text-[#ff4000]" />
          <AlertTitle className="text-[#ff4000]">{t('stolenMotoDeclaration.actionIrreversible')}</AlertTitle>
          <AlertDescription className="text-[#ff4000]">
            La déclaration de vol entraëne le blocage immédiat et global de la moto.
            Cette action sera enregistrée et notifiée à tous les bureaux syndicats.
          </AlertDescription>
        </Alert>

        {/* Section 1: Identification de la Moto */}
        <Card className="border-2 border-slate-200 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-slate-100 to-slate-50 border-b">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Search className="w-5 h-5 text-blue-600" />
              SECTION 1 - Identification de la Moto
            </CardTitle>
            <CardDescription>
              Entrez l'ID et/ou le numéro de plaque pour vérifier la moto
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="searchId" className="font-medium">
                  ID de la moto / N° Série
                </Label>
                <Input
                  id="searchId"
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  placeholder={t('stolenMotoDeclaration.exSn2024001Ou')}
                  className="border-slate-300"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="searchPlate" className="font-medium">
                  Numéro de Plaque
                </Label>
                <Input
                  id="searchPlate"
                  value={searchPlate}
                  onChange={(e) => setSearchPlate(e.target.value)}
                  placeholder="Ex: AB-1234-GN"
                  className="border-slate-300"
                />
              </div>
            </div>

            <Button
              onClick={handleSearch}
              disabled={searching || (!searchId.trim() && !searchPlate.trim())}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5"
            >
              {searching ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Recherche en cours...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5 mr-2" />
                  Vérifier la Moto
                </>
              )}
            </Button>

            {searchError && (
              <Alert variant="destructive" className="mt-4">
                <XCircle className="h-5 w-5" />
                <AlertTitle>Erreur</AlertTitle>
                <AlertDescription>{searchError}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Section 2: Affichage des Informations (si vérifié) */}
        {verified && vehicle && (
          <>
            <Card className="border-2 border-orange-200 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-orange-100 to-orange-50 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <CheckCircle className="w-5 h-5 text-[#ff4000]" />
                    Moto Vérifiée
                  </CardTitle>
                  <Badge className="bg-[#ff4000] text-white">
                    Correspondance exacte
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Informations Moto */}
                <div>
                  <h3 className="font-semibold text-slate-700 flex items-center gap-2 mb-4">
                    <Bike className="w-5 h-5 text-blue-600" />
                    Informations du Véhicule
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-lg">
                    <div>
                      <p className="text-xs text-slate-500">Marque</p>
                      <p className="font-medium text-slate-800">{vehicle.brand || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">{t('stolenMotoDeclaration.modele')}</p>
                      <p className="font-medium text-slate-800">{vehicle.model || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Couleur</p>
                      <p className="font-medium text-slate-800">{vehicle.color || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">{t('stolenMotoDeclaration.nSerie')}</p>
                      <p className="font-medium text-slate-800">{vehicle.serial_number}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Plaque</p>
                      <p className="font-semibold text-lg text-blue-700">{vehicle.license_plate}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">{t('stolenMotoDeclaration.nChassis')}</p>
                      <p className="font-medium text-slate-800">{vehicle.chassis_number || 'N/A'}</p>
                    </div>
                  </div>
                  {vehicle.photo_url && (
                    <div className="mt-4">
                      <img
                        src={vehicle.photo_url}
                        alt={t('stolenMotoDeclaration.photoDuVehicule')}
                        className="w-32 h-32 object-cover rounded-lg border-2 border-slate-200"
                      />
                    </div>
                  )}
                </div>

                <Separator />

                {/* Informations Conducteur */}
                {member && (
                  <div>
                    <h3 className="font-semibold text-slate-700 flex items-center gap-2 mb-4">
                      <User className="w-5 h-5 text-[#04439e]" />
                      Informations du Conducteur
                    </h3>
                    <div className="flex items-start gap-4 bg-blue-50 p-4 rounded-lg">
                      {member.photo_url ? (
                        <img
                          src={member.photo_url}
                          alt={member.name}
                          className="w-16 h-16 rounded-full object-cover border-2 border-blue-200"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-blue-200 flex items-center justify-center">
                          <User className="w-8 h-8 text-[#04439e]" />
                        </div>
                      )}
                      <div className="flex-1 grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-slate-500">{t('stolenMotoDeclaration.nomPrenom')}</p>
                          <p className="font-medium text-slate-800">{member.name}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">ID Conducteur</p>
                          <p className="font-medium text-slate-800">{member.custom_id || member.id}</p>
                        </div>
                        {member.phone && (
                          <div className="col-span-2">
                            <p className="text-xs text-slate-500">{t('stolenMotoDeclaration.telephone')}</p>
                            <p className="font-medium text-slate-800 flex items-center gap-1">
                              <Phone className="w-4 h-4" />
                              {member.phone}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <Separator />

                {/* Informations Syndicat */}
                {bureau && (
                  <div>
                    <h3 className="font-semibold text-slate-700 flex items-center gap-2 mb-4">
                      <Building2 className="w-5 h-5 text-[#ff4000]" />
                      Informations du Bureau Syndicat
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-orange-50 p-4 rounded-lg">
                      <div>
                        <p className="text-xs text-slate-500">Code Bureau</p>
                        <p className="font-semibold text-[#ff4000]">{bureau.bureau_code}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Zone</p>
                        <p className="font-medium text-slate-800 flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {bureau.commune}, {bureau.prefecture}
                        </p>
                      </div>
                      {bureau.president_name && (
                        <div>
                          <p className="text-xs text-slate-500">Responsable</p>
                          <p className="font-medium text-slate-800">{bureau.president_name}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Section 3: Confirmation du Vol */}
            <Card className="border-2 border-orange-300 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-orange-100 to-orange-50 border-b">
                <CardTitle className="flex items-center gap-2 text-lg text-[#ff4000]">
                  <ShieldAlert className="w-5 h-5 text-[#ff4000]" />
                  SECTION FINALE - Confirmation du Vol
                </CardTitle>
                <CardDescription className="text-[#ff4000]">
                  Remplissez les informations ci-dessous pour officialiser la déclaration
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="stolenLocation" className="font-medium">
                      Lieu du vol *
                    </Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="stolenLocation"
                        value={stolenLocation}
                        onChange={(e) => setStolenLocation(e.target.value)}
                        placeholder={t('stolenMotoDeclaration.exKipeConakry')}
                        className="pl-10 border-slate-300"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stolenDate" className="font-medium">
                      Date approximative du vol
                    </Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="stolenDate"
                        type="date"
                        value={stolenDate}
                        onChange={(e) => setStolenDate(e.target.value)}
                        className="pl-10 border-slate-300"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stolenTime" className="font-medium">
                    Heure approximative du vol
                  </Label>
                  <Input
                    id="stolenTime"
                    type="time"
                    value={stolenTime}
                    onChange={(e) => setStolenTime(e.target.value)}
                    className="w-full md:w-48 border-slate-300"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="additionalNotes" className="font-medium">
                    Commentaires / Notes additionnelles
                  </Label>
                  <Textarea
                    id="additionalNotes"
                    value={additionalNotes}
                    onChange={(e) => setAdditionalNotes(e.target.value)}
                    placeholder={t('stolenMotoDeclaration.decrivezLesCirconstancesDuVol')}
                    className="min-h-[100px] border-slate-300"
                  />
                </div>

                <Separator />

                {/* Checkbox de confirmation */}
                <div className="flex items-start gap-3 p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <Checkbox
                    id="confirmStolen"
                    checked={confirmStolen}
                    onCheckedChange={(checked) => setConfirmStolen(checked === true)}
                    className="mt-1 border-[#ff4000] data-[state=checked]:bg-[#ff4000]"
                  />
                  <div>
                    <Label htmlFor="confirmStolen" className="font-semibold text-[#ff4000] cursor-pointer">
                      Je confirme que cette moto est réellement volée
                    </Label>
                    <p className="text-sm text-[#ff4000] mt-1">
                      En cochant cette case, je certifie que les informations fournies sont exactes
                      et que cette déclaration est faite de bonne foi.
                    </p>
                  </div>
                </div>

                {/* Avertissement final */}
                <Alert className="border-orange-300 bg-orange-50">
                  <Lock className="h-5 w-5 text-orange-600" />
                  <AlertTitle className="text-orange-800">{t('stolenMotoDeclaration.consequencesDeLaDeclaration')}</AlertTitle>
                  <AlertDescription className="text-orange-700 space-y-1">
                    <p>{t('stolenMotoDeclaration.laMotoSeraImmediatementBloquee')}</p>
                    <p>{t('stolenMotoDeclaration.leCompteDuConducteurSera')}</p>
                    <p>{t('stolenMotoDeclaration.tousLesBureauxSyndicatsSeront')}</p>
                    <p>{t('stolenMotoDeclaration.cetteActionEstEnregistreeAvec')}</p>
                  </AlertDescription>
                </Alert>

                {/* Bouton final */}
                <Button
                  onClick={handleSubmitDeclaration}
                  disabled={!confirmStolen || !stolenLocation.trim() || submitting}
                  className="w-full bg-gradient-to-r from-[#ff4000] to-[#ff4000] hover:from-[#ff4000] hover:to-[#ff4000] text-white py-6 text-lg font-semibold shadow-lg"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                      Déclaration en cours...
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="w-6 h-6 mr-2" />
                      🚨 CONFIRMER LE VOL
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
