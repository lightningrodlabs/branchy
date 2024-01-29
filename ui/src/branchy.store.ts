import { EntryHashB64, AgentPubKeyB64, AppAgentClient, RoleName, encodeHashToBase64, decodeHashFromBase64, AgentPubKey, DnaHash, EntryHash } from '@holochain/client';
import { AgentPubKeyMap, EntryRecord, LazyHoloHashMap } from '@holochain-open-dev/utils';
import { writable, Writable, derived, Readable, get } from 'svelte/store';
import cloneDeep from 'lodash/cloneDeep';
import { BranchyService } from './branchy.service';
import {
  Dictionary,
  Unit,
  RustNode,
  Node,
  Initialization,
  UnitOutput,
  UnitInfo,
  Mark,
  BranchySignal,
  Progress,
} from './types';
import { Action, ActionHash } from '@holochain/client';
import { HrlB64WithContext, HrlWithContext, WeClient } from '@lightningrodlabs/we-applet';
import { getMyDna, hrlB64WithContextToRaw, hrlWithContextToB64 } from './util';
import { AsyncReadable, manualReloadStore } from '@holochain-open-dev/stores';
import { lazyLoad } from '@holochain-open-dev/stores';

const areEqual = (first: Uint8Array, second: Uint8Array) =>
      first.length === second.length && first.every((value, index) => value === second[index]);

export class BranchyStore {
  /** Private */
  private service : BranchyService

  /** UnitEh -> Unit */
  private unitsStore: Writable<Dictionary<Unit>> = writable({});   // maps unit hash to unit
  private unitsActionStore: Writable<Dictionary<Action>> = writable({});   // maps unit hash to unit
  private unitsInfoStore: Writable<Dictionary<UnitInfo>> = writable({});   // maps unit hash to unit
  private unitsPathStore: Writable<Dictionary<string>> = writable({});  // maps unit hash to path
  private treeStore: Writable<Node> = writable({val:{name:"T", units: []}, children:[], id:"0"});

  /** Static info */
  myAgentPubKey: AgentPubKeyB64;
  treeName: string = "Root"

  /** Readable stores */
  public units: Readable<Dictionary<Unit>> = derived(this.unitsStore, i => i)
  public unitsPath: Readable<Dictionary<string>> = derived(this.unitsPathStore, i => i)
  public unitsAction: Readable<Dictionary<Action>> = derived(this.unitsActionStore, i => i)
  public unitsInfo: Readable<Dictionary<UnitInfo>> = derived(this.unitsInfoStore, i => i)
  public tree: Readable<Node> = derived(this.treeStore, i => i)
  public dnaHash: DnaHash|undefined
  public unitAttachments: LazyHoloHashMap<EntryHash,AsyncReadable<Array<HrlWithContext>>& { reload: () => Promise<void> }> = new LazyHoloHashMap(
    unitHash => manualReloadStore(async () => this.getAttachments(encodeHashToBase64(unitHash)))    
  )

  constructor(
    public weClient: WeClient|undefined,
    protected client: AppAgentClient,
    roleName: RoleName,
    zomeName = 'branchy',

  ) {
    this.myAgentPubKey = encodeHashToBase64(client.myPubKey);
    this.service = new BranchyService(client, roleName, zomeName);
    
    getMyDna(roleName, client).then(res=>{
      this.dnaHash = res
    })
    client.on( 'signal', signal => {
      console.log("SIGNAL",signal.payload)
      const payload  = signal.payload as BranchySignal
      switch(payload.message.type) {
      case "NewUnit":
        if (!get(this.units)[payload.unitHash]) {
        //  this.updateUnitFromEntry(new EntryRecord<Unit>(payload.message.content))
        }
        break;
      }
    })
  }

  private updateUnitFromEntry(unitOutput: UnitOutput) {
    const record: EntryRecord<Unit> = new EntryRecord<Unit>(unitOutput.record)
    const unit = new Unit(record.entry)
    const hash = encodeHashToBase64(record.entryHash)
    this.unitsPathStore.update(units => {
      const path = unit.path()
      units[path] = hash
      return units
    })
    this.unitsStore.update(units => {
      units[hash] = unit
      return units
    })
    this.unitsActionStore.update(units => {
      const a = record.action
      //@ts-ignore
      units[hash] = a
      return units
    })
    this.unitsInfoStore.update(units => {
      units[hash] = unitOutput.info
      return units
    })
  }

