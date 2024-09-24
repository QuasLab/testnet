import { LitElement, html, unsafeCSS } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import baseStyle from '/src/base.css?inline'
import style from './price.css?inline'
import '@shoelace-style/shoelace/dist/components/button/button'
import '@shoelace-style/shoelace/dist/components/input/input'
import '@shoelace-style/shoelace/dist/components/drawer/drawer'
import { StateController, Unsubscribe, walletState } from '../lib/walletState'
import { priceState } from '../lib/priceState'

import '@shoelace-style/shoelace/dist/components/dialog/dialog'
import SlDialog from '@shoelace-style/shoelace/dist/components/dialog/dialog'
import { Ref, createRef, ref } from 'lit/directives/ref.js'
@customElement('price-panel')
export class PricePanel extends LitElement {
  static styles = [unsafeCSS(baseStyle), unsafeCSS(style)]
  @state() dialog: Ref<SlDialog> = createRef<SlDialog>()

  private stateUnsubscribes: Unsubscribe[] = []

  public show() {
    this.dialog.value?.show()
  }

  connectedCallback(): void {
    super.connectedCallback()
    //open websocket and subscribe data
    this.stateUnsubscribes.push(
      priceState.subscribe((k, v) => {
        switch (k) {
          case 'prices':
            console.log('price event-->', v)
            break
        }
      })
    )
    priceState.subscribeAll()
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    this.stateUnsubscribes.forEach((f) => f())
    this.stateUnsubscribes = []
  }

  get btcPrice() {
    return priceState.getTickPrice('btc')
  }

  get ordiPrice() {
    return priceState.getTickPrice('ordi')
  }

  get satsPrice() {
    return priceState.getTickPrice('1000sats')
  }

  get btcPriceBinance() {
    return priceState.getPlatformTickPrice('binance', 'btc')
  }

  get btcPriceOkcoin() {
    return priceState.getPlatformTickPrice('okcoin', 'btc')
  }

  get balance() {
    return walletState.balance?.total ?? 0
  }

  constructor() {
    super()
    new StateController(this, walletState)
  }

  render() {
    return html`<sl-dialog ${ref(this.dialog)} label="Prices" class="dialog-header-actions">
      <table class="border-collapse w-full text-sm table-fixed">
        <tbody>
          <tr>
            <td>
              <div class="relative panel !rounded-none text-center">
                <sl-tooltip content="BTC" placement="right-start">
                  <sl-icon class="text-6xl" outline name="currency-bitcoin"></sl-icon>
                </sl-tooltip>
              </div>
            </td>
            <td>
              <div class="relative panel !rounded-none text-center">
                <sl-tooltip content="BRC20 ORDI" placement="right-start">
                  <span class="brc20-icon" style="background-image:url(brc20-ordi.png)"></span>
                </sl-tooltip>
              </div>
            </td>
            <td>
              <div class="relative panel !rounded-none text-center">
                <sl-tooltip content="BRC20 SATS" placement="right-start">
                  <span class="brc20-icon" style="background-image:url(brc20-sats.png)"></span>
                </sl-tooltip>
              </div>
            </td>
          </tr>
          <tr>
            <td class="p-4 pl-2">
              <div class="relative panel !rounded-none text-3xl text-center">$${Number(this.btcPrice).toFixed(2)}</div>
            </td>
            <td class="p-4 pl-2">
              <div class="relative panel !rounded-none text-3xl text-center">$${Number(this.ordiPrice).toFixed(2)}</div>
            </td>
            <td class="p-4 pl-2">
              <div class="relative panel !rounded-none text-3xl text-center">$${Number(this.satsPrice).toFixed(6)}</div>
            </td>
          </tr>
          <tr>
            <td>
              <div class="relative panel !rounded-none text-2xl text-center">
                <sl-tooltip content="binance ${this.btcPriceBinance}">
                  <span class="brc20-icon-medium" style="background-image:url(binance.icon.png)"></span>
                </sl-tooltip>
                <sl-tooltip content="okx ${this.btcPriceOkcoin}">
                  <span class="brc20-icon-medium" style="background-image:url(okx.svg)"></span>
                </sl-tooltip>
              </div>
            </td>
            <td>
              <div class="relative panel !rounded-none text-2xl text-center">
                <sl-tooltip content="binance">
                  <span class="brc20-icon-medium" style="background-image:url(binance.icon.png)"></span>
                </sl-tooltip>
              </div>
            </td>
            <td>
              <div class="relative panel !rounded-none text-2xl text-center">
                <sl-tooltip content="binance">
                  <span class="brc20-icon-medium" style="background-image:url(binance.icon.png)"></span>
                </sl-tooltip>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </sl-dialog>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'price-panel': PricePanel
  }
}
