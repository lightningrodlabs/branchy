import { html, css, LitElement } from "lit";
import { state, property, query } from "lit/decorators.js";


import { sharedStyles } from "../sharedStyles";
import {branchyContext, Unit, Dictionary, Initialization, Node } from "../types";
import { BranchyStore } from "../branchy.store";
import { BranchyUnit } from "./branchy-unit";
import { BranchyTree } from "./branchy-tree";
import { initialTreeSimple } from "../initSimple";
import { BranchyUnitDialog } from "./branchy-unit-dialog";
import { BranchyUnitDialogEdit } from "./branchy-unit-dialog-edit";
import { ScopedElementsMixin } from "@open-wc/scoped-elements";
import { AsyncReadable, AsyncStatus, StoreSubscriber } from '@holochain-open-dev/stores';
import { aliveImage } from "../images";
import '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import "@shoelace-style/shoelace/dist/components/dropdown/dropdown.js";
import "@shoelace-style/shoelace/dist/components/menu-item/menu-item.js";
import "@shoelace-style/shoelace/dist/components/menu/menu.js";
import SlDropdown from '@shoelace-style/shoelace/dist/components/dropdown/dropdown.js';

import SlDialog from '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
import sanitize from "sanitize-filename";

import {
  ListItem,
  Select,
  IconButton,
  Button, TextField, List, Icon,
} from "@scoped-elements/material-web";
import {
  profilesStoreContext,
  ProfilesStore,
  Profile,
} from "@holochain-open-dev/profiles";
import {EntryHashB64, encodeHashToBase64} from "@holochain/client";
import { consume } from '@lit/context';
import { BranchyMyProfileDialog } from "./branchy-my-profile-dialog";
import { EntryRecord } from "@holochain-open-dev/utils";
import { isWeContext } from "@lightningrodlabs/we-applet";
//import { BranchySettings } from "./branchy-settings";
//import './branchy-settings.js';

/**
 * @element branchy-controller
 */
export class BranchyController extends ScopedElementsMixin(LitElement) {
  constructor() {
    super();
  }

  /** Public attributes */
  @property({ type: Boolean, attribute: 'dummy' })
  canLoadDummy = false;

  /** Dependencies */

  @consume({ context: branchyContext, subscribe: true })
  _store!: BranchyStore;

  @consume({ context: profilesStoreContext, subscribe: true })
  _profiles!: ProfilesStore;


  _myProfile!: StoreSubscriber<AsyncStatus<EntryRecord<Profile> | undefined>>;
  @query("branchy-my-profile")
  _myProfileDialog!:BranchyMyProfileDialog


  @query("#file-input")
  _fileInput!: HTMLElement

  _units = new StoreSubscriber(this, () => this._store.units);
  _unitsPath = new StoreSubscriber(this, () => this._store.unitsPath);

  /** Private properties */

  @query('#tree')
  private _tree!: BranchyTree;
  @query('#settings')
  private _settings!: SlDialog;
  @query('#reparent')
  private _reparentDialog!: SlDialog;
  @state() _reparentingToUnitHash: EntryHashB64 | undefined
  @query('#units-menu')
  private _unitsMenu!: SlDropdown;

  @query('#unit-dialog')
  private _unitDialogElem!: BranchyUnitDialog;
  @query('#unit-dialog-edit')
  private _editUnitDialogElem!: BranchyUnitDialogEdit;

  @state() _currentUnitEh = "";
  @state() _treeType = "tree";

  @state()
  private initialized = false;
  private initializing = false;
  private initialSync : number | undefined = undefined


  async createDummyProfile() {
    const nickname = "Cam";
    const avatar = "https://cdn3.iconfinder.com/data/icons/avatars-9/145/Avatar_Cat-512.png";

    try {
      const fields: Dictionary<string> = {};
       if (avatar) {
         fields['avatar'] = avatar;
       }
      await this._profiles.client.createProfile({
        nickname,
        fields,
      });

    } catch (e) {
      //this._existingUsernames[nickname] = true;
      //this._nicknameField.reportValidity();
    }
  }


  get myNickName(): string {
    if (this._myProfile.value.status == "complete") {
      const profile = this._myProfile.value.value;
      if (profile)
        return profile.entry.nickname
    }
    return ""
  }
  get myAvatar(): string {
    if (this._myProfile.value.status == "complete") {
      const profile = this._myProfile.value.value;
      if (profile)
        return profile.entry.fields.avatar
    }
    return ""
  }

  getCurrentPath() : string {
    if (!this._currentUnitEh) {
      return ""
    }
    const unit: Unit = this._units.value[this._currentUnitEh];
    return unit.path()
  }

  private async subscribeProfile() {

    this._myProfile = new StoreSubscriber(
      this,
      () => this._profiles.myProfile
    );
  }

  async firstUpdated() {
    if (this.canLoadDummy) {
      await this.createDummyProfile()
    }
    this.subscribeProfile()
    await this.checkInit();
    if (!this.initialized) {
      this.initialSync = setInterval(async ()=>{
        if (!this.initialized) {
          await this.checkInit();
        } else {
          clearInterval(this.initialSync)
        }
      }, 10000);
    }
  }
 
