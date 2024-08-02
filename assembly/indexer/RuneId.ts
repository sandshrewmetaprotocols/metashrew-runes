import { HEIGHT_TO_TRANSACTION_IDS } from "./constants";
import { toArrayBuffer } from "../utils";
import { u128 } from "as-bignum/assembly";
import { Box } from "metashrew-as/assembly/utils";

export class RuneId {
  public block: u128;
  public tx: u128;
  constructor(block: u64, tx: u32) {
    this.block = u128.fromU64(block);
    this.tx = u128.fromU32(tx);
  }
  txid(): ArrayBuffer {
    return HEIGHT_TO_TRANSACTION_IDS.selectValue<u32>(<u32>this.block.toU64())
      .selectIndex(this.tx.toU32())
      .get();
  }
  toBytes(): ArrayBuffer {
    let bytes = this.block.toBytes();
    bytes = bytes.concat(this.tx.toBytes());
    return changetype<Uint8Array>(bytes).buffer;
  }
  inspect(): string {
    return this.block.toString() + ":" + this.tx.toString();
  }
  static fromBytesU128(ary: ArrayBuffer): RuneId {
    return RuneId.fromBytes(ary);
  }

  static fromBytes(ary: ArrayBuffer): RuneId {
    const _ary = Uint8Array.wrap(ary);

    const parsed = _ary.reduce<Array<u8>>((acc, c, i, init) => {
      acc[i] = c;
      return acc;
    }, new Array<u8>(_ary.byteLength));
    const block = u128.fromBytes(parsed.slice(0, 16)).toU64();
    const tx = u128.fromBytes(parsed.slice(16)).toU32();
    return new RuneId(block, tx);
  }
  static fromU128(v: u128): RuneId {
    const block = v.hi;
    const tx = <u32>v.lo;
    return new RuneId(block, tx);
  }
}
