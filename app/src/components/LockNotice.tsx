"use client";
import type { NodeLock } from "@/types/tree";
import { formatLockTime } from "@/lib/store";

export function LockNotice({ lock, className = "" }: { lock: NodeLock; className?: string }) {
  return (
    <div className={`truncate text-[11px] italic text-neutral-500 ${className}`} title={`${lock.userName} started editing at ${formatLockTime(lock.lockedAt)}`}>
      {lock.userName} is editing this as of {formatLockTime(lock.lastActivityAt)}
    </div>
  );
}
