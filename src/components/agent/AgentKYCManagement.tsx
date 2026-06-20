import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Shield, Search, CheckCircle, XCircle, Clock, Eye,
  Building2, User, Phone, FileText, AlertTriangle, RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface VendorKYC {
  id: string;
  user_id: string;
  business_name: string;
  email: string;
  phone: string;
  kyc_status: string;
  kyc_verified_at: string | null;
  is_verified: boolean;
  created_at: string;
}

interface AgentKYCManagementProps {
  agentId: string;
  canManage?: boolean;
}

export function AgentKYCManagement({ agentId, canManage = false }: AgentKYCManagementProps) {
  const { t } = useTranslation();
  const [vendors, setVendors] = useState<VendorKYC[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeStatus, setActiveStatus] = useState<string>('pending');
  const [selectedVendor, setSelectedVendor] = useState<VendorKYC | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadVendors();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStatus]);

  const loadVendors = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('vendors')
        .select('id, user_id, business_name, email, phone, kyc_status, kyc_verified_at, is_verified, created_at')
        .order('created_at', { ascending: false });

      if (activeStatus === 'pending') {
        query = query.or('kyc_status.eq.pending,kyc_status.is.null');
      } else if (activeStatus === 'verified') {
        query = query.eq('kyc_status', 'verified');
      } else if (activeStatus === 'rejected') {
        query = query.eq('kyc_status', 'rejected');
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;
      setVendors(data || []);
    } catch (error: any) {
      console.error('Erreur chargement KYC:', error);
      toast.error(t('agentKYCManagement.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (vendor: VendorKYC) => {
    if (!canManage) {
      toast.error(t('agentKYCManagement.vousNAvezPasLa'));
      return;
    }

    try {
      setProcessing(true);

      const { error } = await supabase
        .from('vendors')
        .update({
          kyc_status: 'verified',
          is_verified: true,
          kyc_verified_at: new Date().toISOString()
        })
        .eq('id', vendor.id);

      if (error) throw error;

      toast.success(`KYC de ${vendor.business_name} validé avec succès`);
      loadVendors();
      setIsDialogOpen(false);
    } catch (error: any) {
      console.error('Erreur validation KYC:', error);
      toast.error(t('agentKYCManagement.erreurLorsDeLaValidation'));
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (vendor: VendorKYC) => {
    if (!canManage) {
      toast.error(t('agentKYCManagement.vousNAvezPasLa2'));
      return;
    }

    if (!rejectionReason.trim()) {
      toast.error(t('agentKYCManagement.veuillezIndiquerUneRaisonDe'));
      return;
    }

    try {
      setProcessing(true);

      const { error } = await supabase
        .from('vendors')
        .update({
          kyc_status: 'rejected',
          is_verified: false
        })
        .eq('id', vendor.id);

      if (error) throw error;

      toast.success(`KYC de ${vendor.business_name} rejeté`);
      loadVendors();
      setIsDialogOpen(false);
      setRejectionReason('');
    } catch (error: any) {
      console.error('Erreur rejet KYC:', error);
      toast.error(t('agentKYCManagement.erreurLorsDuRejet'));
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'verified':
        return <Badge className="bg-orange-100 text-[#ff4000] border-orange-200">{t('agentKYCManagement.verifie')}</Badge>;
      case 'rejected':
        return <Badge className="bg-orange-100 text-[#ff4000] border-orange-200">{t('agentKYCManagement.rejete')}</Badge>;
      default:
        return <Badge className="bg-orange-100 text-[#ff4000] border-orange-200">En attente</Badge>;
    }
  };

  const filteredVendors = vendors.filter(v =>
    v.business_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.phone?.includes(searchTerm)
  );

  const stats = {
    pending: vendors.filter(v => !v.kyc_status || v.kyc_status === 'pending').length,
    verified: vendors.filter(v => v.kyc_status === 'verified').length,
    rejected: vendors.filter(v => v.kyc_status === 'rejected').length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-50 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Shield className="w-6 h-6 text-primary" />
              Gestion KYC Vendeurs
            </CardTitle>
            <Button variant="outline" size="sm" onClick={loadVendors}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-orange-50 rounded-lg p-4 text-center">
              <Clock className="w-6 h-6 text-[#ff4000] mx-auto mb-2" />
              <p className="text-2xl font-bold text-[#ff4000]">{stats.pending}</p>
              <p className="text-sm text-[#ff4000]">En attente</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-4 text-center">
              <CheckCircle className="w-6 h-6 text-[#ff4000] mx-auto mb-2" />
              <p className="text-2xl font-bold text-[#ff4000]">{stats.verified}</p>
              <p className="text-sm text-[#ff4000]">{t('agentKYCManagement.verifies')}</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-4 text-center">
              <XCircle className="w-6 h-6 text-[#ff4000] mx-auto mb-2" />
              <p className="text-2xl font-bold text-[#ff4000]">{stats.rejected}</p>
              <p className="text-sm text-[#ff4000]">{t('agentKYCManagement.rejetes')}</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder={t('agentKYCManagement.rechercherParNomEmailOu')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Tabs */}
          <Tabs value={activeStatus} onValueChange={setActiveStatus}>
            <TabsList className="w-full">
              <TabsTrigger value="pending" className="flex-1">
                En attente ({stats.pending})
              </TabsTrigger>
              <TabsTrigger value="verified" className="flex-1">
                Vérifiés ({stats.verified})
              </TabsTrigger>
              <TabsTrigger value="rejected" className="flex-1">
                Rejetés ({stats.rejected})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeStatus} className="mt-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : filteredVendors.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>{t('agentKYCManagement.aucunVendeurDansCetteCategorie')}</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {filteredVendors.map((vendor) => (
                      <div
                        key={vendor.id}
                        className="flex items-center justify-between p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{vendor.business_name || 'Sans nom'}</p>
                            <p className="text-sm text-muted-foreground">{vendor.email}</p>
                            <p className="text-xs text-muted-foreground">{vendor.phone}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {getStatusBadge(vendor.kyc_status)}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedVendor(vendor);
                              setIsDialogOpen(true);
                            }}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            {canManage ? 'Gérer' : 'Voir'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialog détail */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Détails KYC - {selectedVendor?.business_name}
            </DialogTitle>
          </DialogHeader>

          {selectedVendor && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Entreprise</p>
                  <p className="font-medium">{selectedVendor.business_name || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Statut</p>
                  {getStatusBadge(selectedVendor.kyc_status)}
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{selectedVendor.email}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t('agentKYCManagement.telephone')}</p>
                  <p className="font-medium">{selectedVendor.phone || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t('agentKYCManagement.inscritLe')}</p>
                  <p className="font-medium">
                    {format(new Date(selectedVendor.created_at), 'dd MMM yyyy', { locale: fr })}
                  </p>
                </div>
                {selectedVendor.kyc_verified_at && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">{t('agentKYCManagement.verifieLe')}</p>
                    <p className="font-medium">
                      {format(new Date(selectedVendor.kyc_verified_at), 'dd MMM yyyy', { locale: fr })}
                    </p>
                  </div>
                )}
              </div>

              {canManage && selectedVendor.kyc_status !== 'verified' && (
                <>
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-2">{t('agentKYCManagement.raisonDuRejetOptionnel')}</p>
                    <Textarea
                      placeholder={t('agentKYCManagement.indiquezLaRaisonSiVous')}
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <DialogFooter className="gap-2">
                    <Button
                      variant="destructive"
                      onClick={() => handleReject(selectedVendor)}
                      disabled={processing}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Rejeter
                    </Button>
                    <Button
                      onClick={() => handleApprove(selectedVendor)}
                      disabled={processing}
                      className="bg-[#ff4000] hover:bg-[#ff4000]"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Valider KYC
                    </Button>
                  </DialogFooter>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
