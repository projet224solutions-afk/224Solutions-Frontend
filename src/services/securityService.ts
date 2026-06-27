// SERVICE DE SÉCURITÉ (VERSION SIMPLIFIÉE)

export interface SecurityToken {
  id: string;
  token: string;
  type: string;
  expiresAt: string;
}

class SecurityService {
  async generateToken(): Promise<SecurityToken | null> {
    return null;
  }

  async validateToken(_token: string): Promise<boolean> {
    return false;
  }
}

export default new SecurityService();
