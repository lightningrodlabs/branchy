import {
  Initialization,
  SysState,
  Unit
} from "./types";
import { AgentPubKeyB64 } from "@holochain/client";

export function initialTreeSimple(progenitor: AgentPubKeyB64) {
  const init: Initialization = {
    units: [
      [SysState.UnderConstruction, new Unit({
        parents: [], // full paths to parent nodes (remember it's a DAG)
        name: "", // max 10 char
        description: "Root", // max 25 char
        stewards: [progenitor], // people who can change this document
      })],
    ]
  };
  return init;
}
