-- ============================================================
-- 🔐 TABLE USERS POUR CLOUD SQL
-- Remplace la dépendance à auth.users de Supabase
-- Les user_id font référence à cette table au lieu de auth.users
-- ============================================================

-- Table principale des utilisateurs (synchronisée depuis Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cognito_user_id TEXT UNIQUE, -- Pour la sync Cognito (optionnel)
  supabase_user_id UUID UNIQUE NOT NULL, -- Lien vers Supabase auth.users
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  city TEXT,
  country TEXT,
  role user_role DEFAULT 'client',
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_supabase_id ON users(supabase_user_id);
CREATE INDEX IF NOT EXISTS idx_users_cognito_id ON users(cognito_user_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Table des rôles utilisateur
CREATE TABLE IF NOT EXISTS user_roles_cloud (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  granted_by UUID REFERENCES users(id),
  UNIQUE(user_id, role)
);

-- Table des wallets
CREATE TABLE IF NOT EXISTS wallets_cloud (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  balance NUMERIC(15,2) DEFAULT 0,
  currency TEXT DEFAULT 'GNF',
  status wallet_status DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Log d'audit auth
CREATE TABLE IF NOT EXISTS auth_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  success BOOLEAN DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_audit_user ON auth_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_action ON auth_audit_log(action);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER wallets_updated_at BEFORE UPDATE ON wallets_cloud
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
