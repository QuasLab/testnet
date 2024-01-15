import { LitElement, html, unsafeCSS } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { Ref, createRef, ref } from 'lit/directives/ref.js'
import { when } from 'lit/directives/when.js'
import { until } from 'lit/directives/until.js'
import baseStyle from '/src/base.css?inline'
import '@shoelace-style/shoelace/dist/components/button/button'
import '@shoelace-style/shoelace/dist/components/input/input'
import '@shoelace-style/shoelace/dist/components/dialog/dialog'
import '@shoelace-style/shoelace/dist/components/spinner/spinner'
import { SlDialog, SlInput } from '@shoelace-style/shoelace'
import { toast, toastImportant } from '../lib/toast'
import { getJson } from '../../api_lib/fetch'
import { Unsubscribe, walletState } from '../lib/walletState'
import { formatUnits } from '../lib/units'

@customElement('borrow-panel')
export class BorrowPanel extends LitElement {
  static styles = [unsafeCSS(baseStyle)]
  @property() tick = ''
  @property() max = 0
  @state() input: Ref<SlInput> = createRef<SlInput>()
  @state() dialog: Ref<SlDialog> = createRef<SlDialog>()
  @state() inputValue = 0
  @state() balance = 0
  @state() borrowing = false
  @state() sig1 = false
  @state() sig2 = false
  @state() sig3 = false
  @state() message = ''
  @state() maxInProtocol: any

  public show() {
    this.dialog.value?.show()
    this.maxInProtocol = fetch(`/api/protocolBalance`)
      .then(getJson)
      .then((balance) => formatUnits(balance.total, 8))
  }

  private stateUnsubscribes: Unsubscribe[] = []

  connectedCallback(): void {
    super.connectedCallback()
    this.balance = walletState.protocolBalance?.total ?? 0
    this.stateUnsubscribes.push(
      walletState.subscribe((k, v) => {
        switch (k) {
          case '_protocolBalance':
            this.balance = v?.total ?? 0
            break
        }
      })
    )
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    this.stateUnsubscribes.forEach((f) => f())
    this.stateUnsubscribes = []
  }

  private async doBorrow() {
    this.sig1 = false
    this.sig2 = false
    this.sig3 = false
    this.borrowing = true
    this.message = 'Waiting for MPC signatures'

    fetch(`/api/borrow?address=${walletState.address}&amt=${this.input.value?.valueAsNumber}`)
      .then(getJson)
      .then(({ tx }) => {
        Promise.all([
          new Promise((r) => setTimeout(r, 500 + Math.random() * 2000)).then(() => (this.sig1 = true)),
          new Promise((r) => setTimeout(r, 1000 + Math.random() * 2000)).then(() => (this.sig2 = true))
        ]).then(() => tx)
      })
      .then((tx) => {
        toastImportant(`Borrow transaction <a href="https://mempool.space/testnet/tx/${tx}">${tx}</a> sent to network.`)
        walletState.updateProtocolBalance()
      })
      .catch((e) => {
        toast(e)
        this.borrowing = false
      })
      .finally(() => (this.borrowing = false))
  }

  render() {
    return html`
      <sl-dialog ${ref(this.dialog)}>
        <span slot="label" style="color:var(--sl-color-primary-500)">Borrow</span>
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
              this.input.value!.value = (this.max + this.balance / 1e8).toString()
              this.inputValue = this.input.value!.valueAsNumber
            }}
            pill
            >Max</sl-button
          >
        </div>
        <div class="flex text-xs items-center text-sl-neutral-600">
          Your borrow capacity is ${this.max + this.balance / 1e8}. Protocol now has
          ${until(this.maxInProtocol, html`<sl-spinner class="mx-1"></sl-spinner>`)} for borrowing.
        </div>
        <div class="mt-4 space-y-2">
          <sl-button
            class="w-full"
            ?disabled=${this.inputValue <= 0}
            @click=${() => this.doBorrow()}
            pill
            .loading=${this.borrowing}
            >Borrow</sl-button
          >
          <sl-button class="w-full" @click=${() => this.dialog.value?.hide()} pill>Cancel</sl-button>
        </div>
        ${when(
          this.borrowing,
          () =>
            html`<div class="mt-2">${this.message}</div>
              ${when(
                this.sig1,
                () => html`<sl-icon name="check2-circle"></sl-icon>`,
                () => html`<sl-spinner></sl-spinner>`
              )}
              ${when(
                this.sig2,
                () => html`<sl-icon name="check2-circle"></sl-icon>`,
                () => html`<sl-spinner></sl-spinner>`
              )}
              ${when(
                this.sig3,
                () => html`<sl-icon name="check2-circle"></sl-icon>`,
                () => html`<sl-spinner></sl-spinner>`
              )}`
        )}
      </sl-dialog>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'borrow-panel': BorrowPanel
  }
}
