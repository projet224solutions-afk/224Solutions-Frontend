import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Zap, RefreshCw, Plus } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AIAssistantProps {
  currentText: string;
  contractType: string;
  onTextUpdated: (newText: string) => void;
}

const ASSISTANT_ACTIONS = [
  { value: 'reformuler', label: "Reformuler le texte", icon: RefreshCw },
  { value: 'ameliorer', label: "Améliorer la rédaction", icon: Zap },
  { value: 'ajouter_clauses', label: "Ajouter des clauses", icon: Plus },
];

export default function AIAssistant({ currentText, contractType, onTextUpdated }: AIAssistantProps) {
  const { t } = useTranslation();
  const [action, setAction] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleAssist = async () => {
    if (!action) {
      toast({
        title: t('aIAssistant.selectionnezUneAction'),
        description: t('aIAssistant.choisissezCommentLIaDoit'),
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);

      const prompts: Record<string, string> = {
        reformuler: `Reformule ce texte de contrat de manière plus claire et professionnelle, en gardant toutes les informations importantes:\n\n${currentText}`,
        ameliorer: `Améliore la rédaction juridique de ce contrat, rends-le plus précis et professionnel:\n\n${currentText}`,
        ajouter_clauses: `Ajoute des clauses juridiques pertinentes et standards pour un contrat de type "${contractType}" à ce texte:\n\n${currentText}`,
      };

      const userPrompt = customPrompt || prompts[action];

      const { data, error } = await supabase.functions.invoke('ai-contract-assistant', {
        body: {
          prompt: userPrompt,
          contract_text: currentText,
          contract_type: contractType,
        },
      });

      if (error) throw error;

      if (data?.improved_text) {
        onTextUpdated(data.improved_text);
        toast({
          title: t('aIAssistant.texteAmeliore'),
          description: t('aIAssistant.leContratAEteMis'),
        });
        setCustomPrompt('');
      } else {
        throw new Error('Aucun texte amélioré reçu');
      }
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg">Assistant IA</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger>
              <SelectValue placeholder={t('aIAssistant.queVoulezVousFaire')} />
            </SelectTrigger>
            <SelectContent>
              {ASSISTANT_ACTIONS.map((item) => {
                const Icon = item.icon;
                return (
                  <SelectItem key={item.value} value={item.value}>
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder={t('aIAssistant.instructionsPersonnaliseesOptionnel')}
            className="min-h-[80px]"
          />
        </div>

        <Button onClick={handleAssist} disabled={loading || !action} className="w-full">
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Traitement en cours...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 mr-2" />
              Améliorer avec l'IA
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
