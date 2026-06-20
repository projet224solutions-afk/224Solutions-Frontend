/**
 * 📖 DOCUMENTATION UTILISATEUR (PDG) — version ILLUSTRÉE
 * Guides par interface, consultables en ligne (avec schémas de parcours dessinés) et
 * TÉLÉCHARGEABLES en PDF de qualité pro (couverture + diagrammes vectoriels + badges).
 * Génération 100% client via jsPDF (aucune dépendance externe, rien n'est envoyé).
 * Contenu data-driven (tableau GUIDES) → facile à enrichir.
 */

import { useState } from 'react';
import jsPDF from 'jspdf';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen, Download, FileText, Users, Store, Bike, Car, UserCheck,
  Building2, Wallet, Utensils, ChevronDown, ChevronUp, ChevronRight, FileDown,
} from 'lucide-react';
import { toast } from 'sonner';

interface GuideSection { heading: string; steps: string[]; }
interface Guide {
  id: string;
  title: string;
  audience: string;
  icon: React.ElementType;
  color: { r: number; g: number; b: number };
  intro: string;
  flow: string[];          // parcours résumé (diagramme dessiné)
  sections: GuideSection[];
}

const BRAND = { r: 255, g: 64, b: 0 };     // #ff4000
const BLUE = { r: 4, g: 67, b: 158 };      // #04439e
const rgb = (c: { r: number; g: number; b: number }) => `rgb(${c.r}, ${c.g}, ${c.b})`;

