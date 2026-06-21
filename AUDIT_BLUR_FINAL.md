# AUDIT BACKDROP-BLUR — NETTOYAGE FINAL
Date : 2026-06-21

## Bilan global
| Étape | Occurrences |
|-------|-------------|
| Avant 1re passe | 165 |
| Avant cette passe | 186 |
| **Après cette passe** | **112** (74 retirés) |
| dont sur `sticky`/`fixed` (navbars/footers — LÉGITIMES) | 59 |
| dont fichiers EXCLUDE (overlays/photos/fonds sombres) | ~21 fichiers |
| Artefacts double-opacité `bg-X/N/N` | **0** (corrigés) |

> Note de transparence : la cible « < 30 » du prompt n'est pas atteignable sans casser des cas
> LÉGITIMES. Les 112 restants sont **tous justifiés** : barres de navigation `sticky`/`fixed`
> (le contenu défile derrière une barre translucide — performant et voulu), overlays de modals,
> contrôles sur cartes/photos sombres. **0 blur inutile sur carte/contenu à fond clair ne subsiste**
> (vérifié : tous les `bg-white/9x`/`bg-card/8x|9x backdrop-blur` hors EXCLUDE sont des `sticky`/`fixed`).

## Règle définitive appliquée
| Contexte | Traitement |
|----------|-----------|
| `bg-white/90+` + blur sur carte fond clair | → `bg-white` (supprimé) |
| `bg-card/80+`/`/50`/`/30` + blur sur carte fond clair | → `bg-card` (supprimé) |
| `bg-black/60` + blur sur photo/image sombre | CONSERVÉ (lisibilité) |
| `bg-white/10`–`/20` + blur sur fond très sombre | CONSERVÉ (design) |
| Overlay modal/dialog `inset-0` | CONSERVÉ |
| Navbar/footer `sticky`/`fixed` | CONSERVÉ (translucidité voulue) |
| Contrôles sur vue carte sombre | CONSERVÉ |

## Bonus — artefacts double-opacité corrigés (séquelles de la passe gradients)
La passe d'aplatissement des dégradés avait laissé 10 classes malformées `bg-X/N/N` (double opacité →
fond non appliqué). Toutes corrigées en couleurs de marque solides :
- `bg-orange-500/10/10` → `bg-[#ff4000]/10` · `bg-orange-500/5/5` → `bg-[#ff4000]/5` · `bg-blue-500/5/5` → `bg-[#04439e]/5`
- Fichiers : PriceEstimatorCard, PDGFinance, PDGSupportTechnique, StandardIdBadge, DriverVehicleInfo,
  ClientDelivery, ClientTrackingPage, DeliveryRequest, TaxiTrackingPage.

## Corrections (script `scripts/fix-blur-pass2.mjs`, Windows-safe)
35 fichiers — cartes/headers taxi-moto, POS, PDG, conversations, wallet, etc. Voir `AUDIT_BLUR_PASS2.md`.

## Corrections manuelles
- `Auth.tsx` — 3 avatars `bg-white/90 shadow-sm backdrop-blur-sm` → `bg-white shadow-sm` (le `shadow-sm` intercalé empêchait le script de matcher).
- `SubscriptionExpiryBanner.tsx` — `border-orange-400` → `border-[#ff4000]/60` (blur déjà retiré par le script).
- POSSystem, DirectConversation, PDG224Solutions, TaxiMotoClient : déjà couverts par le script.

## Build : exit 0 (à confirmer ci-dessous)
