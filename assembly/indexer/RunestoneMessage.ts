import { u128 } from "as-bignum/assembly";
import { Field } from "./Field";
import { Box } from "metashrew-as/assembly/utils/box";
import { readULEB128ToU128 } from "../leb128";
import {
  u128ToHex,
  fieldToArrayBuffer,
  fieldToU128,
  fieldTo,
  toArrayBuffer,
  fromArrayBuffer,
  toPrimitive,
  min,
  nameToArrayBuffer,
  getReservedNameFor,
  fieldToName,
  isNullPtr,
} from "../utils";
import { Flag } from "./Flag";
import { RuneId } from "./RuneId";
import { Edict } from "./Edict";
import {
  AMOUNT,
  SPACERS,
  RUNE_ID_TO_ETCHING,
  ETCHING_TO_RUNE_ID,
  RUNE_ID_TO_HEIGHT,
  DIVISIBILITY,
  PREMINE,
  MINTS_REMAINING,
  HEIGHTSTART,
  HEIGHTEND,
  OFFSETSTART,
  OFFSETEND,
  SYMBOL,
  CAP,
  ETCHINGS,
  OUTPOINT_TO_RUNES,
  GENESIS,
  HEIGHT_INTERVAL,
  MINIMUM_NAME,
  TWENTY_SIX,
  RESERVED_NAME,
  MAX_BYTES_LEB128_INT,
} from "./constants";
import { BalanceSheet } from "./BalanceSheet";
import { RunesTransaction } from "./RunesTransaction";
import {
  Input,
  OutPoint,
  Output,
} from "metashrew-as/assembly/blockdata/transaction";
import {
  encodeHexFromBuffer,
  parsePrimitive,
  SUBSIDY_HALVING_INTERVAL,
} from "metashrew-as/assembly/utils";
import { console } from "metashrew-as/assembly/utils/logging";

export class RunestoneMessage {
  public fields: Map<u64, Array<u128>>;
  public edicts: Array<StaticArray<u128>>;
  constructor(fields: Map<u64, Array<u128>>, edicts: Array<StaticArray<u128>>) {
    this.fields = fields;
    this.edicts = edicts;
  }
  inspect(): string {
    let result = "RunestoneMessage {\n";
    let fieldInts = this.fields.keys();
    for (let i = 0; i < fieldInts.length; i++) {
      result += "  " + fieldInts[i].toString(10) + ": [\n";
      const ary = this.fields.get(fieldInts[i]);
      for (let j = 0; j < ary.length; j++) {
        result += "    " + u128ToHex(ary[j]) + ",\n";
      }
      result += "  ]\n";
    }
    result += "  edicts: [";
    for (let i = 0; i < this.edicts.length; i++) {
      result += "    ";
      for (let j = 0; j < this.edicts[i].length; j++) {
        result += u128ToHex(this.edicts[i][j]);
      }
      if (i !== this.edicts.length - 1) result += ", ";
    }
    result += "]\n}";
    return result;
  }
  getFlag(position: u64): bool {
    if (!this.fields.has(Field.FLAGS)) return false;
    const flags = fieldToU128(this.fields.get(Field.FLAGS));
    return !u128.and(flags, u128.from(1) << (<i32>position)).isZero();
  }
  isEtching(): bool {
    return this.getFlag(Flag.ETCHING);
  }
  mintTo(): ArrayBuffer {
    if (!this.fields.has(Field.MINT)) return changetype<ArrayBuffer>(0);
    return fieldToArrayBuffer(this.fields.get(Field.MINT));
  }
  static parse(data: ArrayBuffer): RunestoneMessage {
    const input = Box.from(data);
    let fields = new Map<u64, Array<u128>>();
    let edicts = new Array<StaticArray<u128>>(0);
    while (input.len > 0) {
      const fieldKeyHeap = u128.from(0);
      const size = readULEB128ToU128(input, fieldKeyHeap);
      if (size > MAX_BYTES_LEB128_INT) return changetype<RunestoneMessage>(0);
      input.shrinkFront(size);
      const fieldKey = fieldKeyHeap.lo;
      if (fieldKey > 22 && fieldKey % 2 == 0)
        return changetype<RunestoneMessage>(0); // cenotaph
      if (fieldKey === 0) {
        while (input.len > 0) {
          const edict = new StaticArray<u128>(4);
          for (let i = 0; i < 4; i++) {
            const edictInt = u128.from(0);
            const size = readULEB128ToU128(input, edictInt);
            if (size > MAX_BYTES_LEB128_INT)
              return changetype<RunestoneMessage>(0);
            input.shrinkFront(size);
            edict[i] = edictInt;
          }
          edicts.push(edict);
        }
      } else {
        const value = u128.from(0);
        const size = readULEB128ToU128(input, value);
        if (size > MAX_BYTES_LEB128_INT) return changetype<RunestoneMessage>(0);
        input.shrinkFront(size);
        let field: Array<u128> = changetype<Array<u128>>(0);
        if (!fields.has(fieldKey)) {
          field = new Array<u128>(0);
          fields.set(fieldKey, field);
        } else {
          field = fields.get(fieldKey);
        }
        field.push(value);
      }
    }
    return new RunestoneMessage(fields, edicts);
  }

