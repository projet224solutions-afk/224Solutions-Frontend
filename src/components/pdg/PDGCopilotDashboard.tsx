/**
 * 🎯 DASHBOARD COPILOTE PDG
 * Interface de chat pour le PDG
 */

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, Trash2, Brain, TrendingUp, Users, DollarSign } from 'lucide-react';
import { usePDGCopilot, ChatMessage } from '@/hooks/usePDGCopilot';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const PDGCopilotDashboard: React.FC = () => {
  const { user } = useAuth();
  const { messages, loading, error, sendMessage, analyzeVendor, analyzeCustomer, getFinancialSummary, clearMessages } = usePDGCopilot();

  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll vers le bas
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Vérifier que l'utilisateur est PDG/OWNER
  if (user?.role !== 'pdg' && user?.role !== 'owner') {
    return (
      <Alert className="m-4 border-[#ff4000]">
        <AlertDescription>
          ❌ Accès refusé. Cette interface est réservée au PDG/Propriétaire.
        </AlertDescription>
      </Alert>
    );
  }

  const handleSend = async () => {
    if (!inputValue.trim() || loading) return;

    const query = inputValue.trim();
    setInputValue('');
    await sendMessage(query);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = async (action: string) => {
    switch (action) {
      case 'financial-today':
        const today = new Date().toISOString().split('T')[0];
        await getFinancialSummary(today, today);
        break;
      case 'financial-week':
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - 7);
        const weekEnd = new Date();
        await getFinancialSummary(
          weekStart.toISOString().split('T')[0],
          weekEnd.toISOString().split('T')[0]
        );
        break;
      case 'financial-month':
        const monthStart = new Date();
        monthStart.setDate(1);
        const monthEnd = new Date();
        await getFinancialSummary(
          monthStart.toISOString().split('T')[0],
          monthEnd.toISOString().split('T')[0]
        );
        break;
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <Card className="border-blue-500/20 bg-gradient-to-br from-blue-50 to-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Brain className="w-8 h-8 text-blue-600" />
              <div>
                <CardTitle className="text-2xl">Copilote PDG - 224Solutions</CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  Analyse intelligente et insights exécutifs
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={clearMessages}
              className="text-gray-600"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Réinitialiser
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="chat" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="chat">💬 Chat IA</TabsTrigger>
              <TabsTrigger value="quick">⚡ Actions Rapides</TabsTrigger>
            </TabsList>

            {/* TAB CHAT */}
            <TabsContent value="chat" className="space-y-4">
              {/* Messages */}
              <ScrollArea className="h-[500px] w-full rounded-lg border bg-white p-4">
                <div className="space-y-4">
                  {messages.map((msg, index) => (
                    <MessageBubble key={index} message={msg} />
                  ))}
                  {loading && (
                    <div className="flex items-center gap-2 text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Analyse en cours...</span>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Erreur */}
              {error && (
                <Alert className="border-[#ff4000]">
                  <AlertDescription>❌ {error}</AlertDescription>
                </Alert>
              )}

              {/* Input */}
              <div className="flex gap-2">
                <Input
                  placeholder="Entrez un ID vendeur, client ou posez votre question..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={loading}
                  className="flex-1"
                />
                <Button
                  onClick={handleSend}
                  disabled={loading || !inputValue.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Envoyer
                    </>
                  )}
                </Button>
              </div>

              {/* Exemples */}
              <div className="text-xs text-gray-500 space-y-1">
                <p className="font-semibold">💡 Exemples de requêtes :</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>VND-123456 (analyse complète d'un vendeur)</li>
                  <li>CLT-789012 (analyse complète d'un client)</li>
                  <li>"Résumé financier du jour"</li>
                  <li>"Top 10 vendeurs de la semaine"</li>
                  <li>"Clients à risque élevé"</li>
                </ul>
              </div>
            </TabsContent>

            {/* TAB ACTIONS RAPIDES */}
            <TabsContent value="quick" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Finances */}
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <DollarSign className="w-5 h-5 text-[#ff4000]" />
                      Finances
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => handleQuickAction('financial-today')}
                      disabled={loading}
                    >
                      Résumé d'aujourd'hui
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => handleQuickAction('financial-week')}
                      disabled={loading}
                    >
                      Résumé de la semaine
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => handleQuickAction('financial-month')}
                      disabled={loading}
                    >
                      Résumé du mois
                    </Button>
                  </CardContent>
                </Card>

                {/* Performance */}
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                      Performance
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => sendMessage('Top 10 vendeurs du mois')}
                      disabled={loading}
                    >
                      Top 10 vendeurs
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => sendMessage('Vendeurs à faible performance')}
                      disabled={loading}
                    >
                      Vendeurs sous-performants
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => sendMessage('Taux de conversion global')}
                      disabled={loading}
                    >
                      Taux de conversion
                    </Button>
                  </CardContent>
                </Card>

                {/* Risques */}
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Users className="w-5 h-5 text-[#ff4000]" />
                      Risques & Alertes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => sendMessage('Vendeurs à risque élevé')}
                      disabled={loading}
                    >
                      Vendeurs à risque
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => sendMessage('Clients à risque élevé')}
                      disabled={loading}
                    >
                      Clients à risque
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => sendMessage('Litiges en cours')}
                      disabled={loading}
                    >
                      Litiges en cours
                    </Button>
                  </CardContent>
                </Card>

                {/* Clients */}
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Users className="w-5 h-5 text-[#04439e]" />
                      Clients
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => sendMessage('Clients VIP du mois')}
                      disabled={loading}
                    >
                      Clients VIP
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => sendMessage('Nouveaux clients cette semaine')}
                      disabled={loading}
                    >
                      Nouveaux clients
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => sendMessage('Taux de rétention clients')}
                      disabled={loading}
                    >
                      Taux de rétention
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

/**
 * Composant message bubble
 */
const MessageBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-900 border'
        }`}
      >
        <div className="text-sm whitespace-pre-wrap">{message.content}</div>
        <div className={`text-xs mt-2 ${isUser ? 'text-blue-200' : 'text-gray-500'}`}>
          {message.timestamp.toLocaleTimeString('fr-FR')}
        </div>
      </div>
    </div>
  );
};

export default PDGCopilotDashboard;