// ── Contenu des guides ───────────────────────────────────────────────────────
const GUIDES: Guide[] = [
  {
    id: 'client', title: 'Guide Client (Acheteur)', audience: 'Clients / acheteurs',
    icon: Users, color: BRAND,
    intro: "Acheter des produits, payer en toute sécurité et suivre vos commandes et livraisons.",
    flow: ["S'inscrire", 'Choisir un produit', 'Payer (escrow)', 'Suivre la livraison', 'Confirmer la réception'],
    sections: [
      { heading: 'Créer son compte', steps: [
        "Ouvrez l'application et appuyez sur « S'inscrire ».",
        "Renseignez téléphone ou e-mail, puis validez le code reçu par SMS.",
        "Complétez votre profil. Le pays est verrouillé à l'inscription.",
      ]},
      { heading: 'Acheter un produit', steps: [
        "Parcourez le Marketplace ou utilisez la recherche / les filtres (pays, ville, catégorie).",
        "Ouvrez une fiche produit, vérifiez le prix (votre devise) et le vendeur.",
        "Appuyez sur « Acheter », puis confirmez la commande.",
      ]},
      { heading: 'Payer en sécurité (escrow)', steps: [
        "Choisissez votre moyen de paiement (wallet, mobile money…).",
        "Le montant est gardé en séquestre : le vendeur n'est payé qu'à la livraison confirmée.",
      ]},
      { heading: 'Suivre la livraison', steps: [
        "Dans « Mes commandes », suivez le statut et la position du livreur sur la carte.",
        "À la réception, confirmez la livraison pour libérer le paiement.",
      ]},
      { heading: 'Retour & remboursement', steps: [
        "Demandez un retour dans la fenêtre autorisée (14 jours).",
        "Après approbation et réception du produit, le remboursement est automatique.",
      ]},
    ],
  },
  {
    id: 'vendeur', title: 'Guide Vendeur (Boutique)', audience: 'Vendeurs / commerçants',
    icon: Store, color: BLUE,
    intro: "Créer votre boutique, gérer produits, ventes (en ligne + POS), livraisons, finances et abonnement.",
    flow: ['Créer la boutique', 'Ajouter des produits', 'Recevoir une commande', 'Expédier', 'Être payé'],
    sections: [
      { heading: 'Mettre en place sa boutique', steps: [
        "Activez votre profil vendeur et complétez la boutique (logo, pays, ville).",
        "Faites certifier la boutique pour le badge « Vérifié ».",
        "Choisissez votre abonnement vendeur (limites, options).",
      ]},
      { heading: 'Gérer les produits', steps: [
        "Produits → « Nouveau produit » : nom, prix, photos, stock, catégorie.",
        "Option vente par carton et code-barres POS automatiques.",
      ]},
      { heading: 'Vendre (en ligne et en boutique)', steps: [
        "Les commandes en ligne arrivent dans Commandes ; validez préparation et expédition.",
        "Vente directe : POS (hors-ligne + synchronisation). Encaissez à distance via un lien de paiement.",
      ]},
      { heading: 'Livraisons', steps: [
        "Créez une expédition pour qu'un livreur prenne le colis.",
        "Suivez chaque livraison en temps réel (statut + position) via « Suivre en direct ».",
      ]},
      { heading: 'Finances & affiliation', steps: [
        "Suivez dépenses, dettes fournisseurs, analyse de profit ; générez devis/factures PDF.",
        "Activez l'affiliation sur vos produits numériques (commission versée après livraison).",
      ]},
    ],
  },
  {
    id: 'livreur', title: 'Guide Livreur', audience: 'Livreurs', icon: Bike, color: BRAND,
    intro: "Passer en ligne, accepter des livraisons, suivre l'itinéraire et recevoir vos gains.",
    flow: ['Passer en ligne', 'Accepter', 'Récupérer le colis', 'Livrer', 'Gains crédités'],
    sections: [
      { heading: 'Démarrer', steps: [
        "Vérifiez votre abonnement et votre KYC.",
        "Activez le GPS et passez « En ligne » pour recevoir des missions.",
      ]},
      { heading: 'Réaliser une livraison', steps: [
        "Acceptez une livraison disponible (premier arrivé, premier servi).",
        "Au point de retrait, appuyez sur « Démarrer » (colis récupéré).",
        "Suivez l'itinéraire ; votre position est partagée en temps réel.",
        "À l'arrivée : photo de preuve / signature, puis « Terminer ».",
      ]},
      { heading: 'Gains', steps: [
        "À la livraison confirmée, votre gain (98,5 % des frais) est crédité automatiquement (paiement électronique).",
        "En espèces, vous encaissez directement. Suivez vos gains (jour/semaine/mois).",
      ]},
    ],
  },
  {
    id: 'taxi', title: 'Guide Taxi-Moto (Conducteur)', audience: 'Conducteurs taxi-moto',
    icon: Car, color: BLUE,
    intro: "Recevoir des courses, naviguer vers le client et être payé.",
    flow: ['Se mettre en ligne', 'Accepter la demande', 'Prendre le client', 'Déposer', 'Paiement'],
    sections: [
      { heading: 'Se mettre en ligne', steps: [
        "Activez le GPS (obligatoire) et passez « En ligne ».",
        "Vous apparaissez aux clients proches et recevez les demandes.",
      ]},
      { heading: 'Effectuer une course', steps: [
        "Acceptez une demande : le client voit votre position et l'ETA.",
        "Rejoignez le rendez-vous, prenez le client puis démarrez la course.",
        "À destination, terminez la course pour déclencher le paiement.",
      ]},
      { heading: 'Sécurité', steps: [
        "Bouton SOS en cas d'urgence ; position suivie pour la sécurité du trajet.",
      ]},
    ],
  },
  {
    id: 'agent', title: 'Guide Agent', audience: 'Agents PDG / vendeur', icon: UserCheck, color: BRAND,
    intro: "Recruter et activer des utilisateurs, suivre liens d'affiliation et commissions.",
    flow: ['Obtenir son lien', 'Inscrire des utilisateurs', 'Activité générée', 'Commissions'],
    sections: [
      { heading: "Liens d'affiliation", steps: [
        "Récupérez votre lien unique dans votre espace agent et partagez-le.",
      ]},
      { heading: 'Commissions', steps: [
        "Vous percevez une commission sur l'activité générée (abonnements, etc.).",
        "Suivez commissions et wallet dans le tableau de bord agent.",
      ]},
      { heading: 'Utilisateurs créés', steps: [
        "Activez et accompagnez les comptes créés ; accédez aux modules autorisés par le PDG.",
      ]},
    ],
  },
  {
    id: 'bureau', title: 'Guide Bureau Syndical', audience: 'Bureaux syndicaux', icon: Building2, color: BLUE,
    intro: "Gérer les membres, les véhicules et suivre l'activité du bureau.",
    flow: ['Connexion sécurisée', 'Enregistrer membres/véhicules', 'Suivi & statistiques'],
    sections: [
      { heading: 'Accès sécurisé', steps: [
        "Connectez-vous via le lien d'installation fourni par le PDG (session sécurisée, limitée à votre bureau).",
      ]},
      { heading: 'Gestion', steps: [
        "Enregistrez et suivez membres et véhicules (motos).",
        "Consultez les statistiques et le suivi en temps réel.",
      ]},
    ],
  },
  {
    id: 'wallet', title: 'Guide Wallet & Paiements', audience: 'Tous les utilisateurs', icon: Wallet, color: BRAND,
    intro: "Recharger, transférer de l'argent et comprendre frais et plafonds.",
    flow: ['Recharger', 'Choisir le destinataire', 'Vérifier les frais', 'Valider', 'Confirmation'],
    sections: [
      { heading: 'Le portefeuille', steps: [
        "Le solde est affiché dans votre devise locale ; rechargez via mobile money.",
      ]},
      { heading: "Transférer", steps: [
        "Saisissez destinataire (identifiant/téléphone) et montant.",
        "Taux et frais sont affichés avant validation ; des plafonds s'appliquent selon rôle et KYC.",
      ]},
      { heading: 'Sécurité', steps: [
        "Opérations atomiques et tracées. Complétez votre KYC pour augmenter vos plafonds.",
      ]},
    ],
  },
  {
    id: 'services', title: 'Guide Services (Restaurant, Pharmacie…)', audience: 'Prestataires de services',
    icon: Utensils, color: BLUE,
    intro: "Gérer un service (restaurant, pharmacie, proximité) : offre, commandes et livraison.",
    flow: ["Configurer l'offre", 'Recevoir commande/RDV', 'Valider', 'Livrer / Servir'],
    sections: [
      { heading: 'Restaurant', steps: [
        "Configurez menu, tables et zones de livraison ; acceptez les commandes (paiement validé serveur).",
        "Commandes non acceptées : annulées + remboursées automatiquement après 3 minutes.",
      ]},
      { heading: 'Pharmacie', steps: [
        "Le client envoie une ordonnance scannée ; le pharmacien valide avant paiement et livraison.",
      ]},
      { heading: 'Proximité', steps: [
        "Proposez vos prestations et gérez les réservations (rendez-vous).",
      ]},
    ],
  },
];

