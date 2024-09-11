import { WalletResponse, WalletRequest } from "./proto/metashrew-runes";
import { decodeOutpointViewBase } from "./outpoint";
import { decodeRunes, OutPoint, RuneOutput } from "./outpoint";
import { stripHexPrefix } from "./utils";
import { Buffer } from "safe-buffer";


export function decodeWalletOutput(hex: string): {
  outpoints: OutPoint[];
  balanceSheet: RuneOutput[];
} {
  const wo = WalletResponse.fromBinary(
    (Uint8Array as any).from((Buffer as any).from(stripHexPrefix(hex), "hex") as Buffer) as Uint8Array);
  return {
    outpoints: wo.outpoints.map((op) => decodeOutpointViewBase(op)),
    balanceSheet: decodeRunes(wo.balances),
  };
}

export function encodeWalletInput(address: string) {
  const input: any = {
    wallet: (Uint8Array as any).from((Buffer as any).from(address, "utf-8") as Uint8Array),
  };
  return "0x" + ((Buffer as any).from(WalletRequest.toBinary(input)).toString("hex") as string);
}
