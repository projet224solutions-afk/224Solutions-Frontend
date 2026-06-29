import { useTranslation } from "@/hooks/useTranslation";
/**
 * 🤖 Copilot224 (PHASE 2) — assistant IA contextuel, bulle flottante bas-droite.
 * RÈGLE N°2 : présent sur chaque interface de service. Le `service` détermine la
 * personnalité (system prompt) côté backend (`/api/v2/copilot`). Garde un historique
 * de session léger. La clé IA reste SERVEUR (le front ne fait qu'envoyer le message).
 */

import { useRef, useState, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Send, X, Loader2, Sparkles, ShoppingBag, Volume2, VolumeX, Mic, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Money } from '@/components/Money';
import { backendFetch } from '@/services/backendApi';
import { toast } from 'sonner';
import { useCopilotContext } from '@/hooks/useCopilotContext';
import { useCopilotVoice } from '@/hooks/useCopilotVoice';

interface CopilotProduct { id: string; name: string; price: number; image?: string | null; }
interface MsgAction { label: string; to?: string; apiPost?: string; confirm?: boolean; }
// Découverte de stock unifié — JAMAIS de quantité, seulement `available` (booléen).
interface SupplyItem {
  item_id: string; kind: string; name: string; price?: number; available: boolean;
  seller_name?: string; country?: string; city?: string; address?: string; phone?: string;
  latitude?: number; longitude?: number; on_marketplace?: boolean; dist?: number | null;
}
interface Msg { role: 'user' | 'assistant'; content: string; products?: CopilotProduct[]; actions?: MsgAction[]; image?: string; supply?: SupplyItem[]; }

// Tool-calling — mappe les actions proposées par Claude (backend) en boutons de confirmation.
// `confirm` = action sensible (commander/réserver/corriger) ; `apiPost` = action PDG (corrige en 1 clic
// via l'endpoint d'auto-réparation, gardé PDG+2FA backend). `to` = navigation interne sécurisée.
function mapBackendActions(raw: any): MsgAction[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  return raw
    .filter((a) => a && (
      (typeof a.navigate === 'string' && a.navigate.startsWith('/')) ||   // route interne uniquement
      (typeof a.apiPost === 'string' && a.apiPost.startsWith('/api/'))     // endpoint backend uniquement
    ))
    .map((a) => ({
      label: String(a.confirmLabel || a.label || 'Action').slice(0, 60),
      to: typeof a.navigate === 'string' && a.navigate.startsWith('/') ? String(a.navigate) : undefined,
      apiPost: typeof a.apiPost === 'string' && a.apiPost.startsWith('/api/') ? String(a.apiPost) : undefined,
      confirm: !!a.requiresConfirmation,
    }))
    .slice(0, 3);
}

// Phase 3 — l'utilisateur cherche-t-il un produit ?
const SEARCH_INTENT = /\b(cherch|trouv|achet|acheter|o[uù].*(acheter|trouver)|produit|je veux)\b/i;

// Convertit une URL/chemin en chemin INTERNE navigable (react-router) si c'est un lien de l'app,
// sinon renvoie null (lien externe). Gère les chemins relatifs et les URLs sur les domaines 224Solutions.
function toInternalPath(url: string): string | null {
  if (!url) return null;
  if (url.startsWith('/')) return url;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const sameHost = typeof window !== 'undefined' && host === window.location.hostname.toLowerCase();
    if (sameHost || /(^|\.)224solutions?\.net$/.test(host)) {
      return (u.pathname || '/') + (u.search || '') + (u.hash || '');
    }
  } catch { /* pas une URL absolue */ }
  return null;
}

// Phase 5 — actions réelles dérivées de l'intention (navigation seule, sans paiement auto).
function deriveActions(message: string, service: string): { label: string; to: string }[] {
  const m = message.toLowerCase();
  const acts: { label: string; to: string }[] = [];
  if (/(recharg|solde|wallet|argent)/.test(m)) acts.push({ label: 'Recharger mon wallet', to: '/wallet' });
  if (/(march[ée]|achet|produit|cherch|boutique)/.test(m)) acts.push({ label: "Ouvrir le marketplace", to: '/marketplace' });
  if (service === 'beaute' && /(r[ée]serv|rendez|cr[ée]neau|salon)/.test(m)) acts.push({ label: "Trouver un salon", to: '/beaute' });
  if (/(mes rendez|mes rdv|mon rendez)/.test(m)) acts.push({ label: "Mes rendez-vous", to: '/mes-rdv-beaute' });
  return acts.slice(0, 2);
}

