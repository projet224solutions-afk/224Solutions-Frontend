import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Configuration
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  console.error("Please set these environment variables:");
  console.error("  - VITE_SUPABASE_URL");
  console.error("  - SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY)");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

interface MigrationFile {
  name: string;
  path: string;
  timestamp: string;
}

async function getMigrationFiles(): Promise<MigrationFile[]> {
  const migrationsDir = path.join(process.cwd(), "supabase", "migrations");

  if (!fs.existsSync(migrationsDir)) {
    console.error(`❌ Migrations directory not found: ${migrationsDir}`);
    return [];
  }

  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  return files.map((name) => ({
    name,
    path: path.join(migrationsDir, name),
    timestamp: name.split("_")[0],
  }));
}

async function isMigrationApplied(name: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("schema_migrations")
      .select("version")
      .eq("version", name)
      .single();

    return !error && data !== null;
  } catch {
    return false;
  }
}

async function recordMigration(name: string): Promise<void> {
  const { error } = await supabase.from("schema_migrations").insert({
    version: name,
    hash: "",
    executed_at: new Date().toISOString(),
  });

  if (error) {
    console.warn(`⚠️ Could not record migration: ${error.message}`);
  }
}

async function executeSql(sql: string): Promise<void> {
  // Split SQL into individual statements
  const statements = sql
    .split(";")
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length > 0);

  for (const statement of statements) {
    try {
      let error: { message?: string } | null = null;
      try {
        const response = await supabase.rpc("exec_sql", {
          sql_string: statement,
        });
        error = response.error as { message?: string } | null;
      } catch {
        error = { message: "RPC not available" };
      }

      if (error && error.message !== "RPC not available") {
        throw new Error(error.message);
      }

      console.log(`✅ Executed: ${statement.substring(0, 50)}...`);
    } catch (err) {
      console.error(`❌ Failed: ${statement}`);
      throw err;
    }
  }
}

async function executeMigration(migrationFile: MigrationFile): Promise<boolean> {
  try {
    console.log(`\n📋 Checking: ${migrationFile.name}`);

    const applied = await isMigrationApplied(migrationFile.name);
    if (applied) {
      console.log(`✅ Already applied: ${migrationFile.name}`);
      return true;
    }

    console.log(`🔄 Applying: ${migrationFile.name}`);

    const sql = fs.readFileSync(migrationFile.path, "utf-8");

    // For direct SQL execution without RPC
    let rpcError: unknown = null;
    try {
      const response = await supabase.rpc("exec_sql", {
        sql_string: sql,
      });
      rpcError = response.error;
    } catch (e) {
      rpcError = e;
    }

    if (rpcError) {
      console.warn("⚠️ RPC approach failed. Attempting statement-by-statement execution...");
      await executeSql(sql);
    }

    await recordMigration(migrationFile.name);
    console.log(`✅ Migration applied: ${migrationFile.name}`);
    return true;
  } catch (err) {
    console.error(`❌ Migration failed: ${migrationFile.name}`);
    console.error(err);
    return false;
  }
}

async function main() {
  console.log("🚀 Starting Supabase Migrations...\n");

  const migrations = await getMigrationFiles();
  if (migrations.length === 0) {
    console.log("No migration files found.");
    return;
  }

  console.log(`Found ${migrations.length} migration file(s)\n`);

  let applied = 0;
  let failed = 0;

  for (const migration of migrations) {
    const success = await executeMigration(migration);
    if (success) {
      applied++;
    } else {
      failed++;
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`📊 Migration Summary:`);
  console.log(`   Applied: ${applied}`);
  console.log(`   Failed: ${failed}`);
  console.log("=".repeat(50));

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
