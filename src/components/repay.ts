import { LitElement, html, unsafeCSS } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { Ref, createRef, ref } from 'lit/directives/ref.js'
import baseStyle from '/src/base.css?inline'
import '@shoelace-style/shoelace/dist/components/button/button'
import '@shoelace-style/shoelace/dist/components/input/input'
import '@shoelace-style/shoelace/dist/components/dialog/dialog'
import { walletState } from '../lib/walletState'
import { SlDialog, SlInput } from '@shoelace-style/shoelace'
import { formatUnits } from '../lib/units'
import { toast, toastImportant } from '../lib/toast'

@customElement('repay-panel')
export class RepayPanel extends LitElement {
  static styles = [unsafeCSS(baseStyle)]
  @property() max = 0
  @state() input: Ref<SlInput> = createRef<SlInput>()
  @state() dialog: Ref<SlDialog> = createRef<SlDialog>()
  @state() inputValue = 0
  @state() repaying = false

  public show() {
    this.repaying = false
    this.dialog.value?.show()
  }

  private async doRepay() {
    this.repaying = true
    walletState
      .getDepositAddress()
      .then((addr) => {
        console.log(addr, this.input.value!.valueAsNumber * 1e8)
        return walletState.connector!.sendBitcoin(addr, this.input.value!.valueAsNumber * 1e8)
      })
      .then((tx) => {
        toastImportant(
          `Your transaction <a href="https://mempool.space/testnet/tx/${tx}">${tx}</a> has been sent to network.`
        )
        walletState.updateProtocolBalance()
        walletState.updateBalance()
        this.dialog.value?.hide()
      })
      .catch((e) => {
        console.warn(e)
        toast(e)
      })
      .finally(() => (this.repaying = false))
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
              this.input.value!.value = formatUnits(-this.max, 8)
              this.inputValue = this.input.value!.valueAsNumber
            }}
            pill
            >Max</sl-button
          >
        </div>
        <div class="flex text-xs items-center text-sl-neutral-600">Max to ${formatUnits(-this.max, 8)}</div>
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
      </sl-dialog>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'repay-panel': RepayPanel
  }
}
