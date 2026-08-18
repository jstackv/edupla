/**
 * MTN Mobile Money (MoMo) — Collections API client.
 *
 * Docs: https://momodeveloper.mtn.com/api-documentation
 *
 * Important things this file assumes, so nothing here is "magic":
 *  - The RECEIVING account is whichever merchant/API-user is tied to
 *    MOMO_SUBSCRIPTION_KEY + MOMO_API_USER + MOMO_API_KEY. There is no way
 *    to point a payment at an arbitrary phone number via this API — only
 *    the PAYER's phone number is ever passed in.
 *  - Sandbox only accepts EUR as currency (MTN's own restriction). Once you
 *    have production credentials for your country, set MOMO_CURRENCY to
 *    the real local currency (e.g. RWF) and MOMO_ENV=production.
 *  - Every call needs a fresh-ish OAuth bearer token; tokens are cached in
 *    memory here and refreshed automatically ~1 minute before they expire.
 */

const REQUIRED_ENV = ["MOMO_SUBSCRIPTION_KEY", "MOMO_API_USER", "MOMO_API_KEY"];

function getConfig() {
  return {
    baseUrl: process.env.MOMO_BASE_URL || "https://sandbox.momodeveloper.mtn.com",
    targetEnvironment: process.env.MOMO_TARGET_ENVIRONMENT || "sandbox",
    subscriptionKey: process.env.MOMO_SUBSCRIPTION_KEY,
    apiUser: process.env.MOMO_API_USER,
    apiKey: process.env.MOMO_API_KEY,
    currency: process.env.MOMO_CURRENCY || "EUR",
    callbackHost: process.env.MOMO_CALLBACK_HOST || "edupla.vercel.app",
  };
}

function assertConfigured(cfg) {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length) {
    const err = new Error(
      `MTN MoMo is not configured yet. Missing env var(s): ${missing.join(", ")}. ` +
        `Run "node scripts/setupMomoSandbox.js" after subscribing to Collections on the MoMo Developer Portal.`,
    );
    err.code = "MOMO_NOT_CONFIGURED";
    throw err;
  }
}

// ── OAuth token cache ────────────────────────────────────────────────────
let tokenCache = { token: null, expiresAt: 0 };

async function getAccessToken() {
  const cfg = getConfig();
  assertConfigured(cfg);

  const now = Date.now();
  // Refresh a minute early so we never hand out a token that expires
  // mid-request.
  if (tokenCache.token && tokenCache.expiresAt - 60_000 > now) {
    return tokenCache.token;
  }

  const basicAuth = Buffer.from(`${cfg.apiUser}:${cfg.apiKey}`).toString("base64");
  const res = await fetch(`${cfg.baseUrl}/collection/token/`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Ocp-Apim-Subscription-Key": cfg.subscriptionKey,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`MoMo token request failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  tokenCache = {
    token: data.access_token,
    expiresAt: now + (Number(data.expires_in) || 3600) * 1000,
  };
  return tokenCache.token;
}

// Normalizes a Rwandan / generic MSISDN into the digits-only format MoMo
// expects (e.g. "+250 785 683 347" or "0785683347" -> "250785683347").
function normalizePhone(rawPhone) {
  const digits = String(rawPhone || "").replace(/\D/g, "");
  if (digits.startsWith("250")) return digits;
  if (digits.startsWith("0")) return `250${digits.slice(1)}`;
  return digits;
}

/**
 * Kick off a Collections "Request to Pay" — this is what pushes the USSD
 * approval prompt to the payer's phone. Resolves once MTN has ACCEPTED the
 * request for processing; it does NOT mean the user has approved it yet.
 * Use getRequestToPayStatus() to find out what actually happened.
 */
// MTN's gateway rejects non-ASCII characters (em dashes, curly quotes, accented
// letters, emoji, etc.) in payerMessage/payeeNote with a bare 400 and no error
// detail — so we strip anything outside printable ASCII before sending.
function toAscii(str) {
  return String(str || "").replace(/[^\x20-\x7E]/g, "");
}

async function requestToPay({ amount, currency, phone, externalId, referenceId, payerMessage, payeeNote }) {
  const cfg = getConfig();
  assertConfigured(cfg);
  const token = await getAccessToken();

  const payload = {
    amount: String(amount),
    currency: currency || cfg.currency,
    externalId: String(externalId),
    payer: { partyIdType: "MSISDN", partyId: normalizePhone(phone) },
    payerMessage: toAscii(payerMessage || "Edupla subscription payment"),
    payeeNote: toAscii(payeeNote || "Edupla subscription"),
  };

  if (process.env.MOMO_DEBUG === "true") {
    console.log("[momoService] requestToPay ->", {
      url: `${cfg.baseUrl}/collection/v1_0/requesttopay`,
      referenceId,
      targetEnvironment: cfg.targetEnvironment,
      subscriptionKeyPreview: cfg.subscriptionKey ? `${cfg.subscriptionKey.slice(0, 6)}...` : null,
      payload,
    });
  }

  const res = await fetch(`${cfg.baseUrl}/collection/v1_0/requesttopay`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Reference-Id": referenceId,
      "X-Target-Environment": cfg.targetEnvironment,
      "Ocp-Apim-Subscription-Key": cfg.subscriptionKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (res.status !== 202) {
    const body = await res.text().catch(() => "");
    if (process.env.MOMO_DEBUG === "true") {
      console.log("[momoService] requestToPay <-", {
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries()),
        body,
      });
    }
    throw new Error(`MoMo requestToPay failed (${res.status}): ${body}`);
  }

  return { referenceId };
}

/**
 * Poll the status of a previously-created requestToPay.
 * Returns MTN's raw payload; `status` is one of PENDING / SUCCESSFUL / FAILED.
 */
async function getRequestToPayStatus(referenceId) {
  const cfg = getConfig();
  assertConfigured(cfg);
  const token = await getAccessToken();

  const res = await fetch(`${cfg.baseUrl}/collection/v1_0/requesttopay/${referenceId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Target-Environment": cfg.targetEnvironment,
      "Ocp-Apim-Subscription-Key": cfg.subscriptionKey,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`MoMo status check failed (${res.status}): ${body}`);
  }

  return res.json();
}

// ── Sandbox provisioning (used only by scripts/setupMomoSandbox.js) ────
async function createSandboxApiUser(referenceId, callbackHost) {
  const cfg = getConfig();
  if (!cfg.subscriptionKey) {
    throw new Error("MOMO_SUBSCRIPTION_KEY is not set — subscribe to Collections first.");
  }

  const res = await fetch(`${cfg.baseUrl}/v1_0/apiuser`, {
    method: "POST",
    headers: {
      "X-Reference-Id": referenceId,
      "Ocp-Apim-Subscription-Key": cfg.subscriptionKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ providerCallbackHost: callbackHost || cfg.callbackHost }),
  });

  if (res.status !== 201) {
    const body = await res.text().catch(() => "");
    throw new Error(`Sandbox API user creation failed (${res.status}): ${body}`);
  }
  return true;
}

async function createSandboxApiKey(referenceId) {
  const cfg = getConfig();
  if (!cfg.subscriptionKey) {
    throw new Error("MOMO_SUBSCRIPTION_KEY is not set — subscribe to Collections first.");
  }

  const res = await fetch(`${cfg.baseUrl}/v1_0/apiuser/${referenceId}/apikey`, {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": cfg.subscriptionKey },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Sandbox API key creation failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  return data.apiKey;
}

module.exports = {
  getConfig,
  getAccessToken,
  requestToPay,
  getRequestToPayStatus,
  normalizePhone,
  createSandboxApiUser,
  createSandboxApiKey,
};