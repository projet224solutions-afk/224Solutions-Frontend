# 📱 Rapport d'audit PWA — Installabilité iOS

**App :** 224Solutions  
**Date :** 2026-06-12  
**Méthode :** vérification du build de production (`dist/`) + service réel des artefacts (HTTP).

---

## 1. Critères d'installabilité (manifest)
| Critère | État | Valeur |
|---|---|---|
| name | ✅ OK | 224Solutions - Taxi-Moto, Livraison & E-Commerce |
| short_name | ✅ OK | 224Solutions |
| start_url | ✅ OK | / |
| display | ✅ OK | standalone |
| scope | ✅ OK | / |
| theme_color | ✅ OK | #2563eb |
| icône 192px | ✅ OK | requis iOS/Android |
| icône 512px | ✅ OK | requis |
| nombre d'icônes | ✅ | 11 |

## 2. Balises iOS (index.html du build)
| Balise | État |
|---|---|
| apple-mobile-web-app-capable | ✅ OK |
| apple-mobile-web-app-status-bar-style | ✅ OK |
| apple-touch-icon | ✅ OK |
| apple-touch-startup-image (splash) | ✅ OK (5 écrans) |
| viewport-fit=cover (encoche) | ✅ OK |
| lien manifest | ✅ OK |

## 3. Service Worker (offline)
| Élément | État |
|---|---|
| service-worker.js présent dans dist | ✅ OK |
| version injectée (pas le placeholder) | ✅ OK `VF-MQBH61LN-R6JRUO` |
| précache app-shell | ✅ OK |
| page hors-ligne de secours | ✅ OK |
| enregistré en production | ✅ (src/main.tsx, actif hors DEV) |

## 4. UX d'installation
| Composant | État |
|---|---|
| AutoInstallPrompt (rendu global) | ✅ App.tsx |
| IOSInstallGuide (guide iOS immersif) | ✅ |
| Détection iOS fine (iPhone/iPad, exclut Chrome/Firefox iOS) | ✅ usePWAInstall |

## 5. Artefacts réellement servis (test HTTP du build)
```
/                       HTTP 200  [text/html]
/manifest.webmanifest   HTTP 200  [application/manifest+json]
/service-worker.js      HTTP 200  [text/javascript]
/icon-192.png           HTTP 200  [image/png]
/icon-512.png           HTTP 200  [image/png]
/apple-touch-icon.png   HTTP 200  [image/png]
```

---

## ✅ Verdict
**L'application remplit 100 % des critères techniques d'une PWA installable sur iOS** (iPhone / iPad).

### Conditions au moment de l'installation réelle
1. Site servi en **HTTPS** (prod Vercel ✅).
2. Ouvert dans **Safari** (Chrome/Firefox iOS ne permettent pas l'ajout à l'écran d'accueil).
3. Geste utilisateur : **Partager → « Sur l'écran d'accueil »**.

### Non disponible actuellement (pour information)
App **native** App Store / TestFlight — nécessite **macOS + Xcode** + compte Apple Developer (99 $/an).
Bloquants : plateforme iOS non générée (`ios/` absent), versions Capacitor à aligner (cli 8 vs core 7).

*Rapport généré automatiquement à partir du build réel.*