"use client";

import { useState, type FormEvent } from "react";

type Status = "idle" | "submitting" | "success" | "error";

export default function ReportForm({ idPrefix }: { idPrefix: string }) {
  const [docsUrl, setDocsUrl] = useState("");
  const [packageName, setPackageName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setMessage(null);

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docsUrl, packageName, email }),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Something went wrong. Try again.");
        return;
      }

      setStatus("success");
      setMessage("Got it. We'll run your report and email you the broken samples.");
      setDocsUrl("");
      setPackageName("");
      setEmail("");
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Try again.");
    }
  }

  const submitting = status === "submitting";

  return (
    <form className="form-group" onSubmit={handleSubmit} noValidate>
      <input
        id={`${idPrefix}-docs-url`}
        type="text"
        name="docsUrl"
        placeholder="https://docs.yourdomain.com"
        value={docsUrl}
        onChange={(e) => setDocsUrl(e.target.value)}
        disabled={submitting}
        required
        aria-label="Docs URL"
      />
      <input
        id={`${idPrefix}-package-name`}
        type="text"
        name="packageName"
        placeholder="npm package name (e.g., @scope/pkg)"
        value={packageName}
        onChange={(e) => setPackageName(e.target.value)}
        disabled={submitting}
        required
        aria-label="npm package name"
      />
      <input
        id={`${idPrefix}-email`}
        type="email"
        name="email"
        placeholder="you@company.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={submitting}
        required
        aria-label="Email"
      />
      <button type="submit" disabled={submitting}>
        {submitting ? "Sending..." : "Get my report"}
      </button>
      {message && (
        <p className={`form-status ${status === "error" ? "form-status--error" : "form-status--success"}`}>
          {message}
        </p>
      )}
    </form>
  );
}
