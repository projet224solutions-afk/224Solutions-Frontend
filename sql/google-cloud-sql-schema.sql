-- ============================================
-- 🗄️ GOOGLE CLOUD SQL - SCHÉMA PRINCIPAL
-- Base de données PostgreSQL pour 224Solutions
-- Compatible avec AWS Cognito (cognito_user_id)
-- ============================================

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- TABLE USERS (Profils liés à Cognito)
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cognito_user_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(50),
    avatar_url TEXT,
    city VARCHAR(100),
    country VARCHAR(100),
    country_code VARCHAR(10),
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    kyc_status VARCHAR(50) DEFAULT 'pending',
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Index pour recherches rapides
CREATE INDEX idx_users_cognito_id ON users(cognito_user_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = true;
CREATE INDEX idx_users_created_at ON users(created_at);

-- ==========================================
-- TABLE USER_ROLES (Rôles séparés - Sécurité)
-- ==========================================
CREATE TYPE app_role AS ENUM (
    'admin', 'ceo', 'pdg', 
    'client', 'vendeur', 'marchand',
    'livreur', 'taxi', 'transitaire',
    'syndicat', 'agent', 'vendor_agent'
);

CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role app_role NOT NULL DEFAULT 'client',
    granted_by UUID REFERENCES users(id),
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, role)
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role);

-- ==========================================
-- TABLE WALLETS
-- ==========================================
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance DECIMAL(15, 2) DEFAULT 0.00,
    currency VARCHAR(10) DEFAULT 'GNF',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX idx_wallets_user_id ON wallets(user_id);

-- ==========================================
-- TABLE WALLET_TRANSACTIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL REFERENCES wallets(id),
    user_id UUID NOT NULL REFERENCES users(id),
    type VARCHAR(50) NOT NULL, -- 'credit', 'debit', 'transfer'
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'GNF',
    description TEXT,
    reference_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'completed',
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wallet_tx_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX idx_wallet_tx_user_id ON wallet_transactions(user_id);
CREATE INDEX idx_wallet_tx_created_at ON wallet_transactions(created_at);

-- ==========================================
-- TABLE USER_SESSIONS (Audit des sessions)
-- ==========================================
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cognito_session_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    device_type VARCHAR(50),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_sessions_active ON user_sessions(is_active) WHERE is_active = true;

-- ==========================================
-- TABLE AUTH_AUDIT_LOG (Traçabilité sécurité)
-- ==========================================
CREATE TABLE IF NOT EXISTS auth_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL, -- 'login', 'logout', 'signup', 'password_reset', 'token_refresh'
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user_id ON auth_audit_log(user_id);
CREATE INDEX idx_audit_action ON auth_audit_log(action);
CREATE INDEX idx_audit_created_at ON auth_audit_log(created_at);

-- Partition par mois pour scalabilité (millions d'utilisateurs)
-- CREATE TABLE auth_audit_log_2026_03 PARTITION OF auth_audit_log
--   FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

-- ==========================================
-- FONCTION: Mise à jour automatique updated_at
-- ==========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallets_updated_at
    BEFORE UPDATE ON wallets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- FONCTION: has_role (vérification de rôle sécurisée)
-- ==========================================
CREATE OR REPLACE FUNCTION has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- ==========================================
-- FONCTION: Créer profil + wallet après inscription
-- ==========================================
CREATE OR REPLACE FUNCTION create_user_with_wallet(
    p_cognito_user_id VARCHAR,
    p_email VARCHAR,
    p_role app_role DEFAULT 'client',
    p_full_name VARCHAR DEFAULT NULL,
    p_phone VARCHAR DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Insérer l'utilisateur
    INSERT INTO users (cognito_user_id, email, full_name, phone)
    VALUES (p_cognito_user_id, p_email, p_full_name, p_phone)
    ON CONFLICT (cognito_user_id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, users.full_name),
        phone = COALESCE(EXCLUDED.phone, users.phone),
        updated_at = NOW()
    RETURNING id INTO v_user_id;

    -- Assigner le rôle
    INSERT INTO user_roles (user_id, role)
    VALUES (v_user_id, p_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Créer le wallet
    INSERT INTO wallets (user_id)
    VALUES (v_user_id)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN v_user_id;
END;
$$;