  private _getFirst(units: Dictionary<Unit>): EntryHashB64 {
    if (Object.keys(units).length == 0) {
      return "";
    }
    for (let unitEh in units) {
//      const unit = units[unitEh]
//      if (unit.visible) {
        return unitEh
//      }
    }
    return "";
  }

  async refresh() {
    console.log("refresh: Pulling data from DHT")
    await this._store.pullUnits();
    await this._store.pullTree();
  }

  get unitElem(): BranchyUnit {
    return this.shadowRoot!.getElementById("branchy-unit") as BranchyUnit;
  }

  private async handleUnitSelect(unitEh: EntryHashB64): Promise<void> {
    if (this._units.value[unitEh]) {
      this._currentUnitEh = unitEh;
      this.unitElem.currentUnitEh = unitEh;
      this._tree.currentNode = unitEh;
    }
  }

  handleNodeSelected(event: any) {
    this.handleUnitSelect(event.detail)
  }

  handleAddChild(event: any) {
    const parentEh = event.detail
    this._unitDialogElem.open(parentEh)
  }

  handleEditUnit(event: any) {
    const unitEh = event.detail
    this._editUnitDialogElem.open(unitEh)
  }

  private isTreeType() : boolean {
    if (!this._tree) return false
    return this._treeType == "tree"
  }
  toggleTreeType() {
    this._tree.treeType = this._tree.treeType == "tree"?"file-tree":"tree"
    this._treeType = this._tree.treeType
  }
  async handleUnitUpdated(e:any) {
    await this._store.pullTree()
    await this._store.pullUnits()

  }

  clickCount = 0
  @state() showInit = false
  adminCheck = () => { 
    this.clickCount += 1
    if (this.clickCount == 5) {
      this.clickCount = 0
      this.showInit = true
    }
  }

  download = (filename: string, text: string) => {
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/json;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
  }


  serializeUnit(hash:string, unit:Unit) :any  {
    return {
        hash,
        parents: unit.parents,
        name: unit.name,
        description: unit.description,
        stewards: unit.stewards,
        meta: unit.meta,
      }
  }

  serializeNode(path: string, node:Node, units:Dictionary<Unit> ) : any  {
    return {
      id: node.id,
      val: {
        name: node.val.name,
        units: node.val.units.map(u=>{
          const unitHash = encodeHashToBase64(u.hash)
          return { 
            unit: this.serializeUnit(unitHash, units[unitHash]),
            state: u.state,
          }}),
        children: node.children.map(c=> this.serializeNode(path == "" ? node.val.name : `${path}.${node.val.name}`, c, units))
      }
    }
  }

  async doExport() {
    const rawTree = await this._store.pullTree()
    const rawUnits = await this._store.pullUnits()
    const tree = this.serializeNode("", rawTree, rawUnits)
    const exportJSON= JSON.stringify(
      {
        tree,
       // units,
      }
      )
    const fileName = sanitize(`branchy.json`)
    this.download(fileName, exportJSON)
    alert(`exported as: ${fileName}`)
  }
  async doInitializeDHT(init:Initialization) {
    if (this.initializing || this.initialized) {
      console.log("initialization allready started")
      return;
    }
    console.log("starting initialization")
    this.initializing = true  // because checkInit gets call whenever profiles changes...
    await this._store.initilize(init);
    this.initializing = false
    console.log("initialization complete")
    this.checkInit()
  }

  async addInitialSimple() {
    const init  = initialTreeSimple(this._store.myAgentPubKey)

    await this.doInitializeDHT(init)
  }

  async checkInit() {
    console.log("checking...")
    let units = await this._store.pullUnits();
    await this._store.pullTree();

    if (Object.keys(units).length > 0) {
      this.initialized = true
    }
  }

  dataFromImport(parentPath:string, node:any ): [Array<[string,Unit]>] {
    let units: Array<[string,Unit]> = []

    for (const unitInfo of node.val.units) {
      const unit:any = unitInfo.unit
      units.push([unitInfo.state, new Unit({
        parents: unit.parents, // full paths to parent nodes (remember it's a DAG)
        name: unit.name, // max 10 char
        description: unit.description, // max 25 char
        stewards: [this._store.myAgentPubKey], // people who can change this document
      })])
    }
    const path = parentPath == "" ? node.val.name : `${parentPath}.${node.val.name}`
    console.log("importing:", path)
    
    for (const n of node.val.children) {
      const [u] = this.dataFromImport(path, n)
      units = units.concat(u)
    }
    return [units]
  }

  initializationFromImport(importData: any) : Initialization {
    console.log("creating initialization structs..")
    const [units] = this.dataFromImport("", importData.tree)
    const init: Initialization = {
      units,
    }
    return init
  }

  onFileSelected = (e:any)=>{
    let file = e.target.files[0];
    let reader = new FileReader();

    reader.addEventListener("load", async () => {
        console.log("import file loaded, parsing...")
        const b = JSON.parse(reader.result as string)
        const init:Initialization  = this.initializationFromImport(b)
        await this.doInitializeDHT(init)
    }, false);
    reader.readAsText(file);
  }

