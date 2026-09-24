import {
  Address,
  nativeToScVal,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import type { ScValType, ContractArg } from "@lumen/types";

/**
 * Converts a JavaScript value or ContractArg into a Stellar Soroban xdr.ScVal.
 */
export function toScVal(input: ContractArg | any, explicitType?: ScValType): xdr.ScVal {
  if (input instanceof xdr.ScVal) {
    return input;
  }

  let value = input;
  let type = explicitType;

  if (
    input &&
    typeof input === "object" &&
    "value" in input &&
    ("type" in input || !explicitType)
  ) {
    value = input.value;
    type = explicitType ?? input.type;
  }

  if (type) {
    switch (type) {
      case "address":
        return new Address(value.toString()).toScVal();
      case "symbol":
        return xdr.ScVal.scvSymbol(value.toString());
      case "string":
        return xdr.ScVal.scvString(value.toString());
      case "bool":
        return xdr.ScVal.scvBool(Boolean(value));
      case "u32":
        return nativeToScVal(Number(value), { type: "u32" });
      case "i32":
        return nativeToScVal(Number(value), { type: "i32" });
      case "u64":
        return nativeToScVal(BigInt(value), { type: "u64" });
      case "i64":
        return nativeToScVal(BigInt(value), { type: "i64" });
      case "u128":
        return nativeToScVal(BigInt(value), { type: "u128" });
      case "i128":
        return nativeToScVal(BigInt(value), { type: "i128" });
      case "bytes": {
        const buf = Buffer.isBuffer(value)
          ? value
          : typeof value === "string"
          ? Buffer.from(value, "hex")
          : Buffer.from(value);
        return xdr.ScVal.scvBytes(buf);
      }
      default:
        return nativeToScVal(value);
    }
  }

  // Type inference
  if (typeof value === "boolean") {
    return xdr.ScVal.scvBool(value);
  }
  if (typeof value === "bigint") {
    return nativeToScVal(value, { type: "i128" });
  }
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? nativeToScVal(value, { type: "i32" })
      : nativeToScVal(BigInt(Math.floor(value)), { type: "i128" });
  }
  if (typeof value === "string") {
    // Check if string is Stellar Account or Contract address (length 56, starts with G or C)
    if (value.length === 56 && (value.startsWith("G") || value.startsWith("C"))) {
      try {
        return new Address(value).toScVal();
      } catch {
        // Fallback to string
      }
    }
    return xdr.ScVal.scvString(value);
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return xdr.ScVal.scvBytes(Buffer.from(value));
  }

  return nativeToScVal(value);
}

/**
 * Converts a Soroban xdr.ScVal into its native JavaScript representation.
 *
 * Handles all common ScVal types explicitly so contract return values can be
 * decoded reliably:
 *  - scvAddress -> string (StrKey G.../C...)
 *  - scvMap     -> plain object (string keys) or Map for non-string keys
 *  - scvVec     -> array
 *  - scvBytes   -> Uint8Array
 *  - scvBool    -> boolean
 *  - scvSymbol  -> string
 *  - scvI128    -> bigint
 *  - scvU128    -> bigint
 */
export function fromScVal(scVal: any): any {
  if (scVal === null || scVal === undefined) return null;

  // Unwrap common result envelopes before decoding.
  if (scVal && !(scVal instanceof xdr.ScVal)) {
    if (scVal.retval) {
      return fromScVal(scVal.retval);
    }
    if (scVal.result?.retval) {
      return fromScVal(scVal.result.retval);
    }
  }

  if (!(scVal instanceof xdr.ScVal)) {
    return scVal;
  }

  switch (scVal.switch()) {
    case xdr.ScValType.scvAddress():
      return Address.fromScVal(scVal).toString();
    case xdr.ScValType.scvMap(): {
      const entries = scVal.map() ?? [];
      const result: Record<string, any> = {};
      let allStringKeys = true;
      const map = new Map<any, any>();
      for (const entry of entries) {
        const key = fromScVal(entry.key());
        const val = fromScVal(entry.val());
        map.set(key, val);
        if (typeof key === "string") {
          result[key] = val;
        } else {
          allStringKeys = false;
        }
      }
      return allStringKeys ? result : map;
    }
    case xdr.ScValType.scvVec():
      return (scVal.vec() ?? []).map((item) => fromScVal(item));
    case xdr.ScValType.scvBytes():
      return new Uint8Array(scVal.bytes());
    case xdr.ScValType.scvBool():
      return scVal.b();
    case xdr.ScValType.scvSymbol():
      return scVal.sym().toString();
    case xdr.ScValType.scvI128():
      return scVal.i128().toBigInt();
    case xdr.ScValType.scvU128():
      return scVal.u128().toBigInt();
    default:
      return scValToNative(scVal);
  }
}
