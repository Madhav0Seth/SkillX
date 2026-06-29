const fs = require("fs");
const path = require("path");

// Load .env file manually
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  }
}
const { createClient } = require("@supabase/supabase-js");

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
  const { error: rpcError } = await supabase.rpc("exec_sql", {
    query: `
      ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS name text;
    `
  });

  if (rpcError) {
    console.log("");
    console.log("⚠️  Automatic migration failed (this is normal — Supabase doesn't allow DDL via the API by default).");
    console.log("");
    console.log("👉 Please run this SQL manually in your Supabase Dashboard:");
    console.log("   1. Go to https://supabase.com/dashboard → your project");
    console.log("   2. Click 'SQL Editor' in the sidebar");
    console.log("   3. Paste and run this:");
    console.log("");
    console.log("   ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text;");
    console.log("   ALTER TABLE users ADD COLUMN IF NOT EXISTS name text;");
    console.log("");
    console.log("   After running it, click the 'Reload schema cache' button");
    console.log("   in Settings → API → Scroll down to the PostgREST section.");
    console.log("");
    return;
  }

  console.log("✅ Columns added successfully!");
}

run().catch((err) => {
  console.error("Script error:", err.message);
  process.exit(1);
});
