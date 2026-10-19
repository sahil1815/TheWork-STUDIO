import crypto from "crypto";

/**
 * Generate a cryptographically strong random token (hex string)
 */
export function generateSecureToken(byteLength: number = 32): string {
  return crypto.randomBytes(byteLength).toString("hex");
}

/**
 * Hash a plain token using SHA-256 for secure database storage
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