  buildRuneIdForMint(bytes: ArrayBuffer): ArrayBuffer {
    return RuneId.fromBytes(bytes).toBytes();
  }

  mint(height: u32, balanceSheet: BalanceSheet): bool {
    let mintTo = this.mintTo();
    if (changetype<usize>(mintTo) !== 0 && mintTo.byteLength == 32) {
      const name = RUNE_ID_TO_ETCHING.select(mintTo).get();
      const remaining = fromArrayBuffer(MINTS_REMAINING.select(name).get());
      if (!remaining.isZero()) {
        const heightStart = HEIGHTSTART.select(name).getValue<u64>();
        const heightEnd = HEIGHTEND.select(name).getValue<u64>();
        const offsetStart = OFFSETSTART.select(name).getValue<u64>();
        const offsetEnd = OFFSETEND.select(name).getValue<u64>();
        const etchingHeight = RUNE_ID_TO_HEIGHT.select(mintTo).getValue<u32>();
        if (
          (heightStart === 0 || height >= heightStart) &&
          (heightEnd === 0 || height < heightEnd) &&
          (offsetStart === 0 || height >= offsetStart + etchingHeight) &&
          (offsetEnd === 0 || height < etchingHeight + offsetEnd)
        ) {
          MINTS_REMAINING.select(name).set(
            toArrayBuffer(remaining - u128.from(1)),
          );
          balanceSheet.increase(
            mintTo,
            fromArrayBuffer(AMOUNT.select(name).get()),
          );
          return true;
        }
      }
    }
    return false;
  }
  static etchGenesisRune(): void {
    const name = nameToArrayBuffer("UNCOMMONGOODS");
    const spacers = 128;
    const runeId = new RuneId(1, 0).toBytes();
    ETCHING_TO_RUNE_ID.select(name).set(runeId);
    RUNE_ID_TO_ETCHING.select(runeId).set(name);
    RUNE_ID_TO_HEIGHT.select(runeId).setValue<u32>(GENESIS);
    DIVISIBILITY.select(name).setValue<u8>(1);
    AMOUNT.select(name).set(toArrayBuffer(u128.from(1)));
    CAP.select(name).set(toArrayBuffer(u128.Max));
    MINTS_REMAINING.select(name).set(toArrayBuffer(u128.Max));
    OFFSETEND.select(name).setValue<u64>(SUBSIDY_HALVING_INTERVAL);
    SPACERS.select(name).setValue<u32>(128);
    SYMBOL.select(name).setValue<u8>(<u8>"\u{29C9}".charCodeAt(0));
    ETCHINGS.append(name);
  }

  getReservedNameFor(height: u64, tx: u32): ArrayBuffer {
    let nameU128: u128;
    if (this.fields.has(Field.RUNE)) nameU128 = this.fields.get(Field.RUNE)[0];
    else nameU128 = getReservedNameFor(height, tx);
    let interval: i64 = (height - GENESIS) / HEIGHT_INTERVAL;
    let minimum_name = MINIMUM_NAME;
    if (interval > 0)
      while (interval > 0) {
        minimum_name = --minimum_name / TWENTY_SIX;
        interval--;
      }
    if (nameU128 < minimum_name || nameU128 >= RESERVED_NAME)
      return changetype<ArrayBuffer>(0);
    return toArrayBuffer(nameU128);
  }

  buildRuneId(height: u64, tx: u32): ArrayBuffer {
    return new RuneId(height, tx).toBytes();
  }

