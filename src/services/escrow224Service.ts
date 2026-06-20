/**
 * Service Escrow 224SOLUTIONS
 * Gère les transactions escrow sécurisées
 */

import { supabase } from "@/integrations/supabase/client";

export interface EscrowTransaction {
  id: string;
  buyer_id: string;
  seller_id: string;
  order_id?: string;
  amount: number;
  currency: string;
  status: "pending" | "held" | "released" | "refunded";
  created_at: string;
  released_at?: string;
  refunded_at?: string;
  notes?: string;
  admin_action?: string;
  admin_id?: string;
}

export interface EscrowCreateRequest {
  buyer_id: string;
  seller_id: string;
  order_id?: string;
  amount: number;
  currency?: string;
}

export interface EscrowReleaseRequest {
  escrow_id: string;
  notes?: string;
}

export interface EscrowRefundRequest {
  escrow_id: string;
  reason: string;
}

export class Escrow224Service {
  /**
   * Créer une transaction escrow (bloquer les fonds)
   */
  static async createEscrow(request: EscrowCreateRequest) {
    console.log("[Escrow224] Creating escrow transaction", request);

    try {
      const { data, error } = await supabase.functions.invoke("escrow-create", {
        body: {
          buyer_id: request.buyer_id,
          seller_id: request.seller_id,
          order_id: request.order_id,
          amount: request.amount,
          currency: request.currency || "GNF",
        },
      });

      if (error) throw error;

      console.log("[Escrow224] Escrow created successfully", data);
      return { success: true, ...data };
    } catch (error) {
      console.error("[Escrow224] Error creating escrow:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Libérer les fonds au vendeur (Admin/PDG seulement)
   */
  static async releaseEscrow(request: EscrowReleaseRequest) {
    console.log("[Escrow224] Releasing escrow", request);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("User not authenticated");
      }

      const { data, error } = await supabase.functions.invoke(
        "escrow-release",
        {
          body: {
            escrow_id: request.escrow_id,
            notes: request.notes,
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (error) throw error;

      console.log("[Escrow224] Escrow released successfully", data);
      return { success: true, ...data };
    } catch (error) {
      console.error("[Escrow224] Error releasing escrow:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Rembourser l'acheteur (Admin/PDG seulement)
   */
  static async refundEscrow(request: EscrowRefundRequest) {
    console.log("[Escrow224] Refunding escrow", request);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("User not authenticated");
      }

      const { data, error } = await supabase.functions.invoke("escrow-refund", {
        body: {
          escrow_id: request.escrow_id,
          reason: request.reason,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      console.log("[Escrow224] Escrow refunded successfully", data);
      return { success: true, ...data };
    } catch (error) {
      console.error("[Escrow224] Error refunding escrow:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Obtenir les transactions escrow de l'utilisateur
   */
  static async getUserEscrows(userId: string) {
    try {
      const { data, error } = await supabase
        .from("escrow_transactions")
        .select("*")
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return { success: true, transactions: data as EscrowTransaction[] };
    } catch (error) {
      console.error("[Escrow224] Error fetching escrows:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        transactions: [],
      };
    }
  }

  /**
   * Obtenir les statistiques escrow (Admin/PDG)
   */
  static async getEscrowStats(startDate?: string, endDate?: string) {
    try {
      const { data, error } = await supabase.rpc("get_escrow_stats", {
        p_start_date: startDate || null,
        p_end_date: endDate || null,
      });

      if (error) throw error;

      return { success: true, stats: data };
    } catch (error) {
      console.error("[Escrow224] Error fetching stats:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Obtenir les logs d'une transaction escrow
   */
  static async getEscrowLogs(escrowId: string) {
    try {
      const { data, error } = await supabase
        .from("escrow_action_logs")
        .select("*")
        .eq("escrow_id", escrowId)
        .order("performed_at", { ascending: false });

      if (error) throw error;

      return { success: true, logs: data };
    } catch (error) {
      console.error("[Escrow224] Error fetching logs:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        logs: [],
      };
    }
  }
}
