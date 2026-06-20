/**
 * AGENT VENDORS MODULE
 * Module Gestion Vendeurs - miroir de PDGVendors
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Store, CheckCircle, XCircle, RefreshCw, Eye,
  Search, Shield
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface AgentVendorsModuleProps {
  agentId: string;
  canManage?: boolean;
}

interface Vendor {
  id: string;
  business_name: string;
  user_id: string;
  vendor_code: string;
  is_active: boolean;
  is_verified: boolean;
  kyc_status: string | null;
  created_at: string;
  profiles?: {
    email: string;
    first_name: string;
    last_name: string;
    phone: string;
  };
}

export function AgentVendorsModule({ agentId, canManage = false }: AgentVendorsModuleProps) {
  const { t } = useTranslation();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [stats, setStats] = useState({
    active: 0,
    inactive: 0,
    verified: 0,
    total: 0
  });

  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('vendors')
        .select(`
          id,
          business_name,
          user_id,
          vendor_code,
          is_active,
          is_verified,
          kyc_status,
          created_at,
          profiles!inner(first_name, last_name, phone)
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      const vendorsList = (data || []) as Vendor[];
      setVendors(vendorsList);

      setStats({
        total: vendorsList.length,
        active: vendorsList.filter(v => v.is_active).length,
        inactive: vendorsList.filter(v => !v.is_active).length,
        verified: vendorsList.filter(v => v.is_verified).length
      });
    } catch (error) {
      console.error('Erreur chargement vendeurs:', error);
      toast.error(t('agentVendorsModule.erreurLorsDuChargement'));
    } finally {
      setLoading(false);
    }
  };

  const toggleVendorStatus = async (vendorId: string, currentStatus: boolean) => {
    if (!canManage) {
      toast.error(t('agentVendorsModule.permissionRefusee'));
      return;
    }

    try {
      const { error } = await supabase
        .from('vendors')
        .update({ is_active: !currentStatus })
        .eq('id', vendorId);

      if (error) throw error;
      toast.success(currentStatus ? 'Vendeur désactivé' : 'Vendeur activé');
      loadVendors();
    } catch (_error) {
      toast.error(t('agentVendorsModule.erreurLorsDeLaModification'));
    }
  };

  const filteredVendors = vendors.filter(v =>
    v.business_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.vendor_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.profiles?.phone?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getKycBadge = (status: string | null, isVerified: boolean) => {
    if (isVerified || status === 'verified') {
      return <Badge className="bg-orange-100 text-[#ff4000] border-orange-200">{t('agentVendorsModule.verifie')}</Badge>;
    }
    if (status === 'rejected') {
      return <Badge className="bg-orange-100 text-[#ff4000] border-orange-200">{t('agentVendorsModule.rejete')}</Badge>;
    }
    return <Badge className="bg-orange-100 text-[#ff4000] border-orange-200">En attente</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-orange-50 to-orange-50 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-[#ff4000] to-[#ff4000] shadow-lg">
                <Store className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">{t('agentVendorsModule.gestionDesVendeurs')}</CardTitle>
                <CardDescription>{t('agentVendorsModule.vueDEnsembleDesVendeurs')}</CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={loadVendors}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl p-4 text-center">
              <Store className="w-6 h-6 text-slate-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-slate-700">{stats.total}</p>
              <p className="text-xs text-slate-500">Total</p>
            </div>
            <div className="bg-gradient-to-br from-orange-100 to-orange-200 rounded-xl p-4 text-center">
              <CheckCircle className="w-6 h-6 text-[#ff4000] mx-auto mb-2" />
              <p className="text-2xl font-bold text-[#ff4000]">{stats.active}</p>
              <p className="text-xs text-[#ff4000]">Actifs</p>
            </div>
            <div className="bg-gradient-to-br from-orange-100 to-orange-200 rounded-xl p-4 text-center">
              <XCircle className="w-6 h-6 text-[#ff4000] mx-auto mb-2" />
              <p className="text-2xl font-bold text-[#ff4000]">{stats.inactive}</p>
              <p className="text-xs text-[#ff4000]">Inactifs</p>
            </div>
            <div className="bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl p-4 text-center">
              <Shield className="w-6 h-6 text-blue-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-blue-700">{stats.verified}</p>
              <p className="text-xs text-blue-500">{t('agentVendorsModule.verifies')}</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder={t('agentVendorsModule.rechercherParNomCodeVendeur')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Vendors List */}
      <Card className="border-0 shadow-lg">
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <div className="divide-y">
              {filteredVendors.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Store className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>{t('agentVendorsModule.aucunVendeurTrouve')}</p>
                </div>
              ) : (
                filteredVendors.map((vendor) => (
                  <div
                    key={vendor.id}
                    className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        vendor.is_active ? 'bg-orange-100' : 'bg-orange-100'
                      }`}>
                        <Store className={`w-6 h-6 ${
                          vendor.is_active ? 'text-[#ff4000]' : 'text-[#ff4000]'
                        }`} />
                      </div>
                      <div>
                        <p className="font-semibold">{vendor.business_name || 'Sans nom'}</p>
                        <p className="text-sm text-muted-foreground">
                          {vendor.profiles?.phone}
                        </p>
                        <p className="text-xs font-mono text-primary">
                          {vendor.vendor_code}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getKycBadge(vendor.kyc_status, vendor.is_verified)}
                      <Badge variant={vendor.is_active ? 'default' : 'destructive'}>
                        {vendor.is_active ? 'Actif' : 'Inactif'}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedVendor(vendor);
                          setIsDialogOpen(true);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleVendorStatus(vendor.id, vendor.is_active)}
                        >
                          {vendor.is_active ? (
                            <XCircle className="w-4 h-4 text-[#ff4000]" />
                          ) : (
                            <CheckCircle className="w-4 h-4 text-[#ff4000]" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="w-5 h-5 text-primary" />
              {selectedVendor?.business_name}
            </DialogTitle>
          </DialogHeader>

          {selectedVendor && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t('agentVendorsModule.codeVendeur')}</p>
                  <p className="font-mono font-medium">{selectedVendor.vendor_code}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Statut</p>
                  <Badge variant={selectedVendor.is_active ? 'default' : 'destructive'}>
                    {selectedVendor.is_active ? 'Actif' : 'Inactif'}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t('agentVendorsModule.telephone')}</p>
                  <p className="font-medium">{selectedVendor.profiles?.phone}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t('agentVendorsModule.telephone')}</p>
                  <p className="font-medium">{selectedVendor.profiles?.phone || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">KYC</p>
                  {getKycBadge(selectedVendor.kyc_status, selectedVendor.is_verified)}
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t('agentVendorsModule.inscritLe')}</p>
                  <p className="font-medium">
                    {format(new Date(selectedVendor.created_at), 'dd MMM yyyy', { locale: fr })}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AgentVendorsModule;
