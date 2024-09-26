import { SlInput } from '@shoelace-style/shoelace'
import '@shoelace-style/shoelace/dist/components/dialog/dialog'
import SlDialog from '@shoelace-style/shoelace/dist/components/dialog/dialog'
import { html, LitElement, unsafeCSS } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { createRef, Ref, ref } from 'lit/directives/ref.js'
import { when } from 'lit/directives/when.js'
import { getJson } from '../../api_lib/fetch'
import { priceState } from '../lib/priceState'
import { toastImportant } from '../lib/toast'
import { Unsubscribe, walletState } from '../lib/walletState'
import style from './liquadation.css?inline'
import baseStyle from '/src/base.css?inline'

@customElement('liquadation-panel')
export class LiquadationPanel extends LitElement {
  static styles = [unsafeCSS(baseStyle), unsafeCSS(style)]
  private stateUnsubscribes: Unsubscribe[] = []
  @state() inputKey: Ref<SlInput> = createRef<SlInput>()
  @state() inputSecret: Ref<SlInput> = createRef<SlInput>()
  @state() dialog: Ref<SlDialog> = createRef<SlDialog>()
  @state() address?: string
  @state() walletBalance = 0
  @state() items: any = []
  @state() headers: string[] = ['Asset', 'Amount', 'Price', 'Asset Value', 'Liquadition Factor', 'Operation']
  @state() key?: string
  @state() secret?: string

