/**
 * PAGE AIDE LIVREUR
 * FAQ, Support, Tutoriels
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { HelpCircle, MessageCircle, Phone, Mail, BookOpen, Video } from 'lucide-react';
import { DriverLayout } from '@/components/driver/DriverLayout';

export default function DriverHelp() {
  const { t } = useTranslation();
  const faqItems = [
    {
      question: "Comment accepter une livraison ?",
      answer: "Pour accepter une livraison, allez dans l'onglet 'Missions', consultez les livraisons disponibles et cliquez sur 'Accepter' sur celle qui vous convient. Assurez-vous d'être en ligne avec le GPS activé."
    },
    {
      question: "Comment mettre à jour ma position GPS ?",
      answer: "Votre position GPS est mise à jour automatiquement toutes les 30 secondes lorsque vous êtes en ligne. Assurez-vous que l'autorisation de localisation est activée dans les paramètres de votre appareil."
    },
    {
      question: "Que faire si j'ai un problème avec une livraison ?",
      answer: "Utilisez le bouton 'Signaler un problème' dans l'interface de livraison active, ou contactez le support directement via le chat. Notre équipe vous répondra dans les plus brefs délais."
    },
    {
      question: "Comment sont calculés mes gains ?",
      answer: "Vos gains sont calculés à partir des frais de livraison moins la commission de 1.5%. Vous pouvez consulter vos gains en temps réel dans l'onglet 'Portefeuille' et dans les statistiques."
    },
    {
      question: "Comment confirmer une livraison ?",
      answer: "Pour confirmer une livraison, prenez une photo de preuve, demandez la signature du client, puis cliquez sur 'Confirmer la livraison'. Les deux sont nécessaires pour valider la livraison."
    },
    {
      question: "Quand vais-je recevoir mes paiements ?",
      answer: "Les paiements sont traités automatiquement après chaque livraison confirmée. Vous pouvez retirer vos gains à tout moment depuis votre portefeuille 224Solutions."
    }
  ];

  return (
    <DriverLayout currentPage="help">
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Centre d'aide</h1>
          <p className="text-muted-foreground">{t('driverHelp.trouvezDesReponsesAVos')}</p>
        </div>

        {/* Recherche */}
        <div className="relative max-w-2xl mx-auto">
          <Input
            placeholder={t('driverHelp.rechercherDansLAide')}
            className="pl-10"
          />
          <HelpCircle className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        </div>

        {/* Contact rapide */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <MessageCircle className="h-8 w-8 mx-auto text-primary mb-2" />
              <CardTitle className="text-base">Chat en direct</CardTitle>
              <CardDescription>{t('driverHelp.supportInstantane')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                Démarrer un chat
              </Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <Phone className="h-8 w-8 mx-auto text-primary mb-2" />
              <CardTitle className="text-base">{t('driverHelp.appelerLeSupport')}</CardTitle>
              <CardDescription>+224 XXX XX XX XX</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                Appeler
              </Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <Mail className="h-8 w-8 mx-auto text-primary mb-2" />
              <CardTitle className="text-base">Email</CardTitle>
              <CardDescription>support@224solution.net</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                Envoyer un email
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* FAQ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Questions fréquentes
            </CardTitle>
            <CardDescription>{t('driverHelp.reponsesAuxQuestionsLesPlus')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {faqItems.map((item, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="text-left">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        {/* Tutoriels */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Tutoriels vidéo
            </CardTitle>
            <CardDescription>{t('driverHelp.apprenezAUtiliserToutesLes')}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
              <Badge className="mb-2">3 min</Badge>
              <h3 className="font-semibold mb-1">{t('driverHelp.demarrerAvec224solutions')}</h3>
              <p className="text-sm text-muted-foreground">{t('driverHelp.introductionCompleteALApplication')}</p>
            </div>
            <div className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
              <Badge className="mb-2">5 min</Badge>
              <h3 className="font-semibold mb-1">{t('driverHelp.accepterEtGererDesLivraisons')}</h3>
              <p className="text-sm text-muted-foreground">{t('driverHelp.workflowCompletDeLivraison')}</p>
            </div>
            <div className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
              <Badge className="mb-2">2 min</Badge>
              <h3 className="font-semibold mb-1">{t('driverHelp.utiliserLeGpsEtLa')}</h3>
              <p className="text-sm text-muted-foreground">{t('driverHelp.optimiserVosTrajets')}</p>
            </div>
            <div className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
              <Badge className="mb-2">4 min</Badge>
              <h3 className="font-semibold mb-1">{t('driverHelp.gererVosGains')}</h3>
              <p className="text-sm text-muted-foreground">{t('driverHelp.portefeuilleEtRetraits')}</p>
            </div>
          </CardContent>
        </Card>

        {/* Contact support */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6 text-center">
            <MessageCircle className="h-12 w-12 mx-auto text-primary mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t('driverHelp.besoinDAideSupplementaire')}</h3>
            <p className="text-muted-foreground mb-4">
              Notre équipe de support est disponible 24/7 pour vous aider
            </p>
            <Button>{t('driverHelp.contacterLeSupport')}</Button>
          </CardContent>
        </Card>
      </div>
    </DriverLayout>
  );
}
