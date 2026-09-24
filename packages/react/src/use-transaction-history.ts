import { useCallback, useEffect, useRef, useState } from "react";
import { useLumen } from "./context.js";

export interface Transaction {
  id: string;
  [key: string]: unknown;
}

export interface UseTransactionHistoryResult {
  transactions: Transaction[];
  isLoading: boolean;
  error: Error | null;
  fetchMore: () => Promise<void>;
}

interface TransactionPage {
  transactions: Transaction[];
  cursor?: string | null;
}

/**
 * Consume the `GET /wallet/:address/transactions` endpoint with cursor-based
 * pagination.
 */
export function useTransactionHistory(
  walletId: string | undefined,
): UseTransactionHistoryResult {
  const { client } = useLumen();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(walletId));
  const [error, setError] = useState<Error | null>(null);
  const cursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    cursorRef.current = null;
    hasMoreRef.current = true;

    if (!walletId) {
      setTransactions([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    client
      .get<TransactionPage>(`/wallet/${walletId}/transactions`)
      .then((page) => {
        if (cancelled) return;
        setTransactions(page.transactions ?? []);
        cursorRef.current = page.cursor ?? null;
        hasMoreRef.current = Boolean(page.cursor);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, walletId]);

  const fetchMore = useCallback(async () => {
    if (!walletId || !hasMoreRef.current || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const cursor = cursorRef.current;
      const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
      const page = await client.get<TransactionPage>(
        `/wallet/${walletId}/transactions${query}`,
      );
      setTransactions((prev) => [...prev, ...(page.transactions ?? [])]);
      cursorRef.current = page.cursor ?? null;
      hasMoreRef.current = Boolean(page.cursor);
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [client, walletId, isLoading]);

  return { transactions, isLoading, error, fetchMore };
}
