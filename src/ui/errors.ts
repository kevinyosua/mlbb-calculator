import { useSyncExternalStore } from 'react';

export type ErrorCode = 'load' | 'rec';

let last: ErrorCode | null = null;
const subs = new Set<() => void>();

export function reportError(code: ErrorCode): void {
  last = code;
  for (const fn of subs) fn();
}

export function clearError(): void {
  last = null;
  for (const fn of subs) fn();
}

function subscribe(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

export function getLastError(): ErrorCode | null {
  return last;
}

export function useLastError(): ErrorCode | null {
  return useSyncExternalStore(subscribe, () => last);
}
