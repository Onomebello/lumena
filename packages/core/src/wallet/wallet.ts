import type { Keypair, Asset} from "@stellar/stellar-sdk";
import { Operation, TransactionBuilder, BASE_FEE } from "@stellar/stellar-sdk";
import type { StellarClient } from "../stellar/client.js";
import { createSponsoredAccount } from "../stellar/account.js";
import { setupMultisig } from "../stellar/multisig.js";
import { KeyManager } from "../keys/manager.js";
import { ContractClient } from "../soroban/client.js";
import type { ContractSimulationResult } from "@lumen/types";

export interface WalletOpts {
  client: StellarClient;
  sponsorKeypair: Keypair;
  serverPublicKey: string;
  ownerKeypair?: Keypair;
}

export interface WalletRegistry {
  register(address: string): Promise<void> | void;
  list(): Promise<string[]> | string[];
}

export class InMemoryWalletRegistry implements WalletRegistry {
  private addresses: string[] = [];

  register(address: string): void {
    if (!this.addresses.includes(address)) {
      this.addresses.push(address);
    }
  }

  list(): string[] {
    return [...this.addresses];
  }
}

export class Wallet {
  private client: StellarClient;
  private sponsorKeypair: Keypair;
  private serverPublicKey: string;
  private keyManager: KeyManager;
  private _address: string | null = null;
  private _keypair: Keypair | null = null;
  private initialOwnerKeypair?: Keypair;

  constructor(opts: WalletOpts) {
    this.client = opts.client;
    this.sponsorKeypair = opts.sponsorKeypair;
    this.serverPublicKey = opts.serverPublicKey;
    this.initialOwnerKeypair = opts.ownerKeypair;
    this.keyManager = new KeyManager();
    if (opts.ownerKeypair) {
      this._keypair = opts.ownerKeypair;
    }
  }

  get address(): string {
    if (!this._address) throw new Error("Wallet not created yet");
    return this._address;
  }

  async create(): Promise<{ address: string; publicKey: string }> {
    if (!this._keypair) {
      this._keypair = this.keyManager.generateKeypair();
    }

    await createSponsoredAccount({
      client: this.client,
      sponsorKeypair: this.sponsorKeypair,
      newAccountKeypair: this._keypair,
    });

    await setupMultisig({
      client: this.client,
      accountKeypair: this._keypair,
      coSignerPublicKey: this.serverPublicKey,
    });

    this._address = this._keypair.publicKey();
    this.keyManager.store(this._keypair, "default");

    return { address: this._address, publicKey: this._address };
  }

  async getBalance(asset?: Asset): Promise<string> {
    const account = await this.client.horizon.loadAccount(this.address);

    if (!asset || asset.isNative()) {
      const balance = account.balances.find((b: any) => b.asset_type === "native");
      return balance?.balance ?? "0";
    }

    const balance = account.balances.find(
      (b: any) => b.asset_code === asset.getCode() && b.asset_issuer === asset.getIssuer()
    );
    return (balance as any)?.balance ?? "0";
  }

  async send(destination: string, asset: Asset, amount: string): Promise<{ hash: string }> {
    if (!this._keypair) throw new Error("Wallet not initialized");

    const account = await this.client.horizon.loadAccount(this.address);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.client.networkPassphrase,
    })
      .addOperation(
        Operation.payment({
          destination,
          asset,
          amount,
        })
      )
      .setTimeout(180)
      .build();

    tx.sign(this._keypair);

    const result = await this.client.horizon.submitTransaction(tx);

    if (result.successful) {
      return { hash: result.hash };
    }

    throw new Error(`Payment failed: ${result.hash}`);
  }

  async buildPaymentTransaction(destination: string, asset: Asset, amount: string): Promise<string> {
    if (!this._keypair) throw new Error("Wallet not initialized");

    const account = await this.client.horizon.loadAccount(this.address);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.client.networkPassphrase,
    })
      .addOperation(
        Operation.payment({
          destination,
          asset,
          amount,
        })
      )
      .setTimeout(180)
      .build();

    tx.sign(this._keypair);
    return tx.toXDR();
  }

  async simulateContract(
    contractId: string,
    method: string,
    args?: any[]
  ): Promise<ContractSimulationResult> {
    const contractClient = new ContractClient(this.client);
    return contractClient.simulate({ contractId, method, args }, this.address);
  }

  async buildContractInvocationTransaction(
    contractId: string,
    method: string,
    args?: any[],
    fee?: string
  ): Promise<string> {
    if (!this._keypair) throw new Error("Wallet not initialized");

    const contractClient = new ContractClient(this.client);
    const tx = await contractClient.buildTransaction({
      sourceAddress: this.address,
      invocation: { contractId, method, args },
      fee,
    });

    tx.sign(this._keypair);
    return tx.toXDR();
  }

  async invokeContract(
    contractId: string,
    method: string,
    args?: any[],
    fee?: string
  ): Promise<{ hash: string }> {
    if (!this._keypair) throw new Error("Wallet not initialized");

    const xdr = await this.buildContractInvocationTransaction(contractId, method, args, fee);
    const parsed = TransactionBuilder.fromXDR(xdr, this.client.networkPassphrase);

    const result = await this.client.horizon.submitTransaction(parsed as any);
    if (result.successful) {
      return { hash: result.hash };
    }

    throw new Error(`Contract invocation failed: ${result.hash}`);
  }

  getAddress(): string {
    return this.address;
  }
}
