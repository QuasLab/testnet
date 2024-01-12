import { LitElement, html, unsafeCSS } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import baseStyle from '/src/base.css?inline'
import style from './tick.css?inline'
import '@shoelace-style/shoelace/dist/components/button/button'
import '@shoelace-style/shoelace/dist/components/icon/icon'
import { walletState } from '../lib/walletState'
import './supplyTick'
import { formatUnitsComma, parseUnits } from '../lib/units'
import { toast } from '../lib/toast'

@customElement('tick-row')
export class TickRow extends LitElement {
  static styles = [unsafeCSS(baseStyle), unsafeCSS(style)]
  @property() tick?: string
  @state() balance?: string
  @state() price?: string
  @state() minting = false
  private priceUpdater?: Promise<any>
  private balanceUpdater?: Promise<any>

  get tickQ() {
    return this.tick?.replace(/.$/, 'Q')
  }

  connectedCallback(): void {
    super.connectedCallback()
    this.priceUpdater ??= this.updateBrc20Price()
    this.balanceUpdater ??= this.updateBrc20Balance()
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    this.priceUpdater = undefined
    this.balanceUpdater = undefined
  }

  async updateBrc20Price() {
    while (true) {
      this.price = await fetch(`/api/collections?slug=${this.tick}`)
        .then((res) => res.json())
        .then((res) => res?.data?.data?.[0]?.floorPrice)
        .catch((e) => console.log(`failed to fetch price for ${this.tick}, error:`, e))
      await new Promise((r) => setTimeout(r, 5000))
    }
  }

  async updateBrc20Balance() {
    while (true) {
      if (walletState.address) {
        this.balance = await fetch(
          `${import.meta.env.VITE_ORD_BASE_URL}/api/v1/brc20/tick/${this.tickQ}/address/${walletState.address}/balance`
        )
          .then((res) => res.json())
          .then((res) => res?.data?.availableBalance)
          .catch((e) => console.log(`failed to fetch balance for ${this.tickQ} of ${walletState.address}, error:`, e))
      }
      await new Promise((r) => setTimeout(r, 5000))
    }
  }

  mint() {
    const tick = this.tickQ!
    this.minting = true
    Promise.all([walletState.connector!.publicKey, walletState.connector?.accounts])
      .then(async ([publicKey, accounts]) => {
        var res = await fetch(`/api/mintBrc20?tick=${tick}&pub=${publicKey}&address=${accounts?.[0]}`).then((res) => {
          if (res.status != 200)
            return res.json().then((json) => {
              throw new Error(json.message)
            })
          return res.json()
        })
        if (!res.address) {
          console.warn('mint address not returned', res)
          return
        }
        const txid = await walletState.connector?.sendBitcoin(res.address, 1000)
        var res = await fetch(
          `/api/mintBrc20?tick=${tick}&pub=${publicKey}&address=${accounts?.[0]}&txid=${txid}`
        ).then((res) => {
          if (res.status != 200)
            return res.json().then((json) => {
              throw new Error(json.message)
            })
          return res.json()
        })
        if (!res.psbt) {
          console.warn('reveal tx not generated', res)
          return
        }
        await walletState.connector
          ?.signPsbt(res.psbt, {
            autoFinalized: true,
            toSignInputs: [{ index: 0, publicKey, disableTweakSigner: true }]
          })
          .then(
            (hex) =>
              walletState.connector?.pushPsbt(hex).then((id) => {
                toast(
                  `Mint transactions sent to network.<br>
                  Mint: <a href="https://mempool.space/testnet/tx/${txid}">${txid}</a><br/>
                  Reveal: <a href="https://mempool.space/testnet/tx/${id}">${id}</a>`
                )
                console.log(id)
              })
          )
      })
      .catch((e) => {
        toast(e)
      })
      .finally(() => (this.minting = false))
  }

  render() {
    return html`
      <span class="brc20-icon" style="background-image:url(brc20-${this.tick}.png)"></span>
      <div class="ml-3 flex-auto">
        <p class="text-sm">
          <a href="https://testnet.unisat.io/brc20/${this.tickQ}" target="_blank" class="font-medium">${this.tick}</a>
          <span class="text-xs text-sl-neutral-600">
            Price: ${this.price ? formatUnitsComma(parseUnits(this.price ?? '0', 18), 10) : '-'} sats
          </span>
        </p>
        <p class="text-xs text-sl-neutral-600">
          ${this.balance ? formatUnitsComma(this.balance ?? '0', 18) : '-'} in wallet
        </p>
      </div>
      <div class="space-x-2">
        <sl-tooltip content="Mint" class="flex-auto">
          <sl-button variant="text" circle ?loading=${this.minting} @click=${() => this.mint()}>
            <sl-icon name="lightning-charge" class="text-xl"></sl-icon>
          </sl-button>
        </sl-tooltip>
        <sl-button
          variant="default"
          circle
          ?disabled=${!this.balance}
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