  connectedCallback(): void {
    super.connectedCallback()

    this.stateUnsubscribes.push(
      walletState.subscribe((k, v) => {
        switch (k) {
          case '_balance':
            this.walletBalance = v?.total ?? 0
            break
          case '_address':
            if (v) {
              walletState.updateProtocolBalance()
              walletState.updateCollateralBalance()
            }
            break
        }
      })
    )
    this.stateUnsubscribes.push(
      priceState.subscribe((k) => {
        switch (k) {
          case 'prices':
            this.requestUpdate()
            break
        }
      })
    )
    const priceBtc = priceState.getTickPrice('btc')
    const priceOrdi = priceState.getTickPrice('ordi')
    const priceSats = priceState.getTickPrice('1000sats')
    this.items.push({
      id: 1,
      price: priceBtc,
      coin: 'BTC',
      amount: '0.02',
      factor: '70%',
      symbol: 'BTCUSDT',
      status: 'open',
      asset_value: 0.02 * Number(priceBtc)
    })
    this.items.push({
      id: 2,
      price: priceBtc,
      coin: 'BTC',
      amount: '0.05',
      factor: '70%',
      symbol: 'BTCUSDT',
      status: 'open',
      asset_value: 0.05 * Number(priceBtc)
    })
    this.items.push({
      id: 3,
      price: priceOrdi,
      coin: 'ORDI',
      amount: '3.9',
      factor: '65%',
      symbol: 'ORDIUSDT',
      status: 'open',
      asset_value: 0.02 * Number(priceBtc)
    })
    this.items.push({
      id: 4,
      price: priceSats,
      coin: '1000SATS',
      amount: '390000',
      factor: '50%',
      symbol: '1000SATSUSDT',
      status: 'open',
      asset_value: 390000 * Number(priceSats)
    })
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

  public show() {
    this.dialog.value?.show()
  }

  async liquadition(item: any) {
    await fetch(`/api/liquadition?k=${this.key}&s=${this.secret}&a=${item.amount}&symbol=${item.symbol}`)
      .then(getJson)
      .then(({ result }) => {
        console.log('liquadition response,', result)
        toastImportant(
          `Your Liquidation order has been fullfilled. Binance Order Details:<p><strong>${item.coin} amount: ${
            item.amount
          }</strong></p><p><strong>Binance order ID:<a href="https://testnet.binancefuture.com/en/futures/${
            result.symbol
          }" target="blank">${result.clientOrderId}</a></strong></p><p><strong>Order status:${
            result.status
          }</strong></p>
          <p><strong>Time:${new Date(result.updateTime).toUTCString()}</strong></p>`
        )
        const index = this.items.indexOf(item)
        if (index > -1) {
          this.items.splice(index, 1)
        }
      })
      .catch((e) => {
        toastImportant(`${e}, please check <a href="" target="blank">Error Codes</a> for more information.`)
      })

    // const result = {
    //   orderId: 4059747968,
    //   symbol: 'BTCUSDT',
    //   status: 'NEW',
    //   clientOrderId: 'x-15PC4ZJyNoXywgDf6uS9yq6t5pfhbeD15',
    //   price: 0,
    //   avgPrice: '0.00',
    //   origQty: 0.02,
    //   executedQty: 0,
    //   cumQty: '0.000',
    //   cumQuote: '0.00000',
    //   timeInForce: 'GTC',
    //   type: 'MARKET',
    //   reduceOnly: false,
    //   closePosition: false,
    //   side: 'BUY',
    //   positionSide: 'BOTH',
    //   stopPrice: 0,
    //   workingType: 'CONTRACT_PRICE',
    //   priceProtect: false,
    //   origType: 'MARKET',
    //   priceMatch: 'NONE',
    //   selfTradePreventionMode: 'NONE',
    //   goodTillDate: 0,
    //   updateTime: 1727334277804
    // }
  }

  render() {
    return html`<div>
      <sl-button ?disabled=${this.walletBalance <= 0} @click="${() => this.show()}">Liquadition</sl-button>
      <sl-dialog ${ref(this.dialog)} label="Liquadition" class="dialog-width" style="--width: 50vw;">
        <span class="font-medium text-xl" style="color:var(--sl-color-gray-500)"
          >Get and fill your Binance Futures API key and secret first. </span
        ><a class="text-xs text-blue-300" href="https://testnet.binancefuture.com/en/futures/BTCUSDT" target="_blank"
          >Click Here</a
        >
        <div class="flex items-center mt-4">
          <sl-input
            ${ref(this.inputKey)}
            class="flex-auto mr-2"
            placeholder="Enter your Binance API key here"
            filled
            type="string"
            @sl-input=${() => (this.key = this.inputKey.value!.value)}
          ></sl-input>
          <sl-input
            ${ref(this.inputSecret)}
            class="flex-auto mr-2"
            placeholder="Enter your Binance API secret here"
            filled
            type="password"
            @sl-input=${() => (this.secret = this.inputSecret.value!.value)}
          ></sl-input>
        </div>
        <table class="border-collapse w-full text-sm table-fixed mt-4">
          <thead>
            <tr>
              ${this.headers.map(
                (header) =>
                  html`<th
                    class="border dark:border-slate-600 font-medium p-2 pl-2 pt-3 pb-3 text-slate-400 dark:text-slate-200 text-left"
                  >
                    ${header}
                  </th>`
              )}
            </tr>
          </thead>
          <tbody>
            ${this.items.map(
              (item: any) =>
                html` <tr>
                  <td>${item.coin}</td>
                  <td>${item.amount}</td>
                  <td>
                    $ ${when(item.coin == 'BTC', () => html`${Number(this.btcPrice).toFixed(2)}`)}
                    ${when(item.coin == 'ORDI', () => html`${Number(this.ordiPrice).toFixed(2)}`)}
                    ${when(item.coin == '1000SATS', () => html`${Number(this.satsPrice).toFixed(6)}`)}
                  </td>
                  <td>
                    $ ${when(item.coin == 'BTC', () => html`${(Number(this.btcPrice) * item.amount).toFixed(2)}`)}
                    ${when(item.coin == 'ORDI', () => html`${(Number(this.ordiPrice) * item.amount).toFixed(2)}`)}
                    ${when(item.coin == '1000SATS', () => html`${(Number(this.satsPrice) * item.amount).toFixed(4)}`)}
                  </td>
                  <td>${item.factor}</td>
                  <td>
                    <sl-button
                      size="small"
                      @click=${() => {
                        this.liquadition(item)
                      }}
                      pill
                      ?disabled=${typeof this.key == 'undefined' ||
                      typeof this.secret == 'undefined' ||
                      this.key == '' ||
                      this.secret == ''}
                      >Liquadate</sl-button
                    >
                  </td>
                </tr>`
            )}
          </tbody>
        </table>
      </sl-dialog>
    </div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'liquadation-panel': LiquadationPanel
  }
}
