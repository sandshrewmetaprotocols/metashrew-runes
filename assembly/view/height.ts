import { IndexPointer } from "metashrew-as/assembly/indexer/tables";
import { parsePrimitive } from "metashrew-as/assembly/utils/utils";
import { input } from "metashrew-as/assembly/indexer";
import { Box } from "metashrew-as/assembly/utils/box";
import { HEIGHT_TO_BLOCKHASH } from "../indexer/constants/index";

export function blockhash(): ArrayBuffer {
  const data = Box.from(input());
  const height = parsePrimitive<u32>(data);
  const target = parsePrimitive<u32>(data);
  return HEIGHT_TO_BLOCKHASH.selectValue<u32>(target).get();
}
