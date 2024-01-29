import {css, html, LitElement} from "lit";
import {property, query, state} from "lit/decorators.js";

import {sharedStyles} from "../sharedStyles";
import {ScopedElementsMixin} from "@open-wc/scoped-elements";
import {BranchyStore} from "../branchy.store";
import {Unit, branchyContext, Dictionary, SysState, UnitInfo} from "../types";
import {encodeHashToBase64, EntryHashB64} from "@holochain/client";
import {
  Button,
  Dialog,
  TextField,
  TextArea,
  Select,
  ListItem,
} from "@scoped-elements/material-web";
import '@holochain-open-dev/profiles/dist/elements/search-agent.js';
import { StoreSubscriber } from '@holochain-open-dev/stores';
import { consume } from '@lit/context';

/**
 * @element branchy-unit-dialog
 */
export class BranchyUnitDialog extends ScopedElementsMixin(LitElement) {

  /** Dependencies */
  @consume({ context: branchyContext, subscribe: true })
  _store!: BranchyStore;

  @query('#name-field')
  _nameField!: TextField;

  @query('#description-field')
  _descriptionField!: TextField;
  
  @property() _stewards: Dictionary<string> = {};

  @state() _parent?: Unit;
  @state() _parentInfo?: UnitInfo;

  private static readonly NONE = 'none'; // we need a default value for the mwc-selects because if an empty string is provided, the UI gets broken

  private takenNames: Array<string> = []
  /**
   *
   */

  firstUpdated() {
    this._nameField.validityTransform = (newValue: string) => {
      this.requestUpdate();
      if (this.takenNames.includes(this._nameField.value)) {
        this._nameField.setCustomValidity(`Name already exists`);
        return {
          valid: false,
        };
      } 

      return {
        valid: true,
      };
    };
  }
  
  open(parentEh: EntryHashB64) {
    this._parent = this._store.unit(parentEh);
    this._parentInfo = this._store.unitInfo(parentEh);

    const dialog = this.shadowRoot!.getElementById("unit-dialog") as Dialog
    dialog.open = true
  }

  /**
   *
   */
  private async handleOk(e: any) {
    /** Check validity */
    // nameField
    let isValid = this._nameField.validity.valid
    if (!this._nameField.validity.valid) {
      this._nameField.reportValidity()
    }
    if (!this._descriptionField.validity.valid) {
      this._descriptionField.reportValidity()
    }

    const stewards = Object.keys(this._stewards).map((agent)=> agent)
    if (stewards.length == 0) {
      stewards.push(this._store.myAgentPubKey)
    }
    const unit = new Unit({
      parents: [this.parentPath()], // full paths to parent nodes (remember it's a DAG)
      name: this._nameField.value, // max 10 char
      description: this._descriptionField.value,
      stewards,  // people who can change this document
      });

    // - Add unit to commons
    const newUnit = await this._store.addUnit(unit, this._parentInfo?.state == SysState.UnderConstruction? SysState.UnderConstruction : "define");
    this.dispatchEvent(new CustomEvent('unit-added', { detail: newUnit, bubbles: true, composed: true }));

    // - Clear all fields
    // this.resetAllFields();
    // - Close dialog
    const dialog = this.shadowRoot!.getElementById("unit-dialog") as Dialog;
    dialog.close()
  }

  resetAllFields() {
    this._parent = undefined
    this._nameField.value = ''
    this._descriptionField.value = ''
    this._stewards = {}
  }

  private async handleDialogOpened(e: any) {
    // if (false) {
    //   const unit = this._store.unit(this._unitToPreload);
    //   if (unit) {
        
    //   }
    //   this._unitToPreload = undefined;
    // }
   // this.requestUpdate()
  }

  private async handleDialogClosing(e: any) {
    this.resetAllFields();
  }

  private parentPath() {
    if (!this._parent) return ``
    let path = ""
    if (this._parent.parents.length > 0) path +=  `${this._parent?.parents[0]}.`
    path += this._parent?.name
    return path
  }

  private addSteward(e:any) {
    const nickname = e.detail.profile.nickname
    const pubKey = encodeHashToBase64(e.detail.agentPubKey)
    this._stewards[pubKey] = nickname
    this._stewards = this._stewards
    this.requestUpdate()
  }

  render() {
    return html`
<mwc-dialog id="unit-dialog" heading="New unit" @closing=${this.handleDialogClosing} @opened=${this.handleDialogOpened}>
  Parent: ${this.parentPath()}
  <mwc-textfield dialogInitialFocus type="text"
    @input=${() => (this.shadowRoot!.getElementById("name-field") as TextField).reportValidity()}
    id="name-field" minlength="3" maxlength="10" label="name" autoValidate=true required></mwc-textfield>

  <mwc-textfield type="text"
                 @input=${() => (this.shadowRoot!.getElementById("description-field") as TextField).reportValidity()}
                 id="description-field" minlength="3" maxlength="64" label="Description" autoValidate=true></mwc-textfield>
  
  Stewards: ${Object.keys(this._stewards).length} ${Object.entries(this._stewards).map(([agent, nickname])=>html`<span class="agent" title="${agent}">${nickname}</span>`)}
  <search-agent
  @closing=${(e:any)=>e.stopPropagation()}
  @agent-selected="${this.addSteward}"
  clear-on-select
  style="margin-bottom: 16px;"
  include-myself></search-agent>

  <mwc-button id="primary-action-button" slot="primaryAction" @click=${this.handleOk}>ok</mwc-button>
  <mwc-button slot="secondaryAction"  dialogAction="cancel">cancel</mwc-button>
</mwc-dialog>
`
  }


  static get scopedElements() {
    return {
      "mwc-button": Button,
      "mwc-dialog": Dialog,
      "mwc-textfield": TextField,
      "mwc-textarea": TextArea,
      "mwc-list-item": ListItem,
    };
  }
  static get styles() {
    return [
      sharedStyles,
      css`
        mwc-dialog div {
          display: flex;
        }
        #unit-dialog {
          --mdc-dialog-min-width: 600px;
        }
        mwc-textfield {
          margin-top: 10px;
          display: flex;
        }
        mwc-textarea {
          margin-top: 10px;
          display: flex;
        }
        .ui-item {
          position: absolute;
          pointer-events: none;
          text-align: center;
          flex-shrink: 0;
        }
`,
    ];
  }
}
