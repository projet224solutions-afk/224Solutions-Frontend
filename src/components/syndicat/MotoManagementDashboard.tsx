import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {  AlertCircle, Eye, CheckCircle2, XCircle, AlertTriangle, Download, QrCode, CreditCard } from 'lucide-react';
import BadgeGenerator from './BadgeGenerator';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import _StolenMotoReportButton from './StolenMotoReportButton';
import _MotoManagementOffline from './MotoManagementOffline';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

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

interface Props {
  bureauId: string;
  bureauName?: string;
}

export default function MotoManagementDashboard({ bureauId, bureauName = 'Bureau Syndicat' }: Props) {
  const { t } = useTranslation();
  const [motos, setMotos] = useState<Moto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedMoto, setSelectedMoto] = useState<Moto | null>(null);
  const [validationComment, setValidationComment] = useState('');
  const [loadingAction, setLoadingAction] = useState(false);
  const [showBadgeGenerator, setShowBadgeGenerator] = useState(false);
  const [motoForBadge, setMotoForBadge] = useState<Moto | null>(null);

  const loadMotos = async () => {
    try {
      setLoading(true);
      // CENTRALISÉ: Utilise la table vehicles au lieu de registered_motos
      let query = supabase
        .from('vehicles')
        .select(`
          id,
          serial_number,
          license_plate,
          brand,
          model,
          year,
          color,
          status,
          type,
          is_stolen,
          stolen_status,
          security_lock_level,
          created_at,
          bureau_id,
          owner_member_id,
          syndicate_workers:owner_member_id (
            id,
            nom,
            telephone
          )
        `)
        .eq('bureau_id', bureauId)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Transformer les données pour compatibilité avec l'interface existante
      const transformedData = (data || []).map((v: any) => ({
        id: v.id,
        owner_name: v.syndicate_workers?.nom || 'Non assigné',
        owner_phone: v.syndicate_workers?.telephone || '',
        vest_number: '',
        plate_number: v.license_plate || v.serial_number,
        serial_number: v.serial_number,
        brand: v.brand || '',
        model: v.model || '',
        year: v.year || 0,
        color: v.color || '',
        status: v.is_stolen ? 'stolen' : v.status,
        registration_date: v.created_at,
        bureau_id: v.bureau_id,
        security_lock_level: v.security_lock_level
      }));

      setMotos(transformedData);
    } catch (error) {
      console.error('Erreur chargement motos:', error);
      toast.error(t('motoManagementDashboard.erreurLorsDuChargement'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMotos();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bureauId, statusFilter]);

  const filteredMotos = motos.filter(moto =>
    moto.plate_number.toLowerCase().includes(search.toLowerCase()) ||
    moto.serial_number.toLowerCase().includes(search.toLowerCase()) ||
    moto.owner_name.toLowerCase().includes(search.toLowerCase()) ||
    moto.brand.toLowerCase().includes(search.toLowerCase())
  );

  const handleValidate = async (motoId: string) => {
    try {
      setLoadingAction(true);

      // CENTRALISÉ: Utilise la table vehicles
      const { error } = await supabase
        .from('vehicles')
        .update({ status: 'active', verified: true, verified_at: new Date().toISOString() })
        .eq('id', motoId);

      if (error) throw error;

      toast.success(t('motoManagementDashboard.vehiculeValideAvecSucces'));
      setValidationComment('');
      setSelectedMoto(null);
      loadMotos();
    } catch (error: any) {
      console.error('Erreur validation:', error);
      toast.error(error.message || 'Erreur lors de la validation');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleReportStolen = async (motoId: string, reason: string = 'Vol signalé via interface bureau') => {
    try {
      setLoadingAction(true);

      // CENTRALISÉ: Utilise le RPC declare_vehicle_stolen
      const { data, error } = await supabase.rpc('declare_vehicle_stolen', {
        p_vehicle_id: motoId,
        p_bureau_id: bureauId,
        p_declared_by: null, // Sera rempli côté serveur si possible
        p_reason: reason || validationComment || 'Vol signalé via gestion motos',
        p_location: null,
        p_ip_address: null,
        p_user_agent: navigator.userAgent
      });

      if (error) throw error;

      toast.success(t('motoManagementDashboard.vehiculeSignaleVoleAlerteDiffusee'));
      setValidationComment('');
      setSelectedMoto(null);
      loadMotos();
    } catch (error: any) {
      console.error('Erreur signalement:', error);
      toast.error(error.message || 'Erreur lors du signalement');
    } finally {
      setLoadingAction(false);
    }
  };

  const getStatutBadge = (statut: string) => {
    const statuts: Record<string, { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline'; className?: string }> = {
      'pending': { label: 'En attente', variant: 'secondary' },
      'validated': { label: t('motoManagementDashboard.valide'), variant: 'default', className: 'bg-[#ff4000] text-white' },
      'rejected': { label: t('motoManagementDashboard.refuse'), variant: 'destructive' },
      'stolen': { label: t('motoManagementDashboard.volee'), variant: 'destructive' },
      'suspended': { label: 'Suspendu', variant: 'secondary' },
      'active': { label: 'Actif', variant: 'default', className: 'bg-blue-500 text-white' },
    };

    const config = statuts[statut] || { label: statut, variant: 'default' };
    return <Badge variant={config.variant} className={config.className}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4">
        <div className="flex-1">
          <Input
            placeholder={t('motoManagementDashboard.rechercherParImmatriculationChassisPropr')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('motoManagementDashboard.tousLesStatuts')}</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="validated">{t('motoManagementDashboard.valides')}</SelectItem>
            <SelectItem value="rejected">{t('motoManagementDashboard.refuses')}</SelectItem>
            <SelectItem value="stolen">{t('motoManagementDashboard.volees')}</SelectItem>
            <SelectItem value="suspended">Suspendus</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="default"
          onClick={() => {
            if (motos.length > 0) {
              setMotoForBadge(motos[0]);
              setShowBadgeGenerator(true);
            } else {
              toast.error(t('motoManagementDashboard.aucuneMotoDisponiblePourGenerer'));
            }
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <CreditCard className="w-4 h-4 mr-2" />
          Générer Badge
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('motoManagementDashboard.listeDesMotosEnregistrees')}</CardTitle>
          <CardDescription>{filteredMotos.length} moto(s) trouvée(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Immatriculation</TableHead>
                    <TableHead>Marque/Modèle</TableHead>
                    <TableHead>{t('motoManagementDashboard.proprietaire')}</TableHead>
                    <TableHead>{t('motoManagementDashboard.telephone')}</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMotos.map((moto) => (
                    <TableRow key={moto.id}>
                      <TableCell className="font-medium">{moto.plate_number}</TableCell>
                      <TableCell>{moto.brand} {moto.model}</TableCell>
                      <TableCell>{moto.owner_name}</TableCell>
                      <TableCell>{moto.owner_phone}</TableCell>
                      <TableCell>{getStatutBadge(moto.status)}</TableCell>
                      <TableCell>{new Date(moto.registration_date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedMoto(moto)}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                Voir
                              </Button>
                            </DialogTrigger>
                          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>{t('motoManagementDashboard.detailsDeLaMoto')}</DialogTitle>
                            </DialogHeader>
                            {selectedMoto && (
                              <div className="space-y-6">
                                {/* Informations */}
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-sm text-muted-foreground">Plaque</p>
                                    <p className="font-medium">{selectedMoto.plate_number}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">{t('motoManagementDashboard.numeroDeSerie')}</p>
                                    <p className="font-medium">{selectedMoto.serial_number}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Marque</p>
                                    <p className="font-medium">{selectedMoto.brand}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">{t('motoManagementDashboard.modele')}</p>
                                    <p className="font-medium">{selectedMoto.model}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">{t('motoManagementDashboard.proprietaire')}</p>
                                    <p className="font-medium">{selectedMoto.owner_name}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">{t('motoManagementDashboard.telephone')}</p>
                                    <p className="font-medium">{selectedMoto.owner_phone}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Statut</p>
                                    {getStatutBadge(selectedMoto.status)}
                                  </div>
                                </div>

                                {/* Actions */}
                                {selectedMoto.status === 'pending' && (
                                  <div className="space-y-4 pt-4 border-t">
                                    <div className="space-y-2">
                                      <label className="text-sm font-medium">Commentaire</label>
                                      <Textarea
                                        value={validationComment}
                                        onChange={(e) => setValidationComment(e.target.value)}
                                        placeholder={t('motoManagementDashboard.ajouterUnCommentaireOptionnel')}
                                        rows={3}
                                      />
                                    </div>
                                    <div className="flex gap-2">
                                      <Button
                                        onClick={() => handleValidate(selectedMoto.id)}
                                        disabled={loadingAction}
                                        className="flex-1"
                                      >
                                        <CheckCircle2 className="w-4 h-4 mr-2" />
                                        Valider
                                      </Button>
                                      <Button
                                        variant="destructive"
                                        onClick={() => handleReportStolen(selectedMoto.id)}
                                        disabled={loadingAction}
                                        className="flex-1"
                                      >
                                        <AlertTriangle className="w-4 h-4 mr-2" />
                                        Signaler Volée
                                      </Button>
                                    </div>
                                  </div>
                                )}

                                {(selectedMoto.status === 'validated' || selectedMoto.status === 'active') && (
                                  <div className="space-y-4 pt-4 border-t">
                                    <Button
                                      variant="destructive"
                                      onClick={() => handleReportStolen(selectedMoto.id)}
                                      disabled={loadingAction}
                                      className="w-full"
                                    >
                                      <AlertTriangle className="w-4 h-4 mr-2" />
                                      Signaler comme Volée
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>

                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            setMotoForBadge(moto);
                            setShowBadgeGenerator(true);
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <CreditCard className="w-4 h-4 mr-1" />
                          Badge
                        </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {filteredMotos.length === 0 && !loading && (
                <div className="text-center py-8 text-muted-foreground">
                  Aucune moto trouvée
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {showBadgeGenerator && motoForBadge && (
        <BadgeGenerator
          moto={motoForBadge}
          bureauName={bureauName}
          onClose={() => {
            setShowBadgeGenerator(false);
            setMotoForBadge(null);
          }}
        />
      )}
    </div>
  );
}