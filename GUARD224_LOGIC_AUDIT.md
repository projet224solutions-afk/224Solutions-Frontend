# GUARD224_LOGIC_AUDIT — Étape 1 (audit critique de la logique) — 2026-06-14

> Audit senior AVANT toute ligne de code. Pour chaque point : **verdict** (✅ sain /
> ⚠️ à corriger / ❌ rejeté) + décision retenue. Plusieurs snippets du cahier des
> charges sont **dangereux ou impraticables** et sont corrigés ici.

## 0. Modèle de menace (à poser AVANT tout)

C'est le point le plus négligé. **Contre qui 224Guard protège-t-il ?**

- ✅ **Menace réelle = script malveillant injecté** (XSS, dépendance npm compromise,
  tag tiers, extension) qui lit un secret et l'exfiltre. C'est là que 224Guard a de la valeur.
- ✅ **Menace réelle = erreur de build** (un secret serveur fuit dans le bundle).
- ❌ **NON-menace = l'admin dans sa propre console.** Un admin qui ouvre la console voit
  SES propres données dans SON navigateur. Le rendre « inviolable » contre lui-même est un
  **leurre** : en JS côté client, le propriétaire de la page a tout pouvoir. On documente
  cette limite honnêtement plutôt que de promettre l'impossible (cf. §1.4).

**Conséquence de conception** : 224Guard est un **détecteur best-effort + fail-safe**, pas un
bastion inviolable. Sa valeur = détecter tôt + alerter de façon fiable, PAS empêcher un
attaquant tout-puissant. Toute promesse d'« inviolabilité totale » est rejetée.

---

## 1.1 Architecture globale

**Q1 — Singleton**
✅ Acceptable. JS est **mono-thread** → pas de vraie race condition entre `getInstance()`.
Le seul risque = `getInstance()` appelé avant fin d'init. **Décision** : le constructeur est
synchrone et installe immédiatement les hooks critiques (intercepteur) ; l'init asynchrone
(IndexedDB, Ably) est exposée via une `Promise ready`. `getInstance()` renvoie toujours une
instance utilisable ; les opérations async attendent `await guard.ready`. **Pas de mutex
nécessaire** (pas de threads). ❌ Rejet de toute « solution thread-safe » type lock : inutile en JS.

**Q2 — Démarrage des moniteurs**
✅ Isolation obligatoire : si un moniteur échoue, les autres continuent (fail-safe). **Ordre
imposé** : (1) intercepteur réseau/WebSocket **en tout premier, synchrone, au point d'entrée
du bundle** — sinon les requêtes émises avant son installation échappent au monitoring ;
(2) runtime/DOM/storage ; (3) transport (Ably) en dernier. ⚠️ Si l'intercepteur s'installe
après des requêtes déjà parties → trou irréductible : on l'accepte et on le minimise en
chargeant 224Guard **avant** tout SDK dans `main.tsx`. Alerte générée avant connexion Ably →
mise en **file durable** (IndexedDB) puis flush (cf. §3).

**Q3 — Couplage Ably/Supabase**
⚠️ Couplage direct = fragile. **Décision** : Ably et Supabase sont des **sinks optionnels**,
jamais des dépendances dures. Source de vérité = **file locale durable (IndexedDB)**. Ably =
transport temps réel best-effort ; Supabase = historique. Une alerte est « livrée » seulement
après persistance locale ; Ably/Supabase down → l'alerte reste en file et est rejouée. **Aucune
alerte CRITIQUE n'est jamais perdue** tant que IndexedDB est dispo (fallback mémoire sinon).

**Q4 — Performances**
⚠️ Le snippet qui `await analyzeRequest()` **avant** `target.apply()` **bloque chaque requête**
= inacceptable. **Décision** : l'intercepteur ne doit **JAMAIS** être sur le chemin critique.
On capture les args, on lance l'analyse en **tâche différée** (`queueMicrotask`/Worker), et on
laisse la requête partir immédiatement. Overhead cible **< 1 ms** (capture only). Le scan de
bundle = **Web Worker**, par chunks, avec cap de taille (skip si > 8 Mo), jamais sur le main thread.
MutationObserver/setInterval → registre central de `disposables` + `dispose()` (cf. §1.5).

**Q5 — Faux positifs (LE point critique)**
❌ Un regex JWT brut alerte sur **tous** les tokens user → inexploitable. **Décision** : pour un
JWT, on **décode le payload** et on n'alerte que si `role:service_role` (ou claim sensible) ;
`anon`/`authenticated` = ignorés. Firebase `AIza…` = **public par design** → score bas, alerte
seulement en contexte aggravant (ex. dans un body de requête sortante inattendue). **Scoring de
confiance 0-100** combinant : pattern (poids fort si motif serveur explicite), **entropie de
Shannon**, contexte (source + direction réseau), allowlist adaptative (cf. §3.6 — **plafonnée**).
Whitelist intelligente = OUI mais **jamais capable de blanchir un motif CRITIQUE** (service_role,
sk_live, private key) — sinon un attaquant noierait la détection.

