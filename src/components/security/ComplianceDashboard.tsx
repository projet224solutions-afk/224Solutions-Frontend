/**
 * TABLEAU DE BORD CONFORMITÉ
 * ISO 27001, PCI-DSS, SOC 2, GDPR
 * Certifications de sécurité entreprise
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Shield, CheckCircle, Clock, AlertTriangle, RefreshCw,
  Award, FileCheck, Calendar, ExternalLink
} from "lucide-react";
import { ResponsiveGrid } from "@/components/responsive/ResponsiveContainer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Certification {
  id: string;
  name: string;
  certification_type: string;
  status: 'certified' | 'in_progress' | 'planned' | 'expired';
  progress: number;
  description: string;
  issuing_authority: string;
  valid_from: string | null;
  valid_until: string | null;
  certificate_url: string | null;
}

interface ComplianceAudit {
  id: string;
  certification_id: string;
  audit_type: string;
  auditor_name: string;
  auditor_company: string;
  status: string;
  findings: any;
  non_conformities: number;
  observations: number;
  overall_score: number;
  scheduled_date: string;
  completed_date: string;
  next_audit_date: string;
}

export function ComplianceDashboard() {
  const { t } = useTranslation();
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [audits, setAudits] = useState<ComplianceAudit[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [certRes, auditRes] = await Promise.all([
        supabase.from('security_certifications').select('*').order('progress', { ascending: false }),
        supabase.from('compliance_audits').select('*').order('scheduled_date', { ascending: false }).limit(5)
      ]);

      if (certRes.data) setCertifications(certRes.data as Certification[]);
      if (auditRes.data) setAudits(auditRes.data);
    } catch (error) {
      console.error('Error loading compliance data:', error);
      toast.error(t('complianceDashboard.erreurChargementDonneesConformite'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    loadData();
    toast.success(t('complianceDashboard.donneesDeConformiteActualisees'));
  };

  const getStatusBadge = (status: Certification['status']) => {
    switch (status) {
      case 'certified':
        return <Badge className="bg-[#ff4000]"><CheckCircle className="w-3 h-3 mr-1" />{t('complianceDashboard.certifie')}</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-500"><Clock className="w-3 h-3 mr-1" />En cours</Badge>;
      case 'planned':
        return <Badge variant="outline"><Calendar className="w-3 h-3 mr-1" />{t('complianceDashboard.planifie')}</Badge>;
      case 'expired':
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />{t('complianceDashboard.expire')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCertIcon = (type: string) => {
    switch (type) {
      case 'iso27001': return '🔐';
      case 'pci_dss': return '💳';
      case 'soc2': return '🛡️';
      case 'gdpr': return '🇪🇺';
      default: return '📋';
    }
  };

  const certifiedCount = certifications.filter(c => c.status === 'certified').length;
  const inProgressCount = certifications.filter(c => c.status === 'in_progress').length;
  const avgProgress = certifications.length > 0
    ? certifications.reduce((sum, c) => sum + c.progress, 0) / certifications.length
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Award className="w-6 h-6 text-primary" />
                Certifications de Conformité
              </CardTitle>
              <CardDescription>
                Normes ISO 27001, PCI-DSS, SOC 2, GDPR - Standards de sécurité internationaux
              </CardDescription>
            </div>
            <Button
              onClick={handleRefresh}
              disabled={loading}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="p-4 rounded-lg border bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-blue-600" />
              <span className="font-semibold">{t('complianceDashboard.programmeDeConformiteActif')}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {certifiedCount} certifications actives • {inProgressCount} en cours •
              Progression globale: {avgProgress.toFixed(0)}%
            </p>
            <Progress value={avgProgress} className="h-2 mt-2" />
          </div>
        </CardContent>
      </Card>

      {/* Métriques */}
      <ResponsiveGrid mobileCols={2} tabletCols={4} desktopCols={4} gap="md">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-8 h-8 text-[#ff4000]" />
              <div>
                <div className="text-2xl font-bold">{certifiedCount}</div>
                <div className="text-xs text-muted-foreground">{t('complianceDashboard.certifiees')}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="w-8 h-8 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{inProgressCount}</div>
                <div className="text-xs text-muted-foreground">En cours</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <FileCheck className="w-8 h-8 text-[#04439e]" />
              <div>
                <div className="text-2xl font-bold">{audits.length}</div>
                <div className="text-xs text-muted-foreground">Audits</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Award className="w-8 h-8 text-[#ff4000]" />
              <div>
                <div className="text-2xl font-bold">{avgProgress.toFixed(0)}%</div>
                <div className="text-xs text-muted-foreground">Progression</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </ResponsiveGrid>

      {/* Certifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            État des Certifications
          </CardTitle>
          <CardDescription>
            Conformité aux normes internationales de sécurité de l'information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {certifications.map((cert) => (
              <div key={cert.id} className="p-4 border rounded-lg space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{getCertIcon(cert.certification_type)}</span>
                    <div>
                      <h4 className="font-semibold">{cert.name}</h4>
                      <p className="text-sm text-muted-foreground">{cert.description}</p>
                    </div>
                  </div>
                  {getStatusBadge(cert.status)}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progression</span>
                    <span className="font-medium">{cert.progress}%</span>
                  </div>
                  <Progress
                    value={cert.progress}
                    className="h-2"
                  />
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  {cert.issuing_authority && (
                    <div className="flex items-center gap-1">
                      <Award className="w-4 h-4" />
                      <span>{cert.issuing_authority}</span>
                    </div>
                  )}
                  {cert.valid_until && (
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>Valide jusqu'au {new Date(cert.valid_until).toLocaleDateString('fr-FR')}</span>
                    </div>
                  )}
                  {cert.valid_from && (
                    <div className="flex items-center gap-1">
                      <CheckCircle className="w-4 h-4 text-[#ff4000]" />
                      <span>Obtenue le {new Date(cert.valid_from).toLocaleDateString('fr-FR')}</span>
                    </div>
                  )}
                </div>

                {cert.certificate_url && (
                  <Button variant="link" size="sm" className="p-0 h-auto">
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Voir le certificat
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Prochains audits */}
      {audits.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="w-5 h-5" />
              Audits de Conformité
            </CardTitle>
            <CardDescription>
              Historique et planification des audits
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {audits.map((audit) => (
                <div key={audit.id} className="p-3 border rounded-lg">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-medium">{audit.audit_type}</h4>
                      <p className="text-sm text-muted-foreground">
                        {audit.auditor_company && `${audit.auditor_company} • `}
                        {audit.scheduled_date && new Date(audit.scheduled_date).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <Badge variant={audit.status === 'completed' ? 'default' : 'outline'}>
                      {audit.status === 'completed' ? 'Terminé' :
                       audit.status === 'scheduled' ? 'Planifié' :
                       audit.status === 'in_progress' ? 'En cours' : audit.status}
                    </Badge>
                  </div>
                  {audit.overall_score && (
                    <div className="mt-2 text-sm">
                      Score: <span className="font-medium text-[#ff4000]">{audit.overall_score}%</span>
                      {audit.non_conformities > 0 && (
                        <span className="ml-2 text-[#ff4000]">• {audit.non_conformities} non-conformités</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline">
              <FileCheck className="w-4 h-4 mr-2" />
              Télécharger les rapports
            </Button>
            <Button variant="outline">
              <Calendar className="w-4 h-4 mr-2" />
              Planifier un audit
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ComplianceDashboard;
