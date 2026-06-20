import { useState, useRef } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QRCodeSVG } from 'qrcode.react';
const loadPdfLibs = () => Promise.all([
  import('html2canvas').then(m => m.default),
  import('jspdf').then(m => m.default),
]);
import { Download, Edit2, Save, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Moto {
  id: string;
  owner_name: string;
  owner_phone: string;
  vest_number: string;
  plate_number: string;
  serial_number: string;
  brand: string;
  model: string;
  year: number;
  color: string;
  status: string;
  registration_date: string;
  bureau_id: string;
}

interface BadgeData {
  name: string;
  firstName: string;
  title: string;
  idNumber: string;
  joinedDate: string;
  dob: string;
  expireDate: string;
  photo?: string;
}

interface Props {
  moto: Moto;
  bureauName: string;
  onClose: () => void;
}

export default function BadgeGenerator({ moto, bureauName, onClose }: Props) {
  const { t } = useTranslation();
  const badgeRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [badgeData, setBadgeData] = useState<BadgeData>({
    name: moto.owner_name.split(' ').slice(-1).join(' ') || '',
    firstName: moto.owner_name.split(' ').slice(0, -1).join(' ') || '',
    title: 'Taxi-Motard',
    idNumber: moto.vest_number || moto.serial_number.slice(-7),
    joinedDate: new Date(moto.registration_date).toLocaleDateString('fr-FR'),
    dob: '',
    expireDate: new Date(new Date(moto.registration_date).setFullYear(new Date(moto.registration_date).getFullYear() + 1)).toLocaleDateString('fr-FR'),
    photo: undefined
  });

  const handleFieldChange = (field: keyof BadgeData, value: string) => {
    setBadgeData(prev => ({ ...prev, [field]: value }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBadgeData(prev => ({ ...prev, photo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const generateQRData = () => {
    return JSON.stringify({
      id: badgeData.idNumber,
      name: `${badgeData.firstName} ${badgeData.name}`,
      phone: moto.owner_phone,
      plate: moto.plate_number,
      bureau: bureauName,
      vest: moto.vest_number,
      expire: badgeData.expireDate
    });
  };

  const downloadBadge = async () => {
    if (!badgeRef.current) return;

    try {
      setIsSaving(true);
      toast.info(t('badgeGenerator.generationDuBadgeEnCours'));

      const [html2canvas, jsPDF] = await loadPdfLibs();
      const canvas = await html2canvas(badgeRef.current, {
        scale: 3,
        backgroundColor: '#ffffff',
        logging: false
      });

      // Générer PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [85.6, 53.98] // Taille carte de crédit standard
      });

      pdf.addImage(imgData, 'PNG', 0, 0, 85.6, 53.98);
      pdf.save(`badge-${badgeData.idNumber}.pdf`);

      // Sauvegarder dans Supabase
      await saveBadgeToSupabase(imgData);

      toast.success(t('badgeGenerator.badgeGenereAvecSucces'));
    } catch (error) {
      console.error('Erreur génération badge:', error);
      toast.error(t('badgeGenerator.erreurLorsDeLaGeneration'));
    } finally {
      setIsSaving(false);
    }
  };

  const saveBadgeToSupabase = async (imageData: string) => {
    try {
      const { _data, error } = await (supabase as any)
        .from('badges')
        .insert({
          bureau_id: moto.bureau_id,
          member_id: null,
          file_path: `badges/${badgeData.idNumber}.pdf`,
          public_url: imageData,
          name: badgeData.name,
          first_name: badgeData.firstName,
          gilet_number: moto.vest_number,
          phone: moto.owner_phone,
          plate: moto.plate_number,
          serial_number: moto.serial_number,
          created_by: 'bureau'
        });

      if (error) throw error;
    } catch (error) {
      console.error('Erreur sauvegarde badge:', error);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('badgeGenerator.genererBadgeProfessionnel')}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulaire d'édition */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{t('badgeGenerator.informationsDuBadge')}</h3>
              <Button
                variant={isEditing ? "default" : "outline"}
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? <Save className="w-4 h-4 mr-2" /> : <Edit2 className="w-4 h-4 mr-2" />}
                {isEditing ? 'Enregistrer' : 'Modifier'}
              </Button>
            </div>

            <div className="space-y-3">
              <div>
                <Label>Photo</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    disabled={!isEditing}
                    className="flex-1"
                  />
                  <Camera className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t('badgeGenerator.prenomS')}</Label>
                  <Input
                    value={badgeData.firstName}
                    onChange={(e) => handleFieldChange('firstName', e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label>Nom</Label>
                  <Input
                    value={badgeData.name}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
              </div>

              <div>
                <Label>Fonction</Label>
                <Input
                  value={badgeData.title}
                  onChange={(e) => handleFieldChange('title', e.target.value)}
                  disabled={!isEditing}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>ID N° / Matricule</Label>
                  <Input
                    value={badgeData.idNumber}
                    onChange={(e) => handleFieldChange('idNumber', e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label>{t('badgeGenerator.dateDAdhesion')}</Label>
                  <Input
                    type="text"
                    value={badgeData.joinedDate}
                    onChange={(e) => handleFieldChange('joinedDate', e.target.value)}
                    disabled={!isEditing}
                    placeholder="JJ/MM/AAAA"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t('badgeGenerator.dateDeNaissance')}</Label>
                  <Input
                    type="text"
                    value={badgeData.dob}
                    onChange={(e) => handleFieldChange('dob', e.target.value)}
                    disabled={!isEditing}
                    placeholder="JJ/MM/AAAA"
                  />
                </div>
                <div>
                  <Label>Date d'expiration</Label>
                  <Input
                    type="text"
                    value={badgeData.expireDate}
                    onChange={(e) => handleFieldChange('expireDate', e.target.value)}
                    disabled={!isEditing}
                    placeholder="JJ/MM/AAAA"
                  />
                </div>
              </div>
            </div>

            <Button
              onClick={downloadBadge}
              disabled={isSaving}
              className="w-full"
              size="lg"
            >
              <Download className="w-4 h-4 mr-2" />
              Télécharger Badge (PDF)
            </Button>
          </div>

          {/* Aperçu du badge */}
          <div className="flex flex-col items-center justify-center">
            <div className="text-sm text-muted-foreground mb-4">{t('badgeGenerator.apercuDuBadge')}</div>
            <div className="transform scale-90 lg:scale-100">
              <div
                ref={badgeRef}
                className="w-[856px] h-[540px] bg-white rounded-2xl shadow-2xl overflow-hidden border-4 border-gray-300"
                style={{ fontFamily: 'Arial, sans-serif' }}
              >
                {/* Header avec dégradé bleu */}
                <div className="relative h-[230px] bg-gradient-to-r from-[#04439e] via-[#04439e] to-[#04439e] px-8 pt-6">
                  <div className="absolute top-6 right-8 text-white">
                    <div className="text-3xl font-bold tracking-widest">TAXI-MOTO DE {bureauName.toUpperCase()}</div>
                    <div className="text-xs text-right mt-1 opacity-80">224solutions</div>
                  </div>
                </div>

                {/* Photo et contenu */}
                <div className="relative -mt-28 px-8">
                  <div className="flex gap-6">
                    {/* Photo */}
                    <div className="w-[280px] h-[320px] bg-gradient-to-b from-blue-200 to-blue-100 rounded-2xl border-8 border-white shadow-xl flex items-center justify-center overflow-hidden">
                      {badgeData.photo ? (
                        <img loading="lazy" src={badgeData.photo} alt="Photo" className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="w-24 h-24 text-[#04439e]" />
                      )}
                    </div>

                    {/* Informations */}
                    <div className="flex-1 pt-24">
                      <div className="text-6xl font-bold text-gray-900 leading-tight">
                        {badgeData.firstName} {badgeData.name}
                      </div>
                      <div className="text-2xl text-gray-500 mt-2">{badgeData.title}</div>
                    </div>
                  </div>

                  {/* Informations détaillées et signature */}
                  <div className="grid grid-cols-3 gap-8 mt-8">
                    <div>
                      <div className="text-xl font-semibold text-[#04439e]">ID No</div>
                      <div className="text-3xl font-bold text-gray-900">{badgeData.idNumber}</div>
                    </div>
                    <div>
                      <div className="text-xl font-semibold text-[#04439e]">Joined Date</div>
                      <div className="text-2xl font-medium text-gray-900">{badgeData.joinedDate}</div>
                    </div>
                    <div className="row-span-2 flex flex-col items-end justify-center">
                      <div className="text-sm text-gray-500 mb-2">Signature</div>
                      <div className="text-2xl font-signature text-gray-700 italic">
                        Autorité Syndicale
                      </div>
                      <QRCodeSVG
                        value={generateQRData()}
                        size={120}
                        className="mt-4"
                      />
                    </div>
                    <div>
                      <div className="text-xl font-semibold text-[#04439e]">D.O.B</div>
                      <div className="text-2xl font-medium text-gray-900">{badgeData.dob || 'DD/MM/YEAR'}</div>
                    </div>
                    <div>
                      <div className="text-xl font-semibold text-[#04439e]">Expire Date</div>
                      <div className="text-2xl font-medium text-gray-900">{badgeData.expireDate}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
