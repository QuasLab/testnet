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
import * as btc from '@scure/btc-signer'
import { hex, utf8 } from '@scure/base'
import { prepareRevealInscription } from '../lib/inscribe'

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
    const amt = this.input.value!.valueAsNumber
    var { alert } = toastImportant(`Preparing supply inscription`)
    try {
      const [pubKey, address, feeRates] = await Promise.all([
        walletState.getPublicKey(),
        walletState.getAddress(),
        fetch('https://mempool.space/testnet/api/v1/fees/recommended').then(getJson)
      ])

      if (!address) throw new Error('failed to get wallet address')

      const {
        inscription,
        customScripts,
        revealPayment,
        revealFee: fee
      } = prepareRevealInscription(this.tickQ, 'transfer', amt, address, pubKey, feeRates)
      await alert.hide()

      // real inscribe and reveal
      const value = 600n
      alert = toastImportant(
        `Inscribing <span style="white-space:pre-wrap">${utf8.encode(
          inscription.body
        )}</span>, value: ${value}, fee: ${fee}`
      ).alert
      const inscribeTx = await walletState.connector?.sendBitcoin(revealPayment.address!, Number(value + fee))
      await alert.hide()

      alert = toastImportant(`Waiting for inscription to be announced in mempool<sl-spinner></sl-spinner>`).alert
      while (true) {
        const res = await fetch(`https://mempool.space/testnet/api/tx/${inscribeTx}/status`)
        if (res.status == 200) {
          break
        }
        await new Promise((r) => setTimeout(r, 1000))
      }
      await alert.hide()

      alert = toastImportant(
        `Revealing <span style="white-space:pre-wrap">${utf8.encode(inscription.body)}</span>`
      ).alert
      const tx = new btc.Transaction({ customScripts })
      tx.addInput({
        ...revealPayment,
        txid: inscribeTx,
        index: 0,
        witnessUtxo: { script: revealPayment.script, amount: value + fee }
      })
      tx.addOutputAddress(address, BigInt(value), btc.TEST_NETWORK)
      const psbt = tx.toPSBT()
      const revealTx = await walletState.connector
        ?.signPsbt(hex.encode(psbt), {
          autoFinalized: true,
          toSignInputs: [{ index: 0, publicKey: pubKey, disableTweakSigner: true }]
        })
        .then((hex) => walletState.connector?.pushPsbt(hex))
      console.log(`sending inscription: ${revealTx}i0`)
      await alert.hide()
      alert = toastImportant(
        `Transfer transactions sent to network.<br>
            Inscription: <a href="https://mempool.space/testnet/tx/${inscribeTx}">${inscribeTx}</a><br/>
            Reveal: <a href="https://mempool.space/testnet/tx/${revealTx}">${revealTx}</a><br/>
            Now wait for inscription in wallet<sl-spinner></sl-spinner>`
      ).alert
      loop1: while (true) {
        const inscriptions = await walletState.connector?.getInscriptions()
        console.log(inscriptions)
        if (inscriptions?.total) {
          for (const inscription of inscriptions.list) {
            if (inscription.genesisTransaction == revealTx) break loop1
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
      await new Promise((resolve) => setTimeout(resolve, 500))
      await alert.hide()
      alert = toastImportant(
        `Transfer transactions sent to network.<br>
            Inscription: <a href="https://mempool.space/testnet/tx/${inscribeTx}">${inscribeTx}</a><br/>
            Reveal: <a href="https://mempool.space/testnet/tx/${revealTx}">${revealTx}</a><br/>
            Now supply to protocol`
      ).alert
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
