import { AppAgentClient, EntryHashB64, AgentPubKeyB64, AppAgentCallZomeRequest, RoleName, encodeHashToBase64, decodeHashFromBase64, EntryHash } from '@holochain/client';
import { UnitInput, RustNode, RustTree, Initialization, AdvanceStateInput, UnitOutput, BranchySignal, Unit, UpdateUnitInput, AddAttachmentInput} from './types';
import { ActionHash  } from '@holochain/client';
import { HrlB64WithContext } from '@lightningrodlabs/we-applet';

export class BranchyService {
  constructor(
    public client: AppAgentClient,
    protected roleName: RoleName,
    protected zomeName = 'branchy'
  ) {}

  get myAgentPubKey() : AgentPubKeyB64 {
    return encodeHashToBase64(this.client.myPubKey);
  }

  async initialize(input: Initialization): Promise<EntryHashB64> {
    return this.callZome('initialize', input);
  }

  async createUnit(unit: UnitInput): Promise<UnitOutput> {
    return this.callZome('create_unit', unit);
  }

  async updateUnit(unitEh: AgentPubKeyB64, unit: Unit, state: string): Promise<UnitOutput> {
    const input : UpdateUnitInput = {
      hash: decodeHashFromBase64(unitEh),
      state,
      unit
    }
    console.log("UPDATE UNIT", input, unitEh)
    return this.callZome('update_unit', input);
  }

  async getUnits(): Promise<Array<UnitOutput>> {
    return await this.callZome('get_units', null)
  }

  async advanceState(input: AdvanceStateInput): Promise<EntryHashB64> {
    return this.callZome('advance_state', input);
  }

  async addAttachment(input: AddAttachmentInput): Promise<undefined> {
    return this.callZome('add_attachment', input);
  }

  async removeAttachment(input: AddAttachmentInput): Promise<undefined> {
    console.log("REMVO", input )
    return this.callZome('remove_attachment', input);
  }

  async getAttachments(input: EntryHash): Promise<Array<HrlB64WithContext>> {
    return this.callZome('get_attachments', input);
  }

  async getTree(): Promise<Array<RustNode>> {
    let tree:RustTree = await this.callZome('get_tree', null);
    return tree.tree
  }

  async notify(signal: BranchySignal, folks: Array<AgentPubKeyB64>): Promise<void> {
    return this.callZome('notify', {signal, folks});
  }

  private callZome(fnName: string, payload: any) {
    const req: AppAgentCallZomeRequest = {
      role_name: this.roleName,
      zome_name: this.zomeName,
      fn_name: fnName,
      payload
    }
    return this.client.callZome(req);
  }
}
