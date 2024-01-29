import {css, html, LitElement} from "lit";
import {property, query, state} from "lit/decorators.js";

import { asyncReadable, StoreSubscriber } from '@holochain-open-dev/stores';

import {sharedStyles} from "../sharedStyles";
import {Unit, branchyContext, SysState, UnitInfo } from "../types";
import {BranchyStore} from "../branchy.store";
import { SvgButton } from "./svg-button";

import {ScopedElementsMixin} from "@open-wc/scoped-elements";
import {
  Button,
} from "@scoped-elements/material-web";
import { Action, EntryHashB64, decodeHashFromBase64, encodeHashToBase64 } from "@holochain/client";
import { InfoItem } from "./info-item";
import { BranchyConfirm } from "./branchy-confirm";
import { consume } from '@lit/context';
import { Profile, ProfilesStore, profilesStoreContext } from "@holochain-open-dev/profiles";
import { underConstructionImage } from "../images";
import "./attachments-list.js";

/**
 * @element branchy-unit
 */
export class BranchyUnit extends ScopedElementsMixin(LitElement) {
  constructor() {
    super();
  }

  @property() currentUnitEh = "";
  @state() versionIndex: number | undefined = undefined;

  @consume({ context: branchyContext, subscribe: true })
  _store!: BranchyStore;

  @consume({ context: profilesStoreContext, subscribe: true })
  _profiles!: ProfilesStore;

  _allProfiles  = new StoreSubscriber(this, () =>
    this._profiles.allProfiles
  );
  
  _units = new StoreSubscriber(this, () => this._store.units);
  _unitsActions = new StoreSubscriber(this, () => this._store.unitsAction);
  _unitsInfos = new StoreSubscriber(this, () => this._store.unitsInfo);


  @query('branchy-confirm')
  _confirmElem!: BranchyConfirm;

  handleNodelink(path: string) {
    this.dispatchEvent(new CustomEvent('select-node', { detail: path, bubbles: true, composed: true }));
  }

  reloadLinks() {
    const store = this._store.unitAttachments.get(decodeHashFromBase64(this.currentUnitEh))
    if (store) {
      store.reload()
    }
  }

  async addLink() {
    const hrl = await this._store.weClient?.userSelectHrl()
    if (hrl) {
      await this._store.addAttachment(this.currentUnitEh, hrl)
      this.reloadLinks()
    }
  }

  getPath() : string {
    if (!this.currentUnitEh) {
      return ""
    }
    const unit: Unit = this._units.value[this.currentUnitEh];
    return unit.path()
  }

  renderType(type: String, content: String) : String {
    return content
  }

  private async confirmAdvance(unitHash: EntryHashB64, newState: string) {
    let message = "delete?"
    this._confirmElem!.open(message, {unitHash, newState})
  }

  private async handleConfirmAdvance(confirmation:any) {
    const unitHash: EntryHashB64 = confirmation.unitHash
    const nextState: string = confirmation.newState
    this.advanceState(unitHash, nextState)
  }

  private async advanceState(unitHash: EntryHashB64, newState: string) {
    await this._store.advanceState(unitHash, newState)
    this.dispatchEvent(new CustomEvent('unit-updated', { bubbles: true, composed: true }));
  }

