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
import { SupplyPanel } from './components/supply'
import { Brc20Balance, UTXO, walletState } from './lib/walletState'
import { SupplyTickPanel } from './components/supplyTick'
import { BorrowPanel } from './components/borrow'
import { RepayPanel } from './components/repay'
import { toast, toastImportant } from './lib/toast'
import { getJson } from '../api_lib/fetch'
import { formatUnits, parseUnits } from './lib/units'

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
  @state() borrowPanel: Ref<BorrowPanel> = createRef<BorrowPanel>()
  @state() repayPanel: Ref<RepayPanel> = createRef<RepayPanel>()
  @state() withdrawing = false
  @state() walletBalance = 0
  @state() protocolBalance = 0
  @state() collateralBalance = 0n

  constructor() {
    super()
    walletState.subscribe((k, v) => {
      switch (k) {
        case '_balance':
          this.walletBalance = v.confirmed ?? 0
          break
        case '_protocolBalance':
          this.protocolBalance = 0
          v.forEach((utxo: UTXO) => (this.protocolBalance += utxo.value))
          break
        case '_collateralBalance':
          this.collateralBalance = 0n
          v.forEach((balance: Brc20Balance) => (this.collateralBalance += BigInt(balance.availableBalance)))
          break
      }
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
      .then((balances) => balances.find((b) => b.tick == tick.replace(/.$/, 'Q')))
      .then((b) => b && (this.supplyTickPanel.value!.max = BigInt(b.availableBalance)))
    this.supplyTickPanel.value?.show()
  }

  withdrawTick(_: string) {
    // walletState._collateralBalance = 0
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
    fetch(`/api/withdraw?pub=${await walletState.connector!.publicKey}&address=${walletState.address}`)
      .then(getJson)
      .then(({ tx }) =>
        toastImportant(
          `Withdraw transaction <a href="https://mempool.space/testnet/tx/${tx}">${tx}</a> sent to network.`
        )
      )
      .catch((e) => toast(e))
      .finally(() => (this.withdrawing = false))
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
              this.collateralBalance <= 0,
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
                  variant=${this.collateralBalance <= 0 ? 'default' : 'primary'}
                  ?disabled=${this.collateralBalance <= 0}
                  pill
                  @click=${() => this.borrow()}
                >
                  <sl-icon slot="prefix" name="plus-circle-fill"></sl-icon>
                  Borrow BTC
                </sl-button>
                ${when(
                  this.collateralBalance > 0,
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
                ${map(['ordi', 'sats'], (tick) => {
                  return html`<li>
                    <tick-row
                      class="py-4 flex items-center"
                      .tick=${tick}
                      @supply=${() => this.supplyTick(tick)}
                      @withdraw=${() => this.withdrawTick(tick)}
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
                <span class="flex-auto text-end">${formatUnits(this.collateralBalance, 18)}</span>
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
