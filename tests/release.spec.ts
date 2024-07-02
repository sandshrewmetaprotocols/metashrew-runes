import fs from "node:fs";

import { inspect } from "node:util";
import { IndexerProgram, readArrayBufferAsHex } from "metashrew-test";
import * as path from "node:path";
import { expect } from "chai";
//@ts-ignore
import bitcoinjs = require("bitcoinjs-lib");
import { encodeRunestone } from "@magiceden-oss/runestone-lib";
import { MetashrewRunes } from "../lib/rpc";

const EMPTY_BUFFER = Buffer.allocUnsafe(0);
const EMPTY_WITNESS = [];

const TEST_BTC_ADDRESS1 = "16aE44Au1UQ5XqKMUhCMXTX7ZxbmAcQNA1";
const TEST_BTC_ADDRESS2 = "1AdAhGdUgGF6ip7bBcVvuWYuuCxAeonNaK";

const DEBUG_WASM = fs.readFileSync(
  path.join(__dirname, "..", "build", "debug.wasm"),
);

const log = (obj: any) => {
  console.log(inspect(obj, false, 10, true));
};

const stripHexPrefix = (key: string) => {
  if (key.substr(0, 2) === "0x") return key.substr(2);
  return key;
};

const addHexPrefix = (s: string) => {
  if (s.substr(0, 2) === "0x") return s;
  return "0x" + s;
};

const split = (ary, sym) => {
  return ary.reduce((r, v) => {
    if (v === sym) {
      r.push([]);
    } else {
      if (r.length === 0) r.push([]);
      r[r.length - 1].push(v);
    }
    return r;
  }, []);
};

const formatKey = (key: string) => {
  return split(
    Array.from(Buffer.from(stripHexPrefix(key), "hex")),
    Buffer.from("/")[0],
  ).reduce((r, v, i, ary) => {
    const token = Buffer.from(v).toString("utf8");
    if (!(i + v.length)) {
      return r + "/";
    } else if (token.match(/^[0-9a-zA-Z]+$/)) {
      return r + "/" + token;
    } else {
      return r + "/" + addHexPrefix(Buffer.from(v).toString("hex"));
    }
  }, "");
};

const formatValue = (v) => {
  const token = Buffer.from(v.substr(2), "hex").toString("utf8");
  if (token.match(/^[0-9a-zA-Z]+$/)) return token;
  return v;
};

const formatKv = (kv: any) => {
  return Object.fromEntries(
    Object.entries(kv).map(([key, value]) => [formatKey(key), value]),
  );
};

const buildProgram = () => {
  const program = new IndexerProgram(
    new Uint8Array(Array.from(DEBUG_WASM)).buffer,
  );
  program.on("log", (v) => console.log(v.replace(/\0/g, "").trim()));
  return program;
};

const buildBytes32 = () => Buffer.allocUnsafe(32);

const buildCoinbase = (outputs) => {
  const tx = new bitcoinjs.Transaction();
  tx.ins.push({
    hash: buildBytes32(),
    index: bitcoinjs.Transaction.DEFAULT_SEQUENCE,
    script: EMPTY_BUFFER,
    sequence: bitcoinjs.Transaction.DEFAULT_SEQUENCE,
    witness: EMPTY_WITNESS,
  });
  outputs.forEach((v) => tx.outs.push(v));
  return tx;
};

const buildInput = (o) => {
  return {
    ...o,
    script: EMPTY_BUFFER,
    sequence: bitcoinjs.Transaction.DEFAULT_SEQUENCE,
    witness: EMPTY_WITNESS,
  };
};

const buildTransaction = (ins, outs) => {
  const tx = new bitcoinjs.Transaction();
  ins.forEach((v) => tx.ins.push(v));
  outs.forEach((v) => tx.outs.push(v));
  return tx;
};

const buildCoinbaseToAddress = (address: string) =>
  buildCoinbase([
    {
      script: bitcoinjs.payments.p2pkh({
        address: address,
        network: bitcoinjs.networks.bitcoin,
      }).output,
      value: 625000000,
    },
  ]);

const buildDefaultBlock = () => {
  const block = new bitcoinjs.Block();
  block.prevHash = buildBytes32();
  block.merkleRoot = buildBytes32();
  block.witnessCommit = buildBytes32();
  block.transactions = [];
  return block;
};

const runTest = (s) =>
  it(s, async () => {
    const program = buildProgram();
    await program.run(s);
    await new Promise((r) => setTimeout(r, 2000));
    return program;
  });

const runesbyaddress = async (
  program: IndexerProgram,
  address: string,
): any => {
  const cloned = program; // just mutate it
  const result = await MetashrewRunes.prototype.runesbyaddress.call(
    {
      async _call({ input }) {
        cloned.setBlock(input);
        const ptr = await cloned.run("runesbyaddress");
        return readArrayBufferAsHex(cloned.memory, ptr);
      },
    },
    { address },
  );
  return result;
};

const initCompleteBlockWithRuneEtching = (
  outputs: any,
  pointer: number,
  divisibility: number = 8,
  premineAmount: bigint = 2100000005000000n,
  runeName: string = "GENESIS•RUNE•FR",
  symbol: string = "G",

): bitcoinjs.Block => {
  const block = buildDefaultBlock();
  const coinbase = buildCoinbaseToAddress(TEST_BTC_ADDRESS1);
  block.transactions?.push(coinbase);
  const runesGenesis = encodeRunestone({
    etching: {
      divisibility: divisibility,
      premine: premineAmount,
      runeName: runeName,
      symbol: symbol,
    },
    pointer: pointer,
  }).encodedRunestone;
  const transaction = buildTransaction(
    [
      {
        hash: coinbase.getHash(),
        index: 0,
        witness: EMPTY_WITNESS,
        script: EMPTY_BUFFER,
      },
    ],
    [
      {
        script: runesGenesis,
        value: 0,
      },
      ...outputs
    ],
  );
  block.transactions?.push(transaction);
  return block;
}

describe("metashrew-runes", () => {
  it("should check if duplicate keys are not being set", async () => {
    const program = buildProgram();
    program.setBlock(
      fs.readFileSync(path.join(__dirname, "runes-genesis.hex"), "utf8"),
    );
    program.setBlockHeight(840000);
    program.on("log", console.log);
    await program.run("testOverwrite");
    expect(
      Object.keys(formatKv(program.kv)).filter((d) =>
        d.includes("/etching/byruneid"),
      ).length,
    ).to.be.equal(2);
  });
  it("index Runestone on etching and premine", async () => {
    const program = buildProgram();
    program.setBlockHeight(840001);
    const premineAmount = 2100000005000000n
    const outputs = [{
      script: bitcoinjs.payments.p2pkh({
        address: TEST_BTC_ADDRESS1,
        network: bitcoinjs.networks.bitcoin,
      }).output,
      value: 1,
    },
    {
      script: bitcoinjs.payments.p2pkh({
        network: bitcoinjs.networks.bitcoin,
        address: TEST_BTC_ADDRESS2,
      }).output,
      value: 624999999,
    }]
    const block = initCompleteBlockWithRuneEtching(outputs, 1, undefined, premineAmount)
    program.setBlock(block.toHex());
    await program.run("_start");

    const resultAddress1 = await runesbyaddress(program, TEST_BTC_ADDRESS1);
    console.log("runesbyaddress output", resultAddress1);
    expect(resultAddress1.balanceSheet[0].balance == premineAmount);

    const resultAddress2 = await runesbyaddress(program, TEST_BTC_ADDRESS2);
    console.log("runesbyaddress2 output", resultAddress2);
    expect(resultAddress2.balanceSheet.length == 0);
  });
});
