import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useWalletBalance(userId: string | undefined) {
  const [balance, setBalance] = useState<number>(0);
  const [currency, setCurrency] = useState<string>('GNF');
  const [loading, setLoading] = useState(true);

  const loadBalance = async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('balance, currency')
        .eq('user_id', userId)
        .single();

      if (error) {
        // Si le wallet n'existe pas, utiliser la fonction RPC pour l'initialiser
        if (error.code === 'PGRST116') {
          console.log('⚠️ Wallet non trouvé, initialisation via RPC...');

          try {
            const { data: initResult, error: rpcError } = await supabase
              .rpc('initialize_user_wallet', { p_user_id: userId });

            if (rpcError) {
              console.error('❌ Erreur RPC:', rpcError);
            } else if (initResult) {
              const result = initResult as any;
              if (result.success) {
                console.log('✅ Wallet initialisé:', result);
                setBalance(result.balance || 0);
                setCurrency(result.currency || 'GNF');
              }
            }
          } catch (initError) {
            console.error('❌ Erreur initialisation wallet:', initError);
          }
        } else {
          console.error('Error loading wallet:', error);
        }
      } else if (data) {
        setBalance(data.balance || 0);
        setCurrency(data.currency || 'GNF');
      }
    } catch (error) {
      console.error('Error loading wallet balance:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBalance();

    // Listen for wallet updates
    const handleWalletUpdate = () => {
      loadBalance();
    };

    window.addEventListener('wallet-updated', handleWalletUpdate);

    // Subscribe to realtime updates
    const channel = supabase
      .channel('wallet-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wallets',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          console.log('💰 Wallet updated via realtime');
          loadBalance();
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener('wallet-updated', handleWalletUpdate);
      channel.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return { balance, currency, loading, reload: loadBalance };
}
