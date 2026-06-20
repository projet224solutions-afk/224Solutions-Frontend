-- ============================================================
-- 🔄 MIGRATION SUPABASE → GOOGLE CLOUD SQL
-- Script 1: Création des types ENUM
-- Généré automatiquement depuis le schéma Supabase
-- 224SOLUTIONS - Migration unique + bascule
-- ============================================================

-- Types ENUM (reproduits depuis Supabase)
DO $$ BEGIN
  CREATE TYPE agent_type_enum AS ENUM ('commercial','logistique','support','administratif','manager','technique');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE call_status_type AS ENUM ('ringing','accepted','rejected','ended','missed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE commission_type AS ENUM ('percentage','fixed','tiered');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE decision_enum AS ENUM ('AUTO_APPROVED','ADMIN_REVIEW','BLOCKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE delivery_status AS ENUM ('pending','assigned','picked_up','in_transit','delivered','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE escrow_status_type AS ENUM ('holding','released','disputed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fraud_signal_enum AS ENUM ('UNUSUAL_AMOUNT','NEW_SELLER','HIGH_VELOCITY','RISKY_COUNTRY','SUSPICIOUS_PATTERN','CARD_TESTING','DEVICE_MISMATCH');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE id_normalization_reason AS ENUM ('duplicate_detected','format_invalid','prefix_mismatch','sequence_gap','collision_resolved','manual_override','migration_fix');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE message_type AS ENUM ('text','image','file','call','location','audio','video');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_source AS ENUM ('online','pos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('pending','confirmed','preparing','ready','in_transit','delivered','cancelled','completed','processing');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('mobile_money','card','cash','bank_transfer','wallet');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method_type AS ENUM ('card','wallet','mobile_money','escrow','orange_money','mtn','wave');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending','paid','failed','refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE release_status_enum AS ENUM ('PENDING','SCHEDULED','RELEASED','REJECTED','DISPUTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ride_status AS ENUM ('requested','accepted','in_progress','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE risk_level_enum AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE stripe_payment_status AS ENUM ('PENDING','PROCESSING','SUCCEEDED','FAILED','CANCELED','REFUNDED','DISPUTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE stripe_transaction_type AS ENUM ('PAYMENT','COMMISSION','WITHDRAWAL','REFUND','CHARGEBACK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE stripe_wallet_status AS ENUM ('ACTIVE','FROZEN','SUSPENDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE stripe_withdrawal_status AS ENUM ('PENDING','PROCESSING','COMPLETED','FAILED','CANCELED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tracking_status_type AS ENUM ('waiting','in_progress','delivered','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE transaction_status AS ENUM ('pending','processing','completed','failed','cancelled','refunded','disputed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE transaction_status_type AS ENUM ('pending','completed','failed','refunded','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE transaction_type AS ENUM ('transfer','deposit','withdrawal','payment','refund','commission','mobile_money_in','mobile_money_out','card_payment','bank_transfer','transfer_in','transfer_out');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE user_presence_status AS ENUM ('online','offline','away','busy','in_call');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin','vendeur','livreur','taxi','syndicat','transitaire','client','ceo','agent','pdg','prestataire','bureau','vendor_agent','driver');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE vehicle_type AS ENUM ('moto','car','bicycle','truck');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE vendor_certification_status AS ENUM ('NON_CERTIFIE','CERTIFIE','SUSPENDU');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE wallet_status AS ENUM ('active','suspended','blocked','pending_verification');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Activer les extensions nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