  async pullUnits() : Promise<Dictionary<Unit>> {
    const units = await this.service.getUnits();
    for (const unitOutput of units) {
      this.updateUnitFromEntry(unitOutput)
    }
    return get(this.unitsStore)
  }




  async advanceState(unitHash: EntryHashB64, state: string) : Promise<undefined> {
    const unit = this.unit(unitHash)
    if (unit) {
  
        await this.service.advanceState({
            newState: state,
            unitHash: decodeHashFromBase64(unitHash),
            }
          );
        return undefined
    }
    return undefined
  }

  async addAttachment(unitHash: EntryHashB64, attachment: HrlWithContext) : Promise<undefined> {
    const unit = this.unit(unitHash)
    if (unit) {
  
        await this.service.addAttachment({
            unitHash: decodeHashFromBase64(unitHash),
            attachment: hrlWithContextToB64(attachment)
            }
          );
        return undefined
    }
    return undefined
  }

  async removeAttachment(unitHash: EntryHashB64, attachment: HrlWithContext) : Promise<undefined> {
    const unit = this.unit(unitHash)
    if (unit) {
  
        await this.service.removeAttachment({
            unitHash: decodeHashFromBase64(unitHash),
            attachment: hrlWithContextToB64(attachment)
            }
          );
        return undefined
    }
    return undefined
  }

  async getAttachments(unitHash: EntryHashB64) : Promise<Array<HrlWithContext>> {
    const hrlB64s = await this.service.getAttachments(decodeHashFromBase64(unitHash))
    const hrls = hrlB64s.map(h=>hrlB64WithContextToRaw(h))
    return hrls
  }

  buildTree(tree: Array<RustNode>, node: RustNode): Node {
    let t: Node = {val: node.val, children: [], id: `${node.idx}`}
    for (const n of node.children) {
      t.children.push(this.buildTree(tree, tree[n]))
    }
    return t
  }

  private find(tree: Node, path: Array<string>): Node | undefined {
    const node = tree.children.find(n=> {return path[0]==n.val.name})
    if (!node) return undefined
    path.shift()
    if (path.length == 0) return node
    return this.find(node, path)
  }

  findInTree(path: string): Node | undefined {
    return this.find(get(this.treeStore), path.split("."))
  }

  getBranchPaths(path: string): Array<string> {
    const paths: Array<string> = []
    const node = this.findInTree(path)
    if (node) {
      for (const child of node.children) {
        const childPath = `${path}.${child.val.name}`
        paths.push(childPath)
        const subPaths = this.getBranchPaths(childPath)
        for (const p of subPaths) {
          paths.push(p)
        }
      }
    }
    return paths
  }

  async pullTree() : Promise<Node> {
    const rtree: Array<RustNode> = await this.service.getTree();
    const node: Node = this.buildTree(rtree, rtree[0])
    this.treeStore.update(tree => {
      tree = node
      return tree
    })
    return get(this.treeStore)
  }


  async addUnit(unit: Unit, state: string) : Promise<EntryHashB64> {
    const unitOutput: UnitOutput = await this.service.createUnit({unit, state})
    this.updateUnitFromEntry(unitOutput)

    //this.service.notify({unitHash:unitEh, message: {type:"NewUnit", content:unit}}, this.others());
    return encodeHashToBase64(unitOutput.info.hash)
  }

  async updateUnit(unitEh: EntryHashB64, unit: Unit, state: string): Promise<EntryHashB64> {
    const unitOutput: UnitOutput = await this.service.updateUnit(unitEh, unit, state);
    this.updateUnitFromEntry(unitOutput)
    return encodeHashToBase64(unitOutput.info.hash)
  }

  async initilize(input: Initialization) : Promise<void> {
    await this.service.initialize(input)
  }

  unit(unitEh: EntryHashB64): Unit {
    return get(this.unitsStore)[unitEh];
  }

  unitInfo(unitEh: EntryHashB64): UnitInfo {
    return get(this.unitsInfoStore)[unitEh];
  }

}
