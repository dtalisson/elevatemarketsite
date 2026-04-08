/**
 * HMAC-TOTP Verification Module
 * 
 * Instead of sending app_secret in plaintext, clients send:
 *   - app_hash: HMAC-SHA256(app_secret, time_step)
 *   - timestamp: current unix timestamp in seconds
 * 
 * The server computes the same HMAC for each app and matches.
 * Accepts current 30s window ± 1 window (90s total tolerance).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const TIME_STEP = 30; // seconds
const TOLERANCE = 1;  // ±1 window

async function computeHmac(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export interface VerifiedApp {
  id: string;
  enabled: boolean;
  current_version: string | null;
  min_version: string | null;
}

/**
 * Verifies the HMAC-TOTP hash against all applications.
 * Also supports legacy app_secret for backward compatibility.
 * 
 * @returns The matched application or null
 */
export async function verifyAppHmac(
  params: {
    app_hash?: string;
    app_secret?: string;
    timestamp?: number;
  },
  supabase: ReturnType<typeof createClient>
): Promise<{ app: VerifiedApp | null; error: string | null }> {
  // Legacy: if app_secret is provided directly, use old method
  if (params.app_secret && !params.app_hash) {
    const { data: app, error } = await supabase
      .from("applications")
      .select("id, enabled, current_version, min_version")
      .eq("secret_key", params.app_secret)
      .single();

    if (error || !app) {
      return { app: null, error: "Invalid application secret" };
    }
    return { app, error: null };
  }

  // HMAC-TOTP mode
  if (!params.app_hash || !params.timestamp) {
    return { app: null, error: "Missing app_hash and timestamp for HMAC verification" };
  }

  const clientTimestamp = params.timestamp;
  const serverTimestamp = Math.floor(Date.now() / 1000);

  // Reject if timestamp is too far off (more than 5 minutes)
  if (Math.abs(serverTimestamp - clientTimestamp) > 300) {
    return { app: null, error: "Timestamp too far from server time" };
  }

  const clientStep = Math.floor(clientTimestamp / TIME_STEP);

  // Fetch all apps (typically a small number per owner)
  const { data: apps, error: appsError } = await supabase
    .from("applications")
    .select("id, enabled, current_version, min_version, secret_key");

  if (appsError || !apps || apps.length === 0) {
    return { app: null, error: "No applications found" };
  }

  // Try to match the hash against each app with time tolerance
  for (const app of apps) {
    for (let offset = -TOLERANCE; offset <= TOLERANCE; offset++) {
      const step = (clientStep + offset).toString();
      const expectedHash = await computeHmac(app.secret_key, step);

      if (constantTimeEqual(params.app_hash, expectedHash)) {
        return {
          app: {
            id: app.id,
            enabled: app.enabled,
            current_version: app.current_version,
            min_version: app.min_version,
          },
          error: null,
        };
      }
    }
  }

  return { app: null, error: "Invalid application hash" };
}
