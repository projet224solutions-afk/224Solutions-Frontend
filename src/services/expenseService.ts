/**
 * 💰 SERVICE GESTION DÉPENSES RÉEL - 224SOLUTIONS
 * Service opérationnel pour gestion des dépenses avec Supabase
 */

import { supabase } from '@/integrations/supabase/client';

export interface ExpenseCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  created_at: string;
}

export interface VendorExpense {
  id: string;
  vendor_id: string;          // = profiles.id (user id), pas vendors.id
  category_id: string;
  title: string;              // colonne réelle (NOT NULL)
  amount: number;
  currency?: string;
  expense_date?: string;
  description?: string;
  receipt_url?: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'paid';
  created_at: string;
  updated_at: string;
  category?: ExpenseCategory;
}

export interface ExpenseStats {
  total_expenses: number;
  monthly_expenses: number;
  category_breakdown: Array<{
    category_name: string;
    total: number;
    percentage: number;
  }>;
  monthly_trend: Array<{
    month: string;
    total: number;
  }>;
}

export interface ExpenseAlert {
  id: string;
  type: 'budget_exceeded' | 'unusual_expense' | 'missing_receipt';
  message: string;
  severity: 'low' | 'medium' | 'high';
  created_at: string;
}

class ExpenseService {
  /**
   * Obtenir les catégories de dépenses
   */
  async getCategories(): Promise<ExpenseCategory[]> {
    try {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .order('name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Erreur chargement catégories:', error);
      throw error;
    }
  }

  /**
   * Obtenir les dépenses d'un vendeur
   */
  async getExpenses(vendorId: string, filters?: unknown): Promise<VendorExpense[]> {
    try {
      let query = supabase
        .from('vendor_expenses')
        .select(`
          *,
          category:expense_categories(*)
        `)
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (filters?.category_id) {
        query = query.eq('category_id', filters.category_id);
      }

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.date_from) {
        query = query.gte('created_at', filters.date_from);
      }

      if (filters?.date_to) {
        query = query.lte('created_at', filters.date_to);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Erreur chargement dépenses:', error);
      throw error;
    }
  }

  /**
   * Créer une dépense
   */
  async createExpense(expense: Omit<VendorExpense, 'id' | 'created_at' | 'updated_at' | 'category'>): Promise<VendorExpense> {
    try {
      const { data, error } = await supabase
        .from('vendor_expenses')
        .insert(expense)
        .select(`
          *,
          category:expense_categories(*)
        `)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Erreur création dépense:', error);
      throw error;
    }
  }

  /**
   * Mettre à jour une dépense
   */
  async updateExpense(id: string, updates: Partial<VendorExpense>): Promise<VendorExpense> {
    try {
      const { data, error } = await supabase
        .from('vendor_expenses')
        .update(updates)
        .eq('id', id)
        .select(`
          *,
          category:expense_categories(*)
        `)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Erreur mise à jour dépense:', error);
      throw error;
    }
  }

  /**
   * Supprimer une dépense
   */
  async deleteExpense(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('vendor_expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('❌ Erreur suppression dépense:', error);
      throw error;
    }
  }

  /**
   * Obtenir les statistiques des dépenses
   */
  async getStats(vendorId: string): Promise<ExpenseStats> {
    try {
      // Total des dépenses (approved + paid pour inclure les achats)
      const { data: totalData, error: totalError } = await supabase
        .from('vendor_expenses')
        .select('amount')
        .eq('vendor_id', vendorId)
        .in('status', ['approved', 'paid']);

      if (totalError) throw totalError;

      const totalExpenses = totalData?.reduce((sum, expense) => sum + expense.amount, 0) || 0;

      // Dépenses du mois (approved + paid)
      // IMPORTANT: ne pas utiliser "-32" (date invalide) -> calcule le début du mois et le début du mois suivant
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
      const { data: monthlyData, error: monthlyError } = await supabase
        .from('vendor_expenses')
        .select('amount')
        .eq('vendor_id', vendorId)
        .in('status', ['approved', 'paid'])
        .gte('created_at', monthStart)
        .lt('created_at', nextMonthStart);

      if (monthlyError) throw monthlyError;

      const monthlyExpenses = monthlyData?.reduce((sum, expense) => sum + expense.amount, 0) || 0;

      // Répartition par catégorie (approved + paid)
      const { data: categoryData, error: categoryError } = await supabase
        .from('vendor_expenses')
        .select(`
          amount,
          category:expense_categories(name)
        `)
        .eq('vendor_id', vendorId)
        .in('status', ['approved', 'paid']);

      if (categoryError) throw categoryError;

      const categoryBreakdown = categoryData?.reduce((acc, expense: unknown) => {
        const category = expense.category;
        const categoryName = category?.name || 'Autres';
        if (!acc[categoryName]) {
          acc[categoryName] = 0;
        }
        acc[categoryName] += expense.amount;
        return acc;
      }, {} as Record<string, number>) || {};

      const categoryBreakdownArray = Object.entries(categoryBreakdown).map(([name, total]) => ({
        category_name: name,
        total,
        percentage: totalExpenses > 0 ? (total / totalExpenses) * 100 : 0
      }));

      return {
        total_expenses: totalExpenses,
        monthly_expenses: monthlyExpenses,
        category_breakdown: categoryBreakdownArray,
        monthly_trend: [] // TODO: Implémenter tendance mensuelle
      };
    } catch (error) {
      console.error('❌ Erreur chargement statistiques:', error);
      throw error;
    }
  }

  /**
   * Obtenir les alertes de dépenses
   */
  async getAlerts(vendorId: string): Promise<ExpenseAlert[]> {
    try {
      const { data, error } = await supabase
        .from('expense_alerts')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Erreur chargement alertes:', error);
      throw error;
    }
  }

  /**
   * Créer une catégorie de dépense
   */
  async createCategory(category: Omit<ExpenseCategory, 'id' | 'created_at'>): Promise<ExpenseCategory> {
    try {
      const { data, error } = await supabase
        .from('expense_categories')
        .insert(category)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Erreur création catégorie:', error);
      throw error;
    }
  }
}

export const expenseService = new ExpenseService();