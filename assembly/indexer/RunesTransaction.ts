import {
  Transaction,
  Output,
  OutPoint,
} from "metashrew-as/assembly/blockdata/transaction";
import { scriptParse } from "metashrew-as/assembly/utils/yabsp";
import { Box } from "metashrew-as/assembly/utils/box";
import { RunestoneMessage } from "./RunestoneMessage";
import { RUNESTONE_TAG, OP_RETURN } from "./constants";

class TagOutput {
  runestone: i32;
  constructor() {
    this.runestone = -1;
  }
}

@final
export class RunesTransaction extends Transaction {
  runestoneOutputIndex(): i32 {
    for (let i = 0; i < this.outs.length; i++) {
      if (load<u16>(this.outs[i].script.start) === RUNESTONE_TAG) return i;
    }
    return -1;
  }

  runestoneOutput(): Output | null {
    const i = this.runestoneOutputIndex();
    if (i === -1) return null;
    else return this.outs[i];
  }
  defaultOutput(): i32 {
    for (let i = 0; i < this.outs.length; i++) {
      if (load<u8>(this.outs[i].script.start) !== OP_RETURN) return i;
    }
    return -1;
  }
  static from(tx: Transaction): RunesTransaction {
    return changetype<RunesTransaction>(tx);
  }
  runestone(): RunestoneMessage {
    const runestoneOutputIndex = this.runestoneOutputIndex();
    if (runestoneOutputIndex !== -1) {
      const runestoneOutput = this.outs[runestoneOutputIndex];
      const parsed = scriptParse(runestoneOutput.script).slice(2);
      if (
        parsed.findIndex((v: Box, i: i32, ary: Array<Box>) => {
          return v.start === usize.MAX_VALUE;
        }) !== -1
      )
        return changetype<RunestoneMessage>(0); // non-data push: cenotaph
      const payload = Box.concat(parsed);
      const message = RunestoneMessage.parse(payload, this.defaultOutput());
      if (changetype<usize>(message) === 0)
        return changetype<RunestoneMessage>(0);

      //process message here
      return message;
    }
    return changetype<RunestoneMessage>(0);
  }
  outpoint(vout: i32): ArrayBuffer {
    return OutPoint.from(this.txid(), <u32>vout).toArrayBuffer();
  }
}
