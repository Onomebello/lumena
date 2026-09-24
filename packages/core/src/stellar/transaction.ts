import type {
  Keypair,
  Transaction,
  FeeBumpTransaction,
  Operation} from "@stellar/stellar-sdk";
import {
  TransactionBuilder
} from "@stellar/stellar-sdk";

export interface BuildFeeBumpOpts {
  feePayerKeypair: Keypair;
  innerTransaction: Transaction;
  baseFee?: string;
  networkPassphrase: string;
}

export function buildFeeBump(opts: BuildFeeBumpOpts): FeeBumpTransaction {
  const { feePayerKeypair, innerTransaction, baseFee = "1000000", networkPassphrase } = opts;

  const feeBump = TransactionBuilder.buildFeeBumpTransaction(
    feePayerKeypair,
    baseFee,
    innerTransaction,
    networkPassphrase
  );

  feeBump.sign(feePayerKeypair);

  return feeBump;
}

export interface BuildTransactionOpts {
  sourceAccount: string;
  operations: Operation[];
  baseFee?: string;
  networkPassphrase: string;
  timeout?: number;
}

export function buildTransaction(opts: BuildTransactionOpts): Transaction {
  const {
    sourceAccount,
    operations,
    baseFee = "100",
    networkPassphrase,
    timeout = 180
  } = opts;

  const builder = new TransactionBuilder(sourceAccount, {
    fee: baseFee,
    networkPassphrase
  });

  for (const operation of operations) {
    builder.addOperation(operation);
  }

  return builder.setTimeout(timeout).build();
}
