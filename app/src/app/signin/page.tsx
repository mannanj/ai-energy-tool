"use client";
import { useState } from "react";
import { api } from "@/lib/api";

export default function SignInPage() {
  const [f, setF] = useState({ firstName: "", lastName: "", email: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ devLink?: string } | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError("");
    const { status, data } = await api<{ error?: string; devLink?: string }>("/api/signin", { method: "POST", body: JSON.stringify(f) });
    if (status === 200) setSent({ devLink: data.devLink });
    else if (status === 401) window.location.href = "/gate";
    else setError(data.error ?? "Something went wrong");
    setBusy(false);
  };
  const input = "mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-[14px] outline-none focus:border-sky-500 dark:border-neutral-600 dark:bg-neutral-950";
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
        <h1 className="text-lg font-semibold">Sign in</h1>
        {sent ? (
          <div className="mt-2 text-[14px] leading-relaxed">
            <p>Check your email at <b>{f.email}</b> for a sign-in link. It works once and expires in 20 minutes.</p>
            {sent.devLink && <p className="mt-3 rounded bg-amber-50 p-2 text-[12px] text-amber-800">Dev mode, no email sent. <a className="underline" href={sent.devLink}>Open the link</a></p>}
            <button onClick={() => setSent(null)} className="mt-4 text-[12px] text-sky-700 underline">Use a different email</button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <p className="mt-1 text-[13px] text-neutral-500">We will email you a link. No password to remember.</p>
            <label className="mt-4 block text-[12px] text-neutral-600">First name<input autoFocus required value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} className={input} /></label>
            <label className="mt-3 block text-[12px] text-neutral-600">Last name<input required value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} className={input} /></label>
            <label className="mt-3 block text-[12px] text-neutral-600">Email<input required type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={input} /></label>
            {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}
            <button disabled={busy} className="mt-4 w-full rounded bg-sky-600 py-2 text-[14px] font-medium text-white hover:bg-sky-700 disabled:opacity-40">{busy ? "Sending…" : "Email me a sign-in link"}</button>
          </form>
        )}
      </div>
    </main>
  );
}
