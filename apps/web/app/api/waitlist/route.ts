import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "../../../lib/supabase";
import { getResendClient } from "../../../lib/resend";
import { isValidEmail, normalizeDocsUrl, parseHttpsUrl } from "../../../lib/validate";
import { isRateLimited } from "../../../lib/rateLimit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { email, docsUrl, packageName } = (body ?? {}) as Record<string, unknown>;

  const parsedUrl = typeof docsUrl === "string" ? parseHttpsUrl(docsUrl) : null;
  if (!parsedUrl) {
    return NextResponse.json({ error: "That URL did not resolve. Check it and try again." }, { status: 400 });
  }

  const normalizedPackageName = typeof packageName === "string" ? packageName.trim() : "";
  if (!normalizedPackageName) {
    return NextResponse.json(
      { error: "We need the npm package name your docs are about to run the report." },
      { status: 400 },
    );
  }

  if (typeof email !== "string" || !isValidEmail(email)) {
    return NextResponse.json({ error: "That email address doesn't look right." }, { status: 400 });
  }

  const normalizedUrl = normalizeDocsUrl(parsedUrl);
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const supabase = getSupabaseServiceClient();
    const { error } = await supabase.from("report_requests").upsert(
      {
        email: normalizedEmail,
        docs_url: normalizedUrl,
        package_name: normalizedPackageName,
      },
      { onConflict: "email" },
    );

    if (error) {
      console.error("snippetcheck: supabase upsert failed", error);
      return NextResponse.json({ error: "Something went wrong on our end. Try again shortly." }, { status: 500 });
    }
  } catch (err) {
    console.error("snippetcheck: supabase client error", err);
    return NextResponse.json({ error: "Something went wrong on our end. Try again shortly." }, { status: 500 });
  }

  // A failed notification email shouldn't fail the request — the row is already saved.
  // The Resend SDK never throws for API-level failures (bad from-address, unverified
  // domain, etc.) — it always resolves with { data, error }. The error must be
  // checked explicitly or a failed send is indistinguishable from a successful one.
  try {
    const notifyEmail = process.env.NOTIFY_EMAIL;
    if (notifyEmail) {
      const resend = getResendClient();
      const { error } = await resend.emails.send({
        from: "snippetcheck <reports@snippetcheck.dev>",
        to: notifyEmail,
        subject: "New snippetcheck report request",
        text: `docs: ${normalizedUrl}\npackage: ${normalizedPackageName}\nemail: ${normalizedEmail}`,
      });
      if (error) {
        console.error("snippetcheck: resend notification rejected", error);
      }
    }
  } catch (err) {
    console.error("snippetcheck: resend notification failed", err);
  }

  return NextResponse.json({ ok: true });
}
