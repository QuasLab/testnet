import { LitElement, html, unsafeCSS } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { Ref, createRef, ref } from 'lit/directives/ref.js'
import baseStyle from '/src/base.css?inline'
import style from './supplyTick.css?inline'
import '@shoelace-style/shoelace/dist/components/button/button'
import '@shoelace-style/shoelace/dist/components/input/input'
import '@shoelace-style/shoelace/dist/components/drawer/drawer'
import { walletState } from '../lib/walletState'
import { SlDrawer, SlInput } from '@shoelace-style/shoelace'
import { toast, toastImportant } from '../lib/toast'
import { formatUnits } from '../lib/units'
import { getJson } from '../../api_lib/fetch'

@customElement('supply-tick-panel')
export class SupplyTickPanel extends LitElement {
  static styles = [unsafeCSS(baseStyle), unsafeCSS(style)]
  @property() tick = ''
  @property() max = 0n
  @property() decimals = 0
  @state() drawer: Ref<SlDrawer> = createRef<SlDrawer>()
  @state() input: Ref<SlInput> = createRef<SlInput>()
  @state() inputValue = 0
  @state() adding = false

  get tickQ() {
    return this.tick?.replace(/.$/, 'Q')
  }

  public show() {
    return this.drawer.value?.show()
  }

  private async addSupply() {
    this.adding = true
    const amt = this.input.value?.valueAsNumber
    var { alert } = toastImportant(`Preparing inscribe transaction`)
    try {
      const [publicKey, address] = await Promise.all([walletState.getPublicKey(), walletState.getAddress()])
      const { data, address: inscribeAddress } = await fetch(
        `/api/brc20Op?op=transfer&amt=${amt}&tick=${this.tickQ}&pub=${publicKey}&address=${address}`
      ).then(getJson)

      if (!address) throw new Error('failed to get deposit address')
      if (!inscribeAddress) throw new Error('failed to get brc20 transfer inscription address')
      await alert.hide()

      alert = toastImportant(`Inscribing <span style="white-space:pre-wrap">${data}</span>`).alert
      const inscribeTx = await walletState.connector?.sendBitcoin(inscribeAddress, 699)
      await alert.hide()

      alert = toastImportant(`Preparing reveal transaction`).alert
      const res = await fetch(
        `/api/brc20Op?op=transfer&amt=${amt}&tick=${this.tickQ}&pub=${publicKey}&address=${address}&txid=${inscribeTx}`
      ).then(getJson)
      if (!res.psbt) {
        console.error('reveal tx not generated', res)
        throw new Error('reveal tx not generated')
      }
      await alert.hide()

      alert = toastImportant(`Revealing <span style="white-space:pre-wrap">${data}</span>`).alert
      const revealTx = await walletState.connector
        ?.signPsbt(res.psbt, {
          autoFinalized: true,
          toSignInputs: [{ index: 0, publicKey, disableTweakSigner: true }]
        })
        .then((hex) => walletState.connector?.pushPsbt(hex))
      await alert.hide()
      alert = toastImportant(
        `Transfer transactions sent to network.<br>
            Inscription: <a href="https://mempool.space/testnet/tx/${inscribeTx}">${inscribeTx}</a><br/>
            Reveal: <a href="https://mempool.space/testnet/tx/${revealTx}">${revealTx}</a><br/>
            Now supply to protocol`
      ).alert
      console.log(revealTx)
      const supplyTx = await walletState.connector?.sendInscription(
        await walletState.getDepositBrc20Address(),
        `${revealTx}i0`
      )
      await alert.hide()
      toastImportant(
        `Transfer transactions sent to network.<br>
            Inscription: <a href="https://mempool.space/testnet/tx/${inscribeTx}">${inscribeTx}</a><br/>
            Reveal: <a href="https://mempool.space/testnet/tx/${revealTx}">${revealTx}</a><br/>
            Supply: <a href="https://mempool.space/testnet/tx/${supplyTx}">${supplyTx}</a>`
      )
    } catch (e) {
      console.error(e)
      toast(e)
    }
    this.adding = false
    alert.hide()
  }

  render() {
    return html`
      <sl-drawer ${ref(this.drawer)} no-header contained style="--size: 256px">
        <span class="font-medium text-xs" style="color:var(--sl-color-green-500)">Supply ${this.tick}</span>
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
              this.input.value!.value = formatUnits(this.max, this.decimals)
              this.inputValue = this.input.value!.valueAsNumber
            }}
            pill
            >Max</sl-button
          >
        </div>
        <div class="flex text-xs items-center text-sl-neutral-600">
          <span class="brc20-icon" style="background-image:url(brc20-${this.tick}.png)"></span>${formatUnits(
            this.max,
            this.decimals
          )}
          Available
        </div>
        <div class="mt-4 space-y-2">
          <sl-button
            class="w-full"
            ?disabled=${this.inputValue <= 0}
            @click=${() => this.addSupply()}
            pill
            .loading=${this.adding}
            >Add</sl-button
          >
          <sl-button class="w-full" @click=${() => this.drawer.value?.hide()} pill>Cancel</sl-button>
        </div>
      </sl-drawer>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'supply-tick-panel': SupplyTickPanel
  }
}
