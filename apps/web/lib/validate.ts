const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

export function parseHttpsUrl(input: string): URL | null {
  try {
    const url = new URL(input);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export function normalizeDocsUrl(url: URL): string {
  return `${url.origin}${url.pathname}`.replace(/\/$/, "");
}
