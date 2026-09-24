# `@lumen/cli`

Command-Line Interface (CLI) tool for inspecting wallets, managing policy specs, monitoring sponsor balances, and decoding transactions in the Lumen ecosystem.

## Installation

```bash
# Executable directly via npx
npx @lumen/cli --help
```

## Commands Reference

### 1. `lumen status`
Checks the health of the Lumen server and the fee-sponsor account balance.

```bash
npx @lumen/cli status --server http://localhost:3000
```

### 2. `lumen policy get <walletId>`
Retrieves and displays the active policy rules for the specified wallet ID.

```bash
npx @lumen/cli policy get G...
```

### 3. `lumen policy set <file.json>`
Applies policy rules defined in a JSON file to a wallet.

```bash
npx @lumen/cli policy set ./policy-spec.json
```

### 4. `lumen policy delete <walletId>`
Removes the policy for the specified wallet ID.

```bash
npx @lumen/cli policy delete G...
```

### 5. `lumen wallet create`
Triggers creation of a new test sponsored wallet on the server.

```bash
npx @lumen/cli wallet create
```

### 6. `lumen cosign inspect <xdr>`
Decodes transaction XDR, displays operation details, and simulates policy checks.

```bash
npx @lumen/cli cosign inspect "AAAAAgAAA..."
```
