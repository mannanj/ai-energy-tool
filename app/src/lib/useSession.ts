"use client";
import { useEffect, useState } from "react";
import { api, type Me } from "./api";
import { useTreeStore } from "./store";

export function useSession(): { me: Me | null; status: "loading" | "ready" | "redirecting" } {
  const [me, setMe] = useState<Me | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "redirecting">("loading");
  const connect = useTreeStore((s) => s.connect);

  useEffect(() => {
    let disconnect: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const { status, data } = await api<Me & { error?: string }>("/api/me");
      if (cancelled) return;
      if (status !== 200) {
        setStatus("redirecting");
        window.location.href = data.error === "gate" ? "/gate" : "/signin";
        return;
      }
      setMe(data);
      disconnect = connect(data);
      setStatus("ready");
    })();
    return () => { cancelled = true; disconnect?.(); };
  }, [connect]);

  return { me, status };
}