// ── Diagramme de parcours À L'ÉCRAN (boîtes + chevrons) ──────────────────────
function FlowDiagram({ steps, color }: { steps: string[]; color: { r: number; g: number; b: number } }) {
  return (
    <div className="flex flex-wrap items-stretch gap-2">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className="flex min-h-[44px] min-w-[96px] max-w-[140px] flex-col justify-center rounded-lg px-3 py-1.5 text-white shadow-sm"
            style={{ backgroundColor: rgb(color) }}
          >
            <span className="text-[10px] font-bold opacity-80">Étape {i + 1}</span>
            <span className="text-xs font-semibold leading-tight">{s}</span>
          </div>
          {i < steps.length - 1 && <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />}
        </div>
      ))}
    </div>
  );
}

// ── Génération PDF (couverture + diagrammes vectoriels) ──────────────────────
function drawHeaderBand(doc: jsPDF, color: { r: number; g: number; b: number }) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(color.r, color.g, color.b);
  doc.rect(0, 0, pageW, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('224Solutions — Guide d\'utilisation', 48, 19);
}

function drawCover(doc: jsPDF) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  // Fond bandeau
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.rect(0, 0, pageW, 220, 'F');
  doc.setFillColor(BLUE.r, BLUE.g, BLUE.b);
  doc.rect(0, 220, pageW, 6, 'F');

  // Logo simulé (rond + initiales)
  doc.setFillColor(255, 255, 255);
  doc.circle(pageW / 2, 110, 34, 'F');
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text('224', pageW / 2, 118, { align: 'center' });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.text('224SOLUTIONS', pageW / 2, 175, { align: 'center' });

  // Titre
  doc.setTextColor(25, 25, 25);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(30);
  doc.text("Documentation\nde l'application", pageW / 2, 300, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(110, 110, 110);
  doc.text("Guides d'utilisation par interface", pageW / 2, 360, { align: 'center' });

  // Sommaire
  let y = 410;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(BLUE.r, BLUE.g, BLUE.b);
  doc.text('Sommaire', 60, y);
  y += 20;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(50, 50, 50);
  GUIDES.forEach((g, i) => {
    doc.text(`${i + 1}.  ${g.title}`, 70, y);
    y += 18;
  });

  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, pageW / 2, pageH - 40, { align: 'center' });
}