---

## 1.2 Moteur de détection

**Regex — qualité**
- ⚠️ **ReDoS** : bannir backtracking catastrophique (pas de `(.*)+`, pas de quantificateurs
  imbriqués). Utiliser des classes bornées (`[A-Za-z0-9_-]{20,64}`) et ancrer. Tester chaque
  motif contre une chaîne adverse longue.
- Faux positifs/négatifs estimés et **scénarios validés** :
  - JWT session user (`role:anon/authenticated`) → **PAS d'alerte** ✅ (décodage du claim).
  - JWT `role:service_role` au front → **CRITIQUE** ✅.
  - Firebase `apiKey` → évalué **en contexte** ✅ (public, score bas).
  - Clé Ably (`name:key` ou `xxx.yyy:zzz`) dans un header → **alerte** ✅.
  - Token Redis (`rediss://default:PASSWORD@`) en localStorage → **CRITIQUE** ✅.
  - Hash MD5/UUID standard → **PAS d'alerte** ✅ (entropie + format reconnu + exclusion).
- ✅ **Entropie de Shannon** comme COMPLÉMENT (pas remplacement) : détecte les secrets sans
  format connu. Seuils : entropie > 4.0–4.2 bits/char ET longueur > 24 ET caractères mixtes ET
  pas un UUID/hash/base64-d'image. (Le seuil 4.5 du cahier est trop haut → rate des clés.)

**Intercepteur réseau — solidité**
- SDK tiers qui override `fetch` **avant** nous → on s'installe **en premier** (point d'entrée). Si
  un SDK wrappe **après** nous → ⚠️ ne pas « réinstaller de force » : on **chaîne** (on wrappe le
  fetch courant) pour ne pas casser le SDK ; un moniteur d'intégrité **alerte** si notre proxy
  n'est plus dans la chaîne.
- ❌ **REJET de `Object.defineProperty(window,'fetch',{configurable:false})`** : casse les SDK
  légitimes qui re-wrappent fetch (Ably, Sentry…), empêche toute restauration, et `configurable:false`
  est **irréversible** (un bug fige fetch). On utilise un **Proxy** + check d'intégrité **non
  destructif** (alerter, pas écraser sauvagement chaque seconde).
- HTTPS : on n'inspecte pas le TLS ; on lit les **arguments JS** (url/headers/body) **avant**
  chiffrement — c'est suffisant et légitime.
- **Service Workers** : contexte séparé, **non monitorables depuis la page** → limite documentée ;
  on surveille à la place les **enregistrements** de SW (`navigator.serviceWorker.register`).
- **WebSockets** : ne passent pas par fetch → **proxy `window.WebSocket`** (construct + send). ✅.

**Scan du code source — vecteurs souvent ratés** (à couvrir)
source maps `.map` publiques · commentaires du bundle compilé · métadonnées de chunks
Vite/Webpack · `manifest.json`/config JSON publiques · attributs DOM `data-*` · variables CSS
(`getComputedStyle`) · `<script type="application/json">` inline. Le scan serveur existant couvre
déjà bundle+sourcemaps+headers → 224Guard se concentre sur le **runtime live** (storage, réseau,
DOM, WS) pour éviter le doublon.

---

## 1.3 Système d'alertes

**Déduplication multi-dimensionnelle**
- Même clé dans 3 sources → **1 exposition logique**, mais on conserve les 3 **sources** (1 alerte
  avec `sources[]`, pas 3 alertes). Clé de dédup = `hash(secret_masqué) + type`.
