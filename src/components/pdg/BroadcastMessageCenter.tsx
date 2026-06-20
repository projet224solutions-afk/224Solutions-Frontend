/**
 * MODULE BROADCAST MESSAGE CENTER - PDG
 * Interface complète pour envoyer des messages globaux/ciblés
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Send,
  Users,
  Clock,
  AlertTriangle,
  Bell,
  Mail,
  Image,
  Link,
  Calendar,
  BarChart3,
  Eye,
  CheckCircle,
  XCircle,
  RefreshCw,
  Megaphone,
  Target,
  Zap,
  TrendingUp,
  History
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface BroadcastMessage {
  id: string;
  title: string;
  content: string;
  target_segment: string;
  priority: string;
  message_type: string;
  status: string;
  sent_at: string | null;
  sender_name: string;
  created_at: string;
}

interface _BroadcastMetrics {
  total_recipients: number;
  total_read: number;
  open_rate: number;
}

interface DashboardData {
  total_broadcasts: number;
  sent_today: number;
  scheduled: number;
  avg_open_rate: number;
  total_recipients_today: number;
  recent_broadcasts: BroadcastMessage[];
}

const SEGMENTS = [
  { value: 'all', label: 'Tous les utilisateurs', icon: Users, color: 'bg-blue-500' },
  { value: 'agents', label: 'Agents uniquement', icon: Target, color: 'bg-[#04439e]' },
  { value: 'vendors', label: 'Vendeurs uniquement', icon: Megaphone, color: 'bg-[#ff4000]' },
  { value: 'clients', label: 'Clients uniquement', icon: Users, color: 'bg-orange-500' },
  { value: 'drivers', label: 'Livreurs/Chauffeurs', icon: Zap, color: 'bg-[#04439e]' },
];

const PRIORITIES = [
  { value: 'normal', label: 'Normal', color: 'bg-gray-500' },
  { value: 'high', label: 'Important', color: 'bg-orange-500' },
  { value: 'urgent', label: 'Urgent', color: 'bg-[#ff4000]' },
];

const MESSAGE_TYPES = [
  { value: 'announcement', label: 'Annonce' },
  { value: 'promotion', label: 'Promotion' },
  { value: 'alert', label: 'Alerte' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'update', label: 'Mise à jour' },
  { value: 'news', label: 'Actualité' },
];

const BroadcastMessageCenter: React.FC = () => {
  const { t } = useTranslation();
  const { user, profile } = useAuth();

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [segment, setSegment] = useState('all');
  const [priority, setPriority] = useState('normal');
  const [messageType, setMessageType] = useState('announcement');
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [targetCount, setTargetCount] = useState<number>(0);

  // Vérifier les permissions
  const isPDG = profile?.role === 'admin' || profile?.role === 'pdg' || profile?.role === 'ceo';

  // Charger le dashboard
  const loadDashboard = useCallback(async () => {
    if (!isPDG) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_broadcast_dashboard');

      if (error) throw error;
      setDashboardData(data as unknown as DashboardData);
    } catch (error: any) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, [isPDG]);

  // Compter les utilisateurs ciblés
  const countTargetUsers = useCallback(async () => {
    if (!segment) return;

    try {
      const { data, error } = await supabase.rpc('get_broadcast_target_users', {
        p_segment: segment,
        p_roles: [],
        p_regions: [],
        p_user_ids: []
      });

      if (error) throw error;
      setTargetCount(data?.length || 0);
    } catch (error) {
      console.error('Error counting targets:', error);
      setTargetCount(0);
    }
  }, [segment]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    countTargetUsers();
  }, [countTargetUsers]);

  // Envoyer le broadcast
  const handleSend = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error(t('broadcastMessageCenter.veuillezRemplirLeTitreEt'));
      return;
    }

    setShowConfirm(false);
    setSending(true);

    try {
      const { data, error } = await supabase.rpc('create_and_send_broadcast', {
        p_title: title.trim(),
        p_content: content.trim(),
        p_segment: segment,
        p_priority: priority,
        p_message_type: messageType,
        p_image_url: imageUrl || null,
        p_link_url: linkUrl || null,
        p_link_text: linkText || null,
        p_scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        p_target_roles: [],
        p_target_regions: [],
        p_sender_id: user?.id
      });

      if (error) throw error;

      const result = data as { success: boolean; recipients_count?: number; error?: string };

      if (result.success) {
        toast.success(`Message envoyé à ${result.recipients_count || targetCount} utilisateurs`);
        // Reset form
        setTitle('');
        setContent('');
        setImageUrl('');
        setLinkUrl('');
        setLinkText('');
        setScheduledAt('');
        // Refresh dashboard
        loadDashboard();
      } else {
        throw new Error(result.error || 'Erreur lors de l\'envoi');
      }
    } catch (error: any) {
      console.error('Error sending broadcast:', error);
      toast.error(error.message || 'Erreur lors de l\'envoi du message');
    } finally {
      setSending(false);
    }
  };

  const getSegmentInfo = (seg: string) => SEGMENTS.find(s => s.value === seg) || SEGMENTS[0];
  const getPriorityInfo = (pri: string) => PRIORITIES.find(p => p.value === pri) || PRIORITIES[0];

  if (!isPDG) {
    return (
      <Card className="border-[#ff4000]">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 text-[#ff4000]">
            <AlertTriangle className="h-6 w-6" />
            <p>{t('broadcastMessageCenter.accesReserveAuxAdministrateursEt')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" />
            Centre de Diffusion
          </h1>
          <p className="text-muted-foreground">
            Envoyez des messages à tous les utilisateurs ou à un segment ciblé
          </p>
        </div>
        <Button variant="outline" onClick={loadDashboard} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Stats Cards */}
      {dashboardData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Send className="h-4 w-4 text-blue-500" />
                Total envoyés
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardData.total_broadcasts}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Bell className="h-4 w-4 text-[#ff4000]" />
                Envoyés aujourd'hui
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#ff4000]">{dashboardData.sent_today}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                Programmés
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{dashboardData.scheduled}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Eye className="h-4 w-4 text-[#04439e]" />
                Taux d'ouverture
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardData.avg_open_rate || 0}%</div>
              <Progress value={dashboardData.avg_open_rate || 0} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-[#04439e]" />
                Destinataires (24h)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardData.total_recipients_today}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="compose" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="compose" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Nouveau Message
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Historique
          </TabsTrigger>
        </TabsList>

        {/* Compose Tab */}
        <TabsContent value="compose" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form */}
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{t('broadcastMessageCenter.redigerLeMessage')}</CardTitle>
                  <CardDescription>{t('broadcastMessageCenter.composezVotreMessageDeDiffusion')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="title">{t('broadcastMessageCenter.titreDuMessage')}</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={t('broadcastMessageCenter.exNouvelleFonctionnaliteDisponible')}
                      maxLength={100}
                    />
                    <p className="text-xs text-muted-foreground mt-1">{title.length}/100</p>
                  </div>

                  <div>
                    <Label htmlFor="content">{t('broadcastMessageCenter.contenuDuMessage')}</Label>
                    <Textarea
                      id="content"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder={t('broadcastMessageCenter.ecrivezVotreMessageIci')}
                      rows={6}
                      maxLength={2000}
                    />
                    <p className="text-xs text-muted-foreground mt-1">{content.length}/2000</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="imageUrl">{t('broadcastMessageCenter.urlDeLImageOptionnel')}</Label>
                      <div className="flex gap-2">
                        <Image className="h-4 w-4 mt-3 text-muted-foreground" />
                        <Input
                          id="imageUrl"
                          value={imageUrl}
                          onChange={(e) => setImageUrl(e.target.value)}
                          placeholder="https://..."
                          type="url"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="linkUrl">Lien (optionnel)</Label>
                      <div className="flex gap-2">
                        <Link className="h-4 w-4 mt-3 text-muted-foreground" />
                        <Input
                          id="linkUrl"
                          value={linkUrl}
                          onChange={(e) => setLinkUrl(e.target.value)}
                          placeholder="https://..."
                          type="url"
                        />
                      </div>
                    </div>
                  </div>

                  {linkUrl && (
                    <div>
                      <Label htmlFor="linkText">{t('broadcastMessageCenter.texteDuLien')}</Label>
                      <Input
                        id="linkText"
                        value={linkText}
                        onChange={(e) => setLinkText(e.target.value)}
                        placeholder="En savoir plus"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Options */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Ciblage
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Segment cible</Label>
                    <Select value={segment} onValueChange={setSegment}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SEGMENTS.map((seg) => (
                          <SelectItem key={seg.value} value={seg.value}>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${seg.color}`} />
                              {seg.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>~{targetCount} destinataires</span>
                    </div>
                  </div>

                  <div>
                    <Label>{t('broadcastMessageCenter.priorite')}</Label>
                    <Select value={priority} onValueChange={setPriority}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((pri) => (
                          <SelectItem key={pri.value} value={pri.value}>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${pri.color}`} />
                              {pri.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>{t('broadcastMessageCenter.typeDeMessage')}</Label>
                    <Select value={messageType} onValueChange={setMessageType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MESSAGE_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="scheduledAt">Programmer l'envoi (optionnel)</Label>
                    <div className="flex gap-2">
                      <Calendar className="h-4 w-4 mt-3 text-muted-foreground" />
                      <Input
                        id="scheduledAt"
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                        min={new Date().toISOString().slice(0, 16)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <Card>
                <CardContent className="pt-6 space-y-3">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowPreview(true)}
                    disabled={!title || !content}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Aperçu
                  </Button>

                  <Button
                    className="w-full bg-gradient-to-r from-primary to-primary/80"
                    onClick={() => setShowConfirm(true)}
                    disabled={sending || !title || !content}
                  >
                    {sending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Envoi en cours...
                      </>
                    ) : scheduledAt ? (
                      <>
                        <Clock className="h-4 w-4 mr-2" />
                        Programmer l'envoi
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Envoyer maintenant
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('broadcastMessageCenter.historiqueDesEnvois')}</CardTitle>
              <CardDescription>{t('broadcastMessageCenter.messagesEnvoyesRecemment')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {!dashboardData?.recent_broadcasts?.length ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Megaphone className="h-12 w-12 mb-4 opacity-50" />
                    <p>{t('broadcastMessageCenter.aucunMessageEnvoye')}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {dashboardData.recent_broadcasts.map((broadcast: any) => {
                      const segInfo = getSegmentInfo(broadcast.target_segment);
                      const priInfo = getPriorityInfo(broadcast.priority);

                      return (
                        <div key={broadcast.id} className="p-4 rounded-lg border bg-card">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium">{broadcast.title}</span>
                                <Badge className={priInfo.color}>{priInfo.label}</Badge>
                                <Badge variant="outline">{broadcast.status}</Badge>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {broadcast.recipients || 0} destinataires
                                </span>
                                <span className="flex items-center gap-1">
                                  <Eye className="h-3 w-3" />
                                  {broadcast.open_rate || 0}% ouvert
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {broadcast.sent_at
                                    ? new Date(broadcast.sent_at).toLocaleString('fr-FR')
                                    : 'Programmé'}
                                </span>
                              </div>
                            </div>
                            <Badge className={segInfo.color}>{segInfo.label}</Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Confirmer l'envoi
            </AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir envoyer ce message au segment sélectionné ?
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p><strong>Segment :</strong> {getSegmentInfo(segment).label}</p>
                <p><strong>Destinataires :</strong> ~{targetCount} utilisateurs</p>
                <p><strong>{t('broadcastMessageCenter.priorite2')}</strong> {getPriorityInfo(priority).label}</p>
                {scheduledAt && (
                  <p><strong>{t('broadcastMessageCenter.programmePour')}</strong> {new Date(scheduledAt).toLocaleString('fr-FR')}</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('broadcastMessageCenter.annuler')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleSend} className="bg-primary">
              <Send className="h-4 w-4 mr-2" />
              Confirmer l'envoi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('broadcastMessageCenter.apercuDuMessage')}</DialogTitle>
            <DialogDescription>{t('broadcastMessageCenter.voiciCommentVotreMessageApparaitra')}</DialogDescription>
          </DialogHeader>
          <div className="p-4 border rounded-lg bg-card">
            <div className="flex items-center gap-2 mb-3">
              <Badge className={getPriorityInfo(priority).color}>
                {getPriorityInfo(priority).label}
              </Badge>
              <Badge variant="outline">{MESSAGE_TYPES.find(t => t.value === messageType)?.label}</Badge>
            </div>
            <h3 className="text-lg font-bold mb-2">{title || 'Titre du message'}</h3>
            <p className="text-muted-foreground whitespace-pre-wrap">
              {content || 'Contenu du message...'}
            </p>
            {imageUrl && (
              <img
                src={imageUrl}
                alt="Preview"
                className="mt-4 rounded-lg max-h-40 object-cover"
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            )}
            {linkUrl && (
              <a
                href={linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-primary hover:underline"
              >
                <Link className="h-4 w-4" />
                {linkText || linkUrl}
              </a>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BroadcastMessageCenter;
