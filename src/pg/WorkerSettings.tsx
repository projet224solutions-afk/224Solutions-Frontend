/**
 * Page Paramètres Travailleur
 * Édition profil: Photo, Téléphone, Email, Adresse, Mot de passe
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Save, Upload, Lock, User, Mail, Phone, MapPin, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function WorkerSettings() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [worker, setWorker] = useState<any>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    address: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    loadWorkerData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadWorkerData = async () => {
    try {
      const session = localStorage.getItem('worker_session');
      if (!session) {
        navigate('/universal-login');
        return;
      }

      const sessionData = JSON.parse(session);

      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('id', sessionData.userId)
        .single();

      if (error) throw error;

      setWorker(data);
      setFormData({
        email: data.email || '',
        phone: data.phone || '',
        address: '', // Ajouter si existe dans le schéma
        newPassword: '',
        confirmPassword: ''
      });
    } catch (err) {
      console.error('Erreur chargement:', err);
      toast.error(t('workerSettings.erreurDeChargement'));
      navigate('/worker');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Vérifier le type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast.error(t('workerSettings.formatNonSupporteUtilisezJpg'));
        return;
      }

      // Vérifier la taille - Max 10 Mo
      if (file.size > 10 * 1024 * 1024) {
        toast.error(t('workerSettings.lImageNeDoitPas'));
        return;
      }

      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadPhoto = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `worker_${worker.id}_${Date.now()}.${fileExt}`;
      const filePath = `workers/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (err) {
      console.error('Erreur upload:', err);
      return null;
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Validation
      if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
        throw new Error('Les mots de passe ne correspondent pas');
      }

      if (formData.newPassword && formData.newPassword.length < 6) {
        throw new Error('Le mot de passe doit contenir au moins 6 caractères');
      }

      // Upload photo si changée
      let photoUrl = worker.photo_url;
      if (photoFile) {
        const uploaded = await uploadPhoto(photoFile);
        if (uploaded) photoUrl = uploaded;
      }

      // Préparer les mises à jour
      const updates: any = {
        email: formData.email,
        phone: formData.phone,
        photo_url: photoUrl
      };

      // Hash du nouveau mot de passe si fourni
      if (formData.newPassword) {
        const encoder = new TextEncoder();
        const data = encoder.encode(formData.newPassword);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        updates.password_hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      }

      // Mise à jour
      const { error } = await supabase
        .from('members')
        .update(updates)
        .eq('id', worker.id);

      if (error) throw error;

      toast.success(t('workerSettings.profilMisAJourAvec'));
      navigate('/worker');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message: t('workerSettings.erreurDeSauvegarde');
      toast.error(errorMessage);
      console.error('Erreur:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-3xl mx-auto py-8">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate('/worker')} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
          <h1 className="text-3xl font-bold">{t('workerSettings.parametresDuProfil')}</h1>
          <p className="text-muted-foreground">{t('workerSettings.modifiezVosInformationsPersonnelles')}</p>
        </div>

        <div className="space-y-6">
          {/* Photo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Photo de profil
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                  {photoPreview || worker?.photo_url ? (
                    <img
                      src={photoPreview || worker?.photo_url}
                      alt="Photo"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="h-12 w-12 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    disabled={saving}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Formats acceptés: JPG, PNG, GIF, WebP. Taille max: 10 Mo
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact */}
          <Card>
            <CardHeader>
              <CardTitle>{t('workerSettings.informationsDeContact')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    disabled={saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Téléphone
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    disabled={saving}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Adresse
                </Label>
                <Textarea
                  id="address"
                  rows={3}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  disabled={saving}
                  placeholder={t('workerSettings.votreAdresseComplete')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Mot de passe */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Changer le mot de passe
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">{t('workerSettings.nouveauMotDePasse')}</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder={t('workerSettings.min6Caracteres')}
                    value={formData.newPassword}
                    onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                    disabled={saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmer</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder={t('workerSettings.repeterLeMotDePasse')}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    disabled={saving}
                  />
                </div>
              </div>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Laissez vide si vous ne souhaitez pas changer votre mot de passe
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Boutons d'action */}
          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={() => navigate('/worker')}
              disabled={saving}
              className="flex-1"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Enregistrer
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