// Phase 6 — suggestions proactives dérivées du service + contexte (si aucune fournie).
function proactiveSuggestions(service: string, ctx: { role?: string; balance?: number }): string[] {
  const out: string[] = [];
  const perService: Record<string, string[]> = {
    beaute: ['Quel soin pour mes cheveux ?', 'Réserver un créneau'],
    restaurant: ['Suivre ma commande', 'Idées de promotions'],
    agriculture: ['Mieux vendre mes produits', 'Quelle saison pour planter ?'],
    ecommerce: ['Lancer un achat groupé', 'Trouver un produit fiable'],
    construction: ['Estimer un devis', 'Comprendre l\'escrow par jalon'],
    location: ['Comparer des loyers', 'Mes droits de locataire'],
    reparation: ['Estimer une réparation', 'Entretien préventif'],
  };
  if (perService[service]) out.push(...perService[service]);
  if (typeof ctx.balance === 'number' && ctx.balance < 5000) out.push('Comment recharger mon wallet ?');
  out.push('Que peux-tu faire pour moi ?');
  return [...new Set(out)].slice(0, 3);
}

interface Copilot224Props {
  service: string;
  title?: string;
  suggestions?: string[];
  /** 'bubble' (défaut, flottant) ou 'embedded' (plein écran/intégré, remplace CopiloteChat). */
  variant?: 'bubble' | 'embedded';
  /** Hauteur en mode intégré (ex. 'calc(100vh - 160px)'). */
  height?: string;
  className?: string;
  /** Masque l'alerte proactive « solde bas » (ex. interface agent : le wallet du compte agent
   *  n'est pas pertinent, il opère sur le restaurant de son employeur). */
  hideWalletAlert?: boolean;
}

