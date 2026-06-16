/**
 * httpOnly session cookie (ADR-023): the SPA never reads the token from JS. SameSite=Strict
 * + HttpOnly; `Secure` is added in production (omitted here so it works over plain HTTP in
 * local dev). The cookie value is the opaque session token returned by login.
 */
export const SESSION_COOKIE_NAME = "des_session";

export function readSessionToken(cookieHeader: string | undefined): string | null {
  if (cookieHeader === undefined || cookieHeader.length === 0) {
    return null;
  }
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const name = trimmed.slice(0, separatorIndex);
    if (name === SESSION_COOKIE_NAME) {
      const value = trimmed.slice(separatorIndex + 1);
      return value.length === 0 ? null : value;
    }
  }
  return null;
}

export function buildSessionCookie(token: string, maxAgeSeconds: number, secure: boolean): string {
  const attributes = [
    SESSION_COOKIE_NAME + "=" + token,
    "HttpOnly",
    "SameSite=Strict",
    "Path=/",
    "Max-Age=" + Math.floor(maxAgeSeconds),
  ];
  if (secure) {
    attributes.push("Secure");
  }
  return attributes.join("; ");
}

export function buildClearedSessionCookie(): string {
  return [SESSION_COOKIE_NAME + "=", "HttpOnly", "SameSite=Strict", "Path=/", "Max-Age=0"].join("; ");
}
