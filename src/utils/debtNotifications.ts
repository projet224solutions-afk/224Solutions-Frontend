import { supabase } from '@/integrations/supabase/client';

export async function sendDebtCreatedNotification(
  customerId: string | null,
  customerName: string,
  customerPhone: string,
  totalAmount: number,
  vendorName: string
) {
  try {
    // Si le client a un compte, créer une notification dans le système
    if (customerId) {
      const { error } = await supabase
        .from('communication_notifications')
        .insert({
          user_id: customerId,
          type: 'debt_created',
          title: 'Nouvelle dette enregistrée',
          body: `Une dette de ${totalAmount.toLocaleString('fr-FR')} GNF a été enregistrée chez ${vendorName}. Vous pouvez la payer en plusieurs tranches.`,
          metadata: {
            total_amount: totalAmount,
            vendor_name: vendorName
          }
        });

      if (error) {
        console.error('Erreur création notification dette:', error);
      }
    }

    // TODO: Envoyer un SMS au client
    // Utiliser le service de SMS pour envoyer un message au customerPhone
    console.log(`📱 SMS à envoyer à ${customerPhone}: Nouvelle dette de ${totalAmount} GNF chez ${vendorName}`);

  } catch (error) {
    console.error('Erreur notification dette:', error);
  }
}

export async function sendPaymentReceivedNotification(
  debtId: string,
  customerId: string | null,
  customerName: string,
  customerPhone: string,
  paymentAmount: number,
  remainingAmount: number,
  vendorName: string
) {
  try {
    // Si le client a un compte, créer une notification dans le système
    if (customerId) {
      const { error } = await supabase
        .from('communication_notifications')
        .insert({
          user_id: customerId,
          type: 'debt_payment',
          title: 'Paiement enregistré',
          body: `Votre paiement de ${paymentAmount.toLocaleString('fr-FR')} GNF a été enregistré chez ${vendorName}. Reste à payer: ${remainingAmount.toLocaleString('fr-FR')} GNF`,
          metadata: {
            payment_amount: paymentAmount,
            remaining_amount: remainingAmount,
            vendor_name: vendorName,
            debt_id: debtId
          }
        });

      if (error) {
        console.error('Erreur création notification paiement:', error);
      }
    }

    // TODO: Envoyer un SMS au client
    console.log(`📱 SMS à envoyer à ${customerPhone}: Paiement de ${paymentAmount} GNF reçu. Reste: ${remainingAmount} GNF`);

  } catch (error) {
    console.error('Erreur notification paiement:', error);
  }
}

export async function sendDebtPaidNotification(
  customerId: string | null,
  customerName: string,
  customerPhone: string,
  totalAmount: number,
  vendorName: string
) {
  try {
    // Si le client a un compte, créer une notification dans le système
    if (customerId) {
      const { error } = await supabase
        .from('communication_notifications')
        .insert({
          user_id: customerId,
          type: 'debt_paid',
          title: 'Dette totalement payée ! 🎉',
          body: `Félicitations ! Votre dette de ${totalAmount.toLocaleString('fr-FR')} GNF chez ${vendorName} est entièrement payée.`,
          metadata: {
            total_amount: totalAmount,
            vendor_name: vendorName
          }
        });

      if (error) {
        console.error('Erreur création notification dette payée:', error);
      }
    }

    // TODO: Envoyer un SMS au client
    console.log(`📱 SMS à envoyer à ${customerPhone}: Dette de ${totalAmount} GNF totalement payée chez ${vendorName} !`);

  } catch (error) {
    console.error('Erreur notification dette payée:', error);
  }
}

export async function checkOverdueDebts() {
  try {
    // Appeler la fonction check_overdue_debts
    const { error } = await supabase.rpc('check_overdue_debts');

    if (error) {
      console.error('Erreur vérification dettes en retard:', error);
    }
  } catch (error) {
    console.error('Erreur vérification dettes en retard:', error);
  }
}
