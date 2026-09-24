import { act, renderHook, waitFor } from '@testing-library/react';
import { useTransactionHistory } from './use-transaction-history';

describe('useTransactionHistory', () => {
  const walletId = 'GABC123';

  function jsonResponse(body: unknown, ok = true, status = 200) {
    return Promise.resolve({
      ok,
      status,
      statusText: ok ? 'OK' : 'Error',
      json: () => Promise.resolve(body),
    } as Response);
  }

  it('fetches the first page of transactions', async () => {
    const fetcher = jest.fn(() =>
      jsonResponse({
        transactions: [
          { id: '1', walletId, hash: '0x1', amount: '10', asset: 'XLM', from: 'a', to: 'b', createdAt: '2024-01-01' },
        ],
        nextCursor: null,
      }),
    );

    const { result } = renderHook(() =>
      useTransactionHistory(walletId, { fetcher: fetcher as unknown as typeof fetch }),
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.transactions).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toContain(`/wallet/${walletId}/transactions`);
  });

  it('loads the next page via fetchMore using the cursor', async () => {
    const fetcher = jest
      .fn()
      .mockImplementationOnce(() =>
        jsonResponse({
          transactions: [
            { id: '1', walletId, hash: '0x1', amount: '10', asset: 'XLM', from: 'a', to: 'b', createdAt: '2024-01-01' },
          ],
          nextCursor: 'cursor-1',
        }),
      )
      .mockImplementationOnce(() =>
        jsonResponse({
          transactions: [
            { id: '2', walletId, hash: '0x2', amount: '20', asset: 'XLM', from: 'b', to: 'c', createdAt: '2024-01-02' },
          ],
          nextCursor: null,
        }),
      );

    const { result } = renderHook(() =>
      useTransactionHistory(walletId, { fetcher: fetcher as unknown as typeof fetch }),
    );

    await waitFor(() => expect(result.current.transactions).toHaveLength(1));

    await act(async () => {
      await result.current.fetchMore();
    });

    expect(result.current.transactions).toHaveLength(2);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][0]).toContain('cursor=cursor-1');
  });

  it('exposes an error when the request fails', async () => {
    const fetcher = jest.fn(() => jsonResponse({}, false, 500));

    const { result } = renderHook(() =>
      useTransactionHistory(walletId, { fetcher: fetcher as unknown as typeof fetch }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.transactions).toHaveLength(0);
  });

  it('does not fetch when walletId is missing', () => {
    const fetcher = jest.fn();

    const { result } = renderHook(() =>
      useTransactionHistory(undefined, { fetcher: fetcher as unknown as typeof fetch }),
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.transactions).toHaveLength(0);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
