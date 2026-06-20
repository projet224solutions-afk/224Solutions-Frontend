import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  FileSpreadsheet,
  Download,
  Plus,
  BarChart3,
  TrendingUp,
  Users,
  ShoppingBag,
  DollarSign,
  Loader2
} from 'lucide-react';

const reportTypes = [
  { value: 'sales', label: 'Ventes', icon: ShoppingBag, color: 'text-[#ff4000]' },
  { value: 'inventory', label: 'Inventaire', icon: FileSpreadsheet, color: 'text-blue-500' },
  { value: 'finance', label: 'Finance', icon: DollarSign, color: 'text-[#ff4000]' },
  { value: 'customers', label: 'Clients', icon: Users, color: 'text-[#04439e]' },
  { value: 'performance', label: 'Performance', icon: TrendingUp, color: 'text-orange-500' },
  { value: 'custom', label: 'Personnalisé', icon: BarChart3, color: 'text-gray-500' }
];

const exportFormats = [
  { value: 'pdf', label: 'PDF', icon: '📄' },
  { value: 'excel', label: 'Excel', icon: '📊' },
  { value: 'csv', label: 'CSV', icon: '📋' },
  { value: 'json', label: 'JSON', icon: '🔗' }
];

export function CustomReportBuilder() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [template, setTemplate] = useState({
    name: '',
    description: '',
    report_type: 'sales',
    data_sources: [] as string[],
    columns: [] as any[],
    filters: {},
    schedule: 'none'
  });

  const handleGenerateReport = async (format: string) => {
    if (!user) return;

    try {
      setGenerating(true);

      // Créer le template d'abord
      const { data: templateData, error: templateError } = await supabase
        .from('custom_report_templates' as any)
        .insert({
          user_id: user.id,
          ...template
        })
        .select()
        .single();

      if (templateError) throw templateError;

      // Générer le rapport
      const { error: reportError } = await supabase
        .from('generated_reports' as any)
        .insert({
          template_id: (templateData as any).id,
          user_id: user.id,
          report_data: { message: 'Rapport généré avec succès' },
          format,
          generated_at: new Date().toISOString()
        });

      if (reportError) throw reportError;

      toast({
        title: 'Rapport généré',
        description: `Votre rapport ${format.toUpperCase()} est prêt`,
      });
    } catch (error) {
      console.error('Erreur génération rapport:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de générer le rapport',
        variant: 'destructive'
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">{t('customReportBuilder.generateurDeRapportsPersonnalises')}</h2>
          <p className="text-muted-foreground">{t('customReportBuilder.creezDesRapportsSurMesure')}</p>
        </div>
        <Badge className="bg-gradient-to-r from-primary to-primary-glow">
          Premium Feature
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('customReportBuilder.configurationDuRapport')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t('customReportBuilder.nomDuRapport')}</label>
              <Input
                value={template.name}
                onChange={(e) => setTemplate({ ...template, name: e.target.value })}
                placeholder={t('customReportBuilder.exRapportMensuelDesVentes')}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={template.description}
                onChange={(e) => setTemplate({ ...template, description: e.target.value })}
                placeholder={t('customReportBuilder.decrivezLObjectifDeCe')}
                rows={3}
              />
            </div>

            <div>
              <label className="text-sm font-medium">{t('customReportBuilder.typeDeRapport')}</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                {reportTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <Card
                      key={type.value}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        template.report_type === type.value
                          ? 'ring-2 ring-primary'
                          : ''
                      }`}
                      onClick={() => setTemplate({ ...template, report_type: type.value })}
                    >
                      <CardContent className="p-4 text-center space-y-2">
                        <Icon className={`w-8 h-8 mx-auto ${type.color}`} />
                        <p className="text-sm font-medium">{type.label}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Programmation</label>
              <Select
                value={template.schedule}
                onValueChange={(value) => setTemplate({ ...template, schedule: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('customReportBuilder.aucuneManuel')}</SelectItem>
                  <SelectItem value="daily">Quotidien</SelectItem>
                  <SelectItem value="weekly">Hebdomadaire</SelectItem>
                  <SelectItem value="monthly">Mensuel</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Export</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">
              Choisissez le format d'export
            </p>

            {exportFormats.map((format) => (
              <Button
                key={format.value}
                onClick={() => handleGenerateReport(format.value)}
                disabled={generating || !template.name}
                className="w-full justify-start"
                variant="outline"
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <span className="mr-2">{format.icon}</span>
                )}
                {format.label}
              </Button>
            ))}

            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                💡 Les rapports générés seront disponibles pendant 30 jours
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview des données */}
      <Card>
        <CardHeader>
          <CardTitle>{t('customReportBuilder.apercuDesDonnees')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>{t('customReportBuilder.selectionnezLesSourcesDeDonnees')}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
