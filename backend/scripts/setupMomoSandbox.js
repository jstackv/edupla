/**
 * One-time setup: generates a sandbox API User + API Key from your MTN MoMo
 * Collections Subscription (Primary) Key, so you don't have to hand-craft
 * curl/Postman requests.
 *
 * Usage:
 *   1. Put your Subscription Key in backend/.env as MOMO_SUBSCRIPTION_KEY
 *      (get it from momodeveloper.mtn.com -> Products -> Collections ->
 *      Subscribe -> Show Primary key).
 *   2. From the backend/ folder, run:
 *        node scripts/setupMomoSandbox.js
 *   3. Copy the MOMO_API_USER and MOMO_API_KEY lines it prints into your
 *      .env file. That's it — sandbox is ready to use.
 */

require("dotenv").config();
const crypto = require("crypto");
const { createSandboxApiUser, createSandboxApiKey } = require("../services/momoService");

async function main() {
  const subscriptionKey = process.env.MOMO_SUBSCRIPTION_KEY;
  if (!subscriptionKey) {
    console.error(
      "\n❌ MOMO_SUBSCRIPTION_KEY is not set in your .env file.\n" +
        "   Get it from momodeveloper.mtn.com -> Products -> Collections -> Subscribe -> Show Primary key,\n" +
        "   add it to backend/.env as MOMO_SUBSCRIPTION_KEY=..., then re-run this script.\n",
    );
    process.exit(1);
  }

  const callbackHost = process.env.MOMO_CALLBACK_HOST || "edupla.vercel.app";
  const referenceId = crypto.randomUUID();

  console.log(`\n🔧 Creating sandbox API user (reference: ${referenceId})...`);
  try {
    await createSandboxApiUser(referenceId, callbackHost);
    console.log("✅ API user created.");

    console.log("🔧 Generating API key...");
    const apiKey = await createSandboxApiKey(referenceId);
    console.log("✅ API key generated.\n");

    console.log("─".repeat(64));
    console.log("Add these two lines to backend/.env, then restart the server:\n");
    console.log(`MOMO_API_USER=${referenceId}`);
    console.log(`MOMO_API_KEY=${apiKey}`);
    console.log("\n" + "─".repeat(64));
    console.log(
      "\nSandbox is now ready. Test phone numbers for sandbox requestToPay\n" +
        "are documented under Documentation -> Sandbox Use Case on the MoMo\n" +
        "Developer Portal — use one of those, not a real personal number, when\n" +
        "testing in sandbox mode.\n",
    );
  } catch (err) {
    console.error(`\n❌ Setup failed: ${err.message}\n`);
    process.exit(1);
  }
}

main();
