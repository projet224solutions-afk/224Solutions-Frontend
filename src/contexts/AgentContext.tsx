import React, { createContext, useContext, ReactNode } from 'react';

export interface VendorAgentPermissions {
  view_dashboard?: boolean;
  view_analytics?: boolean;
  access_pos?: boolean;
  manage_products?: boolean;
  manage_orders?: boolean;
  manage_inventory?: boolean;
  manage_warehouse?: boolean;
  manage_suppliers?: boolean;
  manage_agents?: boolean;
  manage_clients?: boolean;
  manage_prospects?: boolean;
  manage_marketing?: boolean;
  access_wallet?: boolean;
  manage_payments?: boolean;
  manage_payment_links?: boolean;
  manage_expenses?: boolean;
  manage_debts?: boolean;
  access_affiliate?: boolean;
  manage_delivery?: boolean;
  access_support?: boolean;
  access_communication?: boolean;
  view_reports?: boolean;
  access_settings?: boolean;
}

export interface VendorAgent {
  id: string;
  vendor_id: string;
  agent_code: string;
  name: string;
  email: string;
  phone: string;
  access_token: string;
  permissions: VendorAgentPermissions;
  can_create_sub_agent: boolean;
  is_active: boolean;
  created_at: string;
}

interface AgentContextType {
  agent: VendorAgent | null;
  vendorId: string | null;
  hasPermission: (permission: string) => boolean;
}

const defaultContext: AgentContextType = {
  agent: null,
  vendorId: null,
  hasPermission: () => false,
};

const AgentContext = createContext<AgentContextType>(defaultContext);

export const useAgent = () => {
  return useContext(AgentContext);
};

interface AgentProviderProps {
  agent: VendorAgent;
  children: ReactNode;
}

export const AgentProvider: React.FC<AgentProviderProps> = ({ agent, children }) => {
  const hasPermission = (permission: string) => {
    return agent?.permissions?.[permission as keyof VendorAgentPermissions] || false;
  };

  const value: AgentContextType = {
    agent,
    vendorId: agent.vendor_id,
    hasPermission,
  };

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
};