// Dessine le parcours (boîtes arrondies reliées par des flèches), retourne le nouveau y.
function drawFlowPdf(
  doc: jsPDF, steps: string[], x: number, y: number, maxW: number, color: { r: number; g: number; b: number }
): number {
  const boxW = 150, boxH = 46, gapX = 24, gapY = 16;
  let cx = x, cy = y;
  steps.forEach((label, i) => {
    if (cx + boxW > x + maxW) { cx = x; cy += boxH + gapY; }
    doc.setFillColor(color.r, color.g, color.b);
    doc.roundedRect(cx, cy, boxW, boxH, 7, 7, 'F');
    // pastille numéro
    doc.setFillColor(255, 255, 255);
    doc.circle(cx + 15, cy + 15, 8, 'F');
    doc.setTextColor(color.r, color.g, color.b);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(String(i + 1), cx + 15, cy + 18, { align: 'center' });
    // libellé
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    const lines = doc.splitTextToSize(label, boxW - 34) as string[];
    doc.text(lines, cx + 30, cy + boxH / 2 - (lines.length - 1) * 4.5, { baseline: 'middle' });
    // flèche vers le suivant (même ligne)
    if (i < steps.length - 1 && cx + boxW + gapX + boxW <= x + maxW) {
      const ax = cx + boxW + gapX / 2, ay = cy + boxH / 2;
      doc.setFillColor(170, 170, 170);
      doc.triangle(ax - 5, ay - 5, ax + 5, ay, ax - 5, ay + 5, 'F');
    }
    cx += boxW + gapX;
  });
  return cy + boxH + 12;
}

function drawGuide(doc: jsPDF, guide: Guide) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxW = pageW - margin * 2;
  doc.addPage();
  drawHeaderBand(doc, guide.color);
  let y = 60;

  const ensure = (needed: number) => {
    if (y + needed > pageH - margin) { doc.addPage(); drawHeaderBand(doc, guide.color); y = 60; }
  };

  // Titre + public
  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.text(guide.title, margin, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text(`Public : ${guide.audience}`, margin, y);
  y += 16;

  // Intro
  doc.setTextColor(45, 45, 45);
  doc.setFontSize(11);
  const introLines = doc.splitTextToSize(guide.intro, maxW) as string[];
  doc.text(introLines, margin, y);
  y += introLines.length * 14 + 10;

  // Diagramme de parcours
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(guide.color.r, guide.color.g, guide.color.b);
  doc.text('Parcours en un coup d\'œil', margin, y);
  y += 14;
  ensure(120);
  y = drawFlowPdf(doc, guide.flow, margin, y, maxW, guide.color);
  y += 8;

  // Sections détaillées (badges numérotés)
  guide.sections.forEach((section, idx) => {
    ensure(34);
    // badge rond
    doc.setFillColor(guide.color.r, guide.color.g, guide.color.b);
    doc.circle(margin + 9, y - 3, 9, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(String(idx + 1), margin + 9, y, { align: 'center' });
    doc.setTextColor(BLUE.r, BLUE.g, BLUE.b);
    doc.setFontSize(13);
    doc.text(section.heading, margin + 26, y);
    y += 18;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(35, 35, 35);
    section.steps.forEach((step) => {
      const lines = doc.splitTextToSize(`•  ${step}`, maxW - 16) as string[];
      ensure(lines.length * 14);
      doc.text(lines, margin + 16, y);
      y += lines.length * 14 + 2;
    });
    y += 10;
  });

  // Pied de page
  doc.setFontSize(8);
  doc.setTextColor(160, 160, 160);
  doc.text('224Solutions — Documentation', margin, pageH - 20);
}

function generatePdf(guides: Guide[], filename: string) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  drawCover(doc);
  guides.forEach((g) => drawGuide(doc, g));
  doc.save(filename);
}

