import { describe, it, expect, vi } from "vitest";
import { Keypair, xdr } from "@stellar/stellar-sdk";
import { StellarClient } from "../stellar/client.js";
import { toScVal, fromScVal } from "../soroban/scval.js";
import { ContractClient } from "../soroban/client.js";

describe("Soroban ScVal Conversion & ContractClient Unit Tests", () => {
  const contractId = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
  const userAddress = Keypair.random().publicKey();

  describe("toScVal & fromScVal", () => {
    it("converts boolean values", () => {
      const scValTrue = toScVal(true);
      expect(fromScVal(scValTrue)).toBe(true);

      const scValFalse = toScVal(false);
      expect(fromScVal(scValFalse)).toBe(false);
    });

    it("converts integer numbers and bigints", () => {
      const scValNum = toScVal(42, "u32");
      expect(fromScVal(scValNum)).toBe(42);

      const scValBig = toScVal(1000000000000n, "i128");
      expect(fromScVal(scValBig)).toBe(1000000000000n);
    });

    it("converts strings and symbols", () => {
      const scValStr = toScVal("hello world", "string");
      expect(fromScVal(scValStr)).toBe("hello world");

      const scValSym = toScVal("transfer", "symbol");
      expect(fromScVal(scValSym)).toBe("transfer");
    });

    it("converts Stellar addresses", () => {
      const scValAddr = toScVal(userAddress, "address");
      expect(fromScVal(scValAddr)).toBe(userAddress);
    });

    it("infers address type for 56-char G/C keys", () => {
      const scValInferred = toScVal(userAddress);
      expect(fromScVal(scValInferred)).toBe(userAddress);
    });

    it("converts bytes buffers", () => {
      const buf = Buffer.from("deadbeef", "hex");
      const scValBytes = toScVal(buf, "bytes");
      const res = fromScVal(scValBytes);
      expect(Buffer.from(res).toString("hex")).toBe("deadbeef");
    });

    it("decodes scvBool to boolean", () => {
      expect(fromScVal(xdr.ScVal.scvBool(true))).toBe(true);
      expect(fromScVal(xdr.ScVal.scvBool(false))).toBe(false);
    });

    it("decodes scvSymbol to string", () => {
      const scVal = xdr.ScVal.scvSymbol("transfer");
      expect(fromScVal(scVal)).toBe("transfer");
    });

    it("decodes scvBytes to Uint8Array", () => {
      const scVal = xdr.ScVal.scvBytes(Buffer.from("cafebabe", "hex"));
      const res = fromScVal(scVal);
      expect(res).toBeInstanceOf(Uint8Array);
      expect(Buffer.from(res).toString("hex")).toBe("cafebabe");
    });

    it("decodes scvAddress to string", () => {
      const scVal = toScVal(userAddress, "address");
      expect(scVal.switch().name).toBe("scvAddress");
      expect(fromScVal(scVal)).toBe(userAddress);
    });

    it("decodes scvI128 to bigint", () => {
      const scVal = toScVal(-1234567890123456789n, "i128");
      expect(scVal.switch().name).toBe("scvI128");
      expect(fromScVal(scVal)).toBe(-1234567890123456789n);
    });

    it("decodes scvU128 to bigint", () => {
      const scVal = toScVal(340282366920938463463374607431768211455n, "u128");
      expect(scVal.switch().name).toBe("scvU128");
      expect(fromScVal(scVal)).toBe(340282366920938463463374607431768211455n);
    });

    it("decodes scvVec to array", () => {
      const scVal = xdr.ScVal.scvVec([
        toScVal(1, "u32"),
        toScVal("two", "string"),
        toScVal(true),
      ]);
      expect(fromScVal(scVal)).toEqual([1, "two", true]);
    });

    it("decodes scvMap to object", () => {
      const scVal = xdr.ScVal.scvMap([
        new xdr.ScMapEntry({
          key: toScVal("a", "symbol"),
          val: toScVal(1, "u32"),
        }),
        new xdr.ScMapEntry({
          key: toScVal("b", "symbol"),
          val: toScVal(2, "u32"),
        }),
      ]);
      expect(fromScVal(scVal)).toEqual({ a: 1, b: 2 });
    });
  });

  describe("ContractClient", () => {
    const client = new StellarClient({ network: "local" });
    const contractClient = new ContractClient(client);

    it("builds invokeContractFunction operation with encoded arguments", () => {
      const op = contractClient.buildInvocationOperation({
        contractId,
        method: "transfer",
        args: [
          { value: userAddress, type: "address" },
          { value: 5000n, type: "i128" },
        ],
      });

      expect(op.body().switch()).toBe(xdr.OperationType.invokeHostFunction());
    });

    it("simulates contract call and parses return value", async () => {
      const mockRetval = toScVal(12345n, "i128");
      vi.spyOn(client.rpc, "simulateTransaction").mockResolvedValue({
        result: {
          retval: mockRetval,
        },
        minResourceFee: "1000",
        cost: {
          cpuInsns: "15000",
          memBytes: "4096",
        },
      } as any);

      const sim = await contractClient.simulate({
        contractId,
        method: "balance",
        args: [userAddress],
      });

      expect(sim.successful).toBe(true);
      expect(sim.returnValue).toBe(12345n);
      expect(sim.minResourceFee).toBe("1000");
      expect(sim.cpuInstructions).toBe(15000);
      expect(sim.memoryBytes).toBe(4096);
    });
  });
});
