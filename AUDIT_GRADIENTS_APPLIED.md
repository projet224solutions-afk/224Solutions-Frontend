# AUDIT GRADIENTS & BACKDROP-BLUR — CORRECTIONS APPLIQUÉES
Date : 2026-06-21
Repo : 224Solutions-Frontend

## Couleurs officielles appliquées
| Usage | Couleur | Classe |
|-------|---------|--------|
| Bouton CTA / action | `#ff4000` | `bg-[#ff4000]` |
| Hover CTA | `#ce3d11` | `hover:bg-[#ce3d11]` |
| Bouton principal / header | `#04439e` | `bg-[#04439e]` |
| Statut EN LIGNE uniquement | `#16a34a` | `bg-[#16a34a]` |
| Fond section orange pâle | `#ff4000`/5 | `bg-[#ff4000]/5` |
| Fond section bleu pâle | `#04439e`/5 | `bg-[#04439e]/5` |

## Phase 1 — Script automatique
`scripts/fix-gradients-and-blur.mjs` (Windows-safe : `basename` + normalisation des chemins, sinon `EXCLUDE_FILES` ne filtrait pas sous Windows).
- **152 fichiers** modifiés (1re passe : patterns 2-arrêts de marque + backdrop-blur sur cartes).
- **+6 fichiers** (2e passe : ajout des dégradés 3-arrêts `via-` identiques/de marque).
- Build après script : ✅ exit 0.

