/**
 * Copilote IA pour le module immobilier
 */
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Send, Loader2, Sparkles } from 'lucide-react';
import { backendFetch } from '@/services/backendApi';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface RealEstateCopilotProps {
  stats: {
    totalProperties: number;
    forSale: number;
    forRent: number;
    available: number;
    totalViews: number;
    pendingVisits: number;
    totalContacts: number;
  };
  className?: string;
}

const SUGGESTIONS = [
  'Comment optimiser mes annonces ?',
  'Analyse de mon portefeuille',
  'Conseils pour augmenter les vues',
  'Stratégie de prix',
];

export function RealEstateCopilot({ stats, className }: RealEstateCopilotProps) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // UNIFIÉ sur /api/v2/copilot (service='immobilier') : mêmes capacités cross-service
      // (marketplace, proximité, guide d'app) que Copilot224, + personnalité immobilière.
      const history = messages.slice(-8).map((m) => ({ role: m.role, content: m.content }));
      const res = await backendFetch<{ success?: boolean; reply?: string; products?: any[]; actions?: any[] }>(
        '/api/v2/copilot',
        { method: 'POST', body: { service: 'immobilier', message: messageText, history, context: { service: 'immobilier', stats } } }
      );

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: (res as any)?.reply || 'Désolé, je n\'ai pas pu répondre.',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('Copilot error:', err);
      if (err.message?.includes('402')) {
        toast.error(t('realEstateCopilot.creditsIaInsuffisants'));
      } else if (err.message?.includes('429')) {
        toast.error(t('realEstateCopilot.tropDeRequetesReessayez'));
      } else {
        toast.error(t('realEstateCopilot.erreurDuCopilote'));
      }
    } finally {
      setLoading(false);
    }
  };

  if (!expanded) {
    return (
      <Button
        onClick={() => setExpanded(true)}
        className="fixed bottom-20 right-4 z-50 rounded-full w-14 h-14 shadow-glow bg-primary hover:bg-primary/90"
        size="icon"
      >
        <Bot className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <Card className={`fixed bottom-20 right-4 z-50 w-full max-w-[360px] max-h-[500px] shadow-elegant ${className}`}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Copilote Immobilier
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setExpanded(false)} className="text-xs">
          Réduire
        </Button>
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        {/* Messages */}
        <ScrollArea className="h-[300px] pr-2" ref={scrollRef as any}>
          <div className="space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-6">
                <Bot className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Posez-moi une question sur votre activité immobilière
                </p>
                <div className="flex flex-wrap gap-1.5 justify-center mt-3">
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="text-[11px] px-2 py-1 rounded-full bg-muted hover:bg-accent text-muted-foreground transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none [&>p]:m-0 [&>ul]:m-0 [&>ol]:m-0">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="bg-muted rounded-xl px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <form
          onSubmit={e => { e.preventDefault(); sendMessage(); }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={t('realEstateCopilot.posezVotreQuestion')}
            className="text-sm h-9"
            disabled={loading}
          />
          <Button type="submit" size="icon" className="h-9 w-9" disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
