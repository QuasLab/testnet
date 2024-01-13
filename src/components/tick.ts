import { LitElement, html, unsafeCSS } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import baseStyle from '/src/base.css?inline'
import style from './tick.css?inline'
import '@shoelace-style/shoelace/dist/components/button/button'
import '@shoelace-style/shoelace/dist/components/icon/icon'
import { Unsubscribe, walletState } from '../lib/walletState'
import './supplyTick'
import { formatUnitsComma, parseUnits } from '../lib/units'
import { toast } from '../lib/toast'
import { Brc20Balance } from '../lib/wallets'
import { getJson } from '../../api_lib/fetch'

@customElement('tick-row')
export class TickRow extends LitElement {
  static styles = [unsafeCSS(baseStyle), unsafeCSS(style)]
  @property() tick?: string
  @state() balance?: Brc20Balance
  @state() price?: string
  @state() minting = false

  get tickQ() {
    return this.tick?.replace(/.$/, 'Q')
  }

  private priceUpdater?: Promise<any>
  private balanceUpdater?: Promise<any>
  private stateUnsubscribe?: Unsubscribe

  connectedCallback(): void {
    super.connectedCallback()
    this.priceUpdater ??= this.updateBrc20Price()
    this.balanceUpdater ??= this.updateBrc20Balance()
    this.stateUnsubscribe ??= walletState.subscribe(() => {
      walletState.getBrc20Balance().then((balances) => (this.balance = balances.find((b) => b.tick == this.tickQ)))
    })
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    this.priceUpdater = undefined
    this.balanceUpdater = undefined
    this.stateUnsubscribe?.()
    this.stateUnsubscribe = undefined
  }

  async updateBrc20Price() {
    while (true) {
      try {
        this.price = await fetch(`/api/collections?slug=${this.tick}`)
          .then(getJson)
          .then((res) => res?.data?.data?.[0]?.floorPrice)
          .catch((e) => console.log(`failed to fetch price for ${this.tick}, error:`, e))
      } catch (e) {}
      await new Promise((r) => setTimeout(r, 60000))
    }
  }

  async updateBrc20Balance() {
    while (true) {
      try {
        this.balance = (await walletState.updateBrc20Balance()).find((b) => b.tick == this.tickQ)
      } catch (e) {}
      await new Promise((r) => setTimeout(r, 60000))
    }
  }

  mint() {
    const tick = this.tickQ!
    this.minting = true
    var { alert } = toast(`Preparing inscribe transaction`, {
      variant: 'primary',
      duration: Infinity
    })
    Promise.all([walletState.connector!.publicKey, walletState.connector?.accounts])
      .then(async ([publicKey, accounts]) => {
        const insRes = await fetch(
          `/api/brc20Op?op=mint&amt=1000&tick=${tick}&pub=${publicKey}&address=${accounts?.[0]}`
        ).then(getJson)
        const { address, data } = insRes
        if (!address || !data) {
          console.debug('get inscription tx returns:', insRes)
          throw new Error(`failed to get brc20 mint inscription address, server returns ${JSON.stringify(insRes)}`)
        }
        await alert.hide()
        alert = toast(`Inscribing <span style="white-space:pre">${data}</span>`, {
          variant: 'primary',
          duration: Infinity
        }).alert
        const txid = await walletState.connector?.sendBitcoin(address, 699)
        await alert.hide()
        alert = toast(`Preparing reveal transaction`, {
          variant: 'primary',
          duration: Infinity
        }).alert
        const res = await fetch(
          `/api/brc20Op?op=mint&amt=1000&tick=${tick}&pub=${publicKey}&address=${accounts?.[0]}&txid=${txid}`
        ).then(getJson)
        if (!res.psbt) {
          console.error('reveal tx not generated', res)
          throw new Error('reveal tx not generated')
        }
        await alert.hide()
        alert = toast(`Revealing <span style="white-space:pre">${data}</span>`, {
          variant: 'primary',
          duration: Infinity
        }).alert
        await walletState.connector
          ?.signPsbt(res.psbt, {
            autoFinalized: true,
            toSignInputs: [{ index: 0, publicKey, disableTweakSigner: true }]
          })
          .then((hex) => walletState.connector?.pushPsbt(hex))
          .then((id) => {
            toast(
              `Mint transactions sent to network.<br>
              Inscription: <a href="https://mempool.space/testnet/tx/${txid}">${txid}</a><br/>
              Reveal: <a href="https://mempool.space/testnet/tx/${id}">${id}</a>`,
              { duration: Infinity, closable: true, variant: 'primary' }
            )
            console.log(id)
          })
      })
      .catch((e) => {
        console.error(e)
        toast(e)
      })
      .finally(() => {
        this.minting = false
        alert.hide()
      })
  }

  render() {
    return html`
      <span class="brc20-icon" style="background-image:url(brc20-${this.tick}.png)"></span>
      <div class="ml-3 flex-auto">
        <p class="text-sm">
          <a href="https://testnet.unisat.io/brc20/${this.tickQ}" class="font-medium">${this.tick}</a>
          <span class="text-xs text-sl-neutral-600">
            Price: ${this.price ? formatUnitsComma(parseUnits(this.price ?? '0', 18), 10) : '-'} sats
          </span>
        </p>
        <p class="text-xs text-sl-neutral-600">
          ${this.balance ? formatUnitsComma(this.balance.availableBalance ?? '0', 18) : '-'} in wallet
        </p>
      </div>
      <div class="space-x-2 flex-none">
        <sl-tooltip content="Mint" class="flex-auto">
          <sl-button variant="text" circle ?loading=${this.minting} @click=${() => this.mint()}>
            <sl-icon name="lightning-charge" class="text-xl"></sl-icon>
          </sl-button>
        </sl-tooltip>
        <sl-button
          variant="default"
          circle
          ?disabled=${!this.balance?.availableBalance}
          @click=${() => this.dispatchEvent(new Event('supply'))}
        >
          <sl-icon name="plus"></sl-icon>
        </sl-button>
        <sl-button
          variant="default"
          circle
          ?disabled=${walletState.collateralBalance <= 0}
          @click=${() => this.dispatchEvent(new Event('withdraw'))}
        >
          <sl-icon name="dash"></sl-icon>
        </sl-button>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tick-row': TickRow
  }
}
