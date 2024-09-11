import {
  OutpointResponse,
  Outpoint,
  BalanceSheet,
} from "./proto/metashrew-runes";
import { stripHexPrefix } from "./utils";
import { Buffer } from "safe-buffer";

export type Rune = {
  id: string;
  name: string;
  spacedName: string;
  divisibility: number;
  spacers: number;
  symbol: string;
};
export type RuneOutput = {
  rune: Rune;
  balance: BigInt;
};

export type OutPoint = {
  runes: RuneOutput[];
  outpoint: {
    txid: string;
    vout: number;
  };
  output: {
    value: any;
    script: string;
  };
  height: number;
  txindex: number;
};

export function encodeOutpointInput(txid: string, pos: number): string {
  const input: any = {
    txid: (Buffer as any).from(txid, "hex") as Buffer,
    vout: pos,
  };
  const str = Buffer.from(Outpoint.toBinary(input)).toString("hex");
  return "0x" + str;
}

export function decodeRunes(balances: BalanceSheet): RuneOutput[] {
  if (!balances) return [];
  return balances.entries.map((entry) => {
    const balance = Buffer.from(entry.balance);
    const d = entry.rune;
    const spacer = "•";
    const bitField = d.spacers.toString(2);
    let name = Buffer.from(d.name).toString("utf-8");
    let spaced_name = name;
    const symbol = String.fromCharCode(d.symbol);
    let x = 0;
    bitField
      .split("")
      .reverse()
      .map((d, i) => {
        if (d == "1") {
          spaced_name = `${spaced_name.slice(0, i + 1 + x)}${spacer}${spaced_name.slice(i + 1 + x)}`;
          x++;
        }
      });
    const rune: Rune = {
      id: `${d.runeId.height}:${d.runeId.txindex}`,
      name,
      spacedName: spaced_name,
      divisibility: d.divisibility,
      spacers: d.spacers,
      symbol: symbol,
    };
    return {
      rune,
      balance: BigInt("0x" + (Buffer as any).from(balance).toString("hex") as string),
    };
  });
}
export function decodeOutpointViewBase(op: OutpointResponse): OutPoint {
  return {
    runes: decodeRunes(op.balances),
    outpoint: {
      txid: (Buffer as any).from(op.outpoint.txid).toString("hex"),
      vout: op.outpoint.vout,
    },
    output: op.output
      ? {
          value: op.output.value,
          script: (Buffer as any).from(op.output.script).toString("hex") as string
        }
      : { value: "", script: "" },
    height: op.height,
    txindex: op.txindex,
  };
}

export function decodeOutpointView(hex: string): OutPoint {
  const bytes = (Uint8Array as any).from((Buffer as any).from(stripHexPrefix(hex), "hex") as Buffer) as Uint8Array;
  const op = OutpointResponse.fromBinary(bytes);
  return decodeOutpointViewBase(op);
}
