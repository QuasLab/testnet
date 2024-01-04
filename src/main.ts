import { LitElement, html, unsafeCSS } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import style from './base.css?inline'
import '@shoelace-style/shoelace/dist/themes/light.css'
import '@shoelace-style/shoelace/dist/components/icon/icon'
import '@shoelace-style/shoelace/dist/components/button/button'
import { setBasePath } from '@shoelace-style/shoelace/dist/utilities/base-path.js'
import './components/connect'
import { walletState } from './state/wallet'

setBasePath(import.meta.env.MODE === 'development' ? 'node_modules/@shoelace-style/shoelace/dist' : '/dist')

function darkMode(enable = true) {
  if (enable) {
    import('@shoelace-style/shoelace/dist/themes/dark.css')
    document.documentElement.setAttribute('class', 'sl-theme-dark')
  } else {
    document.documentElement.removeAttribute('class')
  }
}

window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches && darkMode()

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
  darkMode(e.matches)
})

@customElement('app-main')
export class AppMain extends LitElement {
  static styles = [unsafeCSS(style)]
  @state() priceOrdi?: string
  @state() priceSats?: string
  @state() balance = 0

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
    walletState.subscribe(() => {
      walletState.balance.then((res) => {
        this.balance = res.confirmed
      })
    }, 'address')
  }

  formatPrice(price?: string) {
    if (!price) return '-'
    const p = Number(price) * 1e8
    if (p < 1) return p.toPrecision(2)
    return p.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ',')
  }

  render() {
    return html`
      <div class="mx-auto max-w-screen-lg lg:px-0 px-6">
        <nav class="mx-auto flex items-center justify-between py-4" aria-label="Global">
          <div class="flex lg:flex-1">
            <a href="#" class="-m-1.5 p-1.5">
              <img class="h-8 w-auto" src="logo.svg" alt="" />
            </a>
          </div>
          <div class="flex flex-1 justify-end">
            <connect-button></connect-button>
          </div>
        </nav>

        <div class="my-10 flex">
          <div class="font-medium flex-auto">
            <span class="text-xs" style="color:var(--sl-color-green-500)">Balance</span>
            <div class="flex text-4xl my-1 items-center">
              <sl-icon outline name="currency-bitcoin"></sl-icon>${Math.floor(this.balance / 1e8)}.<span
                style="color:var(--sl-color-neutral-600)"
                >${Math.floor((this.balance % 1e8) / 1e4)
                  .toString()
                  .padStart(4, '0')}</span
              >
            </div>
            <span class="text-xs">$0.00</span>
          </div>
          <div class="my-auto space-x-4">
            <sl-button variant="default" disabled pill>
              <sl-icon name="plus-circle-fill"></sl-icon>
              Supply BTC
            </sl-button>
            <sl-button variant="default" disabled pill>
              <sl-icon name="plus-circle-fill"></sl-icon>
              Borrow BTC
            </sl-button>
          </div>
        </div>

        <div class="grid grid-cols-12">
          <div class="rounded col-span-7 p-10" style="background-color:var(--sl-color-neutral-50)">
            <ul>
              <li class="text-xs mb-3 font-medium" style="color:var(--sl-color-neutral-600)">Tick</li>
              <li class="py-4 flex items-center">
                <span class="w-9 h-9 inline-block bg-contain" style="background-image:url(brc20-ordi.png)"></span>
                <div class="ml-3 flex-auto">
                  <p class="text-sm">ordi</p>
                  <p class="text-xs" style="color:var(--sl-color-neutral-600)">
                    ${this.formatPrice(this.priceOrdi)} sats
                  </p>
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
                <span class="w-9 h-9 inline-block bg-contain" style="background-image:url(brc20-sats.png)"></span>
                <div class="ml-3 flex-auto">
                  <p class="text-sm">sats</p>
                  <p class="text-xs" style="color:var(--sl-color-neutral-600)">
                    ${this.formatPrice(this.priceSats)} sats
                  </p>
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
        </div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-main': AppMain
  }
}
