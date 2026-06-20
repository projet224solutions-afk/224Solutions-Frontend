import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AIInsight {
  type: 'warning' | 'info' | 'success';
  message: string;
  priority: 'high' | 'medium' | 'low';
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const usePDGAIAssistant = () => {
  const [aiActive, setAiActive] = useState(false);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    // Activer l'IA par défaut
    setAiActive(true);
    loadInitialInsights();
  }, []);

  const loadInitialInsights = async () => {
    setLoading(true);
    try {
      // Charger les insights initiaux depuis la base de données
      const { data: fraudLogs } = await supabase
        .from('fraud_detection_logs')
        .select('*')
        .eq('reviewed', false)
        .order('created_at', { ascending: false })
        .limit(5);

      const { data: auditLogs } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      const newInsights: AIInsight[] = [];

      if (fraudLogs && fraudLogs.length > 0) {
        newInsights.push({
          type: 'warning',
          message: `${fraudLogs.length} alertes de fraude non traitées détectées`,
          priority: 'high'
        });
      }

      if (auditLogs && auditLogs.length > 10) {
        newInsights.push({
          type: 'info',
          message: 'Activité administrative élevée détectée',
          priority: 'medium'
        });
      }

      setInsights(newInsights);
    } catch (error) {
      console.error('Erreur chargement insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const analyzeWithAI = async () => {
    setLoading(true);
    try {
      // Récupérer les données récentes pour l'analyse
      const [transactionsRes, ordersRes, usersRes] = await Promise.all([
        supabase.from('wallet_transactions').select('amount, status, created_at').limit(100),
        supabase.from('orders').select('total_amount, status, created_at').limit(100),
        supabase.from('profiles').select('created_at, role').limit(100)
      ]);

      const analysisData = {
        transactions: transactionsRes.data?.length || 0,
        totalRevenue: transactionsRes.data?.reduce((sum, t) => sum + Number(t.amount || 0), 0) || 0,
        orders: ordersRes.data?.length || 0,
        newUsers: usersRes.data?.filter(u => {
          const created = new Date(u.created_at);
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return created > weekAgo;
        }).length || 0
      };

      const prompt = `Analyse les données suivantes de la plateforme 224Solutions et fournis des insights actionnables:

Données récentes (7 derniers jours):
- Transactions: ${analysisData.transactions}
- Revenu total: ${analysisData.totalRevenue} GNF
- Commandes: ${analysisData.orders}
- Nouveaux utilisateurs: ${analysisData.newUsers}

Fournis 3-5 insights avec leur type (warning/info/success) et priorité (high/medium/low).`;

      const { data, error } = await supabase.functions.invoke('pdg-ai-assistant', {
        body: {
          type: 'analyze',
          messages: [{ role: 'user', content: prompt }]
        }
      });

      if (error) throw error;

      // Extraire les insights de la réponse
      if (data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) {
        const args = JSON.parse(data.choices[0].message.tool_calls[0].function.arguments);
        if (args.insights) {
          setInsights(args.insights);
          toast.success(`${args.insights.length} insights générés par l'IA`);
        }
      }
    } catch (error: any) {
      console.error('Erreur analyse IA:', error);
      if (error.message?.includes('429')) {
        toast.error('Limite de taux atteinte. Veuillez réessayer dans quelques instants.');
      } else if (error.message?.includes('402')) {
        toast.error('Crédit IA insuffisant. Veuillez ajouter des crédits.');
      } else {
        toast.error('Erreur lors de l\'analyse IA');
      }
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    const userMessage: Message = { role: 'user', content };
    setMessages(prev => [...prev, userMessage]);
    setIsStreaming(true);

    let assistantContent = '';

    try {
      const { data: session } = await supabase.auth.getSession();
      const accessToken = session?.session?.access_token;

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pdg-ai-assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: 'chat',
          message: content
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          toast.error('Limite de taux atteinte. Veuillez réessayer dans quelques instants.');
          setMessages(prev => prev.slice(0, -1)); // Retirer le message utilisateur
          return;
        }
        if (response.status === 402) {
          toast.error('Crédit IA insuffisant. Veuillez ajouter des crédits.');
          setMessages(prev => prev.slice(0, -1));
          return;
        }
        throw new Error('Erreur lors de la connexion au service IA');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Impossible de lire la réponse');

      const decoder = new TextDecoder();
      let textBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) =>
                    i === prev.length - 1 ? { ...m, content: assistantContent } : m
                  );
                }
                return [...prev, { role: 'assistant', content: assistantContent }];
              });
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }
    } catch (error) {
      console.error('Erreur envoi message:', error);
      toast.error('Erreur lors de l\'envoi du message');
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsStreaming(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const refreshInsights = async () => {
    await analyzeWithAI();
  };

  const toggleAI = () => {
    setAiActive(prev => !prev);
  };

  const clearMessages = () => {
    setMessages([]);
  };

  return {
    aiActive,
    insights,
    loading,
    messages,
    isStreaming,
    refreshInsights,
    toggleAI,
    sendMessage,
    clearMessages,
  };
};
