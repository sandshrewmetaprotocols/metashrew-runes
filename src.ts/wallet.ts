import { WalletResponse, WalletRequest } from "./proto/metashrew-runes";
import { decodeOutpointViewBase } from "./outpoint";
import { decodeRunes, OutPoint, RuneOutput } from "./outpoint";
import { stripHexPrefix } from "./utils";


export function decodeWalletOutput(hex: string): {
  outpoints: OutPoint[];
  balanceSheet: RuneOutput[];
} {
  const wo = WalletResponse.fromBinary(
    Uint8Array.from(Buffer.from(stripHexPrefix(hex), "hex"))
  );
  return {
    outpoints: wo.outpoints.map((op) => decodeOutpointViewBase(op)),
    balanceSheet: decodeRunes(wo.balances),
  };
}

export function encodeWalletInput(address: string) {
  const input: WalletRequest = {
    wallet: Uint8Array.from(Buffer.from(address, "utf-8")),
  };
  return "0x" + Buffer.from(WalletRequest.toBinary(input)).toString("hex");
}