  render() {
    if (!this.initialized) {
      return html`

      <div class="initializing">
        <input id="file-input" style="display:none" type="file" accept=".json" @change=${(e:any)=>{this.onFileSelected(e)}} >
        <div class="wrapper">
          <div class="about-event"/>
            <img class="branchy-welcome" src=${aliveImage}
            @click=${()=>this.adminCheck()}>
            <h3>Welcome to Branchy! (v0.1.1)</h3>

            <p> If you are the first person installing Branchy in your group, initialize this instance
            with:
            <span style="display:flex; margin-top:5px;">
            <mwc-button
              id="primary-action-button"
              slot="primaryAction"
              @click=${()=>this.addInitialSimple()}
              >Default Tree</mwc-button
            > 
            or

            <mwc-button
              id="primary-action-button"
              slot="primaryAction"
              @click=${()=>this._fileInput.click()}
              >Import JSON File</mwc-button
            > </span>
            </p>
            <p style="">
              Otherwise, <strong>please be patient and wait</strong> for data to syncronize.  
              When it does this page will automatically refresh.
            </p>
          </div>
        </div>
      </div>
      `
    }
    const tree = html`  
      <branchy-tree id="tree"
        .treeType=${this._treeType}
        @node-selected=${this.handleNodeSelected}
        @add-child=${this.handleAddChild}>
      </branchy-tree>`
    const unit = html`
    <branchy-unit id="branchy-unit" .currentUnitEh=${this._currentUnitEh}
        @unit-updated=${this.handleUnitUpdated}
        @select-node=${(e: any)=>{const hash = this._unitsPath.value[e.detail]; this.handleUnitSelect(hash)}}
        @add-child=${this.handleAddChild}
        @edit=${this.handleEditUnit}
     />`
    return html`

  <branchy-my-profile></branchy-my-profile>
  <sl-dialog id="settings" label="Settings">
      <sl-button
      @click=${async ()=>{await this.doExport()}}>Export</sl-button>
      </sl-dialog>
  <div>

    <div id="top-bar" class="row">
      <div id="top-bar-title">Branchy ${this._currentUnitEh ? ` - ${this._units.value[this._currentUnitEh].description}` : ''}</div>
      <mwc-icon-button icon="view_module"  @click=${this.toggleTreeType}></mwc-icon-button>
      ${!isWeContext() ? html`<mwc-icon-button icon="account_circle" @click=${() => {this._myProfileDialog.open()}}></mwc-icon-button>`:''}
      <mwc-icon-button icon="settings" @click=${() => {this._settings.show()}}></mwc-icon-button>
    </div>

    <div class="appBody column">
      <div class="row"> 
      ${tree}
      ${unit}
      </div>
    </div>
    <branchy-unit-dialog id="unit-dialog"
      @unit-added=${(e:any)=>{this.handleNodeSelected(e); this.refresh();}}>
    </branchy-unit-dialog>
    <branchy-unit-dialog-edit id="unit-dialog-edit"
      >
    </branchy-unit-dialog-edit>
  </div>

`;
  }


  static get scopedElements() {
    return {
      "mwc-textfield": TextField,
      "mwc-select": Select,
      "mwc-list": List,
      "mwc-list-item": ListItem,
      "mwc-icon": Icon,
      "mwc-icon-button": IconButton,
      "mwc-button": Button,
      "branchy-unit-dialog" : BranchyUnitDialog,
      "branchy-unit-dialog-edit" : BranchyUnitDialogEdit,
      "branchy-unit": BranchyUnit,
      "branchy-tree": BranchyTree,
      'branchy-my-profile': BranchyMyProfileDialog,
//      'branchy-settings': BranchySettings,
    };
  }

  static get styles() {
    return [
      sharedStyles,
      css`
        :host {
          font-family: Roboto,'Open Sans','Helvetica Neue',sans-serif;
        }

        #top-bar {
          margin: 10px;
          align-items: center;
          justify-content: flex-end;
        }
        #top-bar-title {
          font-size: 1.5em;
          font-weight: bold;
          margin-right: auto;
        }
        .appBody {
          margin-top: 10px;
          margin-left: 20px;
          margin-right: 20px;
          margin-bottom: 20px;
          display:flex;
        }
        .initializing {
          width: 100vw;
          display: block;
          height: 100vh;
          background-image: url(/images/dweb-background.jpg);
          background-size: cover;
          overflow-y: scroll;
        }

        .initializing .wrapper {
          display: block;
          height: 100%;
          max-width: 320px;
          margin: 0 auto;
        }


        .about-event {
          padding: 20px;
          
        }
        .about-event h3 {
          text-align: center;
        }

        .about-event p {
          font-size: 14px;
          text-align: center;
          margin-top: 15px;
          margin-bottom: 0;
        }
        .branchy-welcome {
          width: 200px;
          margin: 0 auto;
          display: block;
        }
        mwc-textfield.rounded {
          --mdc-shape-small: 20px;
          width: 7em;
          margin-top:10px;
        }

        mwc-textfield label {
          padding: 0px;
        }

        @media (min-width: 640px) {
          main {
            max-width: none;
          }
        }
      `,
    ];
  }
}
