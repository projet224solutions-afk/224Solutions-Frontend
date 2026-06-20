/**
 * GESTION DES BUREAUX SYNDICAUX - Interface PDG
 * Module simplifié utilisant les vraies tables Supabase
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Building2, Users, DollarSign, RefreshCw, Mail, Phone, MapPin,
  CheckCircle, XCircle, Bike
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from '@/integrations/supabase/client';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';

interface Bureau {
  id: string;
  bureau_code: string;
  prefecture: string;
  commune: string;
  full_location: string;
  president_name: string;
  president_email: string;
  president_phone?: string;
  status: string;
  total_members: number;
  total_vehicles: number;
  total_cotisations: number;
  created_at: string;
  validated_at?: string;
  last_activity?: string;
}

export default function SyndicateBureauManagement() {
  const { t } = useTranslation();
  const [bureaus, setBureaus] = useState<Bureau[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: bureauxData, error: bureauxError } = await supabase
        .from('bureaus' as unknown)
        .select('*')
        .order('created_at', { ascending: false });

      if (bureauxError) throw bureauxError;
      setBureaus((bureauxData as unknown as Bureau[]) || []);

      toast.success(t('syndicateBureauManagement.donneesChargees'));
    } catch (error: unknown) {
      console.error('Erreur chargement:', error);
      toast.error(t('syndicateBureauManagement.erreurDeChargement') + error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateBureauStatus = async (bureauId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('bureaus' as unknown)
        .update({ status: newStatus, validated_at: new Date().toISOString() })
        .eq('id', bureauId);

      if (error) throw error;

      toast.success(t('syndicateBureauManagement.statutMisAJour'));
      loadData();
    } catch (error: unknown) {
      toast.error('Erreur: ' + error.message);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { label: 'Actif', className: 'bg-orange-100 text-[#ff4000]' },
      pending: { label: 'En attente', className: 'bg-orange-100 text-[#ff4000]' },
      suspended: { label: 'Suspendu', className: 'bg-orange-100 text-[#ff4000]' },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const _formatAmount = useFormatCurrency();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Statistiques globales
  const stats = {
    totalBureaus: bureaus.length,
    activeBureaus: bureaus.filter(b => b.status === 'active').length,
    totalMembers: bureaus.reduce((sum, b) => sum + (b.total_members || 0), 0),
    totalVehicles: bureaus.reduce((sum, b) => sum + (b.total_vehicles || 0), 0),
    totalCotisations: bureaus.reduce((sum, b) => sum + Number(b.total_cotisations || 0), 0),
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6" />
            Gestion des Bureaux Syndicaux
          </h2>
          <p className="text-muted-foreground">
            Administration et supervision des bureaux syndicaux
          </p>
        </div>
        <Button onClick={loadData} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* Statistiques globales */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bureaux Total</p>
                <p className="text-2xl font-bold">{stats.totalBureaus}</p>
              </div>
              <Building2 className="w-8 h-8 text-blue-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bureaux Actifs</p>
                <p className="text-2xl font-bold text-[#ff4000]">{stats.activeBureaus}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-[#ff4000] opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Membres Total</p>
                <p className="text-2xl font-bold">{stats.totalMembers}</p>
              </div>
              <Users className="w-8 h-8 text-[#04439e] opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('syndicateBureauManagement.vehicules')}</p>
                <p className="text-2xl font-bold">{stats.totalVehicles}</p>
              </div>
              <Bike className="w-8 h-8 text-orange-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Cotisations</p>
                <p className="text-xl font-bold">{formatCurrency(stats.totalCotisations)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-[#ff4000] opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tableau des bureaux */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Liste des Bureaux Syndicaux ({bureaus.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bureaus.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>{t('syndicateBureauManagement.aucunBureauSyndicalEnregistre')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code Bureau</TableHead>
                    <TableHead>Localisation</TableHead>
                    <TableHead>{t('syndicateBureauManagement.president')}</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="text-center">Membres</TableHead>
                    <TableHead className="text-center">{t('syndicateBureauManagement.vehicules')}</TableHead>
                    <TableHead className="text-right">Cotisations</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bureaus.map((bureau) => (
                    <TableRow key={bureau.id}>
                      <TableCell className="font-mono font-semibold">
                        {bureau.bureau_code}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-muted-foreground mt-1 flex-shrink-0" />
                          <div>
                            <div className="font-medium">{bureau.prefecture}</div>
                            <div className="text-sm text-muted-foreground">{bureau.commune}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{bureau.president_name}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-sm">
                          {bureau.president_email && (
                            <div className="flex items-center gap-1">
                              <Mail className="w-3 h-3 text-muted-foreground" />
                              <span className="text-xs">{bureau.president_email}</span>
                            </div>
                          )}
                          {bureau.president_phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-muted-foreground" />
                              <span className="text-xs">{bureau.president_phone}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{bureau.total_members || 0}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{bureau.total_vehicles || 0}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(Number(bureau.total_cotisations || 0))}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(bureau.status)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {bureau.status === 'pending' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateBureauStatus(bureau.id, 'active')}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Valider
                            </Button>
                          )}
                          {bureau.status === 'active' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateBureauStatus(bureau.id, 'suspended')}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Suspendre
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
