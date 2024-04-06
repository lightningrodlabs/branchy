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
  import { WAL, weaveUrlFromWal } from "@lightningrodlabs/we-applet";
  import { decodeHashFromBase64, EntryHashB64 } from "@holochain/client";
  import "@shoelace-style/shoelace/dist/components/button/button.js";
  import "@shoelace-style/shoelace/dist/components/skeleton/skeleton.js";
  import {until} from 'lit-html/directives/until.js';
  import { SVG } from "./svg-icons";
  import '@lightningrodlabs/we-elements/dist/elements/wal-embed.js';

  @customElement("embeds-pane")
  export class EmbedsPane extends LitElement {
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
        <div class="embed">
        ${until(this._store.weClient!.assetInfo(attachment).then(attachable => 
            !attachable ? html`(?)` :
            html`
            <wal-embed
                @click=${(e:any)=>{
                  console.log(e)
                  e.stopPropagation()
                }}
                style="margin-top: 20px;"
                .src=${weaveUrlFromWal(attachment)}
                  >
              </wal-embed>
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
          return html`<div class="embeds-pane" >
            ${Array(3).map(
              () => html`<div class="attachment"><sl-skeleton effect="pulse" class="attachment"></sl-skeleton></div>`
            )}
          </div>`;
        case "complete":
          if (this.attachments.value.value.length === 0)
            return html`
            `;
          return html`
            <div class="embeds-pane">
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
        .embeds-pane {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            padding: 10px;
        }
        .embed {
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
    ]}
  }
  