  etch(
    height: u64,
    tx: u32,
    initialBalanceSheet: BalanceSheet,
    transaction: RunesTransaction,
  ): bool {
    if (!this.isEtching()) return false;
    const name = this.getReservedNameFor(height, tx);
    if (isNullPtr<ArrayBuffer>(name)) return false;
    if (ETCHING_TO_RUNE_ID.select(name).get().byteLength !== 0) return false; // already taken / commitment not foun
    const runeId = this.buildRuneId(height, tx);
    RUNE_ID_TO_ETCHING.select(runeId).set(name);
    ETCHING_TO_RUNE_ID.select(name).set(runeId);
    RUNE_ID_TO_HEIGHT.select(runeId).setValue<u32>(<u32>height);
    if (this.fields.has(Field.DIVISIBILITY))
      DIVISIBILITY.select(name).setValue<u8>(
        fieldTo<u8>(this.fields.get(Field.DIVISIBILITY)),
      );
    if (this.fields.has(Field.PREMINE)) {
      const premine = fieldToU128(this.fields.get(Field.PREMINE));
      BalanceSheet.fromPairs([runeId], [premine]).pipe(initialBalanceSheet);
      PREMINE.select(name).set(toArrayBuffer(premine));
    }
    if (this.getFlag(Flag.TERMS)) {
      if (this.fields.has(Field.AMOUNT))
        AMOUNT.select(name).set(
          toArrayBuffer(fieldToU128(this.fields.get(Field.AMOUNT))),
        );

      if (this.fields.has(Field.CAP)) {
        CAP.select(name).set(
          toArrayBuffer(fieldToU128(this.fields.get(Field.CAP))),
        );
        MINTS_REMAINING.select(name).set(
          fieldToArrayBuffer(this.fields.get(Field.CAP)),
        );
      }
      if (this.fields.has(Field.HEIGHTSTART))
        HEIGHTSTART.select(name).setValue<u64>(
          fieldTo<u64>(this.fields.get(Field.HEIGHTSTART)),
        );
      if (this.fields.has(Field.HEIGHTEND))
        HEIGHTEND.select(name).setValue<u64>(
          fieldTo<u64>(this.fields.get(Field.HEIGHTEND)),
        );
      if (this.fields.has(Field.OFFSETSTART))
        OFFSETSTART.select(name).setValue<u64>(
          fieldTo<u64>(this.fields.get(Field.OFFSETSTART)),
        );
      if (this.fields.has(Field.OFFSETEND))
        OFFSETEND.select(name).setValue<u64>(
          fieldTo<u64>(this.fields.get(Field.OFFSETEND)),
        );
    }
    if (this.fields.has(Field.SPACERS))
      SPACERS.select(name).setValue<u32>(
        fieldTo<u32>(this.fields.get(Field.SPACERS)),
      );
    if (this.fields.has(Field.SYMBOL))
      SYMBOL.select(name).setValue<u8>(
        fieldTo<u8>(this.fields.get(Field.SYMBOL)),
      );
    ETCHINGS.append(name);
    return true;
  }

  //TODO: This should really be a function in transaction.ts in metashrew-as in class Output
  isNonOpReturnOutput(output: Output): bool {
    let view = output.script.sliceFrom(0);
    return parsePrimitive<u8>(view) != 0x6a;
  }

  numNonOpReturnOutputs(outputs: Array<Output>): u128 {
    let counter = 0;
    for (let i = 0; i < outputs.length; i++) {
      if (this.isNonOpReturnOutput(outputs[i])) {
        counter++;
      }
    }
    return new u128(counter, 0);
  }

  updateBalancesForEdict(
    balancesByOutput: Map<u32, BalanceSheet>,
    balanceSheet: BalanceSheet,
    edictAmount: u128,
    edictOutput: u32,
    runeId: ArrayBuffer,
  ): void {
    let outputBalanceSheet = changetype<BalanceSheet>(0);
    if (!balancesByOutput.has(edictOutput)) {
      balancesByOutput.set(
        edictOutput,
        (outputBalanceSheet = new BalanceSheet()),
      );
    } else outputBalanceSheet = balancesByOutput.get(edictOutput);
    const amount = edictAmount.isZero()
      ? balanceSheet.get(runeId)
      : min(edictAmount, balanceSheet.get(runeId));
    balanceSheet.decrease(runeId, amount);
    outputBalanceSheet.increase(runeId, amount);
  }

