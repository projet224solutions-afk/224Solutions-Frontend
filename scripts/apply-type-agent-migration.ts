#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing environment variables:");
  console.error("   Set: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyTypesAgentMigration() {
  try {
    console.log("🔄 Applying type_agent migration...\n");

    // Step 1: Add column
    console.log("1️⃣  Adding type_agent column...");
    const { data: d1, error: e1 } = await supabase.rpc("exec_sql", {
      sql_string: `
        ALTER TABLE public.agents_management
        ADD COLUMN IF NOT EXISTS type_agent TEXT DEFAULT 'principal';
      `,
    });

    if (e1 && e1.message !== "function exec_sql(json) does not exist") {
      throw e1;
    }

    // Step 2: Update existing rows
    console.log("2️⃣  Updating existing agents...");
    const { data: d2, error: e2 } = await supabase
      .from("agents_management")
      .update({ type_agent: "principal" })
      .is("type_agent", null);

    if (e2) {
      console.error("⚠️  Update error (may be OK if column exists):", e2);
    }

    // Step 3: Add constraint
    console.log("3️⃣  Adding CHECK constraint...");
    const { data: d3, error: e3 } = await supabase.rpc("exec_sql", {
      sql_string: `
        ALTER TABLE public.agents_management
        DROP CONSTRAINT IF EXISTS agents_management_type_agent_check;

        ALTER TABLE public.agents_management
        ADD CONSTRAINT agents_management_type_agent_check
        CHECK (type_agent IN ('principal', 'sous_agent', 'agent_regional', 'agent_local'));
      `,
    });

    if (e3 && e3.message !== "function exec_sql(json) does not exist") {
      throw e3;
    }

    // Step 4: Verify
    console.log("4️⃣  Verifying migration...");
    const { data: check, error: eCheck } = await supabase
      .from("agents_management")
      .select("id, type_agent")
      .limit(1);

    if (eCheck) {
      throw eCheck;
    }

    if (check && check[0]?.type_agent) {
      console.log("✅ type_agent column verified\n");
      console.log("🎉 Migration applied successfully!");
      return true;
    } else {
      console.error(
        "❌ Migration may have failed. Column not found in agents_management."
      );
      console.error("\n💡 Manual fix required:");
      console.error("   Go to Supabase Studio > SQL Editor and run:");
      console.error(`
      ALTER TABLE public.agents_management
      ADD COLUMN IF NOT EXISTS type_agent TEXT DEFAULT 'principal';
      
      UPDATE public.agents_management
      SET type_agent = 'principal'
      WHERE type_agent IS NULL;
      
      ALTER TABLE public.agents_management
      DROP CONSTRAINT IF EXISTS agents_management_type_agent_check;
      
      ALTER TABLE public.agents_management
      ADD CONSTRAINT agents_management_type_agent_check
      CHECK (type_agent IN ('principal', 'sous_agent', 'agent_regional', 'agent_local'));
      `);
      return false;
    }
  } catch (error) {
    console.error("❌ Migration failed:", error);
    return false;
  }
}

// Run migration
applyTypesAgentMigration().then((success) => {
  process.exit(success ? 0 : 1);
});
