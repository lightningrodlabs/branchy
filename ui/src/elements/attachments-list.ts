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
  import { HrlWithContext } from "@lightningrodlabs/we-applet";
  import { decodeHashFromBase64, EntryHashB64 } from "@holochain/client";
  import "@shoelace-style/shoelace/dist/components/button/button.js";
  import "@shoelace-style/shoelace/dist/components/skeleton/skeleton.js";
  import {until} from 'lit-html/directives/until.js';
import { SVG } from "./svg-icons";
  
  @localized()
  @customElement("attachments-list")
  export class AttachmentsList extends LitElement {
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

    async removeAttachment(attachment: HrlWithContext) {
        await this._store.removeAttachment(this.unitHash, attachment)
        this.dispatchEvent(new CustomEvent('attachment-removed', { detail: attachment, bubbles: true, composed: true }));
    }
  
    renderAttachment(attachment: HrlWithContext) {
      return html`
        <div class="attachment">
        ${until(this._store.weClient!.attachableInfo(attachment).then(attachable => 
            !attachable ? html`(?)` :
            html`
            <sl-button  size="small"
                @click=${(e:any)=>{
                e.stopPropagation()
                this._store.weClient!.openHrl(attachment)
                }}
                style="display:flex;flex-direction:row;margin-right:5px"><sl-icon src=${attachable!.attachableInfo.icon_src} slot="prefix"></sl-icon>
                ${attachable!.attachableInfo.name}
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
  
    static styles = [
      sharedStyles,
      css`
        .attachments-list {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            padding: 10px;
        }
        .attachment {
            display: flex;
            align-items: center;
            cursor: pointer;
            border-radius: 5px;
            margin-right: 5px;
        }
        :host {
          display: flex;
        }
      `,
    ];
  }
  