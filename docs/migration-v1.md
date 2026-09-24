# Migrating from `@lumen/web-sdk` v0.x to v1.0

This guide describes the planned breaking changes for the v1.0 release of
`@lumen/web-sdk` and its companion packages (`@lumen/core`, `@lumen/react`).
It is a living document: it will be updated as breaking changes are planned and
implemented. If you are currently on v0.x, use the before/after comparisons
below to prepare your codebase ahead of the upgrade.

> **Status:** planning. The exact surface may still change before v1.0 ships.

## Summary of breaking changes

| Area | v0.x | v1.0 |
| --- | --- | --- |
| Wallet access | `useWallet()` returns a single wallet | `useWallet()` returns the active wallet from a wallet registry |
| Transaction history | not available | new `useTransactionHistory()` hook |
| ScVal decoding | manual / ad-hoc | `decodeScVal()` in `@lumen/core` |
| Package entry points | deep imports | public entry points only |

## 1. Wallet access moves to a wallet registry

In v0.x a single wallet was assumed. In v1.0 wallets are registered and the
active wallet is selected explicitly, so multiple wallet providers can coexist.

**Before (v0.x)**

```ts
import { useWallet } from "@lumen/react";

function Connect() {
  const { address, connect, disconnect } = useWallet();
  return <button onClick={connect}>{address ?? "Connect"}</button>;
}
```

**After (v1.0)**

```ts
import { useWallet } from "@lumen/react";

function Connect() {
  const { address, connect, disconnect, wallets, activeWallet } = useWallet();
  return (
    <>
      <select onChange={(e) => activeWallet.set(e.target.value)}>
        {wallets.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
      <button onClick={connect}>{address ?? "Connect"}</button>
    </>
  );
}
```

## 2. Transaction history is now a first-class hook

v0.x had no built-in way to read a wallet's transaction history. v1.0 adds the
`useTransactionHistory()` hook in `@lumen/react`.

**Before (v0.x)**

```ts
// No SDK support — consumers had to query Horizon themselves.
```

**After (v1.0)**

```ts
import { useTransactionHistory } from "@lumen/react";

function History() {
  const { transactions, isLoading, error, refetch } = useTransactionHistory({
    address,
    limit: 20,
  });

  if (isLoading) return <p>Loading…</p>;
  if (error) return <p>{error.message}</p>;

  return (
    <ul>
      {transactions.map((tx) => (
        <li key={tx.hash}>{tx.hash}</li>
      ))}
    </ul>
  );
}
```

## 3. ScVal decoding is centralized in `@lumen/core`

v0.x left ScVal decoding to consumers. v1.0 exposes `decodeScVal()` from
`@lumen/core` so contract return values are decoded consistently.

**Before (v0.x)**

```ts
// Hand-rolled decoding per project.
const value = scValToNative(entry.val);
```

**After (v1.0)**

```ts
import { decodeScVal } from "@lumen/core";

const value = decodeScVal(entry.val);
```

## 4. Public entry points only

v1.0 removes deep imports into package internals. Import from the package root
instead.

**Before (v0.x)**

```ts
import { useWallet } from "@lumen/react/dist/use-wallet.js";
```

**After (v1.0)**

```ts
import { useWallet } from "@lumen/react";
```

## Deprecated APIs removed in v1.0

The following APIs are deprecated in v0.x and will be **removed** in v1.0:

- Deep imports into `@lumen/react/dist/*` and `@lumen/core/dist/*` — use the
  package entry points instead.
- The single-wallet assumption of `useWallet()` — use the wallet registry and
  the `activeWallet` selector instead.
- Ad-hoc ScVal decoding helpers — use `decodeScVal()` from `@lumen/core`.

## Keeping this guide up to date

When a breaking change is planned or implemented, add it here with a before and
after example and, if applicable, an entry in the deprecated APIs list above.
