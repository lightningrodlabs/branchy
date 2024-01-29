import {css, html, LitElement, TemplateResult} from "lit";
import {customElement, property, query, state} from "lit/decorators.js";

import {sharedStyles} from "../sharedStyles";
import {ScopedElementsMixin} from "@open-wc/scoped-elements";
import { AgentPubKeyB64 } from "@holochain/client";
import { BranchyStore } from "../branchy.store";
import { branchyContext } from "../types";
import { consume } from '@lit/context';
import { Profile, ProfilesStore, profilesStoreContext } from "@holochain-open-dev/profiles";
import { StoreSubscriber } from "@holochain-open-dev/stores";
import { decodeHashFromBase64 } from "@holochain/client";

/**
 * @element branchy-agent-list
 */
@customElement('branchy-agent-list')
export class BranchyAgentList extends LitElement {
  constructor() {
    super();
  }
  @property() agents : Array<AgentPubKeyB64> = []
  @property() layout = "column"

  @consume({ context: branchyContext, subscribe: true })
  _store!: BranchyStore;

  @consume({ context: profilesStoreContext, subscribe: true })
  _profiles!: ProfilesStore;

  _allProfiles  = new StoreSubscriber(this, () =>
    this._profiles.allProfiles
  );

  render() {
    const agentsHTML: Array<TemplateResult>= []
    for (const agentHash of this.agents) {
      let profile: Profile |undefined = undefined
      if (this._allProfiles.value.status == "complete") {
        const record = this._allProfiles.value.value.get(decodeHashFromBase64(agentHash))
        if (record)
          profile = record.entry
      }
  
      if (profile) {
        agentsHTML.push(html`<div class="agent" title="${agentHash}"><agent-avatar agent-pub-key=${agentHash}> </agent-avatar> ${profile.nickname}</div>`)
      } else {
        agentsHTML.push(html`<span class="agent" title="${agentHash}">${agentHash}</span>`)
      }
    } 
    return html`
      <div class="agent-list ${this.layout}">
        ${agentsHTML}
      </div>
      `
  }

static get styles() {
    return [
      sharedStyles,
      css`
         .agent {
          margin-right:10px;
         }
         .agent-list {

         }
      `,
    ];
  }
}