  processEdict(
    balancesByOutput: Map<u32, BalanceSheet>,
    balanceSheet: BalanceSheet,
    edict: Edict,
    outputs: Array<Output>,
  ): bool {
    if (edict.block.isZero() && !edict.transactionIndex.isZero()) {
      return true;
    }
    const runeId = edict.runeId().toBytes();

    const edictOutput = toPrimitive<u32>(edict.output);
    if (edictOutput > <u32>outputs.length) {
      return true;
    } else if (edictOutput == outputs.length) {
      if (edict.amount.isZero()) {
        const numNonOpReturnOuts: u128 = this.numNonOpReturnOutputs(outputs);
        if (!numNonOpReturnOuts.isZero()) {
          const amountSplit = u128.div(
            balanceSheet.get(runeId),
            numNonOpReturnOuts,
          );
          const amountSplitPlus1 = amountSplit.preInc();
          const numRemainder = u128.rem(
            balanceSheet.get(runeId),
            numNonOpReturnOuts,
          );
          let extraCounter: u64 = 0;
          for (let i = 0; i < outputs.length; i++) {
            if (this.isNonOpReturnOutput(outputs[i])) {
              if (extraCounter < numRemainder.lo) {
                this.updateBalancesForEdict(
                  balancesByOutput,
                  balanceSheet,
                  amountSplitPlus1,
                  i,
                  runeId,
                );
                extraCounter++;
              } else {
                this.updateBalancesForEdict(
                  balancesByOutput,
                  balanceSheet,
                  amountSplit,
                  i,
                  runeId,
                );
              }
            }
          }
        }
      } else {
        for (let i = 0; i < outputs.length; i++) {
          if (this.isNonOpReturnOutput(outputs[i])) {
            this.updateBalancesForEdict(
              balancesByOutput,
              balanceSheet,
              edict.amount,
              i,
              runeId,
            );
          }
        }
      }

      return false;
    } else {
      this.updateBalancesForEdict(
        balancesByOutput,
        balanceSheet,
        edict.amount,
        edictOutput,
        runeId,
      );
      return false;
    }
  }

  processEdicts(
    balancesByOutput: Map<u32, BalanceSheet>,
    balanceSheet: BalanceSheet,
    outputs: Array<Output>,
  ): bool {
    const edicts = Edict.fromDeltaSeries(this.edicts);
    for (let e = 0; e < edicts.length; e++) {
      if (
        this.processEdict(balancesByOutput, balanceSheet, edicts[e], outputs)
      ) {
        return true;
      }
    }
    return false;
  }
  loadBalanceSheet(tx: RunesTransaction): BalanceSheet {
    return BalanceSheet.concat(
      tx.ins.map<BalanceSheet>((v: Input, i: i32, ary: Array<Input>) =>
        BalanceSheet.load(
          OUTPOINT_TO_RUNES.select(v.previousOutput().toArrayBuffer()),
        ),
      ),
    );
  }
  saveBalanceSheet(
    sheet: BalanceSheet,
    txid: ArrayBuffer,
    output: u32,
    isCenotaph: bool,
  ): void {
    sheet.save(
      OUTPOINT_TO_RUNES.select(OutPoint.from(txid, output).toArrayBuffer()),
      isCenotaph,
    );
  }
  process(
    tx: RunesTransaction,
    txid: ArrayBuffer,
    height: u32,
    txindex: u32,
  ): Map<u32, BalanceSheet> {
    let balanceSheet = this.loadBalanceSheet(tx);
    const balancesByOutput = new Map<u32, BalanceSheet>();

    this.mint(height, balanceSheet);
    this.etch(<u64>height, <u32>txindex, balanceSheet, tx);

    const unallocatedTo = this.fields.has(Field.POINTER)
      ? fieldTo<u32>(this.fields.get(Field.POINTER))
      : <u32>tx.defaultOutput();

    const isCenotaph = this.processEdicts(
      balancesByOutput,
      balanceSheet,
      tx.outs,
    );

    if (balancesByOutput.has(unallocatedTo)) {
      balanceSheet.pipe(balancesByOutput.get(unallocatedTo));
    } else {
      balancesByOutput.set(unallocatedTo, balanceSheet);
    }
    const runesToOutputs = balancesByOutput.keys();

    for (let x = 0; x < runesToOutputs.length; x++) {
      const sheet = balancesByOutput.get(runesToOutputs[x]);
      this.saveBalanceSheet(sheet, txid, runesToOutputs[x], isCenotaph);
    }
    return balancesByOutput;
  }
}
