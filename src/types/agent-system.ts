export type RoleType = 'pdg' | 'agent' | 'sub_agent';

export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at?: string | null;
}

export interface User extends BaseEntity {
  name: string;
  email?: string | null;
  role: RoleType;
  parent_id?: string | null;
}

export interface Agent extends BaseEntity {
  pdg_id: string;
  agent_code: string;
  name: string;
  email: string;
  phone: string;
  is_active: boolean;
  can_create_sub_agent?: boolean;
  permissions?: string[];
  total_users_created?: number;
  total_commissions_earned?: number;
}

export interface SubAgent extends Agent {
  parent_agent_id: string;
}

export interface Transaction extends BaseEntity {
  user_id: string;
  amount: number;
}

export type CommissionStatus = 'pending' | 'paid' | 'cancelled';

export interface Commission extends BaseEntity {
  agent_id: string;
  user_id: string;
  amount: number;
  status: CommissionStatus;
}


