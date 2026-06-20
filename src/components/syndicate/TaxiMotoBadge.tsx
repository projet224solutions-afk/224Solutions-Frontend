/**
 * Badge professionnel ULTRA pour taxi-motards
 * Design inspiré de badges officiels gouvernementaux et entreprises internationales
 */

import { forwardRef } from 'react';
import Barcode from 'react-barcode';
import { QRCodeSVG } from 'qrcode.react';
import { Shield, MapPin, Calendar, CreditCard, User, Bike } from 'lucide-react';

interface TaxiMotoBadgeProps {
  driverName: string;
  driverPhoto?: string;
  badgeId: string;
  memberId: string;
  vehicleType: string;
  vehiclePlate: string;
  serialNumber?: string;
  dateOfBirth?: string;
  joinedDate: string;
  expireDate: string;
  bureauName?: string;
  bureauPhone?: string;
  bureauLogo?: string;
  badgeTitle?: string;
}

const TaxiMotoBadge = forwardRef<HTMLDivElement, TaxiMotoBadgeProps>(({
  driverName,
  driverPhoto,
  badgeId,
  memberId,
  vehicleType,
  vehiclePlate,
  serialNumber,
  dateOfBirth,
  joinedDate,
  expireDate,
  bureauName = '224SOLUTIONS',
  bureauPhone,
  bureauLogo,
  badgeTitle
}, ref) => {
  const displayTitle = badgeTitle || `TAXI-MOTO ${bureauName.toUpperCase()}`;

  // Formater l'ID pour l'affichage (raccourcir si c'est un UUID)
  const formatMemberId = (id: string) => {
    if (!id) return 'N/A';
    // Si c'est un UUID, prendre les 8 premiers caractères
    if (id.includes('-') && id.length > 20) {
      return `MBR-${id.substring(0, 8).toUpperCase()}`;
    }
    return id;
  };

  const displayMemberId = formatMemberId(memberId);

  const getVehicleLabel = () => {
    switch (vehicleType) {
      case 'motorcycle': return 'CONDUCTEUR MOTO';
      case 'tricycle': return 'CONDUCTEUR TRICYCLE';
      default: return 'CONDUCTEUR TAXI';
    }
  };

  // Nom du bureau à afficher (jamais "VOTRE BUREAU")
  const displayBureauName = bureauName && bureauName !== 'VOTRE BUREAU' ? bureauName : '224SOLUTIONS';

  return (
    <div
      ref={ref}
      className="w-[850px] h-[520px] bg-gradient-to-br from-slate-50 to-white rounded-2xl overflow-hidden shadow-2xl border border-slate-200"
      style={{
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 50%, #f1f5f9 100%)'
      }}
    >
      {/* En-tête principal */}
      <div className="relative h-[120px] bg-gradient-to-r from-[#0f172a] via-[#04439e] to-[#04439e] overflow-hidden">
        {/* Motif géométrique subtil */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/20 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-1/3 w-48 h-48 bg-white/10 rounded-full translate-y-1/2" />
        </div>

        {/* Contenu de l'en-tête */}
        <div className="relative h-full flex items-center justify-between px-6">
          {/* Logo et titre gauche */}
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/20">
              {bureauLogo ? (
                <img loading="lazy" src={bureauLogo} alt="Logo" className="w-12 h-12 object-contain" />
              ) : (
                <Shield className="w-8 h-8 text-white" />
              )}
            </div>
            <div>
              <div className="text-white text-sm font-bold tracking-[0.2em] uppercase mb-0.5">
                République de Guinée
              </div>
              <div className="flex items-center justify-start gap-1 text-xs font-semibold mb-1 pl-4">
                <span className="text-[#ff4000]">Travail</span>
                <span className="text-white">-</span>
                <span className="text-[#ff4000]">Justice</span>
                <span className="text-white">-</span>
                <span className="text-[#ff4000]">Solidarité</span>
              </div>
              <h1 className="text-white text-xl font-bold tracking-wide">
                {displayTitle}
              </h1>
              <div className="text-blue-200 text-sm font-medium mt-0.5">
                Carte Professionnelle de Transport
              </div>
            </div>
          </div>

          {/* Badge de sécurité droite */}
          <div className="text-right">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20">
              <div className="w-2 h-2 bg-[#ff4000] rounded-full animate-pulse" />
              <span className="text-white text-xs font-semibold">CARTE OFFICIELLE</span>
            </div>
            <div className="text-white/50 text-xs mt-1.5 tracking-wider">
              224SOLUTIONS • Système Certifié
            </div>
          </div>
        </div>

        {/* Bande de sécurité holographique */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#04439e]" />
      </div>

      {/* Corps principal */}
      <div className="flex h-[400px]">
        {/* Section photo et identité - Gauche */}
        <div className="w-[240px] p-4 bg-gradient-to-b from-slate-50 to-white border-r border-slate-200 flex flex-col">
          {/* Photo du conducteur */}
          <div className="relative">
            <div className="w-full aspect-[3/4] bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl overflow-hidden border-3 border-white shadow-lg">
              {driverPhoto ? (
                <img
                  src={driverPhoto}
                  alt={driverName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
                  <div className="text-center">
                    <User className="w-12 h-12 text-blue-300 mx-auto mb-1" />
                    <div className="text-4xl font-bold text-blue-400">
                      {driverName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Badge véhicule - Séparé et bien stylé */}
          <div className="mt-3 flex justify-center">
            <div className="bg-[#04439e] text-white text-[11px] font-bold px-4 py-2 rounded-full shadow-lg border border-blue-400/30">
              <div className="flex items-center gap-2">
                <Bike className="w-4 h-4" />
                <span className="tracking-wide">{getVehicleLabel()}</span>
              </div>
            </div>
          </div>

          {/* Nom du conducteur */}
          <div className="text-center mt-3">
            <h2 className="text-sm font-bold text-slate-800 tracking-wide uppercase leading-tight">
              {driverName}
            </h2>
            <div className="flex items-center justify-center gap-1.5 mt-1.5 text-slate-600">
              <CreditCard className="w-3 h-3" />
              <span className="text-xs font-mono font-bold">{displayMemberId}</span>
            </div>
          </div>

          {/* Signature */}
          <div className="mt-auto pt-2 border-t border-slate-200">
            <div className="text-[10px] text-slate-400 text-center mb-1 uppercase tracking-wider">
              Signature du Titulaire
            </div>
            <div className="h-8 border-b-2 border-slate-300 flex items-end justify-center pb-0.5">
              <span className="text-base text-slate-600 italic font-serif">
                {driverName.split(' ')[0]}
              </span>
            </div>
          </div>
        </div>

        {/* Section informations - Droite */}
        <div className="flex-1 p-4 flex flex-col">
          {/* Grille d'informations */}
          <div className="grid grid-cols-2 gap-2.5 mb-2.5">
            {/* Matricule véhicule */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-50 rounded-lg p-2.5 border border-blue-100">
              <div className="flex items-center gap-1.5 text-blue-600 mb-0.5">
                <CreditCard className="w-3.5 h-3.5" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">Immatriculation</span>
              </div>
              <div className="text-base font-bold text-slate-900 font-mono">
                {vehiclePlate}
              </div>
            </div>

            {/* Numéro de série */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-50 rounded-lg p-2.5 border border-blue-100">
              <div className="flex items-center gap-1.5 text-[#04439e] mb-0.5">
                <Bike className="w-3.5 h-3.5" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">N° Série</span>
              </div>
              <div className="text-base font-bold text-slate-900 font-mono">
                {serialNumber || 'N/A'}
              </div>
            </div>

            {/* Date de naissance */}
            <div className="bg-gradient-to-br from-orange-50 to-orange-50 rounded-lg p-2.5 border border-orange-100">
              <div className="flex items-center gap-1.5 text-[#ff4000] mb-0.5">
                <Calendar className="w-3.5 h-3.5" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">Naissance</span>
              </div>
              <div className="text-sm font-bold text-slate-900">
                {dateOfBirth || 'Non renseigné'}
              </div>
            </div>

            {/* Date d'expiration */}
            <div className="bg-gradient-to-br from-orange-50 to-orange-50 rounded-lg p-2.5 border border-orange-100">
              <div className="flex items-center gap-1.5 text-[#ff4000] mb-0.5">
                <Calendar className="w-3.5 h-3.5" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">Expiration</span>
              </div>
              <div className="text-sm font-bold text-slate-900">
                {expireDate}
              </div>
            </div>
          </div>

          {/* Bureau et localisation */}
          <div className="bg-gradient-to-r from-slate-100 to-slate-50 rounded-lg p-2.5 mb-2.5 border border-slate-200">
            <div className="flex items-center gap-1.5 text-slate-600 mb-0.5">
              <MapPin className="w-3.5 h-3.5" />
              <span className="text-[10px] font-semibold uppercase tracking-wider">Bureau de Rattachement</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-slate-900">
                {displayBureauName}
              </div>
              {bureauPhone && (
                <div className="flex items-center gap-1 text-blue-600">
                  <span className="text-xs font-semibold">📞 {bureauPhone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Section code-barres et QR */}
          <div className="flex items-center gap-3 flex-1 min-h-0">
            {/* Code-barres */}
            <div className="flex-1 bg-white rounded-lg p-2 border border-slate-200 h-full flex items-center justify-center">
              <Barcode
                value={displayMemberId}
                width={1.2}
                height={50}
                fontSize={0}
                margin={0}
                background="transparent"
                displayValue={false}
              />
            </div>

            {/* QR Code - Lien vers la page de vérification */}
            <div className="bg-white rounded-lg p-3 border-2 border-slate-200 shadow-sm flex-shrink-0">
              <QRCodeSVG
                value={`${window.location.origin}/badge/${badgeId}`}
                size={80}
                level="M"
                includeMargin={false}
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>
          </div>

          {/* Pied de page */}
          <div className="pt-2 border-t border-slate-200 mt-2">
            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold">Émis par 224Solutions</span>
                <span>•</span>
                <span>République de Guinée</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="w-3 h-3" />
                <span className="font-medium">Document sécurisé</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

TaxiMotoBadge.displayName = 'TaxiMotoBadge';

export default TaxiMotoBadge;
