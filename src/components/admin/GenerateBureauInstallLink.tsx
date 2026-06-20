/**
 * GÉNÉRATEUR DE LIEN D'INSTALLATION BUREAU
 * Composant pour générer des liens sécurisés d'installation PWA
 * 224SOLUTIONS - Administration
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Link as LinkIcon,
  Copy,
  Check,
  Mail,
  Clock,
  Shield,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";

interface Props {
  bureauId: string;
  bureauName: string;
}

export default function GenerateBureauInstallLink({ bureauId, bureauName }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [email, setEmail] = useState('');
  const [expiresIn, setExpiresIn] = useState('24');

  const handleGenerate = async () => {
    setLoading(true);

    try {
      // Appeler l'edge function pour générer le token
      const { data, error } = await supabase.functions.invoke('generate-bureau-token', {
        body: {
          bureau_id: bureauId,
          president_email: email || null,
          expires_in_hours: parseInt(expiresIn)
        }
      });

      if (error) throw error;

      if (data.success) {
        setGeneratedLink(data.install_url);

        toast.success(t('generateBureauInstallLink.lienGenere'), {
          description: email ? `Email envoyé à ${email}` : 'Copiez et partagez le lien'
        });
      } else {
        throw new Error(data.error || 'Erreur inconnue');
      }
    } catch (error: any) {
      console.error('Erreur génération lien:', error);
      toast.error(error.message || 'Erreur lors de la génération');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      toast.success(t('generateBureauInstallLink.lienCopie'));

      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReset = () => {
    setGeneratedLink(null);
    setEmail('');
    setExpiresIn('24');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <LinkIcon className="w-4 h-4 mr-2" />
          Lien d'installation
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            Générer un lien d'installation PWA
          </DialogTitle>
          <DialogDescription>
            Créez un lien sécurisé pour {bureauName}
          </DialogDescription>
        </DialogHeader>

        {!generatedLink ? (
          <div className="space-y-4">
            {/* Informations bureau */}
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm font-medium text-blue-900">Bureau:</p>
              <p className="text-sm text-blue-700">{bureauName}</p>
              <Badge variant="outline" className="mt-2">
                ID: {bureauId.slice(0, 8)}...
              </Badge>
            </div>

            {/* Email du président (optionnel) */}
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email du président (optionnel)
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="president@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Si fourni, le lien sera envoyé automatiquement par email
              </p>
            </div>

            {/* Durée de validité */}
            <div className="space-y-2">
              <Label htmlFor="expires" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Durée de validité
              </Label>
              <Select value={expiresIn} onValueChange={setExpiresIn}>
                <SelectTrigger id="expires">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 heure</SelectItem>
                  <SelectItem value="6">6 heures</SelectItem>
                  <SelectItem value="12">12 heures</SelectItem>
                  <SelectItem value="24">{t('generateBureauInstallLink.t24HeuresRecommande')}</SelectItem>
                  <SelectItem value="48">48 heures</SelectItem>
                  <SelectItem value="72">72 heures</SelectItem>
                  <SelectItem value="168">7 jours</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Bouton génération */}
            <Button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Génération en cours...
                </>
              ) : (
                <>
                  <LinkIcon className="w-4 h-4 mr-2" />
                  Générer le lien
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Lien généré */}
            <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
              <div className="flex items-center gap-2 text-[#ff4000] mb-2">
                <Check className="w-5 h-5" />
                <span className="font-medium">{t('generateBureauInstallLink.lienGenereAvecSucces')}</span>
              </div>

              <div className="mt-3 p-3 bg-white rounded border border-orange-300">
                <p className="text-sm break-all font-mono text-gray-700">
                  {generatedLink}
                </p>
              </div>

              <Button
                onClick={handleCopyLink}
                variant="outline"
                className="w-full mt-3"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2 text-[#ff4000]" />
                    Copié !
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copier le lien
                  </>
                )}
              </Button>
            </div>

            {/* Informations */}
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-900">
                <strong>{t('generateBureauInstallLink.validite')}</strong> {expiresIn} heure(s)
              </p>
              {email && (
                <p className="text-sm text-blue-900 mt-1">
                  <strong>{t('generateBureauInstallLink.emailEnvoyeA')}</strong> {email}
                </p>
              )}
            </div>

            {/* Instructions */}
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm font-medium text-[#04439e] mb-2">
                📱 Instructions pour le président :
              </p>
              <ol className="text-sm text-[#04439e] space-y-1 list-decimal list-inside">
                <li>{t('generateBureauInstallLink.cliquerSurLeLien')}</li>
                <li>{t('generateBureauInstallLink.accepterLInstallationDeL')}</li>
                <li>{t('generateBureauInstallLink.lApplicationSeraDisponibleSur')}</li>
                <li>{t('generateBureauInstallLink.utilisableMemeSansInternet')}</li>
              </ol>
            </div>

            {/* Boutons */}
            <div className="flex gap-2">
              <Button onClick={handleReset} variant="outline" className="flex-1">
                Générer un nouveau lien
              </Button>
              <Button onClick={() => setOpen(false)} className="flex-1">
                Fermer
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
