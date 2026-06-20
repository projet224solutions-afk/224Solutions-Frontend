/**
 * EMERGENCY ACTIONS PANEL - Panneau d'actions syndicat
 * 224Solutions - Actions rapides pour gérer les urgences
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Phone,
  MessageSquare,
  Shield,
  FileText,
  Clock,
  CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { emergencyService } from '@/services/emergencyService';
import type { EmergencyAlert, EmergencyAction } from '@/types/emergency';

interface EmergencyActionsPanelProps {
  alert: EmergencyAlert;
  userId: string;
  userName?: string;
  onActionComplete: () => void;
}

export const EmergencyActionsPanel: React.FC<EmergencyActionsPanelProps> = ({
  alert,
  userId,
  userName,
  onActionComplete
}) => {
  const [actions, setActions] = useState<EmergencyAction[]>([]);
  const [noteText, setNoteText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Charger les actions existantes
   */
  useEffect(() => {
    const loadActions = async () => {
      const actions = await emergencyService.getAlertActions(alert.id);
      setActions(actions);
    };

    loadActions();

    // S'abonner aux nouvelles actions
    const unsubscribe = emergencyService.subscribeToActions(alert.id, (newAction) => {
      setActions((prev) => [newAction, ...prev]);
    });

    return () => {
      unsubscribe();
    };
  }, [alert.id]);

  /**
   * Appeler le conducteur
   */
  const handleCallDriver = async () => {
    try {
      await emergencyService.createAction({
        alert_id: alert.id,
        action_type: 'call_driver',
        performed_by: userId,
        performed_by_name: userName,
        action_details: { phone: alert.driver_phone },
        notes: `Appel vers ${alert.driver_phone}`
      });

      // Ouvrir le dialer si sur mobile
      if (alert.driver_phone) {
        window.location.href = `tel:${alert.driver_phone}`;
      }

      toast.success('Appel initié');
      onActionComplete();
    } catch (error) {
      console.error('❌ Erreur:', error);
      toast.error('Erreur lors de l\'appel');
    }
  };

  /**
   * Envoyer un message
   */
  const handleSendMessage = async () => {
    const message = prompt('Message à envoyer au conducteur:');
    if (!message) return;

    try {
      await emergencyService.createAction({
        alert_id: alert.id,
        action_type: 'send_message',
        performed_by: userId,
        performed_by_name: userName,
        action_details: { message },
        notes: `Message envoyé: ${message}`
      });

      toast.success('Message envoyé');
      onActionComplete();
    } catch (error) {
      console.error('❌ Erreur:', error);
      toast.error('Erreur lors de l\'envoi');
    }
  };

  /**
   * Notifier la police
   */
  const handleNotifyPolice = async () => {
    const details = prompt('Détails pour la police (numéro, unité, etc.):');
    if (!details) return;

    try {
      await emergencyService.createAction({
        alert_id: alert.id,
        action_type: 'notify_police',
        performed_by: userId,
        performed_by_name: userName,
        action_details: { details },
        notes: `Police notifiée: ${details}`
      });

      toast.success('🚔 Police notifiée avec succès');
      onActionComplete();
    } catch (error) {
      console.error('❌ Erreur:', error);
      toast.error('Erreur lors de la notification');
    }
  };

  /**
   * Ajouter une note
   */
  const handleAddNote = async () => {
    if (!noteText.trim()) {
      toast.warning('Veuillez saisir une note');
      return;
    }

    setIsSubmitting(true);

    try {
      await emergencyService.createAction({
        alert_id: alert.id,
        action_type: 'note',
        performed_by: userId,
        performed_by_name: userName,
        notes: noteText
      });

      setNoteText('');
      toast.success('Note ajoutée');
      onActionComplete();
    } catch (error) {
      console.error('❌ Erreur:', error);
      toast.error('Erreur lors de l\'ajout de la note');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'call_driver':
        return <Phone className="h-4 w-4" />;
      case 'send_message':
        return <MessageSquare className="h-4 w-4" />;
      case 'notify_police':
        return <Shield className="h-4 w-4" />;
      case 'note':
        return <FileText className="h-4 w-4" />;
      case 'mark_safe':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getActionLabel = (type: string) => {
    switch (type) {
      case 'call_driver':
        return 'Appel conducteur';
      case 'send_message':
        return 'Message envoyé';
      case 'notify_police':
        return 'Police notifiée';
      case 'note':
        return 'Note';
      case 'mark_safe':
        return 'Marqué en sécurité';
      case 'escalate':
        return 'Escaladé';
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6">
      {/* Actions rapides */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Actions Rapides</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={handleCallDriver}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Phone className="h-4 w-4" />
              Appeler le Conducteur
            </Button>

            <Button
              onClick={handleSendMessage}
              variant="outline"
              className="flex items-center gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              Envoyer un Message
            </Button>

            <Button
              onClick={handleNotifyPolice}
              variant="destructive"
              className="flex items-center gap-2 col-span-2"
            >
              <Shield className="h-4 w-4" />
              Notifier la Police Locale
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ajouter une note */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ajouter une Note</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Décrivez l'action prise ou les observations..."
            rows={4}
            className="w-full"
          />
          <Button
            onClick={handleAddNote}
            disabled={isSubmitting || !noteText.trim()}
            className="w-full"
          >
            <FileText className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Ajout...' : 'Ajouter la Note'}
          </Button>
        </CardContent>
      </Card>

      {/* Historique des actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Historique des Actions ({actions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {actions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucune action enregistrée pour cette alerte
              </p>
            ) : (
              actions.map((action) => (
                <div
                  key={action.id}
                  className="flex items-start gap-3 p-3 bg-muted rounded-lg"
                >
                  <div className="mt-1">{getActionIcon(action.action_type)}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">
                        {getActionLabel(action.action_type)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(action.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {action.notes || 'Aucun détail'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Par: {action.performed_by_name || 'Utilisateur'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmergencyActionsPanel;
