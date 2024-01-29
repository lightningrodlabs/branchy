import { css, html, LitElement } from "lit";
import { property, query, state } from "lit/decorators.js";
import { sharedStyles } from "../sharedStyles";
import { ScopedElementsMixin } from "@open-wc/scoped-elements";
import {
  Button,
  Dialog,
} from "@scoped-elements/material-web";

const DEFAULT_CONFIRM_MESSAGE = "Please confirm!"
/**
 * @element branchy-confirm-dialog
 */
export class BranchyConfirm extends ScopedElementsMixin(LitElement) {

  @property() 
  message: string = DEFAULT_CONFIRM_MESSAGE;
  @query('#confirm-dialog')
  _dialogElem!: Dialog;

  private userData: any = {}

  open(message: string, userData:any) {
    this.userData = userData
    if (message) {
      this.message = message
    } else {
      message = DEFAULT_CONFIRM_MESSAGE
    }
    this._dialogElem!.open = true
  }

  private async handleOk(e: any) {
    this.dispatchEvent(new CustomEvent('confirmed', { detail: this.userData, bubbles: true, composed: true }));
    this._dialogElem!.close()
  }
  render() {
    return html`
      <mwc-dialog id="confirm-dialog" heading="Confirm">

      <div class="message">${this.message}</div>
      <mwc-button
          id="primary-action-button"
          slot="primaryAction"
          @click=${this.handleOk}
          >ok</mwc-button
        >
        <mwc-button slot="secondaryAction" dialogAction="cancel"
          >cancel</mwc-button
        >
      </mwc-dialog>
    `;
  }

  static get scopedElements() {
    return {
      "mwc-button": Button,
      "mwc-dialog": Dialog,
    };
  }
  static get styles() {
    return [
      sharedStyles,
      css`
        :host {
          --mdc-dialog-max-width: 1000px;
        }
        .message {
          max-width: 300px;
        }
      `,
    ];
  }
}
