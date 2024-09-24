import { LitElement, html, unsafeCSS } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { Ref, createRef, ref } from 'lit/directives/ref.js'
import { when } from 'lit/directives/when.js'
import { map } from 'lit/directives/map.js'
import baseStyle from './base.css?inline'
import style from './main.css?inline'
import './global.css'
import '@shoelace-style/shoelace/dist/themes/light.css'
import '@shoelace-style/shoelace/dist/components/icon/icon'
import '@shoelace-style/shoelace/dist/components/icon-button/icon-button'
import '@shoelace-style/shoelace/dist/components/button/button'
import '@shoelace-style/shoelace/dist/components/divider/divider'
import '@shoelace-style/shoelace/dist/components/tooltip/tooltip'
import { setBasePath } from '@shoelace-style/shoelace/dist/utilities/base-path.js'
import './components/borrow'
import './components/connect'
import './components/repay'
import './components/supply'
import './components/supplyTick'
import './components/tick'
import './components/price'
import { SupplyPanel } from './components/supply'
import { Unsubscribe, walletState } from './lib/walletState'
import { SupplyTickPanel } from './components/supplyTick'
import { BorrowPanel } from './components/borrow'
import { PricePanel } from './components/price'
import { RepayPanel } from './components/repay'
import { toast, toastImportant } from './lib/toast'
import { getJson } from '../api_lib/fetch'
import { formatUnits, parseUnits } from './lib/units'
import { marketState } from './lib/marketState'
import { Balance } from './lib/wallets'

setBasePath(import.meta.env.MODE === 'development' ? 'node_modules/@shoelace-style/shoelace/dist' : '/')

function darkMode(enable = true) {
  if (enable) {
    import('@shoelace-style/shoelace/dist/themes/dark.css')
    document.documentElement.setAttribute('class', 'sl-theme-dark')
  } else {
    document.documentElement.removeAttribute('class')
  }
}

globalThis.matchMedia && globalThis.matchMedia('(prefers-color-scheme: dark)').matches && darkMode()

globalThis.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
  darkMode(e.matches)
})

@customElement('app-main')
export class AppMain extends LitElement {
  static styles = [unsafeCSS(baseStyle), unsafeCSS(style)]
  @state() balanceOrdi?: string
  @state() balanceSats?: string
  @state() supplyPanel: Ref<SupplyPanel> = createRef<SupplyPanel>()
  @state() supplyTickPanel: Ref<SupplyTickPanel> = createRef<SupplyTickPanel>()
  @state() pricePanel: Ref<PricePanel> = createRef<PricePanel>()
  @state() borrowPanel: Ref<BorrowPanel> = createRef<BorrowPanel>()
  @state() repayPanel: Ref<RepayPanel> = createRef<RepayPanel>()
  @state() withdrawing = false
  @state() walletBalance = 0
  @state() protocolBalance?: Balance
  @state() collateralValue = 0

  private protocolBalanceUpdater?: Promise<any>
  private stateUnsubscribes: Unsubscribe[] = []