## Phase 2 — Corrections manuelles (fichiers exclus + gros fichiers)
- `HorizontalScrollRow.tsx` — boutons scroll : `bg-card/95 backdrop-blur-sm` → `bg-card` (fades de défilement conservés).
- `InstallPromptBanner.tsx` — bannière : `backdrop-blur-lg` retiré, bordure → `border-[#04439e]/20` (gradient déjà aplati par le script).
- `StandardIdBadge.tsx` — couleur texte hors-charte `hsl(25 98% 55%)` → `hsl(15 100% 50%)` (orange officiel).
- `MediaAutoCarousel.tsx` — skeleton `from-muted/10 to-muted/30` → `bg-muted/20` (contrôles `bg-black/60 backdrop-blur` sur photo conservés).
- `ProductImageCarousel.tsx` — placeholder + skeleton aplatis (overlay photo `from-black/20` conservé).
- `SingleTransportTicket.tsx` — dégradé blanc→blanc invisible → `#ffffff` (décor du billet : sombre, bande verte Guinée, filigrane conservés).
- `AgentOverviewProfessional.tsx` / `AgentFullFinanceModule.tsx` — déjà traités par le script (blur retiré).
- `Auth.tsx` — ~10 dégradés aplatis (cartes rôle/service → blanc ou `bg-[#ff4000]/5`, indicateur d'onglet → `bg-[#04439e]`, bouton submit → `bg-[#04439e]`, icône succès + progression → `bg-[#ff4000]`). Conservés : 3 overlays photo `from-black/*`, effet shimmer, blur de modal.
- `LivreurDashboard.tsx` — **0 dégradé restant** : page/cartes → `bg-[#ff4000]/5`, onglets actifs → `bg-[#ff4000]`/`bg-[#04439e]`, titres en dégradé → `text-[#ff4000]`, `linear-gradient` inline → `#ff4000` / `#04439e`.

## Phase 3 — Statut « en ligne » vert (#16a34a)
- `index.css` — variables `--status-online*` / `--status-offline*` ajoutées dans `:root` (8 occurrences) et `.dark`.
- `GoOnlineButton.tsx` — état online (ping, pulse, glow, bouton, pill) orange → vert. `#ff4000` conservé UNIQUEMENT sur le bloc `!hasSubscription`.
- `DriverStatusToggle.tsx` — `getStatusColor()` : online=`#16a34a`, on_delivery=`#04439e`, paused=`#ff4000`, default=gris. Icône Power online → vert, GPS/Navigation → bleu.
- `DriverLayout.tsx` — Badge statut vert `#16a34a`/gris avec point pulsant.

## Phase 6 — Boutons de filtres (blanc/bleu)
- `badge.tsx` + `button.tsx` — variants `filter` (repos : blanc + texte/bordure bleus) et `filter-active` (actif : bleu plein + texte blanc).
- Appliqués : `Marketplace.tsx` (catégories produits, numériques, chips pays + villes), `ServicesProximite.tsx`, `RestaurantPublicMenu.tsx`, `RestaurantPOS.tsx`, `BrowseModal.tsx` (filtres pays Vendeurs + Certifiés), plus `POSSystem.tsx`, `RestaurantMenuManager.tsx`, `ReservationModal.tsx` (trouvés en Phase 6I).
- Laissés (hors périmètre « catégories ») : filtres de **statut de commande** (`ClientOrdersList`, `MyPurchasesOrdersList`).

## Checklist Phase 4 — VÉRIFIÉE
| Vérification | Résultat |
|---|---|
| `from-[#ff4000] to-[#ff4000]` | **0** ✅ |
| `from-orange-500 to-[#ff4000]` | **0** ✅ |
| `hsl(25 98% 55%)` | **0** ✅ |
| `--status-online` dans `index.css` | présent (`:root` + `.dark`) ✅ |
| `GoOnlineButton` online sans `#ff4000` | ✅ (orange seulement sur `!hasSubscription`) |
| `DriverStatusToggle` online = `#16a34a` | ✅ |
| variants `filter`/`filter-active` (badge+button) | ✅ |

## Passes 2-4 — Couverture TOTALE des dégradés décoratifs
Après accord utilisateur (« va au bout »), 3 passes supplémentaires ont aplati **tous** les dégradés décoratifs restants, sans casser la sémantique (stratégie : `from-X … to-Y` → `bg-X`, on garde la teinte de départ en solide ; les textes en dégradé restent lisibles car `bg-clip-text` clippe la couleur solide) :
- **`scripts/fix-gradients-pass2.mjs`** — aplatissement générique : **280 dégradés** dans 135 fichiers.
- **`scripts/fix-gradients-pass3-cleanup.mjs`** — nettoyage des « stops » orphelins (`to-`, `via-`, `dark:from-`, `hover:from-`…) laissés par la passe 2 : **92 lignes** dans 51 fichiers. (Bug de la passe 2 corrigé : le TOKEN ne gérait pas `[#hex]/opacité` ni les variantes `dark:`/`hover:`, d'où des orphelins → nettoyés.)
- **`scripts/fix-gradients-pass4-background.mjs`** — aplatit les dégradés subtils `from-background … to-X` → `bg-background` : **19** dans 16 fichiers.

### État final des `bg-gradient-to-*`
- **567 au départ → 81 restants**, et **0 dégradé décoratif hors fichiers EXCLUDE**. Les 81 se répartissent en :
  - **overlays/fades LÉGITIMES** : `to-transparent` (38), `from-black/*` (14), `from-transparent` (shimmer).
  - **fichiers EXCLUDE conservés volontairement** : `AgentLayout(Professional)`, `WebRTCAudioCall` (fond appel vidéo `slate-900`), `ProfessionalServiceCard`/`ProductImageCarousel`/`MediaAutoCarousel` (photos), `SingleTransportTicket` (décor billet), navbars/modals.

### Cas particulier laissé (transparence)
**~7 définitions de dégradé « dynamiques »** (chaînes stockées en data, appliquées au runtime via `bg-gradient-to-r ${var}`) : `PDGNavigation.tsx` (`color: 'from-[#ff4000]'`…), `ServiceCard.tsx` (`gradient='from-primary/10'`), `CopiloteChat.tsx` (`roleColor`). Non aplaties car elles ne sont pas des classes statiques — un remplacement nécessiterait de réécrire le site d'application au cas par cas. Impact visuel mineur, à traiter manuellement si souhaité.

## Backdrop-blur
- Retirés sur cartes/contenus (script + manuel).
- Conservés (légitimes) : ~186 occurrences sur navbars fixes, overlays de modal (`fixed inset-0`), contrôles sur photos (`bg-black/60 backdrop-blur`).

## Aucun fichier supprimé · aucun fichier renommé · aucune dépendance modifiée