// ── Composant ────────────────────────────────────────────────────────────────
export default function PdgDocumentation() {
  const [expanded, setExpanded] = useState<string | null>(null);

  const handleDownload = (guide: Guide) => {
    try {
      generatePdf([guide], `Guide-224Solutions-${guide.id}.pdf`);
      toast.success(`Guide « ${guide.title} » téléchargé`);
    } catch (e) {
      console.error(e);
      toast.error('Échec de la génération du PDF');
    }
  };

  const handleDownloadAll = () => {
    try {
      generatePdf(GUIDES, 'Documentation-224Solutions-complete.pdf');
      toast.success('Documentation complète téléchargée');
    } catch (e) {
      console.error(e);
      toast.error('Échec de la génération du PDF');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-[#ff4000]" />
              Documentation de l'application
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Guides illustrés par interface (schémas de parcours). Consultez en ligne ou téléchargez
              un PDF professionnel à distribuer aux utilisateurs.
            </p>
          </div>
          <Button onClick={handleDownloadAll}>
            <FileDown className="mr-2 h-4 w-4" />
            Tout télécharger
          </Button>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {GUIDES.map((guide) => {
          const Icon = guide.icon;
          const isOpen = expanded === guide.id;
          return (
            <Card key={guide.id} className="overflow-hidden border-border/60">
              <div className="h-1.5 w-full" style={{ backgroundColor: rgb(guide.color) }} />
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-white"
                    style={{ backgroundColor: rgb(guide.color) }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold">{guide.title}</h3>
                    <Badge variant="outline" className="mt-1 text-xs">{guide.audience}</Badge>
                    <p className="mt-2 text-sm text-muted-foreground">{guide.intro}</p>

                    {/* Schéma de parcours (toujours visible) */}
                    <div className="mt-3 rounded-lg bg-muted/40 p-3">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Parcours en un coup d'œil
                      </p>
                      <FlowDiagram steps={guide.flow} color={guide.color} />
                    </div>

                    {isOpen && (
                      <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
                        {guide.sections.map((s, i) => (
                          <div key={i}>
                            <div className="flex items-center gap-2">
                              <span
                                className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-white"
                                style={{ backgroundColor: rgb(guide.color) }}
                              >
                                {i + 1}
                              </span>
                              <p className="text-sm font-medium text-[#04439e]">{s.heading}</p>
                            </div>
                            <ul className="mt-1 space-y-1 pl-7">
                              {s.steps.map((step, j) => (
                                <li key={j} className="flex gap-2 text-sm text-muted-foreground">
                                  <span className="text-[#ff4000]">•</span>
                                  <span>{step}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => setExpanded(isOpen ? null : guide.id)}>
                        {isOpen ? <ChevronUp className="mr-1.5 h-4 w-4" /> : <ChevronDown className="mr-1.5 h-4 w-4" />}
                        {isOpen ? 'Réduire' : 'Lire le guide'}
                      </Button>
                      <Button size="sm" onClick={() => handleDownload(guide)}>
                        <Download className="mr-1.5 h-4 w-4" />
                        Télécharger le PDF
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-dashed">
        <CardContent className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
          <FileText className="h-4 w-4 flex-shrink-0" />
          <span>
            PDF générés dans l'application (couverture + schémas dessinés). Pour ajouter de vraies
            captures d'écran, fournissez les images et je les intègre aux guides.
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
