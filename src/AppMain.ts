import { LitElement, html, unsafeCSS } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { Ref, createRef, ref } from 'lit/directives/ref.js'
import baseStyle from './base.css?inline'
import style from './main.css?inline'
import { SupplyPanel } from './components/supply'
import { StateController, walletState } from './lib/walletState'

@customElement('app-main')
export class AppMain extends LitElement {
  static styles = [unsafeCSS(baseStyle), unsafeCSS(style)]
  @state() priceOrdi?: string
  @state() priceSats?: string
  @state() protocolBalance = 0
  @state() supplyPanel: Ref<SupplyPanel> = createRef<SupplyPanel>()

  get walletBalance() {
    return walletState.balance?.confirmed ?? 0
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
    setTimeout(this.supply.bind(this), 1000)
  }

  supply() {
    this.supplyPanel.value?.show()
  }

  formatPrice(price?: string) {
    if (!price) return '-'
    const p = Number(price) * 100000000
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
            <span class="text-xs" style="color:var(--sl-color-green-500)">Balance</span>
            <div class="flex text-4xl my-1 items-center">
              <sl-icon outline name="currency-bitcoin"></sl-icon>${Math.floor(this.protocolBalance / 100000000)}.<span
                class="text-sl-neutral-600"
                >${Math.floor((this.protocolBalance % 100000000) / 10000)
                  .toString()
                  .padStart(4, '0')}</span
              >
            </div>
            <span class="text-xs">$0.00</span>
          </div>
          <div class="mt-5 flex sm:my-auto space-x-4">
            <sl-button
              class="supply"
              variant=${this.walletBalance <= 0 ? 'default' : 'success'}
              @click=${this.supply.bind(this)}
              ?disabled=${this.walletBalance <= 0}
              pill
            >
              <sl-icon slot="prefix" name="plus-circle-fill"></sl-icon>
              Supply BTC
            </sl-button>
            <sl-button class="supply" variant="default" disabled pill>
              <sl-icon slot="prefix" name="plus-circle-fill"></sl-icon>
              Borrow BTC
            </sl-button>
          </div>
        </div>

        <div class="grid grid-cols-5 space-y-5 sm:grid-cols-12 sm:space-x-5 sm:space-y-0">
          <div class="col-span-7 panel !rounded-none">
            <ul>
              <li class="text-xs mb-3">Tick</li>
              <li class="py-4 flex items-center">
                <span class="brc20-icon" style="background-image:url(brc20-ordi.png)"></span>
                <div class="ml-3 flex-auto">
                  <p class="text-sm">ordi</p>
                  <p class="text-xs text-sl-neutral-600">${this.formatPrice(this.priceOrdi)} sats</p>
                </div>
                <div class="space-x-2">
                  <sl-button variant="default" circle disabled>
                    <sl-icon name="plus"></sl-icon>
                  </sl-button>
                  <sl-button variant="default" circle disabled>
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
                  <sl-button variant="default" circle disabled>
                    <sl-icon name="plus"></sl-icon>
                  </sl-button>
                  <sl-button variant="default" circle disabled>
                    <sl-icon name="dash"></sl-icon>
                  </sl-button>
                </div>
              </li>
            </ul>
          </div>

          <div class="col-span-5">
            <div class="relative panel font-medium">
              <span class="text-xs text-sl-neutral-600">Wallet Balance</span>
              <div class="flex text-xl my-1 items-center">
                <sl-icon outline name="currency-bitcoin"></sl-icon>${Math.floor(this.walletBalance / 100000000)}.<span
                  class="text-sl-neutral-600"
                  >${Math.floor((this.walletBalance % 100000000) / 10000)
                    .toString()
                    .padStart(4, '0')}</span
                >
              </div>
              <sl-divider class="my-8"></sl-divider>
              <div class="flex">
                <div class="flex-1">
                  <span class="text-xs text-sl-neutral-600">Borrow APR</span>
                  <div class="mt-2">2.25%</div>
                </div>
                <div class="flex-1 text-end">
                  <span class="text-xs text-sl-neutral-600">Supply APR</span>
                  <div class="mt-2">2.65%</div>
                </div>
              </div>
              <supply-panel ${ref(this.supplyPanel)}></supply-panel>
            </div>
          </div>
        </div>
      </div>
    `
  }
}