  render() {
    if (!this.currentUnitEh) {
      return;
    }
    /** Get current unit*/
    const unit: Unit = this._units.value[this.currentUnitEh]
    const unitInfo: UnitInfo = this._unitsInfos.value[this.currentUnitEh]
    const action: Action = this._unitsActions.value[this.currentUnitEh]

    const path = this.getPath()

    const isSteward = unit.stewards.includes(this._store.myAgentPubKey)
    let stewardsHTML = html`<branchy-agent-list .agents=${unit.stewards}></branchy-agent-list>`

    
    const created = new Date(action.timestamp)
    const creatorHash = encodeHashToBase64(action.author)
    let creator: Profile |undefined = undefined
    if (this._allProfiles.value.status == "complete") {
      const record = this._allProfiles.value.value.get(action.author)
      if (record) {
        creator = record.entry
      }
    }
    let stateHTML
    let controlsHTML:any[] = []

    let updated: Date |undefined
    let state = unitInfo.state

    controlsHTML.push(html`
          <svg-button
            .click=${() => this.addLink()} 
            .info=${"add link"}
            .button=${"link"}>
          </svg-button>
        </div>
      `)
      
    if ( (state == SysState.UnderConstruction || state == SysState.Alive) && isSteward) {
      controlsHTML.push(html`
          <svg-button
            .click=${() => this.dispatchEvent(new CustomEvent('add-child', { detail: this.currentUnitEh, bubbles: true, composed: true }))} 
            .info=${"add child"}
            .button=${"plus"}>
          </svg-button>
        </div>
      `)
      if (state == SysState.UnderConstruction  && isSteward) {
        if (path != "") {
          controlsHTML.push(html`
          <svg-button
            .click=${() => this.dispatchEvent(new CustomEvent('edit', { detail: this.currentUnitEh, bubbles: true, composed: true }))} 
            .info=${"edit"}
            .button=${"edit"}>
          </svg-button>
          `)
        }
      //   controlsHTML.push(html`
      //     <svg-button
      //       .click=${() => this.confirmAdvance(this.currentUnitEh, SysState.Alive)}
      //       .info=${"make alive"}
      //       .button=${"move"}>
      //     </svg-button> 
      //   </div>
      // `)
      }
      if (state != SysState.UnderConstruction ) {
        if (updated) {
          stateHTML = html`<info-item title=${`Alive as of ${updated}`} item="Alive" .name=${`as of ${updated.toLocaleDateString('en-us', { year:"numeric", month:"short", day:"numeric"})}`}></info-item>`
        } else {
          stateHTML = html`<info-item item="Alive"></info-item>`
        }
      }
    } else if (state == SysState.Defunct) {
      stateHTML = html`<info-item item="Defunct"></info-item >`
    } else {
      stateHTML = html`<div class="info-item">${"CUR STATE"}<div class="info-item-name">state: ${state}</div></div>`
    }
    const stateName = unitInfo.state

    return html`
      <div class="unit row">
        <div class="column">
          <info-item size="26px" .item=${unit.name} name="name"></info-item>
          <info-item .item=${unit.description} name="description"></info-item>
          <info-item 
            .title=${`Created on ${created} by ${creator ? creator.nickname : creatorHash}`}
            .item=${created.toLocaleDateString('en-us', { year:"numeric", month:"short", day:"numeric"})} name="created">
          </info-item>
          ${ updated ? html`<info-item title=${`Last modified ${updated}`} .item=${updated.toLocaleDateString('en-us', { year:"numeric", month:"short", day:"numeric"})} name="modified"></info-item>`:''}
          <div class="info-item">${stewardsHTML}
            <div class="info-item-name">stewards</div>
          </div>
        </div>
        <div class="column">
          ${stateHTML}
          <div class="column unit-controls">
            ${controlsHTML}
          </div>
        </div>
        <attachments-list
          @attachment-removed=${()=>this.reloadLinks()}
          unitHash=${this.currentUnitEh} ></attachments-list>
      </div>
      <branchy-confirm @confirmed=${(e:any) => this.handleConfirmAdvance(e.detail)}></branchy-confirm>
    `;
  }


  static get scopedElements() {
    return {
      "mwc-button": Button,
      "svg-button": SvgButton,
      "info-item": InfoItem,
      "branchy-confirm": BranchyConfirm,
    };
  }
  static get styles() {
    return [
      sharedStyles,
      css`
      svg-button {
        align-self: flex-end;
      }
      .unit {
        padding: 10px;
      }
      .unit-name {
        font-size: 30px;
        font-weight: bold;
      }
      .unit-controls {
        justify-content: flex-end;
      }
      .progress {
        width: 200px;
      }
      .node-link {
        cursor: pointer;
        background-color: white;
        border: solid .1em #666;
        border-radius: .2em;
        padding: 0 6px 0 6px;
      }
      .history-item {
        width: 340px;
      }
      `,
    ];
  }
}
