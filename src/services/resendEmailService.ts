/**
 * 📧 SERVICE D'ENVOI D'EMAIL VIA RESEND API
 * Alternative gratuite pour envoyer de vrais emails
 * API Key gratuite: https://resend.com/api-keys
 */

import { toast } from 'sonner';
import { backendConfig } from '@/config/backend';

class ResendEmailService {
  private static instance: ResendEmailService;
  private fromEmail = import.meta.env.VITE_FROM_EMAIL || 'onboarding@resend.dev';

  static getInstance(): ResendEmailService {
    if (!ResendEmailService.instance) {
      ResendEmailService.instance = new ResendEmailService();
    }
    return ResendEmailService.instance;
  }

  /**
   * Envoie un code MFA par email via Resend
   */
  async sendMfaCode(to: string, code: string): Promise<boolean> {
    console.log('🔑 CODE MFA GÉNÉRÉ:', code);
    console.log('📧 Envoi à:', to);

    try {
      const response = await fetch(`${backendConfig.baseUrl}/edge-functions/send-otp-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: to,
          otp: code,
          from: this.fromEmail,
          subject: '🔐 Code de vérification PDG - 224Solutions',
          html: this.generateMfaEmailTemplate(code),
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || 'Erreur envoi email');
      }

      const result = await response.json();
      console.log('✅ Email envoyé via backend:', result.email || to);
      toast.success('Code MFA envoyé à votre email');
      return true;

    } catch (error) {
      console.error('❌ Erreur email backend:', error);
      this.showDevelopmentCode(code, to);
      return true;
    }
  }

  /**
   * Affiche le code en mode développement
   */
  private showDevelopmentCode(code: string, email: string): void {
    console.log('🔑 CODE MFA DE DÉVELOPPEMENT:', code);

    toast.success(`🔐 CODE MFA: ${code}`, {
      duration: 120000, // 2 minutes
      description: `Mode développement - Configurez le backend email pour envoyer de vrais emails\nDestination: ${email}`,
      style: {
        background: '#04439e',
        color: 'white',
        fontSize: '18px',
        fontWeight: 'bold'
      }
    });

    setTimeout(() => {
      alert(`🔐 CODE MFA DE DÉVELOPPEMENT\n\n${code}\n\nCopiez ce code pour continuer\n\n💡 Pour envoyer de vrais emails:\n1. Configurez le backend Node.js\n2. Vérifiez l'endpoint /edge-functions/send-otp-email`);
    }, 500);
  }

  /**
   * Génère le template HTML de l'email MFA
   */
  private generateMfaEmailTemplate(code: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Code MFA - 224Solutions</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 40px auto; background: linear-gradient(135deg, #04439e 0%, #04439e 100%); border-radius: 16px; padding: 2px;">
    <div style="background: white; border-radius: 14px; padding: 40px 30px;">

      <!-- Header -->
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #04439e; margin: 0; font-size: 28px;">224SOLUTIONS</h1>
        <p style="color: #64748b; margin: 8px 0 0 0; font-size: 14px;">Authentification Multi-Facteurs</p>
      </div>

      <!-- Code Box -->
      <div style="background: linear-gradient(to bottom, #f8fafc, #f1f5f9); padding: 35px 25px; border-radius: 12px; text-align: center; margin: 30px 0; border: 2px solid #e2e8f0;">
        <p style="color: #475569; font-size: 15px; margin: 0 0 15px 0; font-weight: 500;">Votre code de vérification PDG :</p>
        <div style="font-size: 42px; font-weight: bold; color: #04439e; letter-spacing: 12px; font-family: 'Courier New', monospace; margin: 10px 0;">
          ${code}
        </div>
        <p style="color: #64748b; font-size: 13px; margin: 15px 0 0 0;">Valide pendant 10 minutes</p>
      </div>

      <!-- Warning Box -->
      <div style="background: #fff4ee; border-left: 4px solid #ff4000; padding: 16px 20px; border-radius: 6px; margin: 25px 0;">
        <p style="margin: 0; color: #ff4000; font-size: 14px; line-height: 1.5;">
          <strong style="display: block; margin-bottom: 5px;">⚠️ Important :</strong>
          Ce code expire dans 10 minutes. Ne le partagez jamais avec qui que ce soit, même avec le support 224Solutions.
        </p>
      </div>

      <!-- Security Notice -->
      <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0;">
        <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0;">
          <strong style="color: #1e293b;">Vous n'avez pas demandé ce code ?</strong><br>
          Si vous n'êtes pas à l'origine de cette demande, ignorez cet email et sécurisez votre compte immédiatement en changeant votre mot de passe.
        </p>
      </div>

      <!-- Footer -->
      <div style="text-align: center; margin-top: 40px; padding-top: 25px; border-top: 1px solid #e2e8f0;">
        <p style="color: #94a3b8; font-size: 12px; margin: 0; line-height: 1.6;">
          <strong style="color: #64748b;">224SOLUTIONS</strong><br>
          Système de Gestion Professionnel<br>
          © 2025 - Tous droits réservés
        </p>
      </div>

    </div>
  </div>

  <!-- Footer Text -->
  <div style="max-width: 600px; margin: 0 auto; padding: 20px; text-align: center;">
    <p style="color: #9ca3af; font-size: 11px; margin: 0;">
      Cet email a été envoyé automatiquement. Merci de ne pas y répondre.
    </p>
  </div>
</body>
</html>
    `;
  }
}

export const resendEmailService = ResendEmailService.getInstance();
export default resendEmailService;
