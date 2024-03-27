// TODO: add globally available interfaces for your elements

import { ActionHash, ActionHashed, EntryHash, Record, Timestamp, EntryHashB64, AgentPubKeyB64, encodeHashToBase64  } from "@holochain/client";
import { createContext } from "@lit/context";
import { BranchyStore } from "./branchy.store";
import { WALUrl } from "./util";

export const branchyContext = createContext<BranchyStore>('branchy/service');

export type Dictionary<T> = { [key: string]: T };

export interface Initialization {
  units: Array<[string,Unit]>,
}

export interface UnitInput {
  state: string,
  unit: Unit,
}

export class Unit {
  parents: Array<string> = []
  name: string = ""
  description: string =""
  stewards: Array<AgentPubKeyB64> = []
  meta: Dictionary<string> = {};
  constructor(init?: Partial<Unit> ) {
    Object.assign(this, init);
  }
  public path() : string {
    return this.parents.length > 0 ? `${this.parents[0]}.${this.name}` : this.name
  }
}

export enum SysState {
  Alive = "_alive",
  Defunct = "_defunct",
  UnderConstruction = "_build"
}

export interface Mark {
  markType: number,
  mark: String,
  author: AgentPubKeyB64,
}

export interface AdvanceStateInput {
  newState: string,
  unitHash: EntryHash,
}

export interface AddAttachmentInput {
  unitHash: EntryHash,
  attachment: WALUrl
}

export type BranchySignal =
  | {
    unitHash: EntryHashB64, message: {type: "NewUnit", content:  Unit}
  }

export type UnitInfo = {
    hash: EntryHash,
    state: string,
    flags: string,
}

export enum UnitFlags {
  TBD = "p"
}

export type UnitOutput = {
  info: UnitInfo,
  record: Record,
}

export type UpdateUnitInput = {
  hash: EntryHash,
  state: String,
  unit: Unit,
}

export type Content = {
  name: string,
  units: Array<UnitInfo>,
}

export type RustNode = {
    idx: number,
    val: Content,
    parent: null | number,
    children: Array<number>
  }
export type RustTree = {
  tree: Array<RustNode>
}

export type Node = {
    val: Content,
    id: string,
    children: Array<Node>
}

export type Progress = {
  total: number,
  count: number,
}
