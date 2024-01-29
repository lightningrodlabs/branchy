// import {
//   FileStorageClient,
//   fileStorageClientContext,
// } from '@holochain-open-dev/file-storage';
import {
  ProfilesClient,
  ProfilesConfig,
  ProfilesStore,
  profilesStoreContext,
} from '@holochain-open-dev/profiles';
import '@holochain-open-dev/profiles/dist/elements/agent-avatar.js';
import '@holochain-open-dev/profiles/dist/elements/profile-prompt.js';
import '@holochain-open-dev/profiles/dist/elements/profile-list-item-skeleton.js';
import {
  ActionHash,
  AdminWebsocket,
  AppAgentClient,
  AppAgentWebsocket,
  encodeHashToBase64,
} from '@holochain/client';
import { provide } from '@lit/context';
import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import {BranchyController} from "./elements/branchy-controller"
import {BranchyStore} from "./branchy.store"
import {branchyContext} from "./types"
import { localized, msg } from '@lit/localize';

import { ScopedElementsMixin } from "@open-wc/scoped-elements";
import { WeClient, isWeContext, initializeHotReload, HrlWithContext, Hrl } from '@lightningrodlabs/we-applet';
import { appletServices } from './we';
import { BranchyUnit } from './elements/branchy-unit';

const appId = 'branchy'

enum RenderType {
  App,
  Unit,
}

@localized()
@customElement('holochain-app')
export class HolochainApp extends ScopedElementsMixin(LitElement) {
  @state()
  loaded = false;

  // @provide({ context: fileStorageClientContext })
  // @property()
  // _fileStorageClient!: FileStorageClient;

  @provide({ context: branchyContext })
  @property()
  _branchyStore!: BranchyStore;

  @provide({ context: profilesStoreContext })
  @property()
  _profilesStore!: ProfilesStore;

  renderType = RenderType.App
  hrlWithContext: HrlWithContext| undefined

  async firstUpdated() {

    const config:ProfilesConfig = {
      minNicknameLength: 3,
      avatarMode: "avatar-optional",
      additionalFields: [], // "Location","Hashtags", "Bio"// Custom app level profile fields
    };
    if ((import.meta as any).env.DEV) {
      try {
        await initializeHotReload();
      } catch (e) {
        console.warn("Could not initialize applet hot-reloading. This is only expected to work in a We context in dev mode.")
      }
    }

    if (!isWeContext()) {
      const adminPort : string = import.meta.env.VITE_ADMIN_PORT
      const appPort : string = import.meta.env.VITE_APP_PORT
      const url = appPort ? `ws://localhost:${appPort}` : 'ws://localhost';

      if (adminPort) {
        const adminWebsocket = await AdminWebsocket.connect(new URL(`ws://localhost:${adminPort}`))
        const x = await adminWebsocket.listApps({})
        const cellIds = await adminWebsocket.listCellIds()
        await adminWebsocket.authorizeSigningCredentials(cellIds[0])
      }
      const appAgentClient = await AppAgentWebsocket.connect(new URL(url), appId)
    
      this._branchyStore = new BranchyStore(undefined, appAgentClient, "branchy")
      
      this._profilesStore = new ProfilesStore(
        new ProfilesClient(appAgentClient, 'branchy'), config
      );
    } else {
        const weClient = await WeClient.connect(appletServices);

        switch (weClient.renderInfo.type) {
          case "applet-view":
            switch (weClient.renderInfo.view.type) {
              case "main":
                // default is allready App
                break;
              case "block":
                switch(weClient.renderInfo.view.block) {
                  default:
                    throw new Error("Unknown applet-view block type:"+weClient.renderInfo.view.block);
                }
                break;
              case "attachable":
                switch (weClient.renderInfo.view.roleName) {
                  case "branchy":
                    switch (weClient.renderInfo.view.integrityZomeName) {
                      case "branchy_integrity":
                        switch (weClient.renderInfo.view.entryType) {
                          case "unitx":
                            this.renderType = RenderType.Unit
                            this.hrlWithContext = weClient.renderInfo.view.hrlWithContext
                            break;
                          default:
                            throw new Error("Unknown entry type:"+weClient.renderInfo.view.entryType);
                        }
                        break;
                      default:
                        throw new Error("Unknown integrity zome:"+weClient.renderInfo.view.integrityZomeName);
                    }
                    break;
                  default:
                    throw new Error("Unknown role name:"+weClient.renderInfo.view.roleName);
                }
                break;
              default:
                throw new Error("Unsupported applet-view type");
            }
            break;
          case "cross-applet-view":
            switch (weClient.renderInfo.view.type) {
              case "main":
                // here comes your rendering logic for the cross-applet main view
                //break;
              case "block":
                //
                //break;
              default:
                throw new Error("Unknown cross-applet-view render type.")
            }
            break;
          default:
            throw new Error("Unknown render view type");
  
        }  
        //@ts-ignore
        const client = weClient.renderInfo.appletClient;
        this._branchyStore = new BranchyStore(weClient, client, "branchy")
        if (this.renderType == RenderType.Unit) this._branchyStore.pullUnits()

        //@ts-ignore
        const profilesClient = weClient.renderInfo.profilesClient;
        this._profilesStore = new ProfilesStore(profilesClient, config)
      }

    this.loaded = true;
  }


  render() {
    if (!this.loaded) return html`<span>Loading...</span>`;
    return html`
      <profile-prompt>
        ${this.renderType == RenderType.App ? html`
         <branchy-controller></branchy-controller>`:""}
        ${this.renderType == RenderType.Unit && this.hrlWithContext ? html`
         <branchy-unit .currentUnitEh=${encodeHashToBase64(this.hrlWithContext.hrl[1])}></branchy-unit>`:""}
      </profile-prompt>
                  <!-- <branchy-controller id="controller" dummy="{true}""></branchy-controller> -->

    `;
  }

  static get scopedElements() {
    return {
      "branchy-controller": BranchyController,
      "branchy-unit": BranchyUnit,
    };
  }
}
