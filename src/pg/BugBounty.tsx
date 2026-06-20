import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "@/hooks/useTranslation";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Shield, Trophy, Award } from "lucide-react";

const bugReportSchema = z.object({
  reporter_name: z.string().min(2, "Le nom doit contenir au moins 2 caractères").max(100),
  reporter_email: z.string().email("Email invalide").max(255),
  reporter_github: z.string().max(100).optional(),
  title: z.string().min(5, "Le titre doit contenir au moins 5 caractères").max(200),
  description: z.string().min(20, "La description doit contenir au moins 20 caractères").max(5000),
  severity: z.enum(["critical", "high", "medium", "low", "info"]),
  category: z.enum(["authentication", "authorization", "injection", "xss", "csrf", "data_exposure", "crypto", "business_logic", "other"]),
  steps_to_reproduce: z.string().min(20, "Veuillez fournir des étapes détaillées").max(5000),
  impact: z.string().min(20, "Veuillez décrire l'impact").max(5000),
  proof_of_concept: z.string().max(10000).optional(),
  suggested_fix: z.string().max(5000).optional(),
});

type BugReportFormData = z.infer<typeof bugReportSchema>;

const BugBounty = () => {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<BugReportFormData>({
    resolver: zodResolver(bugReportSchema),
    defaultValues: {
      severity: "medium",
      category: "other",
    },
  });

  const onSubmit = async (data: BugReportFormData) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("bug_reports").insert([data]);

      if (error) throw error;

      toast.success(t('bugBounty.rapportEnvoyeAvecSucces'), {
        description: "Notre équipe de sécurité examinera votre rapport. Merci pour votre contribution !",
      });
      form.reset();
    } catch (error: any) {
      console.error("Error submitting bug report:", error);
      toast.error(t('bugBounty.erreurLorsDeLEnvoi'), {
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4">
      <div className="max-w-4xl mx-auto space-y-8 py-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center mb-4">
            <Shield className="w-16 h-16 text-primary" />
          </div>
          <h1 className="text-4xl font-bold">Programme Bug Bounty 224Solutions</h1>
          <p className="text-xl text-muted-foreground">
            Aidez-nous à sécuriser notre plateforme et gagnez des récompenses
          </p>
        </div>

        {/* Rewards Info */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-[#ff4000]/10 to-[#ff4000]/10 border-[#ff4000]/20">
            <CardHeader className="pb-3">
              <Trophy className="w-8 h-8 text-[#ff4000] mb-2" />
              <CardTitle className="text-lg">Critique</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">500-2000€</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/10 border-orange-500/20">
            <CardHeader className="pb-3">
              <Award className="w-8 h-8 text-orange-500 mb-2" />
              <CardTitle className="text-lg">Haute</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">200-500€</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-[#ff4000]/10 to-[#ff4000]/10 border-[#ff4000]/20">
            <CardHeader className="pb-3">
              <Award className="w-8 h-8 text-[#ff4000] mb-2" />
              <CardTitle className="text-lg">Moyenne</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">50-200€</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-[#ff4000]/10 to-[#ff4000]/10 border-[#ff4000]/20">
            <CardHeader className="pb-3">
              <Award className="w-8 h-8 text-[#ff4000] mb-2" />
              <CardTitle className="text-lg">Basse</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">10-50€</p>
            </CardContent>
          </Card>
        </div>

        {/* Submission Form */}
        <Card>
          <CardHeader>
            <CardTitle>{t('bugBounty.soumettreUneVulnerabilite')}</CardTitle>
            <CardDescription>
              Remplissez ce formulaire pour signaler une vulnérabilité de sécurité
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="reporter_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom complet *</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="reporter_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="john@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="reporter_github"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('bugBounty.profilGithubOptionnel')}</FormLabel>
                      <FormControl>
                        <Input placeholder="@username" {...field} />
                      </FormControl>
                      <FormDescription>
                        Pour apparaître dans le Hall of Fame
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('bugBounty.titreDeLaVulnerabilite')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('bugBounty.sqlInjectionDansLaPage')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="severity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('bugBounty.severite')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('bugBounty.selectionnezLaSeverite')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="critical">Critique</SelectItem>
                            <SelectItem value="high">Haute</SelectItem>
                            <SelectItem value="medium">Moyenne</SelectItem>
                            <SelectItem value="low">Basse</SelectItem>
                            <SelectItem value="info">Info</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('bugBounty.categorie')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('bugBounty.selectionnezLaCategorie')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="authentication">Authentification</SelectItem>
                            <SelectItem value="authorization">Autorisation</SelectItem>
                            <SelectItem value="injection">Injection SQL/NoSQL</SelectItem>
                            <SelectItem value="xss">XSS (Cross-Site Scripting)</SelectItem>
                            <SelectItem value="csrf">CSRF</SelectItem>
                            <SelectItem value="data_exposure">{t('bugBounty.expositionDeDonnees')}</SelectItem>
                            <SelectItem value="crypto">Cryptographie</SelectItem>
                            <SelectItem value="business_logic">{t('bugBounty.logiqueMetier')}</SelectItem>
                            <SelectItem value="other">Autre</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('bugBounty.descriptionDetaillee')}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t('bugBounty.decrivezLaVulnerabiliteEnDetail')}
                          className="min-h-[120px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="steps_to_reproduce"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('bugBounty.etapesPourReproduire')}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t('bugBounty.t1AllezSurLaPage')}
                          className="min-h-[120px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="impact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Impact *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t('bugBounty.decrivezLImpactPotentielDe')}
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="proof_of_concept"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('bugBounty.preuveDeConceptOptionnel')}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t('bugBounty.codeCapturesDEcranVideo')}
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Ajoutez du code, des liens vers des captures d'écran, etc.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="suggested_fix"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('bugBounty.suggestionDeCorrectionOptionnel')}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t('bugBounty.commentPourraitOnCorrigerCette')}
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Envoi en cours..." : "Soumettre le rapport"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Rules */}
        <Card>
          <CardHeader>
            <CardTitle>{t('bugBounty.reglesDuProgramme')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">{t('bugBounty.scopeAutorise')}</h3>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>{t('bugBounty.t224solutionNetEtTousSes')}</li>
                <li>Applications mobiles officielles</li>
                <li>{t('bugBounty.apisPubliquesDocumentees')}</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Hors scope</h3>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Attaques par déni de service (DoS/DDoS)</li>
                <li>{t('bugBounty.spamOuPhishing')}</li>
                <li>{t('bugBounty.testsSurDesComptesQui')}</li>
                <li>Social engineering</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Conditions</h3>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Divulgation responsable uniquement</li>
                <li>{t('bugBounty.nePasExploiterLaVulnerabilite')}</li>
                <li>{t('bugBounty.nePasAccederAuxDonnees')}</li>
                <li>{t('bugBounty.rapportClairEtDetaille')}</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BugBounty;