- Escalade de sévérité (MEDIUM→HIGH) → **réinitialise la dédup** (nouvelle alerte, car l'admin doit
  re-voir l'aggravation).
- Persistance de la dédup **entre rechargements** → IndexedDB (fenêtre glissante 5 min).
- Algo retenu : clé composite `{keyHash, source, severity}` + fenêtre temporelle + coalescing des
  sources sous une même exposition.

**Fiabilité des notifications** (scénarios de perte → solution)
| Scénario | Solution |
|----------|----------|
| Admin déconnecté d'Ably à l'alerte CRITIQUE | file durable IndexedDB + rejeu ; Supabase = historique fiable |
| Supabase rate-limit (pic d'alertes) | rate-limit + **coalescing** côté Guard, retry backoff exponentiel |
| Onglet en arrière-plan (timers throttlés) | événementiel (pas que `setInterval`) + flush sur `visibilitychange` |
| Réseau coupé 10 min | file durable, rejeu à la reconnexion (`online` event) |
| SW met en cache des réponses d'alerte | endpoints d'alerte en `no-store`, jamais cachés |

**Sécurité des alertes elles-mêmes**
- ⚠️ Canal Ably `224guard:alerts` **écoutable** si la clé/capability est trop large → **aucune
  valeur de clé** ne transite : seulement `keyHash`, masque (`sk_live_****…1234`), type, sévérité,
  source, score. Reconstruction impossible.
- Capability Ably **restreinte** au canal admin + token signé serveur (jamais d'API key au front).
- Tables `guard_224_*` protégées par **RLS admin/PDG only**.
- Export admin → masqué + journalisé (`audit_logs`) ; jamais de clé reconstructible.

---

## 1.4 Sécurité de 224Guard lui-même (attaques 1-6)

> Cadre honnête (cf. §0) : on **détecte et complique**, on ne prétend pas l'inviolabilité absolue.

| Attaque | Verdict | Décision |
|---------|---------|----------|
| **1. `Guard224.stop()` console** | ⚠️ non empêchable contre le propriétaire | Instance **non exposée sur `window`** (closure/module privé) ; pas d'API `stop()` publique ; toute tentative d'accès détectée → alerte. Honnête : protège contre un **script** tiers, pas contre l'admin lui-même. |
| **2. Override de `fetch`** | ⚠️ détectable, pas bloquable à 100% | Proxy + moniteur d'intégrité **jittered** → alerte `TAMPER`. PAS de `configurable:false` (cf. §1.2). |
| **3. Clés DOM éphémères** | ⚠️ résiduel | MutationObserver (subtree, attributs) capte l'ajout ; add+remove dans le même microtask peut échapper → risque accepté + documenté. |
| **4. Timing attack sur le scanner** | ✅ atténuable | Scans **événementiels** (mutation/réseau) + intervalle **jitteré** (imprévisible), pas seulement périodique. |
| **5. Pollution de la dédup (flood)** | ✅ géré | **Rate-limit** par source + cap de file (500) + coalescing ; au-delà du seuil → 1 méta-alerte « flood détecté » au lieu de N. |
| **6. Injection dans les patterns** | ✅ géré par conception | ❌ **Les patterns CRITIQUES ne sont JAMAIS chargés depuis Supabase.** Ils sont **constantes du bundle** (immuables, protégés par CSP/SRI). La DB ne sert qu'à l'**allowlist additive** et au tuning — **jamais à affaiblir** un motif critique. ❌ Rejet du `PatternIntegrityVerifier` à hash SHA-256 codés en dur (impraticable au build, faux sentiment de sécurité). |

---

## 1.5 Robustesse technique (edge cases)

| Cas | Décision |
|-----|----------|
| Connexion lente / scan 30 s | scan en **Web Worker**, chunké, annulable, budget temps ; jamais bloquant |
| Bundle 50 Mo → crash mémoire | **cap de taille** (skip > 8 Mo), streaming par chunks, pas de `.text()` global |
| `localStorage` désactivé | feature-detect → dégradation (file en mémoire, pas de persistance) |
| API absente (MutationObserver/IndexedDB/ReadableStream) | **feature-detect** + dégradation gracieuse, jamais de crash |
| iframe sandboxé | détecter l'absence d'accès → mode réduit |
| 2 onglets admin | **BroadcastChannel** + id d'onglet → dédup inter-onglets (pas de doublon) |
| Compat Chrome/FF/Safari/Edge | Proxy/MO/IndexedDB OK partout ; **Safari/iOS** : restrictions SW + throttling → feature-detect |

**Memory leaks** : registre central `Disposable[]` ; `dispose()` garantit clear de tous les
intervals, déconnexion MutationObserver, removeEventListener, unsubscribe Ably, fermeture WS proxy.
Pas de références circulaires (WeakRef/WeakMap pour les logs d'accès).

---

## 1.6 Dashboard (UX)

- 50 alertes simultanées → **virtualisation de liste** (obligatoire) ; pas de re-render massif.
- Priorisation visuelle CRITIQUE : tri + bandeau fixe + **icône + texte** (pas que la couleur).
- Son **throttlé** (1 / 5 s max) + respect `prefers-reduced-motion`.
- Action en **≤ 3 clics** (Acquitter / Faux positif / Détails).
- **Daltonisme** : sévérité = couleur **+ icône + label** (jamais couleur seule).
- **Mode sombre** : oui (déjà supporté par le thème).

---

## Décisions « anti-cahier-des-charges » (ce que je REJETTE et pourquoi)

1. ❌ `Object.defineProperty(window,'fetch',{configurable:false})` → casse SDK + irréversible.
2. ❌ Réinstaller fetch toutes les 1 s de force → guerre avec les wrappers légitimes.
3. ❌ `PatternIntegrityVerifier` à hash codés en dur → impraticable ; patterns = constantes bundle.
4. ❌ Corrélation storage↔réseau « < 100 ms » comme signal fort → infaisable de façon fiable ;
   dégradée en **heuristique faible confiance**.
5. ❌ `AdaptiveTrustEngine` qui **baisse automatiquement** les seuils → vecteur d'aveuglement ;
   ajustement **plafonné** et **interdit** sur les motifs critiques.
6. ❌ Promesse d'« inviolabilité » → remplacée par « détection best-effort + fail-safe + alerte
   fiable », conforme au modèle de menace réel.
