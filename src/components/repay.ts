import { LitElement, html, unsafeCSS } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { Ref, createRef, ref } from 'lit/directives/ref.js'
import { when } from 'lit/directives/when.js'
import baseStyle from '/src/base.css?inline'
import '@shoelace-style/shoelace/dist/components/alert/alert'
import '@shoelace-style/shoelace/dist/components/button/button'
import '@shoelace-style/shoelace/dist/components/input/input'
import '@shoelace-style/shoelace/dist/components/dialog/dialog'
import { StateController, walletState } from '../lib/walletState'
import { SlAlert, SlDialog, SlInput } from '@shoelace-style/shoelace'

@customElement('repay-panel')
export class RepayPanel extends LitElement {
  static styles = [unsafeCSS(baseStyle)]
  @property() tick = ''
  @state() input: Ref<SlInput> = createRef<SlInput>()
  @state() alert: Ref<SlAlert> = createRef<SlAlert>()
  @state() dialog: Ref<SlDialog> = createRef<SlDialog>()
  @state() inputValue = 0
  @state() repaying = false
  @state() sig1 = false
  @state() sig2 = false
  @state() sig3 = false
  @state() alertMessage: any

  get walletBalance() {
    return walletState.balance?.confirmed ?? 0
  }

  constructor() {
    super()
    new StateController(this, walletState)
  }

  public show() {
    this.repaying = false
    this.sig1 = false
    this.sig2 = false
    this.sig3 = false
    this.dialog.value?.show()
  }

  private async doRepay() {
    this.repaying = true
    try {
      await Promise.all([
        new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 1200)).then(() => (this.sig1 = true)),
        new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 1200)).then(() => (this.sig2 = true)),
        new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 1200)).then(() => (this.sig3 = true))
      ])
      walletState._borrowedBalance =
        walletState._borrowedBalance > this.input.value!.valueAsNumber
          ? walletState._borrowedBalance - this.input.value!.valueAsNumber
          : 0
    } catch (e) {
      console.warn(e)
      this.alertMessage = e
      this.alert.value?.toast()
    }
    this.repaying = false
  }

  render() {
    return html`
      <sl-dialog ${ref(this.dialog)}>
        <span slot="label" style="color:var(--sl-color-primary-500)">Repay</span>
        <div class="flex items-center">
          <sl-input
            ${ref(this.input)}
            class="flex-auto mr-2"
            placeholder="0"
            filled
            type="number"
            @sl-input=${() => (this.inputValue = this.input.value!.valueAsNumber)}
          ></sl-input>
          <sl-button
            size="small"
            @click=${() => {
              this.inputValue = walletState._collateralBalance
              this.input.value!.value = this.inputValue.toString()
            }}
            pill
            >Max</sl-button
          >
        </div>
        <div class="flex text-xs items-center text-sl-neutral-600">
          <span class="brc20-icon" style="background-image:url(brc20-${this.tick}.png)"></span>Max to
          ${walletState._collateralBalance}
        </div>
        <div class="mt-4 space-y-2">
          <sl-button
            class="w-full"
            ?disabled=${this.inputValue <= 0}
            @click=${() => this.doRepay()}
            pill
            .loading=${this.repaying}
            >Repay</sl-button
          >
          <sl-button class="w-full" @click=${() => this.dialog.value?.hide()} pill>Cancel</sl-button>
        </div>
        ${when(this.repaying, () => html`<div class="mt-2">Waiting for MPC signatures</div>`)}
        ${when(this.repaying || this.sig1, () =>
          when(
            this.sig1,
            () => html`<sl-icon name="check2-circle"></sl-icon>`,
            () => html`<sl-spinner></sl-spinner>`
          )
        )}
        ${when(this.repaying || this.sig2, () =>
          when(
            this.sig2,
            () => html`<sl-icon name="check2-circle"></sl-icon>`,
            () => html`<sl-spinner></sl-spinner>`
          )
        )}
        ${when(this.repaying || this.sig3, () =>
          when(
            this.sig3,
            () => html`<sl-icon name="check2-circle"></sl-icon>`,
            () => html`<sl-spinner></sl-spinner>`
          )
        )}
      </sl-dialog>

      <sl-alert
        variant=${this.alertMessage instanceof Error ? 'danger' : 'warning'}
        duration="3000"
        closable
        ${ref(this.alert)}
      >
        <sl-icon
          slot="icon"
          name=${this.alertMessage instanceof Error ? 'exclamation-octagon' : 'info-circle'}
        ></sl-icon>
        ${this.alertMessage?.message ?? this.alertMessage}
      </sl-alert>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'repay-panel': RepayPanel
  }
}
