/**
 * 🤖 COPILOTE 224 - INTERFACE CHATGPT STYLE
 * Interface de chat avec le Copilote IA intégral
 * Connecté à la vraie IA avec contexte spécifique client/vendeur
 * NOUVEAU: Support Copilote Vendeur Enterprise avec analyse complète
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Send,
  Bot,
  User,
  Trash2,
  History,
  Loader2,
  Sparkles,
  MessageSquare,
  Clock,
  X,
  Mic,
  MicOff,
  ScanSearch
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { backendFetch } from '@/services/backendApi';
import { useVendorCopilot } from '@/hooks/useVendorCopilot';
import ReactMarkdown from 'react-markdown';
import { copiloteSearch, type CopiloteSearchResponse } from '@/services/copilote/copiloteSearchService';
import CopiloteSearchResults from '@/components/copilot/CopiloteSearchResults';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  searchResults?: CopiloteSearchResponse;
}

interface UserLocationPayload {
  latitude: number;
  longitude: number;
}

interface UserContext {
  name: string;
  role: string;
  balance: number;
  currency: string;
}

interface CopiloteChatProps {
  className?: string;
  height?: string;
  userRole?: 'client' | 'vendeur' | 'prestataire';
  serviceId?: string;
}

// Générer un ID de session unique pour la conversation
const generateSessionId = () => {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

export default function CopiloteChat({ className = '', height = 'calc(100vh - 140px)', userRole = 'client', serviceId }: CopiloteChatProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [attachedImage, setAttachedImage] = useState<{ name: string; dataUrl: string } | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [vendorAccess, setVendorAccess] = useState<{ loading: boolean; hasVendor: boolean | null }>({
    loading: userRole === 'vendeur',
    hasVendor: userRole === 'vendeur' ? null : true,
  });

  // NOUVEAU: Hook Copilote Vendeur Enterprise
  const vendorCopilot = useVendorCopilot();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [useEnterpriseMode, setUseEnterpriseMode] = useState(false);

  // Microphone
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const transcriptAccumRef = useRef<string>('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const detectIntent = (text: string): string => {
    const query = text.toLowerCase().trim();
    if (!query) return 'conversation_simple';

    // Salutations simples (message court sans produit)
    if (/^(bonjour|salut|hello|bonsoir|coucou|yo|hi|merci|ok|super|parfait|génial)\s*[!?.]?$/.test(query)) return 'conversation_simple';
    if (/photo|image|analyse|reconnai|visuel/.test(query)) return 'analyse_image';

    // Recherche interne — très large pour éviter que l'IA invente des liens
    if (
      // Intentions d'achat / recherche
      /je cherche|trouve.?moi|j.ai besoin|je veux|je voudrais|vous avez|vous vendez|c.est combien|quel prix|prix de|disponible|en stock|acheter|commander|livrer|livraison/.test(query) ||
      // Types de produits / commerce
      /produit|boutique|magasin|shop|vendeur|article|vêtement|téléphone|électronique|électroménager|meuble|chaussure|sac|robe|pantalon|chemise|tissu|cosmétique|parfum|nourriture|épicerie|pharmacie|médicament/.test(query) ||
      // Métiers / services
      /coiffeur|barbier|salon|plombier|électricien|peintre|menuisier|mécanicien|restaurant|café|traiteur|livreur|chauffeur|taxi|moto|coursier|réparation|nettoyage|jardinage|sécurité|prestataire|artisan|technicien/.test(query) ||
      // Marques
      /iphone|samsung|tecno|infinix|itel|oppo|xiaomi|huawei|hp|dell|lenovo|lg|sony|nike|adidas|puma|toyota|honda/.test(query) ||
      // Demandes de liens / adresses
      /lien|url|adresse de|où se trouve|envoie.?moi|donne.?moi|partage|copie.?moi/.test(query) ||
      // Lieux de Guinée
      /matoto|ratoma|lambanyi|kaloum|dixinn|conakry|kindia|kankan|labé|mamou|nzérékoré|boké|faranah|coyah/.test(query)
    ) return 'recherche_interne';

    if (/tendance|marché mondial|prix international|amazon|alibaba|comparaison internationale/.test(query)) return 'recherche_externe';
    if (/comment (utiliser|fonctionne|marche|créer|activer)|étape|tutoriel|wallet|inscription|connexion|mot de passe|solde|publier (un produit|une annonce)/.test(query)) return 'assistant_application';
    if (/business|revenu|opportunité|croissance|marketing|stratégie/.test(query)) return 'assistant_business';
    return 'assistant_application';
  };

  const buildMemorySnapshot = (history: Message[], pendingUserText: string) => {
    // Résumé des 40 derniers échanges — mémoire longue durée
    const recent = history.slice(-40);
    const summary = recent
      .map((m) => `${m.role === 'user' ? 'Utilisateur' : 'Copilote'}: ${m.content.slice(0, 500)}`)
      .join('\n')
      .slice(0, 10000);

    // Tous les messages utilisateur pour extraire les faits importants
    const userUtterances = history
      .filter((m) => m.role === 'user')
      .map((m) => m.content)
      .slice(-40);

    // Faits épinglés — mots-clés élargis pour capturer plus d'infos
    const pinnedFacts = userUtterances
      .filter((entry) =>
        /je veux|mon objectif|je cherche|j'ai besoin|rappelle|important|mon nom|je m'appelle|mon budget|ma ville|j'habite|mon numéro|mon adresse|je suis|je travaille|ma boutique|mon produit|mon problème|je préfère|j'aime/i.test(entry)
      )
      .slice(-20);

    const detectedIntent = detectIntent(pendingUserText);
    return { summary, pinnedFacts, detectedIntent };
  };

  const toDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(String(e.target?.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleAttachImage = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error(t('copiloteChat.veuillezSelectionnerUneImage'));
      return;
    }
    const dataUrl = await toDataUrl(file);
    setAttachedImage({ name: file.name, dataUrl });
  };

  const analyzeAttachedImage = async (dataUrl: string): Promise<{ text: string; keywords: string[]; productName: string }> => {
    setIsAnalyzingImage(true);
    try {
      const response = await backendFetch<{
        success: boolean;
        name: string;
        description: string;
        keywords: string[];
        category: string;
        confidence: number;
      }>('/edge-functions/copilote/analyze-image', {
        method: 'POST',
        body: { imageBase64: dataUrl },
      });

      if (!response.success || !response.data) throw new Error('Analyse échouée');

      const { name, description, keywords } = response.data;
      const safeKeywords = keywords.length > 0 ? keywords : (name ? [name] : []);

      return {
        text: `Produit détecté : ${name}. ${description}. Recherche: ${safeKeywords.join(', ')}.`,
        keywords: safeKeywords,
        productName: name,
      };
    } catch (error) {
      console.error('Erreur analyse image copilote:', error);
      return {
        text: 'Photo jointe. Aide l\'utilisateur à trouver un produit similaire.',
        keywords: [],
        productName: '',
      };
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  const getCurrentUserLocation = async (): Promise<UserLocationPayload | null> => {
    if (!navigator.geolocation) return null;

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => resolve(null), 2500);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timeoutId);
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        () => {
          clearTimeout(timeoutId);
          resolve(null);
        },
        {
          enableHighAccuracy: false,
          timeout: 2000,
          maximumAge: 5 * 60 * 1000,
        }
      );
    });
  };

  const extractSourceLabel = (content: string): string | null => {
    const match = content.match(/\[Source principale:\s*([^\]]+)\]/i);
    if (match?.[1]) return match[1].trim();

    const normalized = content.toLowerCase();
    if (normalized.includes('recherche web') || normalized.includes('duckduckgo') || normalized.includes('wikipedia')) {
      return 'Source : recherche web';
    }
    if (normalized.includes('produit') || normalized.includes('catalogue')) {
      return 'Source : catalogue 224SOLUTIONS';
    }
    if (normalized.includes('service proche') || normalized.includes('distance') || normalized.includes('proximite')) {
      return 'Source : services proches';
    }
    if (normalized.includes('wallet') || normalized.includes('commande') || normalized.includes('votre compte')) {
      return 'Source : votre compte';
    }
    return null;
  };

  // Initialiser ou récupérer le session ID
  useEffect(() => {
    const storageKey = `copilote-session-${userRole}-${user?.id || 'anonymous'}`;
    let existingSession = sessionStorage.getItem(storageKey);

    if (!existingSession) {
      existingSession = generateSessionId();
      sessionStorage.setItem(storageKey, existingSession);
    }

    setSessionId(existingSession);
    console.log(`📍 Copilote session: ${existingSession}`);
  }, [userRole, user?.id]);

  // Synchroniser les messages du vendorCopilot avec l'état local en mode Enterprise
  // IMPORTANT: on utilise un merge ADDITIF (append) pour préserver l'historique chargé depuis localStorage
  useEffect(() => {
    if (!useEnterpriseMode) return;
    // Ignorer le message système initial — ne pas écraser l'historique chargé
    const realMsgs = vendorCopilot.messages.filter(m => m.id !== 'welcome' && m.role !== 'system');
    if (realMsgs.length === 0) return;

    const newMapped: Message[] = realMsgs.map(msg => ({
      id: msg.id,
      role: (msg.role === 'system' ? 'assistant' : msg.role) as 'user' | 'assistant',
      content: msg.content,
      timestamp: msg.timestamp.toISOString(),
    }));

    // Dernier message assistant pour auto-search
    const last = newMapped[newMapped.length - 1];
    const shouldAutoSearch =
      last?.role === 'assistant' &&
      !/\]\(\/marketplace\/|\]\(\/shop\/|\]\(\/services-proximite\//.test(last.content) &&
      /produit|boutique|service|trouv|cherch|disponible|vend|acheter|stock|prix/i.test(last.content);

    // Merge additif : ajouter seulement les messages absents de l'état actuel
    setMessages(prev => {
      const existingIds = new Set(prev.map(m => m.id));
      const toAdd = newMapped.filter(m => {
        if (existingIds.has(m.id)) return false;
        // Éviter les doublons de messages utilisateur (l'IA et l'affichage immédiat ont des IDs différents)
        if (m.role === 'user' && prev.some(e => e.role === 'user' && e.content === m.content)) return false;
        return true;
      });
      if (toAdd.length === 0) return prev;
      const combined = [...prev, ...toAdd];
      // Sauvegarder dans localStorage pour la prochaine actualisation
      try { localStorage.setItem(historyKey, JSON.stringify(combined)); } catch {}
      return combined;
    });

    // Auto-search sur le dernier message assistant
    if (shouldAutoSearch && last) {
      const lastUser = [...newMapped].reverse().find(m => m.role === 'user');
      if (lastUser?.content) {
        copiloteSearch(lastUser.content, null)
          .then(autoSearch => {
            if (autoSearch.total > 0) {
              setMessages(prev => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                if (lastIdx >= 0 && updated[lastIdx].role === 'assistant' && updated[lastIdx].id === last.id) {
                  updated[lastIdx] = { ...updated[lastIdx], searchResults: autoSearch };
                }
                return updated;
              });
            }
          })
          .catch(() => {});
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useEnterpriseMode, vendorCopilot.messages]);

  // Initialiser le message de bienvenue au chargement
  useEffect(() => {
    if (messages.length === 0 && userRole === 'vendeur' && !useEnterpriseMode) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: '👋 Bienvenue dans votre espace vendeur ! Je peux analyser vos ventes, optimiser votre inventaire ou répondre à vos questions sur votre boutique. Dites-moi ce que vous souhaitez faire.',
        timestamp: new Date().toISOString(),
      }]);
    } else if (messages.length === 0 && userRole === 'client') {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: '👋 Bienvenue ! Je suis votre conseiller 224Solutions. Je peux vous aider avec votre compte, vos transactions, vos commandes ou vos achats. Dites-moi ce dont vous avez besoin.',
        timestamp: new Date().toISOString(),
      }]);
    }
  }, [userRole, useEnterpriseMode, messages.length]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      loadHistory();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, userRole]);

  // Vérifie si l'utilisateur connecté est bien associé à un vendeur (table vendors)
  useEffect(() => {
    let cancelled = false;

    const checkVendorAccess = async () => {
      if (userRole !== 'vendeur') {
        if (!cancelled) setVendorAccess({ loading: false, hasVendor: true });
        return;
      }

      if (!user?.id) {
        if (!cancelled) setVendorAccess({ loading: false, hasVendor: false });
        return;
      }

      try {
        const baseQuery = supabase.from('vendors').select('id').eq('user_id', user.id);
        const res = (baseQuery as any).maybeSingle
          ? await (baseQuery as any).maybeSingle()
          : await baseQuery.single();

        if (!cancelled) {
          const hasVendor = !!res?.data;
          setVendorAccess({ loading: false, hasVendor });

          // NOUVEAU: Si vendeur trouvé, activer mode Enterprise et stocker l'ID
          if (hasVendor && res.data?.id) {
            setVendorId(res.data.id);
            setUseEnterpriseMode(true);
          }
        }
      } catch {
        if (!cancelled) setVendorAccess({ loading: false, hasVendor: false });
      }
    };

    setVendorAccess({ loading: userRole === 'vendeur', hasVendor: userRole === 'vendeur' ? null : true });
    checkVendorAccess();

    return () => {
      cancelled = true;
    };
  }, [userRole, user?.id]);

  // Clé unique par utilisateur — évite de mélanger les historiques
  const historyKey = `copilote-history-${userRole}-${user?.id || 'anonymous'}`;

  const loadHistory = async () => {
    try {
      const savedHistory = localStorage.getItem(historyKey);
      if (savedHistory) {
        const history = JSON.parse(savedHistory);
        setMessages(history);
      }
    } catch (error) {
      console.error('Erreur lors du chargement de l\'historique:', error);
    }
  };

  // ── Microphone — MediaRecorder + transcription Gemini (fonctionne sans HTTPS strict) ──
  const toggleMic = async () => {
    // Arrêter si déjà en cours
    if (isListening) {
      mediaRecorderRef.current?.stop();
      recognitionRef.current?.stop();
      setIsListening(false);
      setInterimTranscript('');
      return;
    }

    // 1. Essayer Web Speech API en premier (plus rapide, temps réel)
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition && window.isSecureContext) {
      transcriptAccumRef.current = '';
      const recognition = new SpeechRecognition();
      recognition.lang = 'fr-FR';
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
        setInterimTranscript('');
        toast.info(t('copiloteChat.jeVousEcoute'), { duration: 2000 });
      };
      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) final += event.results[i][0].transcript;
          else interim += event.results[i][0].transcript;
        }
        if (final) {
          transcriptAccumRef.current = (transcriptAccumRef.current + ' ' + final).trim();
          setInput(transcriptAccumRef.current);
          setInterimTranscript('');
        } else {
          setInterimTranscript(interim);
        }
      };
      recognition.onerror = (event: any) => {
        setIsListening(false);
        setInterimTranscript('');
        transcriptAccumRef.current = '';
        if (event.error === 'not-allowed') {
          toast.error(t('copiloteChat.accesAuMicrophoneRefuseAutorisez'));
        } else if (event.error === 'network') {
          // Web Speech API échoue sur réseau → basculer vers MediaRecorder
          toast.info('🎙️ Basculement vers enregistrement audio…', { duration: 1500 });
          startMediaRecorder();
        } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
          toast.error(`Microphone : ${event.error}`);
        }
      };
      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
        const captured = transcriptAccumRef.current.trim();
        transcriptAccumRef.current = '';
        if (captured) sendMessage(captured);
      };
      recognition.start();
      recognitionRef.current = recognition;
      return;
    }

    // 2. Fallback MediaRecorder → transcription Gemini backend
    startMediaRecorder();
  };

  const startMediaRecorder = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setIsListening(false);
        setInterimTranscript('Transcription en cours…');

        try {
          const blob = new Blob(audioChunksRef.current, { type: mimeType });
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(String(e.target?.result ?? ''));
            reader.readAsDataURL(blob);
          });

          const resp = await backendFetch<{ success: boolean; text: string }>(
            '/edge-functions/copilote/transcribe',
            { method: 'POST', body: { audioBase64: base64, mimeType } }
          );

          setInterimTranscript('');
          const text = ((resp.data?.text ?? (resp as any).text) ?? '').trim();
          if (text) {
            setInput(text);
            sendMessage(text);
          } else {
            toast.error(t('copiloteChat.transcriptionVideReessayezEnParlant'));
          }
        } catch {
          setInterimTranscript('');
          toast.error(t('copiloteChat.transcriptionEchoueeTapezVotreMessage'));
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsListening(true);
      setInterimTranscript('');
      toast.info(t('copiloteChat.enregistrementCliquezANouveauPour'), { duration: 3000 });
    } catch (err: any) {
      setIsListening(false);
      if (err?.name === 'NotAllowedError') {
        toast.error(t('copiloteChat.accesAuMicrophoneRefuseAutorisez'));
      } else {
        toast.error(t('copiloteChat.microphoneIndisponibleSurCetAppareil'));
      }
    }
  };

  // Nettoyage à la fermeture du composant
  React.useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      mediaRecorderRef.current?.stop();
    };
  }, []);

  const sendMessage = async (voiceText?: string) => {
    const effectiveInput = voiceText ?? input;
    console.log('📤 Copilote: Envoi message, isLoading =', isLoading);
    if ((!effectiveInput.trim() && !attachedImage) || isLoading || (userRole === 'vendeur' && vendorCopilot.loading)) return;

    // Copie brute de l'input utilisateur — utilisée pour l'auto-search après réponse IA
    const userInputForSearch = effectiveInput.trim();

    // ── Analyse image (une seule fois) + tentative de recherche produit ───────
    let messageToSend = effectiveInput.trim();
    if (attachedImage) {
      const imageResult = await analyzeAttachedImage(attachedImage.dataUrl);
      messageToSend = `${messageToSend || 'Analyse cette image et aide-moi'}\n\n[CONTEXTE_IMAGE]\n${imageResult.text}`;

      if (imageResult.keywords.length > 0) {
        setIsLoading(true);
        setIsTyping(true);
        try {
          const userLocation = await getCurrentUserLocation();
          const searchData = await copiloteSearch(imageResult.keywords.join(' '), userLocation);

          if (searchData.total > 0) {
            const userMsg: Message = {
              id: Date.now().toString(),
              role: 'user',
              content: effectiveInput.trim() || `📷 ${imageResult.productName || 'Recherche par image'}`,
              timestamp: new Date().toISOString(),
            };
            const label = imageResult.productName
              ? `"${imageResult.productName}"`
              : `"${imageResult.keywords.slice(0, 3).join(', ')}"`;
            const assistantMsg: Message = {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: `J'ai reconnu ${label} sur votre photo. Voici les produits similaires disponibles sur le marketplace :`,
              timestamp: new Date().toISOString(),
              searchResults: searchData,
            };
            setInput('');
            setAttachedImage(null);
            setMessages(prev => [...prev, userMsg, assistantMsg]);
            setIsLoading(false);
            setIsTyping(false);
            const storageKey = historyKey;
            setMessages(prev => { localStorage.setItem(storageKey, JSON.stringify(prev)); return prev; });
            return;
          }
        } catch {
          // Pas de résultats ou erreur → continuer vers l'IA
        }
        setIsLoading(false);
        setIsTyping(false);
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ── Interception recherche interne (TOUS rôles, avant Enterprise) ─────────
    const intentForSearch = detectIntent(messageToSend);
    if (intentForSearch === 'recherche_interne') {
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: messageToSend,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, userMessage]);
      setInput('');
      setAttachedImage(null);
      setIsLoading(true);
      setIsTyping(true);

      try {
        const userLocation = await getCurrentUserLocation();
        const searchData = await copiloteSearch(messageToSend, userLocation);

        const assistantMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: searchData.message,
          timestamp: new Date().toISOString(),
          searchResults: searchData,
        };
        setMessages(prev => [...prev, assistantMsg]);

        const storageKey = historyKey;
        setMessages(prev => {
          localStorage.setItem(storageKey, JSON.stringify(prev));
          return prev;
        });
        return;
      } catch (searchErr) {
        // Échec silencieux → on continue vers l'IA classique
        console.warn('[Copilote Search] Échec, fallback IA:', searchErr);
        setMessages(prev => prev.slice(0, -1)); // Retirer le message utilisateur déjà ajouté
        setIsLoading(false);
        setIsTyping(false);
        // On laisse la suite du code le ré-ajouter et appeler l'IA
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    // Mode Enterprise pour vendeur
    if (userRole === 'vendeur' && useEnterpriseMode && vendorId) {
      const history = messages.filter(m => m.id !== 'welcome').slice(-50);
      const memory = buildMemorySnapshot(history, messageToSend);
      setInput('');
      setAttachedImage(null);
      setIsLoading(true);
      setIsTyping(true);

      // Afficher le message utilisateur immédiatement sans attendre l'IA
      const immediateUserMsg: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: messageToSend,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => {
        const updated = [...prev, immediateUserMsg];
        try { localStorage.setItem(historyKey, JSON.stringify(updated)); } catch {}
        return updated;
      });

      try {
        await vendorCopilot.processQuery(messageToSend, vendorId, {
          memorySummary: memory.summary,
          pinnedFacts: memory.pinnedFacts,
          detectedIntent: memory.detectedIntent
        });
      } catch (err: any) {
        console.error('❌ Erreur Copilote Enterprise:', err);
        toast.error(err.message || 'Erreur lors de l\'analyse');
      } finally {
        setIsLoading(false);
        setIsTyping(false);
      }
      return;
    }

    // Mode standard (edge function)
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (userRole === 'vendeur' && !accessToken) {
      toast.error(t('copiloteChat.veuillezVousConnecterPourUtiliser'));
      return;
    }

    // 🔐 Copilote vendeur: on laisse l'edge function décider (permet auto-association si boutique existante)
    // (La vérification locale sert surtout à l'UX, mais ne doit pas bloquer un compte qui vient d'être lié)


    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageToSend,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setAttachedImage(null);
    setIsLoading(true);
    setIsTyping(true);

    try {
      const userLocation = await getCurrentUserLocation();

      // Déterminer quelle edge function appeler selon le rôle
      const functionName =
        userRole === 'vendeur'
          ? 'vendor-ai-assistant'
          : userRole === 'prestataire'
          ? 'service-ai-assistant'
          : 'client-ai-assistant';

      console.log(`🤖 Calling ${functionName} for ${userRole}...`);

      // Appel à l'edge function avec streaming
      const functionsBaseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      // Préparer l'historique (50 derniers messages pour le contexte long)
      // Exclure le message de bienvenue initial (id='welcome')
      const historyMessages = messages
        .filter(m => m.id !== 'welcome')
        .slice(-50)
        .map(m => ({ role: m.role, content: m.content }));

      // Ajouter le nouveau message utilisateur
      const conversationMessages = [
        ...historyMessages,
        { role: 'user', content: userMessage.content }
      ];
      const memory = buildMemorySnapshot(messages.filter(m => m.id !== 'welcome'), userMessage.content);

      console.log(`📜 Sending ${conversationMessages.length} messages to AI (history: ${historyMessages.length}, session: ${sessionId})`);

      const response = await fetch(
        `${functionsBaseUrl}/${functionName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseAnonKey,
            ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({
            message: userMessage.content,
            messages: conversationMessages,
            sessionId: sessionId,
            userRole: userRole,
            ...(userRole === 'prestataire' && serviceId ? { serviceId } : {}),
            memorySummary: memory.summary,
            pinnedFacts: memory.pinnedFacts,
            detectedIntent: memory.detectedIntent,
            hasImageAttachment: userMessage.content.includes('[CONTEXTE_IMAGE]'),
            userLocation,
          }),
        }
      );

      if (!response.ok) {
        // Essayer de remonter un message précis renvoyé par l'edge function
        const errJson = await response.json().catch(() => null);
        const errMsg = (errJson as any)?.error;

        if (response.status === 401) {
          if (
            userRole === 'vendeur' &&
            typeof errMsg === 'string' &&
            errMsg.toLowerCase().includes('vendeur non trouvé')
          ) {
            setVendorAccess({ loading: false, hasVendor: false });
            throw new Error("Votre compte n'est pas associé à une boutique (vendeur introuvable). Connectez-vous avec un compte vendeur ou créez votre boutique.");
          }
          throw new Error(errMsg || 'Non autorisé. Vérifiez que vous êtes connecté et que votre compte est bien un vendeur.');
        }
        if (response.status === 403) {
          throw new Error(errMsg || 'Accès refusé.');
        }
        if (response.status === 429) {
          throw new Error(errMsg || 'Limite de requêtes atteinte. Veuillez réessayer dans quelques instants.');
        }
        if (response.status === 402) {
          throw new Error(errMsg || 'Crédits insuffisants pour l\'IA.');
        }

        throw new Error(errMsg || 'Erreur de communication avec l\'IA');
      }

      // Parser le stream SSE
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString()
      };

      // Ajouter le message assistant vide pour le streaming
      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);

      if (reader) {
        let textBuffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          textBuffer += decoder.decode(value, { stream: true });

          // Traiter ligne par ligne
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
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) {
                assistantContent += content;
                // Mettre à jour le dernier message assistant
                setMessages(prev => {
                  const updated = [...prev];
                  const lastIndex = updated.length - 1;
                  if (lastIndex >= 0 && updated[lastIndex].role === 'assistant') {
                    updated[lastIndex] = { ...updated[lastIndex], content: assistantContent };
                  }
                  return updated;
                });
              }
            } catch {
              // JSON incomplet, attendre plus de données
              textBuffer = line + '\n' + textBuffer;
              break;
            }
          }
        }
      }

      // ── Auto-search : si l'IA n'a inclus aucun lien interne mais parle de produits/boutiques ──
      const hasInternalLinks = /\]\(\/marketplace\/|\]\(\/shop\/|\]\(\/services-proximite\//.test(assistantContent);
      const looksSearchable = /produit|boutique|service|trouv|cherch|disponible|vend|acheter|stock|prix/i.test(assistantContent);

      if (!hasInternalLinks && looksSearchable && userInputForSearch) {
        try {
          const userLoc = await getCurrentUserLocation();
          const autoSearch = await copiloteSearch(userInputForSearch, userLoc);
          if (autoSearch.total > 0) {
            setMessages(prev => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                updated[lastIdx] = { ...updated[lastIdx], searchResults: autoSearch };
              }
              return updated;
            });
          }
        } catch { /* silent */ }
      }
      // ────────────────────────────────────────────────────────────────────────

      // Sauvegarder l'historique
      const storageKey = historyKey;
      setMessages(prev => {
        localStorage.setItem(storageKey, JSON.stringify(prev));
        return prev;
      });

      setUserContext({
        name: user?.email?.split('@')[0] || 'Utilisateur',
        role: userRole === 'vendeur' ? 'Vendeur' : 'Client',
        balance: 0,
        currency: 'GNF'
      });

    } catch (error) {
      console.error('Erreur:', error);

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: error instanceof Error ? error.message : 'Désolé, je rencontre une difficulté technique. Veuillez réessayer.',
        timestamp: new Date().toISOString()
      };

      setMessages(prev => {
        // Si le dernier message est un assistant vide du streaming, le remplacer
        if (prev.length > 0 && prev[prev.length - 1].role === 'assistant' && prev[prev.length - 1].content === '') {
          return [...prev.slice(0, -1), errorMessage];
        }
        return [...prev, errorMessage];
      });
      toast.error(error instanceof Error ? error.message : 'Erreur de communication avec le Copilote');
    } finally {
      console.log('🔄 Copilote: Fin du traitement');
      setIsLoading(false);
      setIsTyping(false);
    }
  };

  const clearHistory = async () => {
    try {
      if (userRole === 'vendeur' && useEnterpriseMode) {
        // Mode Enterprise: utiliser le hook vendeur
        vendorCopilot.clearMessages();
        setMessages([]);
      } else {
        // Mode standard
        setMessages([]);
        setUserContext(null);
        const storageKey = historyKey;
        localStorage.removeItem(storageKey);
      }

      // Générer une nouvelle session après effacement
      const sessionKey = `copilote-session-${userRole}-${user?.id || 'anonymous'}`;
      const newSession = generateSessionId();
      sessionStorage.setItem(sessionKey, newSession);
      setSessionId(newSession);
      setAttachedImage(null);
      console.log(`🔄 Nouvelle session créée: ${newSession}`);

      toast.success(t('copiloteChat.conversationReinitialisee'));
    } catch (error) {
      console.error('Erreur lors de l\'effacement:', error);
      toast.error(t('copiloteChat.erreurLorsDeLEffacement'));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Aujourd\'hui';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Hier';
    } else {
      return date.toLocaleDateString('fr-FR');
    }
  };

  const roleLabel = userRole === 'vendeur' ? 'Vendeur' : 'Client';
  const roleColor = userRole === 'vendeur' ? 'from-primary to-brand-blue-deep' : 'from-vendeur-secondary to-brand-orange-dark';

  // Regex UUID v4
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // Renderer Markdown avec liens intelligents (interne React Router vs externe)
  const markdownComponents = {
    a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
      if (!href) return <span>{children}</span>;

      // Normaliser une URL absolue vers notre app en chemin relatif
      let path = href;
      if (!href.startsWith('/')) {
        try {
          const parsed = new URL(href);
          if (
            parsed.hostname === window.location.hostname ||
            /224solutions\.(com|app|fr|co|net)/i.test(parsed.hostname)
          ) {
            path = parsed.pathname + parsed.search + parsed.hash;
          } else {
            // Lien vraiment externe
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:opacity-80 break-all">
                {children}
              </a>
            );
          }
        } catch {
          return (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:opacity-80 break-all">
              {children}
            </a>
          );
        }
      }

      // Valider les liens produits : l'IA invente parfois des UUIDs inexistants
      const productId = path.match(/^\/marketplace\/product\/([^/?#]+)/)?.[1];
      const shopId = path.match(/^\/shop\/([^/?#]+)/)?.[1];

      if (productId && !UUID_RE.test(productId)) {
        // UUID invalide généré par l'IA — ne pas naviguer
        return <span className="text-muted-foreground line-through text-xs italic" title={t('copiloteChat.lienProduitNonValide')}>{children}</span>;
      }
      if (shopId && !UUID_RE.test(shopId)) {
        // Slug/slug invalide — ne pas naviguer
        return <span className="text-muted-foreground line-through text-xs italic" title={t('copiloteChat.boutiqueNonTrouvee')}>{children}</span>;
      }

      return (
        <Link to={path} className="text-primary underline hover:opacity-80 break-words">
          {children}
        </Link>
      );
    },
  };

  return (
    <Card className={`flex flex-col w-full ${className}`} style={{ height }}>
      <CardHeader className="pb-3 px-3 sm:px-8 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="relative flex-shrink-0">
              <Avatar className={`h-10 w-10 sm:h-14 sm:w-14 bg-gradient-to-br ${roleColor}`}>
                <AvatarImage src="/copilote-avatar.png" alt="Copilote 224" />
                <AvatarFallback>
                  <Bot className="h-5 w-5 sm:h-7 sm:w-7 text-white" />
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-[#ff4000] rounded-full border-2 border-background"></div>
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base sm:text-2xl flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500 flex-shrink-0" />
                <span className="truncate">Copilote 224</span>
                <Badge variant="outline" className="text-xs sm:text-sm flex-shrink-0">{roleLabel}</Badge>
              </CardTitle>
              <p className="text-xs sm:text-base text-muted-foreground truncate">
                Assistant IA dédié {roleLabel.toLowerCase()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowHistory(!showHistory)}
              className="h-9 w-9 sm:h-11 sm:w-11 text-muted-foreground hover:text-foreground"
            >
              <History className="h-4 w-4 sm:h-6 sm:w-6" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={clearHistory}
              className="h-9 w-9 sm:h-11 sm:w-11 text-muted-foreground hover:text-[#ff4000]"
            >
              <Trash2 className="h-4 w-4 sm:h-6 sm:w-6" />
            </Button>
          </div>
        </div>

        {userContext && (
          <div className="mt-2 p-2 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-xs sm:text-sm flex-wrap">
              <Badge variant="secondary" className="text-xs sm:text-sm">{userContext.role}</Badge>
              <span className="text-muted-foreground truncate">
                {userContext.name} • {userContext.balance} {userContext.currency}
              </span>
            </div>
          </div>
        )}
      </CardHeader>

      <Separator />

      <CardContent className="flex-1 p-0 overflow-hidden min-h-0">
        <ScrollArea className="h-full px-4 py-5 sm:px-8 sm:py-6">
          <div className="space-y-5 sm:space-y-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center">
                <MessageSquare className="h-16 w-16 sm:h-20 sm:w-20 text-muted-foreground mb-6" />
                <h3 className="text-xl sm:text-3xl font-semibold mb-3 sm:mb-4">Bienvenue chez Copilote 224</h3>
                <p className="text-sm sm:text-lg text-muted-foreground mb-5 sm:mb-6 px-2 sm:px-0">
                  {userRole === 'vendeur'
                    ? useEnterpriseMode
                      ? '🚀 Je suis votre IA ENTERPRISE de 224Solutions. Je peux analyser en profondeur TOUTE votre interface vendeur.'
                      : 'Je suis votre assistant pour gérer votre boutique, produits et ventes.'
                    : 'Je suis votre assistant pour vos achats, commandes et wallet.'}
                </p>
                <div className="grid grid-cols-1 gap-2.5 sm:gap-4 text-sm sm:text-lg text-muted-foreground px-2 sm:px-0">
                  {userRole === 'vendeur' ? (
                    useEnterpriseMode ? (
                      <>
                        <div className="flex items-center space-x-2">
                          <span>📊</span>
                          <span>{t('copiloteChat.analyseCompleteDeLInterface')}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span>💡</span>
                          <span>{t('copiloteChat.recommandationsIntelligentesBaseesSurVos')}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span>📈</span>
                          <span>{t('copiloteChat.tableauxDeBordEtInsights')}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span>🎯</span>
                          <span>{t('copiloteChat.scoresDeSanteEtAlertes')}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center space-x-2">
                          <span>📦</span>
                          <span>{t('copiloteChat.gestionDesProduits')}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span>📊</span>
                          <span>{t('copiloteChat.analyseDesVentes')}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span>👥</span>
                          <span>{t('copiloteChat.gestionDesClients')}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span>💰</span>
                          <span>{t('copiloteChat.financesEtPaiements')}</span>
                        </div>
                      </>
                    )
                  ) : (
                    <>
                      <div className="flex items-center space-x-2">
                        <span>💬</span>
                        <span>{t('copiloteChat.chatEnTempsReel')}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span>💰</span>
                        <span>{t('copiloteChat.gestionDeVotreWallet')}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span>📦</span>
                        <span>{t('copiloteChat.suiviDesCommandes')}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span>🔧</span>
                        <span>Aide technique</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {messages.map((message, index) => {
              const isUser = message.role === 'user';
              const showDate = index === 0 ||
                formatDate(messages[index - 1].timestamp) !== formatDate(message.timestamp);

              return (
                <div key={message.id}>
                  {showDate && (
                    <div className="flex items-center justify-center my-6">
                      <Badge variant="outline" className="text-xs sm:text-sm">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatDate(message.timestamp)}
                      </Badge>
                    </div>
                  )}

                  <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-6 sm:mb-8`}>
                    <div className={`flex items-start gap-3 sm:gap-4 ${isUser ? 'flex-row-reverse max-w-[85%] sm:max-w-[80%]' : 'max-w-full w-full'}`}>
                      <Avatar className={`h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 ${isUser ? 'bg-primary' : 'bg-[#04439e]'}`}>
                        {isUser ? (
                          <AvatarFallback>
                            <User className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                          </AvatarFallback>
                        ) : (
                          <AvatarFallback>
                            <Bot className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                          </AvatarFallback>
                        )}
                      </Avatar>

                      <div className={`rounded-xl px-4 py-4 sm:px-6 sm:py-5 min-w-0 ${
                        isUser
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}>
                        {/* NOUVEAU: Support Markdown pour mode Enterprise */}
                        {!isUser && extractSourceLabel(message.content) && !message.searchResults && (
                          <div className="mb-3">
                            <Badge variant="secondary" className="text-xs sm:text-sm">
                              {extractSourceLabel(message.content)}
                            </Badge>
                          </div>
                        )}

                        {/* ── Résultats de recherche Copilote ── */}
                        {!isUser && message.searchResults ? (
                          <div className="space-y-2">
                            {message.content && (
                              <p className="text-[13px] sm:text-sm text-muted-foreground mb-2 whitespace-pre-wrap">
                                {message.content.replace(/\*\*/g, '')}
                              </p>
                            )}
                            <CopiloteSearchResults data={message.searchResults} />
                          </div>
                        ) : !isUser ? (
                          <div className="prose prose-base dark:prose-invert max-w-none text-sm sm:text-base leading-relaxed [&_p]:mb-3 [&_ul]:my-2 [&_li]:my-1.5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-3 [&_a]:break-all [&_*]:max-w-full">
                            <ReactMarkdown components={markdownComponents as any}>{message.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
                        )}
                        <p className="text-xs sm:text-sm mt-2 opacity-70">
                          {new Date(message.timestamp).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {isTyping && (
              <div className="flex justify-start mb-4">
                <div className="flex items-start space-x-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className={`bg-gradient-to-br ${roleColor} text-white`}>
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-muted rounded-2xl px-4 py-3">
                    <div className="flex items-center space-x-1">
                      <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin" />
                      <span className="text-base sm:text-lg text-muted-foreground">{t('copiloteChat.copilote224Reflechit')}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </CardContent>

      <Separator />

      <div className="mt-auto sticky bottom-0 px-2.5 py-2.5 sm:px-8 sm:py-5 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
        {userRole === 'vendeur' && vendorAccess.hasVendor === false && (
          <div className="mb-4 rounded-lg border border-border bg-muted/50 p-4 text-sm sm:text-base">
            <div className="font-medium">{t('copiloteChat.accesVendeurRequis')}</div>
            <div className="text-muted-foreground">
              Votre compte n'est pas associé à une boutique.
            </div>
          </div>
        )}

        <div
          className={`space-y-3 sm:space-y-5 rounded-lg transition-colors ${isDragOver ? 'bg-muted/40' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            handleAttachImage(e.dataTransfer.files?.[0]);
          }}
        >
          {/* Aperçu image jointe */}
          {attachedImage && (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
              <div className="w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
                <img
                  src={attachedImage.dataUrl}
                  alt={t('copiloteChat.apercu')}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <ScanSearch className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                  <span className="text-xs font-medium truncate">
                    {isAnalyzingImage ? 'Analyse en cours…' : 'Recherche par image active'}
                  </span>
                  {isAnalyzingImage && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{attachedImage.name}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => setAttachedImage(null)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {/* Transcription intermédiaire microphone */}
          {isListening && interimTranscript && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-50 dark:bg-[#ff4000]/30 border border-orange-200 dark:border-[#ff4000]">
              <span className="w-2 h-2 bg-[#ff4000] rounded-full animate-pulse flex-shrink-0" />
              <span className="text-xs text-[#ff4000] dark:text-orange-300 italic truncate">{interimTranscript}</span>
            </div>
          )}

          <div className="flex gap-1.5 sm:gap-2 min-w-0">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? '🎙️ Parlez maintenant…' : 'Tapez ou parlez à Copilote…'}
            disabled={
              isLoading ||
              (userRole === 'vendeur' && (vendorAccess.loading || vendorAccess.hasVendor === false))
            }
            className={`flex-1 min-w-0 h-10 sm:h-14 text-sm sm:text-base px-3 sm:px-4 transition-colors ${isListening ? 'border-[#ff4000] ring-1 ring-orange-300' : ''}`}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleAttachImage(e.target.files?.[0])}
          />

          {/* Bouton microphone */}
          <Button
            variant={isListening ? 'destructive' : 'outline'}
            size="icon"
            onClick={toggleMic}
            disabled={
              isLoading ||
              (userRole === 'vendeur' && (vendorAccess.loading || vendorAccess.hasVendor === false))
            }
            className={`h-9 w-9 sm:h-12 sm:w-12 rounded-lg flex items-center justify-center flex-shrink-0 ${isListening ? 'animate-pulse' : ''}`}
            title={isListening ? 'Arrêter la reconnaissance vocale' : 'Parler à Copilote'}
          >
            {isListening
              ? <MicOff className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
              : <Mic className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
            }
          </Button>

          {/* Bouton image */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={
              isLoading ||
              (userRole === 'vendeur' && (vendorAccess.loading || vendorAccess.hasVendor === false))
            }
            className={`h-9 w-9 sm:h-12 sm:w-12 rounded-lg flex items-center justify-center flex-shrink-0 ${attachedImage ? 'border-primary text-primary' : ''}`}
            title={t('copiloteChat.rechercheParImageCopiloteAnalysera')}
          >
            <ScanSearch className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
          </Button>
          <Button
            onClick={() => sendMessage()}
            disabled={
              (!input.trim() && !attachedImage) ||
              isLoading ||
              (userRole === 'vendeur' && (vendorAccess.loading || vendorAccess.hasVendor === false))
            }
            size="icon"
            className={`h-9 w-9 sm:h-12 sm:w-12 bg-gradient-to-r ${roleColor} hover:opacity-90 rounded-lg flex items-center justify-center`}
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 sm:h-5 sm:w-5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
            )}
          </Button>
          </div>

        </div>

        <div className="mt-4 text-sm sm:text-base text-muted-foreground text-center hidden sm:block">
          Appuyez sur Entrée pour envoyer • Shift+Entrée pour une nouvelle ligne
        </div>
      </div>
    </Card>
  );
}