export function Copilot224({ service, title, suggestions = [], variant = 'bubble', height, className, hideWalletAlert = false }: Copilot224Props) {
  const { t } = useTranslation();
  const isEmbedded = variant === 'embedded';
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const context = useCopilotContext(service); // Phase 1 — contexte temps réel (optionnel)
  const voice = useCopilotVoice(); // Phase 4 — voix (optionnel)
  const [voiceOn, setVoiceOn] = useState(false);
  const [proactiveDismissed, setProactiveDismissed] = useState(false);
  const loadedRef = useRef(false);

  // Phase 2 — précharge la mémoire persistante à la 1re ouverture (best-effort).
  useEffect(() => {
    if ((!open && !isEmbedded) || loadedRef.current) return;
    loadedRef.current = true;
    (async () => {
      try {
        const res = await backendFetch<{ history: Msg[] }>(`/api/v2/copilot/history?service=${encodeURIComponent(service || '')}`, { method: 'GET' });
        const hist = (res as any)?.history as Msg[] | undefined;
        if (res.success && hist?.length) setMsgs((m) => (m.length === 0 ? hist.map((h) => ({ role: h.role, content: h.content })) : m));
      } catch { /* best-effort */ }
    })();
  }, [open, service]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [msgs, loading]);

  const ask = async (text: string) => {
    const message = text.trim();
    if (!message || loading) return;
    const history = msgs.slice(-8);
    setMsgs((m) => [...m, { role: 'user', content: message }]);
    setInput('');
    setLoading(true);
    try {
      const res = await backendFetch<{ reply: string; products?: CopilotProduct[]; actions?: any[] }>('/api/v2/copilot', { method: 'POST', body: { service, message, history, context } });
      const reply = res.success ? ((res as any).reply as string) : (res.error || 'Copilot indisponible pour le moment.');
      // Tool-calling — produits/actions fournis par Claude (backend) en priorité, sinon repli front.
      let products: CopilotProduct[] | undefined = Array.isArray((res as any).products) && (res as any).products.length ? (res as any).products as CopilotProduct[] : undefined;
      let actions: MsgAction[] | undefined = mapBackendActions((res as any).actions);
      // Phase 3 (repli) — si le backend n'a pas cherché mais l'intention est claire, on cherche côté front.
      if (!products && SEARCH_INTENT.test(message)) {
        try {
          const sr = await backendFetch<{ products: CopilotProduct[] }>('/api/v2/copilot/search', { method: 'POST', body: { q: message } });
          const list = (sr as any)?.products as CopilotProduct[] | undefined;
          if (sr.success && list?.length) products = list;
        } catch { /* best-effort */ }
      }
      if (!actions) { const d = deriveActions(message, service); actions = d.length ? d : undefined; }
      const supply: SupplyItem[] | undefined = Array.isArray((res as any).supply) && (res as any).supply.length ? (res as any).supply as SupplyItem[] : undefined;
      setMsgs((m) => [...m, { role: 'assistant', content: reply, products, actions, supply }]);
      if (voiceOn) voice.speak(reply); // Phase 4 — lecture vocale si activée
    } catch {
      setMsgs((m) => [...m, { role: 'assistant', content: 'Erreur de connexion au Copilot.' }]);
    } finally {
      setLoading(false);
    }
  };

  // PARTIE 5 — VISION : compresse une image (max 1024px) côté client → dataURL JPEG léger.
  const compressImage = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1024;
        let w = img.width, h = img.height;
        if (w > max || h > max) { const s = max / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
        const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
        const cx = canvas.getContext('2d'); if (!cx) { reject(new Error('canvas')); return; }
        cx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = reject; img.src = reader.result as string;
    };
    reader.onerror = reject; reader.readAsDataURL(file);
  });

  // Envoie une PHOTO au copilote → analyse vision + recherche marketplace (backend). Propose, n'achète pas.
  const sendImage = async (file: File) => {
    if (loading || !file) return;
    setLoading(true);
    try {
      const dataUrl = await compressImage(file);
      const message = input.trim() || 'Voici une photo, trouve-moi ce produit sur le marketplace.';
      const history = msgs.slice(-8);
      setMsgs((m) => [...m, { role: 'user', content: input.trim() || '📷 Photo envoyée', image: dataUrl }]);
      setInput('');
      const res = await backendFetch<{ reply: string; products?: CopilotProduct[]; actions?: any[] }>('/api/v2/copilot', { method: 'POST', body: { service, message, history, context, image: dataUrl } });
      const reply = res.success ? ((res as any).reply as string) : (res.error || 'Analyse indisponible.');
      const products: CopilotProduct[] | undefined = Array.isArray((res as any).products) && (res as any).products.length ? (res as any).products as CopilotProduct[] : undefined;
      const actions = mapBackendActions((res as any).actions);
      const supply: SupplyItem[] | undefined = Array.isArray((res as any).supply) && (res as any).supply.length ? (res as any).supply as SupplyItem[] : undefined;
      setMsgs((m) => [...m, { role: 'assistant', content: reply, products, actions, supply }]);
      if (voiceOn) voice.speak(reply);
    } catch {
      setMsgs((m) => [...m, { role: 'assistant', content: "Erreur lors de l'analyse de l'image." }]);
    } finally { setLoading(false); }
  };

  // Exécute une action proposée : apiPost (corriger en 1 clic, PDG) → POST backend ; sinon navigation.
  const runAction = async (a: MsgAction) => {
    if (a.apiPost) {
      if (loading) return;
      setLoading(true);
      try {
        const res = await backendFetch(a.apiPost, { method: 'POST' });
        if (res.success) {
          toast.success(t('copilot224.correctionAppliquee'));
          setMsgs((m) => [...m, { role: 'assistant', content: `✅ Correction appliquée : ${a.label}.` }]);
        } else {
          toast.error(res.error || 'Correction impossible');
          setMsgs((m) => [...m, { role: 'assistant', content: `⚠️ ${res.error || 'Correction impossible'}.` }]);
        }
      } catch {
        toast.error(t('copilot224.erreurReseau'));
      } finally { setLoading(false); }
      return;
    }
    if (a.to) navigate(a.to);
  };

  // Rend le texte d'un message en rendant CLIQUABLES les liens : markdown [label](url), URLs http(s),
  // et chemins internes (/marketplace/product/…, /boutique/…, etc.). Les liens internes naviguent via
  // react-router (navigate) ; les externes s'ouvrent dans un nouvel onglet sécurisé.
  const renderMessageContent = (text: string): ReactNode => {
    if (!text) return text;
    const re = /\[([^\]]+)\]\(\s*(https?:\/\/[^\s)]+|\/[^\s)]+)\s*\)|(https?:\/\/[^\s<]+)|(\/(?:marketplace|product|produit|shop|boutique|digital-product|digital-products|wallet|proximite|boutiques)[^\s<)]*)/gi;
    const nodes: ReactNode[] = [];
    let last = 0; let m: RegExpExecArray | null; let key = 0;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) nodes.push(text.slice(last, m.index));
      const label = m[1];
      const target = (m[2] || m[3] || m[4] || '').replace(/[.,;:]$/, '');
      const internal = toInternalPath(target);
      if (internal) {
        nodes.push(
          <a key={key++} href={internal} onClick={(e) => { e.preventDefault(); navigate(internal); }}
            className="font-medium text-[#04439e] underline underline-offset-2 hover:opacity-80 cursor-pointer break-words">
            {label || target}
          </a>
        );
      } else {
        nodes.push(
          <a key={key++} href={target} target="_blank" rel="noopener noreferrer"
            className="font-medium text-[#04439e] underline underline-offset-2 hover:opacity-80 break-words">
            {label || target}
          </a>
        );
      }
      last = re.lastIndex;
    }
    if (last < text.length) nodes.push(text.slice(last));
    return nodes.length ? nodes : text;
  };

  // Mode bulle fermée → bouton flottant (+ carte proactive si pertinent). Le mode intégré est toujours « ouvert ».
  if (!isEmbedded && !open) {
    const lowBalance = !hideWalletAlert && typeof context.balance === 'number' && context.balance < 5000;
    return (
      <div className="fixed bottom-28 right-4 z-[60] flex flex-col items-end gap-2">
        {lowBalance && !proactiveDismissed && (
          <div className="max-w-[240px] rounded-xl border bg-card p-2.5 text-xs shadow-lg animate-fade-in">
            <p className="mb-1.5">{t('copilot224.votreSoldeEstBasRechargez')}</p>
            <div className="flex gap-1">
              <Button size="sm" className="h-6 px-2 text-[11px]" onClick={() => navigate('/wallet')}>Recharger</Button>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => setProactiveDismissed(true)}>Plus tard</Button>
            </div>
          </div>
        )}
        <button
          onClick={() => setOpen(true)}
          className={`flex h-14 w-14 items-center justify-center rounded-full bg-[#ff4000] text-white shadow-lg transition hover:scale-105 ${lowBalance && !proactiveDismissed ? 'animate-pulse' : ''}`}
          title="Copilot 224"
          aria-label={t('copilot224.ouvrirLeCopilot')}
        >
          <Bot className="h-6 w-6" />
        </button>
      </div>
    );
  }

  const panel = (
    <>
      <div className="flex items-center gap-2 bg-[#ff4000] px-3 py-2 text-white">
        <Sparkles className="h-4 w-4" />
        <span className="text-sm font-semibold">{title || 'Copilot 224'}</span>
        {voice.ttsSupported && (
          <button onClick={() => { const n = !voiceOn; setVoiceOn(n); if (!n) voice.stopSpeaking(); }} className="ml-auto" aria-label="Lecture vocale" title={voiceOn ? 'Voix activée' : 'Voix désactivée'}>
            {voiceOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 opacity-70" />}
          </button>
        )}
        {!isEmbedded && <button onClick={() => setOpen(false)} className={voice.ttsSupported ? '' : 'ml-auto'} aria-label={t('copilot224.fermer')}><X className="h-4 w-4" /></button>}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-3">
        {msgs.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{context.name ? `Bonjour ${context.name} 👋` : 'Bonjour 👋'} Je suis votre assistant. Posez-moi une question.</p>
            {(suggestions.length ? suggestions : proactiveSuggestions(service, context)).slice(0, 3).map((s, i) => (
              <button key={i} onClick={() => ask(s)} className="block w-full rounded-lg border px-2 py-1.5 text-left text-xs hover:border-[#ff4000]">{s}</button>
            ))}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className="space-y-1.5">
            <div className={`max-w-[85%] whitespace-pre-wrap break-words rounded-xl px-3 py-2 text-sm ${m.role === 'user' ? 'ml-auto bg-[#ff4000] text-white' : 'bg-muted'}`}>
              {m.image && <img src={m.image} alt="Photo envoyée" className="mb-1 max-h-40 rounded-lg object-cover" />}
              {m.role === 'assistant' ? renderMessageContent(m.content) : m.content}
            </div>
            {m.actions && m.actions.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {m.actions.map((a, k) => (
                  <Button key={k} size="sm" variant={a.confirm ? 'default' : 'outline'} className={`h-7 text-xs ${a.apiPost ? 'bg-green-600 hover:bg-green-700' : a.confirm ? 'bg-[#ff4000] hover:bg-[#e03900]' : ''}`} disabled={loading} onClick={() => runAction(a)}>{a.label}</Button>
                ))}
              </div>
            )}
            {m.products && m.products.length > 0 && (
              <div className="space-y-1">
                {m.products.map((p) => (
                  <button key={p.id} onClick={() => navigate(`/marketplace/product/${p.id}`)} className="flex w-full items-center gap-2 rounded-lg border p-1.5 text-left hover:border-[#ff4000]">
                    {p.image ? <img src={p.image} alt="" className="h-9 w-9 rounded object-cover" /> : <ShoppingBag className="h-9 w-9 rounded bg-muted p-2 text-muted-foreground" />}
                    <span className="flex-1 truncate text-xs">{p.name}</span>
                    <span className="text-xs font-bold text-[#ff4000]"><Money amount={p.price} /></span>
                  </button>
                ))}
              </div>
            )}
            {/* PARTIE 3.4 — disponibilité chez les vendeurs (JAMAIS de quantité) */}
            {m.supply && m.supply.length > 0 && (
              <div className="space-y-1">
                {m.supply.map((s) => (
                  <div key={s.item_id} className="rounded-lg border p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{s.name}</span>
                      {typeof s.price === 'number' && s.price > 0 && <span className="font-bold text-[#ff4000]"><Money amount={s.price} /></span>}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="rounded-full bg-green-100 px-1.5 py-0.5 font-medium text-green-700">✓ Disponible</span>
                      {s.seller_name && <span>· {s.seller_name}</span>}
                      {(s.city || s.country) && <span>· {[s.city, s.country].filter(Boolean).join(', ')}</span>}
                      {s.dist != null && <span>· {s.dist} km</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {s.on_marketplace ? (
                        <button onClick={() => navigate(`/marketplace/product/${s.item_id}`)} className="rounded-md border px-2 py-0.5 hover:border-[#ff4000]">Voir / Commander</button>
                      ) : (
                        <>
                          {s.phone && <a href={`tel:${s.phone}`} className="rounded-md border px-2 py-0.5 hover:bg-muted">📞 Appeler</a>}
                          {(s.address || (s.latitude != null && s.longitude != null)) && (
                            <a href={s.latitude != null && s.longitude != null ? `https://www.google.com/maps/search/?api=1&query=${s.latitude},${s.longitude}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address || '')}`} target="_blank" rel="noopener noreferrer" className="rounded-md border px-2 py-0.5 hover:bg-muted">🧭 Itinéraire</a>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />{t('copilot224.leCopilotReflechit')}</div>}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex items-center gap-2 border-t p-2">
        {/* PARTIE 5 — BOUTON PHOTO : caméra (mobile) ou galerie → analyse vision + recherche marketplace */}
        <label className={`flex h-9 w-9 flex-shrink-0 cursor-pointer items-center justify-center rounded-md border hover:bg-muted ${loading ? 'pointer-events-none opacity-50' : ''}`} aria-label="Envoyer une photo" title="Envoyer une photo">
          <input type="file" accept="image/*" capture="environment" className="hidden" disabled={loading}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void sendImage(f); e.currentTarget.value = ''; }} />
          <Camera className="h-4 w-4" />
        </label>
        {voice.sttSupported && (
          <Button type="button" size="icon" variant={voice.listening ? 'default' : 'outline'} className="h-9 w-9 flex-shrink-0"
            onClick={() => voice.listening ? voice.stopListening() : voice.listen((t) => setInput(t))} aria-label="Dicter">
            <Mic className="h-4 w-4" />
          </Button>
        )}
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder={voice.listening ? 'Parlez…' : 'Votre question…'} className="h-9" />
        <Button type="submit" size="icon" disabled={loading || !input.trim()} className="h-9 w-9 flex-shrink-0"><Send className="h-4 w-4" /></Button>
      </form>
    </>
  );

  // Mode intégré (plein écran) — remplace CopiloteChat sans perdre l'UX.
  if (isEmbedded) {
    return (
      <div className={`flex flex-col overflow-hidden rounded-2xl border bg-card ${className || ''}`} style={{ height: height || '70vh' }}>
        {panel}
      </div>
    );
  }

  // Mode bulle (flottant).
  return (
    <div className="fixed bottom-28 right-4 z-[60] flex h-[28rem] max-h-[calc(100vh-10rem)] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl">
      {panel}
    </div>
  );
}

export default Copilot224;
