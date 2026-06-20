#!/usr/bin/env node

/**
 * EDGE FUNCTIONS AUTO-INTEGRATION SCRIPT
 * 
 * This script automatically integrates the Edge Functions routes into backend/src/server.ts
 * Run: npm run integrate:edge-functions
 * Or: npx ts-node scripts/integrate-edge-functions.ts
 */

import * as fs from "fs";
import * as path from "path";

const SERVER_FILE = path.join(
  process.cwd(),
  "backend",
  "src",
  "server.ts"
);

const IMPORT_LINE = `// @ts-ignore
import edgeFunctionsRoutes from './routes/edge-functions/index.js';`;

const MOUNT_LINE = `// Edge Functions - Migrated from Supabase
app.use('/edge-functions', edgeFunctionsRoutes);`;

function checkServerFile(): boolean {
  if (!fs.existsSync(SERVER_FILE)) {
    console.error(`❌ Server file not found: ${SERVER_FILE}`);
    return false;
  }
  return true;
}

function isAlreadyIntegrated(content: string): boolean {
  return (
    content.includes("import edgeFunctionsRoutes") ||
    content.includes("app.use('/edge-functions'")
  );
}

function integrateImport(content: string): string {
  // Find the last import statement
  const lastImportMatch = content.match(/import .* from '.*';\n/g);
  if (!lastImportMatch) {
    console.warn("⚠️  No imports found - adding at beginning");
    return IMPORT_LINE + "\n\n" + content;
  }

  const lastImport = lastImportMatch[lastImportMatch.length - 1];
  const insertIndex = content.indexOf(lastImport) + lastImport.length;

  return (
    content.slice(0, insertIndex) +
    "\n" +
    IMPORT_LINE +
    "\n" +
    content.slice(insertIndex)
  );
}

function integrateMountPoint(content: string): string {
  // Find the "V3 ROUTES" section or similar
  const v3RoutesMatch = content.match(/app\.use\('\/api\/payment-links'/);

  if (!v3RoutesMatch) {
    console.warn(
      "⚠️  Could not find mount point for routes - adding before error handler"
    );
    const errorHandlerMatch = content.match(
      /app\.use\(\(_req, res\) => \{[\s\S]*?res\.status\(404\)/
    );
    if (errorHandlerMatch) {
      const insertIndex = content.indexOf(errorHandlerMatch[0]);
      return (
        content.slice(0, insertIndex) +
        "\n" +
        MOUNT_LINE +
        "\n\n" +
        content.slice(insertIndex)
      );
    }
  }

  const insertIndex =
    content.indexOf(v3RoutesMatch![0]) + v3RoutesMatch![0].length;
  return (
    content.slice(0, insertIndex + 50) + // Add some buffer
    "\n" +
    MOUNT_LINE +
    "\n" +
    content.slice(insertIndex + 50)
  );
}

function main() {
  console.log("🚀 Integrating Edge Functions into backend...\n");

  // Step 1: Check file exists
  if (!checkServerFile()) {
    process.exit(1);
  }

  // Step 2: Read content
  console.log("📖 Reading server.ts...");
  let content = fs.readFileSync(SERVER_FILE, "utf-8");

  // Step 3: Check if already integrated
  if (isAlreadyIntegrated(content)) {
    console.log("✅ Edge Functions already integrated!");
    process.exit(0);
  }

  // Step 4: Integrate import
  console.log("📝 Adding import statement...");
  content = integrateImport(content);

  // Step 5: Integrate mount point
  console.log("📝 Adding route mount point...");
  content = integrateMountPoint(content);

  // Step 6: Write back
  console.log("💾 Writing updated server.ts...");
  fs.writeFileSync(SERVER_FILE, content, "utf-8");

  console.log("\n✅ Edge Functions successfully integrated!");
  console.log("\n📋 Next steps:");
  console.log("   1. Review the changes in backend/src/server.ts");
  console.log("   2. Test: npm run dev:backend");
  console.log("   3. Try: curl http://localhost:3001/edge-functions/health");
  console.log("\n📚 For more info, see: EDGE_FUNCTIONS_MIGRATION_COMPLETE.md");
}

main();
