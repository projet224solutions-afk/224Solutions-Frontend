import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Send, Shield, AlertTriangle, Search } from 'lucide-react';
import { useCopilote } from '@/hooks/useCopilote';

interface PDGCopilotProps {
  mfaVerified: boolean;
}

export default function PDGCopilot({ mfaVerified }: PDGCopilotProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const {
    messages,
    isLoading,
    sendMessage: sendCopilotMessage,
    analyzeSystem
  } = useCopilote();

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    await sendCopilotMessage(input);
    setInput('');
  };

  const handleAnalyzeSystem = async () => {
    if (isLoading) return;
    await analyzeSystem();
  };

  return (
    <div className="space-y-6">
      {/* MFA Warning */}
      {!mfaVerified && (
        <Card className="bg-orange-500/10 border-orange-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-400" />
            <p className="text-orange-300 text-sm">
              MFA non vérifié - Les actions critiques ne seront pas exécutées
            </p>
          </CardContent>
        </Card>
      )}

      {/* Chat Interface */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Copilote IA PDG
            <Badge variant="outline" className="ml-2">
              <Shield className="w-3 h-3 mr-1" />
              Sécurisé
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Messages */}
          <div className="h-96 overflow-y-auto space-y-4 p-4 bg-slate-900/50 rounded-lg">
            {messages.length === 0 && (
              <div className="flex justify-start">
                <div className="bg-slate-700 text-slate-100 p-3 rounded-lg max-w-[80%]">
                  <p className="text-sm">
                    Bonjour ! Je suis votre copilote IA PDG. Je peux analyser automatiquement votre système ou répondre à vos questions. Comment puis-je vous aider ?
                  </p>
                </div>
              </div>
            )}
            {messages.map((msg, idx) => (
              <div
                key={msg.id || idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-primary text-white'
                      : 'bg-slate-700 text-slate-100'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p className="text-xs opacity-50 mt-1">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-700 text-slate-100 p-3 rounded-lg">
                  <div className="flex gap-2">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <Input
              placeholder={t('pDGCopilot.posezVotreQuestion')}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              className="bg-slate-700 border-slate-600 text-white"
              disabled={isLoading}
            />
            <Button onClick={handleSendMessage} disabled={isLoading} className="gap-2">
              <Send className="w-4 h-4" />
              Envoyer
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white text-sm">Actions Rapides</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Analyse automatique */}
            <Button
              onClick={handleAnalyzeSystem}
              disabled={isLoading}
              className="w-full gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
              size="lg"
            >
              <Search className="w-4 h-4" />
              🔍 Analyser automatiquement le système
            </Button>

            {/* Questions rapides */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                'Statistiques utilisateurs',
                'Transactions du jour',
                'Alertes fraude',
                'Commissions actives'
              ].map((action) => (
                <Button
                  key={action}
                  variant="outline"
                  size="sm"
                  onClick={() => setInput(action)}
                  className="text-xs"
                  disabled={isLoading}
                >
                  {action}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
