import {css, html, LitElement} from "lit";
import {customElement, property, query, state} from "lit/decorators.js";

import {sharedStyles} from "../sharedStyles";
import { AgentPubKeyB64, encodeHashToBase64 } from "@holochain/client";
import { BranchyAgentList } from "./branchy-agent-list";
import "./branchy-agent-list";
import '@holochain-open-dev/profiles/dist/elements/search-agent.js';

/**
 * @element branchy-edit-agent-list
 */
@customElement('branchy-edit-agent-list')
export class BranchyEditAgentList extends LitElement {
  constructor() {
    super();
  }
  @property() agents : Array<AgentPubKeyB64> = []

  private addAgent(e:any) {
    //const nickname = e.detail.agent.profile.nickname
    const pubKey = encodeHashToBase64(e.detail.agentPubKey)
    if (!this.agents.includes(pubKey)) {
      this.agents.push(pubKey)
      const list = this.shadowRoot!.getElementById(`agent-list`) as BranchyAgentList
      list.requestUpdate()
    }
  }

  render() {
    return html`
      <div class="edit-agent-list column">
        <branchy-agent-list id="agent-list" layout="row" .agents=${this.agents}></branchy-agent-list>
        <search-agent
          @closing=${(e:any)=>e.stopPropagation()}
          @agent-selected="${this.addAgent}"
          clear-on-select
          style="margin-bottom: 16px;"
          include-myself></search-agent>
        </div>
      `
  }
static get styles() {
    return [
      sharedStyles,
      css`
         .edit-agent-list {

         }
      `,
    ];
  }
}
