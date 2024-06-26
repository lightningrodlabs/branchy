import {
    StoreSubscriber,
  } from "@holochain-open-dev/stores";
  import { consume } from "@lit/context";
  import { css, html, LitElement } from "lit";
  import { customElement, property } from "lit/decorators.js";
  import { localized, msg } from "@lit/localize";
  import { sharedStyles } from "@holochain-open-dev/elements";
  import { branchyContext} from "../types";
  import { BranchyStore} from "../branchy.store";
  import { WAL } from "@lightningrodlabs/we-applet";
  import { decodeHashFromBase64, EntryHashB64 } from "@holochain/client";
  import "@shoelace-style/shoelace/dist/components/button/button.js";
  import "@shoelace-style/shoelace/dist/components/skeleton/skeleton.js";
  import {until} from 'lit-html/directives/until.js';
  import { SVG } from "./svg-icons";
  
  @customElement("attachments-list")
  export class AttachmentsList extends LitElement {
    constructor() {
      super();
    }
    @property()
    unitHash!:EntryHashB64;

    @property()
    allowDelete = true;

    @consume({ context: branchyContext, subscribe: true })
    _store!: BranchyStore;
  
    attachments = new StoreSubscriber(
        this,
        () =>
          this._store.unitAttachments.get(decodeHashFromBase64(this.unitHash)),
      );

    async removeAttachment(attachment: WAL) {
        await this._store.removeAttachment(this.unitHash, attachment)
        this.dispatchEvent(new CustomEvent('attachment-removed', { detail: attachment, bubbles: true, composed: true }));
    }
  
    renderAttachment(attachment: WAL) {
      return html`
        <div style="display:flex;">
        ${until(this._store.weClient!.assetInfo(attachment).then(attachable => 
            !attachable ? html`(?)` :
            html`
            <sl-button  size="small"
                @click=${(e:any)=>{
                e.stopPropagation()
                this._store.weClient!.openWal(attachment)
                }}
                style="display:flex;flex-direction:row;margin-right:5px"><sl-icon src=${attachable!.assetInfo.icon_src} slot="prefix"></sl-icon>
                ${attachable!.assetInfo.name}
            </sl-button> 
            ${this.allowDelete ? html `
            <sl-button style="display:flex;align-items:center;" size="small" circle
                @click=${()=>{
                    this.removeAttachment(attachment)
                }}
            >
                <img  width=15 src=${`data:image/svg+xml;charset=utf-8,${SVG["trash"].replace("#","%23")}`} />
            </sl-button>
            `: html``}
            `
            ),
            html`Loading...`,
        )}
        </div>
      `;
    }
  
    render() {
      switch (this.attachments.value.status) {
        case "pending":
          return html`<div class="attachments-list" >
            ${Array(3).map(
              () => html`<div class="attachment"><sl-skeleton effect="pulse" class="attachment"></sl-skeleton></div>`
            )}
          </div>`;
        case "complete":
          if (this.attachments.value.value.length === 0)
            return html`
              <div
                class="attachments-list"
              >
                <span class="placeholder" style="margin: 24px;"
                  >${msg("No attachments yet")}</span
                >
              </div>
            `;
          return html`
            <div class="attachments-list">
              ${
                this.attachments.value.value
                .map((a) => this.renderAttachment(a))}
            </div>
          `;
        case "error":
          return html`<display-error
            .headline=${msg("Error fetching the attachments")}
            .error=${this.attachments.value.error}
          ></display-error>`;
      }
    }
  
    get styles() {return [
      sharedStyles,
      css`
        .attachments-list {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            padding: 10px;
            background-color: red;
        }
        .attachmentx {
            display: inline-block;
            align-items: center;
            cursor: pointer;
            border-radius: 5px;
            margin-right: 5px;
        }
        :host {
          display: flex;
        }
      `,
    ]}
  }
  