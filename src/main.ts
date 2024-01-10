import { LitElement, html, unsafeCSS } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { Ref, createRef, ref } from 'lit/directives/ref.js'
import { when } from 'lit/directives/when.js'
import baseStyle from './base.css?inline'
import style from './main.css?inline'
import './global.css'
import '@shoelace-style/shoelace/dist/themes/light.css'
import '@shoelace-style/shoelace/dist/components/icon/icon'
import '@shoelace-style/shoelace/dist/components/button/button'
import '@shoelace-style/shoelace/dist/components/divider/divider'
import { setBasePath } from '@shoelace-style/shoelace/dist/utilities/base-path.js'
import './components/borrow'
import './components/connect'
import './components/repay'
import './components/supply'
import './components/supplyTick'
import { SupplyPanel } from './components/supply'
import { StateController, walletState } from './lib/walletState'
import { SupplyTickPanel } from './components/supplyTick'
import { BorrowPanel } from './components/borrow'
import { RepayPanel } from './components/repay'

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
  @state() priceOrdi?: string
  @state() priceSats?: string
  @state() supplyPanel: Ref<SupplyPanel> = createRef<SupplyPanel>()
  @state() supplyTickPanel: Ref<SupplyTickPanel> = createRef<SupplyTickPanel>()
  @state() borrowPanel: Ref<BorrowPanel> = createRef<BorrowPanel>()
  @state() repayPanel: Ref<RepayPanel> = createRef<RepayPanel>()
  @state() withdrawing = false

  get walletBalance() {
    return walletState.balance?.confirmed ?? 0
  }

  get protocolBalance() {
    const utxos = walletState.protocolBalance
    var value = 0
    utxos?.forEach((utxo) => (value += utxo.value))
    return value
  }

  constructor() {
    super()
    new StateController(this, walletState)
  }

  connectedCallback(): void {
    super.connectedCallback()
    fetch('/api/collections?slug=ordi')
      .then((res) => res.json())
      .then((res) => {
        this.priceOrdi = res?.data?.data?.[0]?.floorPrice
      })
    fetch('/api/collections?slug=sats')
      .then((res) => res.json())
      .then((res) => {
        this.priceSats = res?.data?.data?.[0]?.floorPrice
      })
  }

  supply() {
    this.supplyPanel.value?.show()
  }

  supplyTick(tick: string) {
    this.supplyTickPanel.value!.tick = tick
    this.supplyTickPanel.value?.show()
  }

  withdrawTick(_: string) {
    walletState._collateralBalance = 0
  }

  async withdraw() {
    this.withdrawing = true
    fetch(`/api/withdraw?pub=${await walletState.connector.publicKey}&address=${walletState.address}`)
      .then((res) => res.json())
      .then((res) => {
        this.priceSats = res?.data?.data?.[0]?.floorPrice
      })
      .finally(() => (this.withdrawing = false))
    this.withdrawing = false
  }

  async borrow() {
    this.borrowPanel.value?.show()
  }

  async repay() {
    this.repayPanel.value?.show()
  }

  formatPrice(price?: string) {
    if (!price) return '-'
    const p = Number(price) * 1e8
    if (p < 1) return p.toPrecision(2)
    return p.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ',')
  }

  render() {
    return html`
      <div class="mx-auto max-w-screen-lg px-6 lg:px-0 pb-6">
        <nav class="flex justify-between py-4">
          <div class="flex">
            <a href="#" class="-m-1.5 p-1.5">
              <img class="h-8 w-auto" src="logo.svg" alt="" />
            </a>
          </div>
          <div class="justify-end">
            <connect-button></connect-button>
          </div>
        </nav>

        <div class="my-10 grid sm:flex">
          <div class="sm:flex-auto font-medium">
            ${when(
              walletState.borrowedBalance <= 0,
              () => html`
                <span class="text-xs" style="color:var(--sl-color-green-500)">Balance</span>
                <div class="flex text-4xl my-1 items-center">
                  <sl-icon outline name="currency-bitcoin"></sl-icon>${Math.floor(this.protocolBalance / 1e8)}.<span
                    class="text-sl-neutral-600"
                    >${Math.floor((this.protocolBalance % 1e8) / 1e4)
                      .toString()
                      .padStart(4, '0')}</span
                  >
                </div>
                <span class="text-xs">$0.00</span>
              `,
              () => html`
                <span class="text-xs" style="color:var(--sl-color-green-500)">Borrowing</span
                ><span class="text-xs text-sl-neutral-600">@</span><span class="text-xs">2.6%</span>
                <div class="flex text-4xl my-1 items-center">
                  <sl-icon outline name="currency-bitcoin"></sl-icon>${Math.floor(walletState.borrowedBalance)}.<span
                    class="text-sl-neutral-600"
                    >${Math.floor((walletState.borrowedBalance * 1e4) % 1e4)
                      .toString()
                      .padStart(4, '0')}</span
                  >
                </div>
                <span class="text-xs">$0.00</span>
              `
            )}
          </div>
          <div class="mt-5 flex sm:my-auto space-x-4">
            ${when(
              walletState._collateralBalance <= 0,
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
              this.protocolBalance > 0,
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
                  variant=${walletState._collateralBalance <= 0 ? 'default' : 'primary'}
                  ?disabled=${walletState._collateralBalance <= 0}
                  pill
                  @click=${() => this.borrow()}
                >
                  <sl-icon slot="prefix" name="plus-circle-fill"></sl-icon>
                  Borrow BTC
                </sl-button>
                ${when(
                  walletState._collateralBalance > 0,
                  () => html`
                    <sl-button
                      class="supply"
                      variant=${walletState._borrowedBalance <= 0 ? 'default' : 'primary'}
                      ?disabled=${walletState._borrowedBalance <= 0}
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
                <li class="py-4 flex items-center">
                  <span class="brc20-icon" style="background-image:url(brc20-ordi.png)"></span>
                  <div class="ml-3 flex-auto">
                    <p class="text-sm">ordi</p>
                    <p class="text-xs text-sl-neutral-600">${this.formatPrice(this.priceOrdi)} sats</p>
                  </div>
                  <div class="space-x-2">
                    <sl-button variant="default" circle @click=${() => this.supplyTick('ordi')}>
                      <sl-icon name="plus"></sl-icon>
                    </sl-button>
                    <sl-button
                      variant="default"
                      circle
                      ?disabled=${walletState.collateralBalance <= 0}
                      @click=${() => this.withdrawTick('ordi')}
                    >
                      <sl-icon name="dash"></sl-icon>
                    </sl-button>
                  </div>
                </li>
                <li class="py-4 flex items-center">
                  <span class="brc20-icon" style="background-image:url(brc20-sats.png)"></span>
                  <div class="ml-3 flex-auto">
                    <p class="text-sm">sats</p>
                    <p class="text-xs text-sl-neutral-600">${this.formatPrice(this.priceSats)} sats</p>
                  </div>
                  <div class="space-x-2">
                    <sl-button variant="default" circle @click=${() => this.supplyTick('sats')}>
                      <sl-icon name="plus"></sl-icon>
                    </sl-button>
                    <sl-button
                      variant="default"
                      circle
                      ?disabled=${walletState.collateralBalance <= 0}
                      @click=${() => this.withdrawTick('sats')}
                    >
                      <sl-icon name="dash"></sl-icon>
                    </sl-button>
                  </div>
                </li>
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
                <span class="flex-1">Collateral Value</span>
                <span class="flex-1 text-end">${walletState.collateralBalance}</span>
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