  connectedCallback(): void {
    super.connectedCallback()
    this.stateUnsubscribes.push(
      walletState.subscribe((k, v) => {
        switch (k) {
          case '_balance':
            this.walletBalance = v?.total ?? 0
            break
          case '_protocolBalance':
            this.protocolBalance = v
            break
          case '_collateralBalance':
            this.collateralValue = 0
            if (v) this.updateCollateralValue()
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
    this.stateUnsubscribes.push(marketState.subscribe(() => this.updateCollateralValue(), 'brc20Price'))
    this.protocolBalanceUpdater ??= this.updateProtocolBalance()
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    this.protocolBalanceUpdater = undefined
    this.stateUnsubscribes.forEach((f) => f())
    this.stateUnsubscribes = []
  }

  async updateProtocolBalance() {
    while (true) {
      await walletState
        .updateProtocolBalance()
        .catch((e) => console.log(`failed to update protocol balance, error:`, e))
      await new Promise((r) => setTimeout(r, 60000))
    }
  }

  private updateCollateralValue() {
    walletState.getCollateralBalance().then(async (balances) => {
      var value = parseUnits('0')
      const priceDecimals = 18
      const priceMul = parseUnits((10 ** priceDecimals).toString(), 0)
      for (let tick in marketState.brc20Price) {
        const price = marketState.brc20Price[tick]
        const balance = balances.find((b) => b.ticker == tick.replace(/.$/, 'Q'))
        console.debug(
          'update collateral value, ticker:',
          tick,
          'price:',
          JSON.stringify(price),
          'balance:',
          JSON.stringify(balance)
        )
        if (!price || !balance) return
        value = value.add(
          parseUnits(
            formatUnits(
              parseUnits(balance.overallBalance, 18).mul(parseUnits(price.floorPrice, 18)).div(priceMul),
              balance.decimals
            )
          )
        )
      }
      this.collateralValue = parseFloat(Number(formatUnits(value)).toFixed(8))
      console.log('update collateral value:', this.collateralValue)
    })
  }

  supply() {
    this.supplyPanel.value?.show()
  }

  supplyTick(tick: string) {
    this.supplyTickPanel.value!.tick = tick
    this.supplyTickPanel.value!.max = 0n
    walletState
      .getBrc20Balance()
      .then((balances) => balances.find((b) => b.ticker == tick.replace(/.$/, 'Q')))
      .then((b) => b && (this.supplyTickPanel.value!.max = BigInt(b.availableBalance)))
    this.supplyTickPanel.value?.show()
  }

  deploy(tick: string) {
    Promise.all([walletState.connector!.publicKey, walletState.connector?.accounts]).then(
      async ([publicKey, accounts]) => {
        var res = await fetch(`/api/brc20Deploy?tick=${tick}&pub=${publicKey}&address=${accounts?.[0]}`).then(getJson)
        if (!res.address) {
          console.warn('deploy address not returned', res)
          return
        }
        const txid = await walletState.connector?.sendBitcoin(res.address, 1000)
        var res = await fetch(
          `/api/brc20Deploy?tick=${tick}&pub=${publicKey}&address=${accounts?.[0]}&txid=${txid}`
        ).then(getJson)
        if (!res.psbt) {
          console.warn('reveal tx not generated', res)
          return
        }
        walletState.connector
          ?.signPsbt(res.psbt, {
            autoFinalized: true,
            toSignInputs: [{ index: 0, publicKey, disableTweakSigner: true }]
          })
          .then((hex) => {
            walletState.connector?.pushPsbt(hex).then((id) => console.log(id))
          })
      }
    )
  }

  async withdraw() {
    this.withdrawing = true
    const { alert } = toastImportant('Withdrawing, waiting for MPC signatures...')
    Promise.all([
      fetch(`/api/withdraw?pub=${await walletState.connector!.publicKey}&address=${walletState.address}`)
        .then(getJson)
        .catch((e) => toast(e)),
      new Promise((r) => setTimeout(r, 500 + Math.random() * 2000)).then(() => (alert.innerHTML += '✔️')),
      new Promise((r) => setTimeout(r, 1000 + Math.random() * 2000)).then(() => (alert.innerHTML += '✔️'))
    ])
      .then(([{ tx }]) => {
        alert.hide().then(() => {
          toastImportant(
            `Withdraw transaction <a href="https://mempool.space/testnet/tx/${tx}">${tx}</a> sent to network.`
          )
        })
        walletState.updateProtocolBalance()
      })
      .finally(() => (this.withdrawing = false))
  }

  async borrow() {
    this.borrowPanel.value!.max = this.collateralValue
    this.borrowPanel.value!.show()
  }

  async repay() {
    this.repayPanel.value!.max = this.protocolBalance?.total ?? 0
    this.repayPanel.value!.show()
  }

  formatPrice(price?: string) {
    if (!price) return '-'
    const p = Number(price) * 1e8
    if (p < 1) return p.toPrecision(2)
    return p.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ',')
  }

  showPrice() {
    console.log(this.pricePanel.value)
    this.pricePanel.value?.show()
  }

  render() {
    return html`
      <price-panel ${ref(this.pricePanel)}></price-panel>
      <div class="mx-auto max-w-screen-lg px-6 lg:px-0 pb-6">
        <nav class="flex justify-between py-4">
          <div class="flex">
            <a href="#" class="-m-1.5 p-1.5">
              <img class="h-8 w-auto" src="logo.svg" alt="" />
            </a>
          </div>
          <div class="justify-end">
            <sl-button @click="${() => this.showPrice()}">View Prices</sl-button>
            <connect-button></connect-button>
          </div>
        </nav>

        <div class="my-10 grid sm:flex">
          <div class="sm:flex-auto font-medium">
            ${when(
              (this.protocolBalance?.total ?? 0) >= 0,
              () => html` <span class="text-xs" style="color:var(--sl-color-green-500)">Balance</span> `,
              () => html`
                <span class="text-xs" style="color:var(--sl-color-green-500)">Borrowing</span
                ><span class="text-xs text-sl-neutral-600">@</span><span class="text-xs">2.6%</span>
              `
            )}
            <div class="flex text-4xl my-1 items-center">
              <sl-icon outline name="currency-bitcoin"></sl-icon>
              ${Math.floor(Math.abs(this.protocolBalance?.total ?? 0) / 1e8)}.<span class="text-sl-neutral-600"
                >${Math.floor((Math.abs(this.protocolBalance?.total ?? 0) % 1e8) / 1e4)
                  .toString()
                  .padStart(4, '0')}</span
              >
              ${when(
                this.protocolBalance?.unconfirmed,
                () =>
                  html`<span class="text-xs ml-1 border-l pl-2 text-sl-neutral-600 font-light">
                    ${formatUnits(Math.abs(this.protocolBalance!.confirmed), 8)} confirmed<br />
                    ${formatUnits(Math.abs(this.protocolBalance!.unconfirmed), 8)} unconfirmed
                  </span>`
              )}
            </div>
            <span class="text-xs">$0.00</span>
          </div>
          <div class="mt-5 flex sm:my-auto space-x-4">
            ${when(
              this.collateralValue <= 0,
              () => html`
                <sl-button
                  class="supply"
                  variant=${this.walletBalance <= 0 ? 'default' : 'success'}
                  @click=${() => this.supply()}
                  ?disabled=${this.walletBalance <= 0}
                  pill
                >
                  <sl-icon slot="prefix" name="plus-circle-fill"></sl-icon>
                  Supply BTC
                </sl-button>
              `
            )}
            ${when(
              (this.protocolBalance?.total ?? 0) > 0,
              () => html`
                <sl-button
                  class="supply"
                  variant="success"
                  @click=${() => this.withdraw()}
                  ?loading=${this.withdrawing}
                  pill
                >
                  <sl-icon slot="prefix" name="dash-circle-fill"></sl-icon>
                  Withdraw BTC
                </sl-button>
              `,
              () => html`
                <sl-button
                  class="supply"
                  variant=${this.collateralValue <= 0 ? 'default' : 'primary'}
                  ?disabled=${this.collateralValue <= 0}
                  pill
                  @click=${() => this.borrow()}
                >
                  <sl-icon slot="prefix" name="plus-circle-fill"></sl-icon>
                  Borrow BTC
                </sl-button>
                ${when(
                  this.collateralValue > 0,
                  () => html`
                    <sl-button
                      class="supply"
                      variant=${(this.protocolBalance?.total ?? 0) >= 0 ? 'default' : 'primary'}
                      ?disabled=${(this.protocolBalance?.total ?? 0) >= 0}
                      pill
                      @click=${() => this.repay()}
                    >
                      <sl-icon slot="prefix" name="plus-circle-fill"></sl-icon>
                      Repay BTC
                    </sl-button>
                  `
                )}
              `
            )}
          </div>
        </div>

        <div class="grid grid-cols-5 space-y-5 sm:grid-cols-12 sm:space-x-5 sm:space-y-0">
          <div class="col-span-7">
            <div class="relative panel !rounded-none">
              <ul>
                <li class="text-xs mb-3">Tick</li>
                ${map(['ordi', 'sats'], (tick) => {
                  return html`<li>
                    <tick-row
                      class="py-4 flex items-center"
                      .tick=${tick}
                      @supply=${() => this.supplyTick(tick)}
                    ></tick-row>
                  </li>`
                })}
              </ul>
              <supply-tick-panel ${ref(this.supplyTickPanel)}></supply-tick-panel>
            </div>
          </div>

          <div class="col-span-5 space-y-2">
            <div class="relative panel font-medium">
              <span class="text-xs text-sl-neutral-600">Wallet Balance</span>
              <div class="flex text-xl my-1 items-center">
                <sl-icon outline name="currency-bitcoin"></sl-icon>${Math.floor(this.walletBalance / 1e8)}.<span
                  class="text-sl-neutral-600"
                  >${Math.floor((this.walletBalance % 1e8) / 1e4)
                    .toString()
                    .padStart(4, '0')}</span
                >
              </div>
              <sl-divider class="my-8"></sl-divider>
              <div class="flex">
                <div class="flex-1">
                  <span class="text-xs text-sl-neutral-600">Borrow APR</span>
                  <div class="mt-2">2.65%</div>
                </div>
                <div class="flex-1 text-end">
                  <span class="text-xs text-sl-neutral-600">Supply APR</span>
                  <div class="mt-2">2.25%</div>
                </div>
              </div>
              <supply-panel ${ref(this.supplyPanel)}></supply-panel>
            </div>

            <div class="relative panel">
              <span class="text-xs text-sl-neutral-600 font-medium">Position Summary</span>
              <div class="flex my-4 text-sm">
                <span class="flex-auto">Collateral Value</span>
                <span class="flex-auto text-end">${this.collateralValue > 0 ? this.collateralValue : '-'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <borrow-panel ${ref(this.borrowPanel)}></borrow-panel>
      <repay-panel ${ref(this.repayPanel)}></repay-panel>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-main': AppMain
  }
}
