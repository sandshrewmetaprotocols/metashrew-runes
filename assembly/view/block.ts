import {
  OUTPOINTS_FOR_ADDRESS,
  OUTPOINT_TO_OUTPUT,
} from "metashrew-spendables/assembly/tables.ts";
import { SpendablesIndex } from "metashrew-spendables/assembly/indexer";
import { balanceSheetToProtobuf, outpointBase } from "./outpoint";
import { BalanceSheet } from "../indexer/BalanceSheet";
import { metashrew_runes as protobuf } from "../proto/metashrew-runes";
import { Output } from "metashrew-as/assembly/blockdata/transaction";
import { Box } from "metashrew-as/assembly/utils/box";
import { parsePrimitive } from "metashrew-as/assembly/utils/utils";
import { console } from "metashrew-as/assembly/utils/logging";
import { input } from "metashrew-as/assembly/indexer";
import { decodeHex } from "metashrew-as/assembly";
import {
  OUTPOINT_TO_RUNES,
  HEIGHT_TO_TRANSACTION_IDS,
  RUNE_ID_TO_ETCHING,
  DIVISIBILITY,
  OUTPOINT_TO_HEIGHT,
  HEIGHT_TO_BLOCKHASH,
  CAP,
  SPACERS,
  SYMBOL,
  HEIGHT_TO_OUTPOINTS,
} from "../indexer/constants";
import { RunesIndex } from "../indexer";

export function runesByBlock(): ArrayBuffer {
  const block = protobuf.BlockRequest.decode(input().slice(4)).block;

  const _outpoints = HEIGHT_TO_OUTPOINTS.selectValue<u32>(block).getList();

  const outpoints = new Array<protobuf.OutpointResponse>();
  const balanceSheets = new Array<BalanceSheet>();
  for (let i = 0; i < _outpoints.length; i++) {
    const inp = new protobuf.Outpoint();
    inp.txid = changetype<Array<u8>>(
      Uint8Array.wrap(_outpoints[i].slice(0, 32))
    );
    inp.vout = parsePrimitive<u32>(Box.from(_outpoints[i].slice(32)));
    const op = outpointBase(inp);
    if (op.balances.entries.length == 0) {
      continue;
    }
    balanceSheets.push(
      BalanceSheet.load(OUTPOINT_TO_RUNES.select(_outpoints[i]))
    );
    outpoints.push(op);
  }

  const message = new protobuf.WalletResponse();
  message.outpoints = outpoints;
  message.balances = balanceSheetToProtobuf(
    balanceSheets.reduce(
      (r: BalanceSheet, v: BalanceSheet, i: i32, ary: Array<BalanceSheet>) => {
        return BalanceSheet.merge(r, v);
      },
      new BalanceSheet()
    )
  );

  return message.encode();
}
