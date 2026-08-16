import { Resend } from "resend";

export function getResendClient(): Resend {
  const key = process.env.RESEND_API_KEY;

  if (!key) {
    throw new Error("RESEND_API_KEY must be set.");
  }

  return new Resend(key);
}
