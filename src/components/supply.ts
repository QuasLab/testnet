import { LitElement, html, unsafeCSS } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { Ref, createRef, ref } from 'lit/directives/ref.js'
import baseStyle from '/src/base.css?inline'
import style from './supply.css?inline'
import '@shoelace-style/shoelace/dist/components/button/button'
import '@shoelace-style/shoelace/dist/components/input/input'
import '@shoelace-style/shoelace/dist/components/drawer/drawer'
import SlDrawer from '@shoelace-style/shoelace/dist/components/drawer/drawer'
import { walletState } from '../state/wallet'
import SlInput from '@shoelace-style/shoelace/dist/components/input/input'

@customElement('supply-panel')
export class SupplyPanel extends LitElement {
  static styles = [unsafeCSS(baseStyle), unsafeCSS(style)]
  @property() coin = 'Bitcoin'
  @state() drawer: Ref<SlDrawer> = createRef<SlDrawer>()
  @state() input: Ref<SlInput> = createRef<SlInput>()
  @state() walletBalance = 0
  @state() inputValue = 0

  connectedCallback(): void {
    super.connectedCallback()

    walletState.subscribe(() => {
      walletState.balance.then((res) => {
        this.walletBalance = res.confirmed
      })
    }, 'address')
  }

  public show() {
    return this.drawer.value?.show()
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
          <sl-button class="w-full" ?disabled=${this.inputValue <= 0} pill>Add</sl-button>
        </div>
      </sl-drawer>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'supply-panel': SupplyPanel
  }
}
