import { LitElement, html, unsafeCSS } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { Ref, createRef, ref } from 'lit/directives/ref.js'
import { unsafeHTML } from 'lit/directives/unsafe-html.js'
import baseStyle from '/src/base.css?inline'
import style from './supply.css?inline'
import '@shoelace-style/shoelace/dist/components/alert/alert'
import '@shoelace-style/shoelace/dist/components/button/button'
import '@shoelace-style/shoelace/dist/components/input/input'
import '@shoelace-style/shoelace/dist/components/drawer/drawer'
import { StateController, walletState } from '../lib/walletState'
import { SlAlert, SlDrawer, SlInput } from '@shoelace-style/shoelace'
import { sha256 } from '@noble/hashes/sha256'

@customElement('supply-panel')
export class SupplyPanel extends LitElement {
  static styles = [unsafeCSS(baseStyle), unsafeCSS(style)]
  @property() coin = 'Bitcoin'
  @state() drawer: Ref<SlDrawer> = createRef<SlDrawer>()
  @state() input: Ref<SlInput> = createRef<SlInput>()
  @state() alert: Ref<SlAlert> = createRef<SlAlert>()
  @state() inputValue = 0
  @state() adding = false
  @state() alertMessage: any

  get walletBalance() {
    return walletState.balance?.confirmed ?? 0
  }

  constructor() {
    super()
    new StateController(this, walletState)
  }

  public show() {
    return this.drawer.value?.show()
  }

  private async addSupply() {
    this.adding = true
    try {
      const addr = await fetch(`/api/depositAddress?pub=${await walletState.connector.publicKey}`)
        .then((res) => {
          if (res.status != 200)
            return res.json().then((json) => {
              throw new Error(json.message)
            })
          return res.json()
        })
        .then((js) => js.address)
      console.log(addr, this.input.value!.valueAsNumber * 1e8)
      //   const tx = await walletState.connector.sendBitcoin(addr, this.input.value!.valueAsNumber * 1e8)
      const tx = sha256(addr)
      this.alertMessage = unsafeHTML(
        `Your transaction <a href="https://mempool.space/testnet/tx/${tx}">${tx}</a> is sent.(FAKE)`
      )
      this.alert.value?.toast()
    } catch (e) {
      console.warn(e)
      this.alertMessage = e
      this.alert.value?.toast()
    }
    this.adding = false
  }

  render() {
    return html`
      <sl-drawer
        ${ref(this.drawer)}
        placement="bottom"
        no-header
        ?contained=${globalThis.matchMedia('(min-width:640px').matches}
        class="drawer-placement-bottom sm:drawer-contained"
      >
        <span class="font-medium text-xs" style="color:var(--sl-color-green-500)">Supply ${this.coin}</span>
        <div class="flex items-center mt-5">
          <sl-input
            ${ref(this.input)}
            class="flex-auto mr-2"
            size="large"
            placeholder="0"
            filled
            type="number"
            @sl-input=${() => (this.inputValue = this.input.value!.valueAsNumber)}
          ></sl-input>
          <sl-button
            size="small"
            @click=${() => {
              this.inputValue = this.walletBalance / 1e8
              this.input.value!.value = this.inputValue.toString()
            }}
            pill
            >Max</sl-button
          >
        </div>
        <div class="flex text-xs items-center text-sl-neutral-600">
          <sl-icon outline name="currency-bitcoin"></sl-icon>${Math.floor(this.walletBalance / 1e8)}.${Math.floor(
            (this.walletBalance % 1e8) / 1e4
          )
            .toString()
            .padStart(4, '0')}
          Available
        </div>
        <div class="mt-4 flex space-x-4">
          <sl-button class="w-full" @click=${() => this.drawer.value?.hide()} pill>Cancel</sl-button>
          <sl-button
            class="w-full"
            ?disabled=${this.inputValue <= 0}
            @click=${() => this.addSupply()}
            pill
            .loading=${this.adding}
            >Add</sl-button
          >
        </div>
      </sl-drawer>

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
    'supply-panel': SupplyPanel
  }
}
