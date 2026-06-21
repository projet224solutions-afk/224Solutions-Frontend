import { useState, useRef, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Brain, Zap, TrendingUp, AlertTriangle, CheckCircle, RefreshCw, Send, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { usePDGAIAssistant } from '@/hooks/usePDGAIAssistant';

interface PDGAIAssistantProps {
  mfaVerified: boolean;
}

export default function PDGAIAssistant({ mfaVerified }: PDGAIAssistantProps) {
  const { t } = useTranslation();
  const {
    aiActive,
    insights,
    loading,
    messages,
    isStreaming,
    refreshInsights,
    toggleAI,
    sendMessage,
    clearMessages
  } = usePDGAIAssistant();

  const [analyzing, setAnalyzing] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      await refreshInsights();
      toast.success(t('pDGAIAssistant.analyseIaTerminee'));
    } catch (_error) {
      toast.error(t('pDGAIAssistant.erreurLorsDeLAnalyse'));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isStreaming) return;

    await sendMessage(inputMessage);
    setInputMessage('');
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-[#ff4000]" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-[#ff4000]" />;
      default:
        return <TrendingUp className="w-5 h-5 text-blue-500" />;
    }
  };

  const getInsightBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge className="bg-[#ff4000]">{t('pDGAIAssistant.prioriteHaute')}</Badge>;
      case 'medium':
        return <Badge className="bg-[#ff4000]">{t('pDGAIAssistant.prioriteMoyenne')}</Badge>;
      default:
        return <Badge className="bg-blue-500">{t('pDGAIAssistant.prioriteBasse')}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-[#ff4000] blur-xl opacity-50" />
            <div className="relative bg-[#ff4000] p-3 rounded-2xl">
              <Brain className="w-8 h-8 text-white" />
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-bold">Assistant IA Intelligent</h2>
            <p className="text-muted-foreground mt-1">{t('pDGAIAssistant.analysePredictiveEtRecommandationsAutoma')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={toggleAI}>
            {aiActive ? 'Désactiver IA' : 'Activer IA'}
          </Button>
          <Button onClick={handleAnalyze} disabled={analyzing || !aiActive}>
            <RefreshCw className={`w-4 h-4 mr-2 ${analyzing ? 'animate-spin' : ''}`} />
            Analyser
          </Button>
        </div>
      </div>

      {/* Statut IA */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Statut de l'Assistant IA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-4">
              <div className={`w-3 h-3 rounded-full ${aiActive ? 'bg-[#ff4000] animate-pulse' : 'bg-[#ff4000]'}`} />
              <div>
                <h3 className="font-medium">
                  {aiActive ? 'IA Activée' : 'IA Désactivée'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {aiActive
                    ? 'L\'assistant IA surveille activement la plateforme'
                    : 'L\'assistant IA est en veille'}
                </p>
              </div>
            </div>
            {aiActive && (
              <Badge className="bg-[#04439e]">
                <Brain className="w-3 h-3 mr-1" />
                En ligne
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Insights et Recommandations */}
      {aiActive && (
        <Card>
          <CardHeader>
            <CardTitle>Insights & Recommandations IA ({insights.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {insights.map((insight, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      {getInsightIcon(insight.type)}
                      <div className="flex-1">
                        <p className="font-medium">{insight.message}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Détecté par l'analyse IA automatique
                        </p>
                      </div>
                    </div>
                    {getInsightBadge(insight.priority)}
                  </div>
                ))}
                {insights.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle className="w-12 h-12 mx-auto mb-4 text-[#ff4000]" />
                    <p>{t('pDGAIAssistant.aucunProblemeDetecte')}</p>
                    <p className="text-sm mt-2">{t('pDGAIAssistant.laPlateformeFonctionneNormalement')}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Chat avec l'Assistant IA */}
      {aiActive && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Discussion avec l'Assistant IA
              </CardTitle>
              <Button variant="outline" size="sm" onClick={clearMessages}>
                Effacer
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Zone de messages */}
              <div className="h-[400px] overflow-y-auto border rounded-lg p-4 space-y-4 bg-muted/20">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                    <Brain className="w-12 h-12 mb-4 opacity-50" />
                    <p className="font-medium">{t('pDGAIAssistant.demarrezUneConversation')}</p>
                    <p className="text-sm mt-2">
                      Posez des questions sur la plateforme, demandez des analyses ou des recommandations
                    </p>
                  </div>
                ) : (
                  <>
                    {messages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-3 ${
                            msg.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-card border'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    ))}
                    {isStreaming && (
                      <div className="flex justify-start">
                        <div className="bg-card border rounded-lg p-3">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" />
                            <div className="w-2 h-2 rounded-full bg-primary animate-bounce delay-100" />
                            <div className="w-2 h-2 rounded-full bg-primary animate-bounce delay-200" />
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Input de message */}
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={t('pDGAIAssistant.posezUneQuestionAL')}
                  disabled={isStreaming}
                  className="flex-1"
                />
                <Button type="submit" disabled={isStreaming || !inputMessage.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Capacités IA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('pDGAIAssistant.detectionDeFraude')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Surveillance en temps réel des transactions suspectes
            </p>
            <div className="mt-4">
              <Badge className="bg-[#ff4000]">Actif</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('pDGAIAssistant.analysePredictive')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Prévision des tendances et comportements utilisateurs
            </p>
            <div className="mt-4">
              <Badge className="bg-[#ff4000]">Actif</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Optimisation Auto</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Recommandations d'amélioration des performances
            </p>
            <div className="mt-4">
              <Badge className="bg-[#ff4000]">Actif</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {!mfaVerified && (
        <Card className="border-orange-500/20 bg-orange-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              <p className="text-sm text-orange-500">
                MFA non vérifié - Certaines fonctionnalités IA avancées sont limitées
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
