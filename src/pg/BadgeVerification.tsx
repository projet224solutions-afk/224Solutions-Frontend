/**
 * Page publique de vérification de badge taxi-moto
 * Affiche toutes les informations du conducteur quand le QR code est scanné
 */

import { useEffect, useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  User,
  Bike,
  Calendar,
  MapPin,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Phone,
  Mail
} from 'lucide-react';

interface BadgeData {
  id: string;
  serial_number: string;
  license_plate: string;
  type: string;
  brand?: string;
  model?: string;
  year?: number;
  color?: string;
  status: string;
  verified: boolean;
  verified_at?: string;
  driver_photo_url?: string;
  driver_date_of_birth?: string;
  digital_badge_id?: string;
  badge_generated_at?: string;
  created_at: string;
  owner_name?: string;
  owner_phone?: string;
  owner_email?: string;
  bureau_name?: string;
  bureau_commune?: string;
  bureau_prefecture?: string;
}

export default function BadgeVerification() {
  const { t } = useTranslation();
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const [badgeData, setBadgeData] = useState<BadgeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (vehicleId) {
      loadBadgeData(vehicleId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId]);

  const loadBadgeData = async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      // Charger les données du véhicule
      const { data: vehicle, error: vehicleError } = await supabase
        .from('vehicles')
        .select('*')
        .eq('id', id)
        .single();

      if (vehicleError) {
        // Essayer avec le digital_badge_id
        const { data: vehicleByBadge, error: badgeError } = await supabase
          .from('vehicles')
          .select('*')
          .eq('digital_badge_id', id)
          .single();

        if (badgeError) throw new Error('Badge non trouvé');

        await processVehicleData(vehicleByBadge);
      } else {
        await processVehicleData(vehicle);
      }
    } catch (err: any) {
      console.error('Error loading badge:', err);
      setError(err.message || 'Erreur lors du chargement du badge');
    } finally {
      setLoading(false);
    }
  };

  const processVehicleData = async (vehicle: any) => {
    let ownerName = 'Non renseigné';
    let ownerPhone = '';
    let ownerEmail = '';
    let bureauName = '';
    let bureauCommune = '';
    let bureauPrefecture = '';

    // Charger les informations du propriétaire
    if (vehicle.owner_member_id) {
      const { data: worker } = await supabase
        .from('syndicate_workers')
        .select('nom, telephone, email')
        .eq('id', vehicle.owner_member_id)
        .single();

      if (worker) {
        ownerName = worker.nom || 'Non renseigné';
        ownerPhone = worker.telephone || '';
        ownerEmail = worker.email || '';
      }
    }

    // Charger les informations du bureau
    if (vehicle.bureau_id) {
      const { data: bureau } = await supabase
        .from('bureaus')
        .select('bureau_code, commune, prefecture')
        .eq('id', vehicle.bureau_id)
        .single();

      if (bureau) {
        bureauName = (bureau as any).bureau_code || '';
        bureauCommune = (bureau as any).commune || '';
        bureauPrefecture = (bureau as any).prefecture || '';
      }
    }

    setBadgeData({
      ...vehicle,
      owner_name: ownerName,
      owner_phone: ownerPhone,
      owner_email: ownerEmail,
      bureau_name: bureauName,
      bureau_commune: bureauCommune,
      bureau_prefecture: bureauPrefecture,
    });
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'active':
        return { label: 'Actif', color: 'bg-orange-100 text-[#ff4000]', icon: CheckCircle };
      case 'suspended':
        return { label: 'Suspendu', color: 'bg-orange-100 text-[#ff4000]', icon: XCircle };
      case 'maintenance':
        return { label: 'En maintenance', color: 'bg-orange-100 text-[#ff4000]', icon: AlertTriangle };
      default:
        return { label: status, color: 'bg-gray-100 text-gray-800', icon: AlertTriangle };
    }
  };

  const getVehicleTypeLabel = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'motorcycle': return 'Moto';
      case 'tricycle': return 'Tricycle';
      case 'car': return 'Voiture';
      default: return type || 'Non spécifié';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Non renseigné';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">{t('badgeVerification.verificationDuBadgeEnCours')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !badgeData) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-orange-200">
          <CardContent className="p-8 text-center">
            <XCircle className="w-16 h-16 text-[#ff4000] mx-auto mb-4" />
            <h2 className="text-xl font-bold text-[#ff4000] mb-2">Badge Non Valide</h2>
            <p className="text-gray-600">{error || 'Ce badge n\'existe pas ou a été révoqué.'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusInfo = getStatusInfo(badgeData.status);
  const _StatusIcon = statusInfo.icon;

  // Calculer la date d'expiration (1 an après la génération)
  const generatedDate = badgeData.badge_generated_at || badgeData.created_at;
  const expireDate = new Date(generatedDate);
  expireDate.setFullYear(expireDate.getFullYear() + 1);
  const isExpired = new Date() > expireDate;

  return (
    <div className="min-h-screen bg-slate-900 p-4">
      <div className="max-w-lg mx-auto space-y-4">
        {/* En-tête */}
        <div className="text-center py-6">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full mb-4">
            <Shield className="w-5 h-5 text-blue-400" />
            <span className="text-white font-semibold">224SOLUTIONS</span>
          </div>
          <h1 className="text-2xl font-bold text-white">{t('badgeVerification.verificationDeBadge')}</h1>
          <p className="text-blue-200 text-sm mt-1">{t('badgeVerification.carteProfessionnelleDeTransport')}</p>
        </div>

        {/* Statut du badge */}
        <Card className={`border-2 ${badgeData.status === 'active' && !isExpired ? 'border-[#ff4000]' : 'border-[#ff4000]'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${badgeData.status === 'active' && !isExpired ? 'bg-orange-100' : 'bg-orange-100'}`}>
                  {badgeData.status === 'active' && !isExpired ? (
                    <CheckCircle className="w-6 h-6 text-[#ff4000]" />
                  ) : (
                    <XCircle className="w-6 h-6 text-[#ff4000]" />
                  )}
                </div>
                <div>
                  <h2 className="font-bold text-lg">
                    {badgeData.status === 'active' && !isExpired ? 'Badge Valide' : 'Badge Invalide'}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {isExpired ? 'Badge expiré' : `Statut: ${statusInfo.label}`}
                  </p>
                </div>
              </div>
              {badgeData.verified && (
                <Badge className="bg-blue-100 text-blue-800">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Vérifié
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Photo et identité */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              {/* Photo */}
              <div className="w-24 h-32 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
                {badgeData.driver_photo_url ? (
                  <img
                    src={badgeData.driver_photo_url}
                    alt="Photo conducteur"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-10 h-10 text-slate-400" />
                  </div>
                )}
              </div>

              {/* Informations identité */}
              <div className="flex-1">
                <h3 className="text-xl font-bold text-slate-800 mb-2">
                  {badgeData.owner_name}
                </h3>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Bike className="w-4 h-4 text-blue-600" />
                    <span className="font-medium">{getVehicleTypeLabel(badgeData.type)}</span>
                  </div>
                  {badgeData.driver_date_of_birth && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Calendar className="w-4 h-4 text-[#ff4000]" />
                      <span>Né(e) le: {formatDate(badgeData.driver_date_of_birth)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Informations véhicule */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-600 flex items-center gap-2">
              <Bike className="w-4 h-4" />
              INFORMATIONS VÉHICULE
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="text-xs text-blue-600 font-medium mb-1">Immatriculation</div>
                <div className="text-lg font-bold text-slate-900">{badgeData.license_plate}</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="text-xs text-[#04439e] font-medium mb-1">{t('badgeVerification.nSerie')}</div>
                <div className="text-lg font-bold text-slate-900">{badgeData.serial_number || 'N/A'}</div>
              </div>
            </div>

            {(badgeData.brand || badgeData.model) && (
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-xs text-slate-600 font-medium mb-1">Marque / Modèle</div>
                <div className="font-semibold text-slate-900">
                  {badgeData.brand} {badgeData.model} {badgeData.year && `(${badgeData.year})`}
                </div>
                {badgeData.color && (
                  <div className="text-sm text-slate-600 mt-1">Couleur: {badgeData.color}</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bureau de rattachement */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-600 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              BUREAU DE RATTACHEMENT
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="font-semibold text-slate-900">
                {badgeData.bureau_commune || badgeData.bureau_name || 'Non renseigné'}
              </div>
              {badgeData.bureau_prefecture && (
                <div className="text-sm text-slate-600">
                  Préfecture: {badgeData.bureau_prefecture}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Dates de validité */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-600 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              VALIDITÉ DU BADGE
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-orange-50 rounded-lg p-3">
                <div className="text-xs text-[#ff4000] font-medium mb-1">{t('badgeVerification.emisLe')}</div>
                <div className="font-semibold text-slate-900">{formatDate(generatedDate)}</div>
              </div>
              <div className={`rounded-lg p-3 ${isExpired ? 'bg-orange-50' : 'bg-orange-50'}`}>
                <div className={`text-xs font-medium mb-1 ${isExpired ? 'text-[#ff4000]' : 'text-[#ff4000]'}`}>
                  Expire le
                </div>
                <div className="font-semibold text-slate-900">{formatDate(expireDate.toISOString())}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact (si disponible) */}
        {(badgeData.owner_phone || badgeData.owner_email) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                <User className="w-4 h-4" />
                CONTACT
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {badgeData.owner_phone && (
                <div className="flex items-center gap-2 text-slate-700">
                  <Phone className="w-4 h-4 text-slate-500" />
                  <a href={`tel:${badgeData.owner_phone}`} className="hover:text-blue-600">
                    {badgeData.owner_phone}
                  </a>
                </div>
              )}
              {badgeData.owner_email && badgeData.owner_email !== `temp_${badgeData.owner_email.split('_')[1]}` && (
                <div className="flex items-center gap-2 text-slate-700">
                  <Mail className="w-4 h-4 text-slate-500" />
                  <a href={`mailto:${badgeData.owner_email}`} className="hover:text-blue-600 text-sm">
                    {badgeData.owner_email}
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Badge ID */}
        <Card className="bg-slate-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 mb-1">ID Badge</div>
                <div className="font-mono text-sm font-semibold text-slate-700">
                  {badgeData.digital_badge_id || badgeData.id}
                </div>
              </div>
              <div className="flex items-center gap-2 text-slate-500">
                <Shield className="w-4 h-4" />
                <span className="text-xs">224SOLUTIONS</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center py-4 text-white/60 text-sm">
          <p>{t('badgeVerification.systemeDeVerificationSecurise')}</p>
          <p className="text-xs mt-1">{t('badgeVerification.t224solutionsRepubliqueDeGuinee')}</p>
        </div>
      </div>
    </div>
  );
}
