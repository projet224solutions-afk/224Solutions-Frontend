/**
 * Générateur de Tickets de Transport - Bureau Syndicat
 * Design fidèle au modèle officiel guinéen (orientation PAYSAGE)
 * 30 tickets par page A4 (5 colonnes x 6 lignes)
 */

import { useState, useRef } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Eye, History, Loader2, Upload, Stamp, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import TransportTicketPreview from './TransportTicketPreview';
import TransportTicketBatchHistory from './TransportTicketBatchHistory';

interface TicketConfig {
  syndicateName: string;
  commune: string;
  ticketType: string;
  amount: number;
  date: string;
  optionalMention: string;
  bureauStampUrl?: string;
}

interface _TicketBatch {
  id: string;
  batch_number: string;
  bureau_id: string;
  ticket_config: TicketConfig;
  start_number: number;
  end_number: number;
  tickets_count: number;
  created_at: string;
  created_by: string;
}

export default function TransportTicketGenerator({ bureauId, bureauName }: { bureauId: string; bureauName?: string }) {
  const { t } = useTranslation();
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [generatedTickets, setGeneratedTickets] = useState<number[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [stampUrl, setStampUrl] = useState<string | null>(null);
  const [isUploadingStamp, setIsUploadingStamp] = useState(false);
  const stampInputRef = useRef<HTMLInputElement>(null);

  const [config, setConfig] = useState<TicketConfig>({
    syndicateName: bureauName || 'Syndicat de Transports Moto-Taxi',
    commune: '',
    ticketType: 'stationnement',
    amount: 2000,
    date: new Date().toISOString().split('T')[0],
    optionalMention: '',
  });

  const ticketTypes = [
    { value: 'stationnement', label: t('transportTicketGenerator.ticketDeStationnement') },
    { value: 'journalier', label: 'Ticket journalier' },
    { value: 'hebdomadaire', label: 'Ticket hebdomadaire' },
    { value: 'mensuel', label: 'Ticket mensuel' },
    { value: 'cotisation', label: t('transportTicketGenerator.ticketDeCotisation') },
    { value: 'special', label: t('transportTicketGenerator.ticketSpecial') },
  ];

  const generateBatchNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const time = String(date.getHours()).padStart(2, '0') + String(date.getMinutes()).padStart(2, '0');
    return `LOT-${year}${month}${day}-${time}`;
  };

  // Upload du cachet via Edge Function (bypass RLS)
  const handleStampUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Vérifier le type de fichier
    if (!file.type.startsWith('image/')) {
      toast.error(t('transportTicketGenerator.veuillezSelectionnerUneImage'));
      return;
    }

    // Vérifier la taille (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t('transportTicketGenerator.lImageNeDoitPas'));
      return;
    }

    setIsUploadingStamp(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bureauId', bureauId);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-bureau-stamp`,
        {
          method: 'POST',
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erreur upload');
      }

      setStampUrl(result.url);
      toast.success(t('transportTicketGenerator.cachetTelechargeAvecSucces'));
    } catch (error: any) {
      console.error('Erreur upload cachet:', error);
      toast.error(`Erreur: ${error?.message || 'Téléchargement échoué'}`);
    } finally {
      setIsUploadingStamp(false);
    }
  };

  const handleRemoveStamp = () => {
    setStampUrl(null);
    if (stampInputRef.current) {
      stampInputRef.current.value = '';
    }
  };

  // Calculer la période de validité selon le type de ticket
  const getValidityPeriod = (ticketType: string): { days: number; name: string } => {
    switch (ticketType) {
      case 'journalier':
      case 'stationnement':
        return { days: 1, name: '24h' };
      case 'hebdomadaire':
        return { days: 7, name: '7 jours' };
      case 'mensuel':
        return { days: 30, name: '30 jours' };
      default:
        return { days: 1, name: '24h' }; // Par défaut 24h
    }
  };

  // Vérifier si un lot doit être réinitialisé (période expirée)
  const shouldResetNumbering = (lastBatchDate: string, ticketType: string): boolean => {
    const { days } = getValidityPeriod(ticketType);
    const lastDate = new Date(lastBatchDate);
    const now = new Date();
    const diffTime = now.getTime() - lastDate.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    console.log(`Vérification reset: ${diffDays.toFixed(2)} jours écoulés, période: ${days} jours`);
    return diffDays >= days;
  };

  const handleGenerateTickets = async () => {
    if (!config.commune) {
      toast.error(t('transportTicketGenerator.veuillezSaisirLaCommune'));
      return;
    }
    if (config.amount <= 0) {
      toast.error(t('transportTicketGenerator.leMontantDoitEtreSuperieur'));
      return;
    }

    setIsGenerating(true);

    try {
      // Récupérer le dernier lot DE CE TYPE pour ce bureau
      const { data: lastBatch, error: fetchError } = await (supabase as any)
        .from('transport_ticket_batches')
        .select('end_number, created_at, ticket_config')
        .eq('bureau_id', bureauId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        console.error('Erreur récupération dernier lot:', fetchError);
      }

      let startNumber = 1; // Par défaut recommencer à 1
      let resetReason = '';

      // Si aucun lot existe (historique vide), recommencer à 1
      if (!lastBatch) {
        startNumber = 1;
        resetReason = 'Historique vide';
        console.log('Aucun lot trouvé, numérotation à 1');
      } else {
        const lastTicketType = lastBatch.ticket_config?.ticketType || 'journalier';

        // Si le type de ticket est différent, recommencer à 1
        if (lastTicketType !== config.ticketType) {
          startNumber = 1;
          resetReason = `Type changé (${lastTicketType} → ${config.ticketType})`;
          console.log(`Type de ticket changé, numérotation à 1`);
        }
        // Si la période est expirée, recommencer à 1
        else if (shouldResetNumbering(lastBatch.created_at, config.ticketType)) {
          startNumber = 1;
          const { name } = getValidityPeriod(config.ticketType);
          resetReason = `Période ${name} expirée`;
          console.log(`Période expirée, numérotation à 1`);
        }
        // Sinon continuer la séquence
        else {
          startNumber = (lastBatch.end_number || 0) + 1;
          console.log(`Continuation séquence depuis ${startNumber}`);
        }
      }

      const endNumber = startNumber + 29; // 30 tickets
      const batchNumber = generateBatchNumber();

      // Config avec cachet
      const configWithStamp = {
        ...config,
        bureauStampUrl: stampUrl || undefined,
      };

      // Créer le lot dans la base de données
      const { data: newBatch, error: insertError } = await (supabase as any)
        .from('transport_ticket_batches')
        .insert({
          batch_number: batchNumber,
          bureau_id: bureauId,
          ticket_config: configWithStamp,
          start_number: startNumber,
          end_number: endNumber,
          tickets_count: 30,
        })
        .select()
        .single();

      if (insertError) {
        throw new Error('Erreur création du lot: ' + insertError.message);
      }

      // Générer les numéros de tickets
      const ticketNumbers = Array.from({ length: 30 }, (_, i) => startNumber + i);

      setGeneratedTickets(ticketNumbers);
      setBatchId(newBatch?.id || null);
      setConfig(configWithStamp);
      setShowPreview(true);

      const { name } = getValidityPeriod(config.ticketType);
      const successMsg = resetReason
        ? `Lot ${batchNumber} généré (tickets 01-30) - ${resetReason}`
        : `Lot ${batchNumber} généré (tickets ${startNumber}-${endNumber}) - Validité: ${name}`;
      toast.success(successMsg);
    } catch (error: any) {
      console.error('Erreur génération tickets:', error);
      toast.error(error.message || 'Erreur lors de la génération des tickets');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Formulaire de configuration */}
      <Card className="border-0 shadow-xl rounded-2xl">
        <CardHeader className="bg-[#ff4000]/5 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#ff4000]" />
              Générateur de Tickets de Transport
            </CardTitle>
            <Button
              variant="outline"
              onClick={() => setShowHistory(true)}
              className="border-orange-300 hover:bg-orange-50"
            >
              <History className="w-4 h-4 mr-2" />
              Historique
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Nom du Syndicat */}
            <div className="space-y-2">
              <Label htmlFor="syndicateName">{t('transportTicketGenerator.nomDuSyndicat')}</Label>
              <Input
                id="syndicateName"
                value={config.syndicateName}
                onChange={(e) => setConfig({ ...config, syndicateName: e.target.value })}
                placeholder={t('transportTicketGenerator.syndicatDeTransportsMotoTaxi')}
              />
            </div>

            {/* Commune */}
            <div className="space-y-2">
              <Label htmlFor="commune">Commune / Zone *</Label>
              <Input
                id="commune"
                value={config.commune}
                onChange={(e) => setConfig({ ...config, commune: e.target.value })}
                placeholder="Ex: Coyah"
                required
              />
            </div>

            {/* Type de ticket */}
            <div className="space-y-2">
              <Label htmlFor="ticketType">{t('transportTicketGenerator.typeDeTicket')}</Label>
              <Select
                value={config.ticketType}
                onValueChange={(value) => setConfig({ ...config, ticketType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('transportTicketGenerator.selectionnerLeType')} />
                </SelectTrigger>
                <SelectContent>
                  {ticketTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Montant */}
            <div className="space-y-2">
              <Label htmlFor="amount">{t('transportTicketGenerator.montantGnf')}</Label>
              <Input
                id="amount"
                type="number"
                value={config.amount}
                onChange={(e) => setConfig({ ...config, amount: parseInt(e.target.value) || 0 })}
                min="0"
                step="500"
              />
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={config.date}
                onChange={(e) => setConfig({ ...config, date: e.target.value })}
              />
            </div>

            {/* Mention optionnelle */}
            <div className="space-y-2">
              <Label htmlFor="optionalMention">Mention optionnelle</Label>
              <Input
                id="optionalMention"
                value={config.optionalMention}
                onChange={(e) => setConfig({ ...config, optionalMention: e.target.value })}
                placeholder="Ex: Valable 24h"
              />
            </div>
          </div>

          {/* Upload du cachet */}
          <div className="mt-6 p-4 border-2 border-dashed border-orange-300 rounded-xl bg-orange-50/50">
            <Label className="text-sm font-semibold text-[#ff4000] flex items-center gap-2 mb-3">
              <Stamp className="w-4 h-4" />
              Cachet du Bureau Syndicat (optionnel)
            </Label>

            {stampUrl ? (
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 border-2 border-[#ff4000] rounded-full overflow-hidden bg-white flex items-center justify-center">
                  <img
                    src={stampUrl}
                    alt="Cachet"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-sm text-[#ff4000] font-medium">{t('transportTicketGenerator.cachetTelecharge')}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveStamp}
                    className="text-[#ff4000] border-orange-300 hover:bg-orange-50"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Supprimer
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <input
                  ref={stampInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleStampUpload}
                  className="hidden"
                  id="stamp-upload"
                />
                <Button
                  variant="outline"
                  onClick={() => stampInputRef.current?.click()}
                  disabled={isUploadingStamp}
                  className="border-[#ff4000] hover:bg-orange-100"
                >
                  {isUploadingStamp ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Télécharger le cachet
                </Button>
                <span className="text-xs text-gray-500">
                  Format: PNG, JPG (max 2MB)
                </span>
              </div>
            )}
          </div>

          {/* Bouton de génération */}
          <div className="mt-8 flex justify-center">
            <Button
              onClick={handleGenerateTickets}
              disabled={isGenerating}
              className="bg-[#ff4000] text-white px-8 py-3 text-lg font-bold shadow-lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Génération en cours...
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5 mr-2" />
                  Générer 30 Tickets
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Prévisualisation Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Prévisualisation des Tickets - Lot #{batchId?.slice(-8)}
            </DialogTitle>
          </DialogHeader>
          <TransportTicketPreview
            config={config}
            ticketNumbers={generatedTickets}
            batchId={batchId}
          />
        </DialogContent>
      </Dialog>

      {/* Historique Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Historique des Lots de Tickets
            </DialogTitle>
          </DialogHeader>
          <TransportTicketBatchHistory bureauId={bureauId} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
