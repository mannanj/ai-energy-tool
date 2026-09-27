"use client";
import { useState } from "react";
import { api } from "@/lib/api";

export default function GatePage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError("");
    const { status, data } = await api<{ error?: string }>("/api/gate", { method: "POST", body: JSON.stringify({ password }) });
    if (status === 200) window.location.href = "/signin";
    else { setError(data.error ?? "Wrong password"); setBusy(false); }
  };
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
        <h1 className="text-lg font-semibold">AI Energy Tool</h1>
        <p className="mt-1 text-[13px] text-neutral-500">Enter the team password to continue.</p>
        <input type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password"
          className="mt-4 w-full rounded border border-neutral-300 px-3 py-2 text-[14px] outline-none focus:border-sky-500 dark:border-neutral-600 dark:bg-neutral-950" />
        {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}
        <button disabled={busy || !password} className="mt-4 w-full rounded bg-sky-600 py-2 text-[14px] font-medium text-white hover:bg-sky-700 disabled:opacity-40">Continue</button>
      </form>
    </main>
  );
}
