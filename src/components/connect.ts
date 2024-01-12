import { LitElement, html, unsafeCSS } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { Ref, createRef, ref } from 'lit/directives/ref.js'
import { when } from 'lit/directives/when.js'
import { map } from 'lit/directives/map.js'
import style from '/src/base.css?inline'
import '@shoelace-style/shoelace/dist/components/alert/alert'
import '@shoelace-style/shoelace/dist/components/button/button'
import '@shoelace-style/shoelace/dist/components/dialog/dialog'
import '@shoelace-style/shoelace/dist/components/divider/divider'
import '@shoelace-style/shoelace/dist/components/dropdown/dropdown'
import '@shoelace-style/shoelace/dist/components/icon/icon'
import '@shoelace-style/shoelace/dist/components/menu/menu'
import '@shoelace-style/shoelace/dist/components/menu-item/menu-item'
import { SlAlert, SlDialog } from '@shoelace-style/shoelace'
import { getAddressInfo } from 'bitcoin-address-validation'
import { StateController, walletState } from '../lib/walletState'
import { WalletNames, WalletType, WalletTypes } from '../lib/wallets'

@customElement('connect-button')
export class ConnectButton extends LitElement {
  static styles = [unsafeCSS(style)]
  @state() dialog: Ref<SlDialog> = createRef<SlDialog>()
  @state() alert: Ref<SlAlert> = createRef<SlAlert>()
  @state() alertMessage: any
  @state() connectingWallet?: WalletType
  @state() ticks: any

  constructor() {
    super()
    new StateController(this, walletState)
  }

  disconnect() {
    walletState.reset()
  }

  async connect(type: WalletType) {
    walletState.useWallet(type)
    if (!walletState.connector || !walletState.connector.installed) {
      this.alertMessage = 'Wallet is not installed.'
      this.alert.value?.toast()
      return
    }
    this.connectingWallet = type
    try {
      const res = await walletState.connector.network
      if (res != 'testnet') await walletState.connector.switchNetwork('testnet')
    } catch (e) {
      console.warn(e)
      this.alertMessage = 'Failed to switch to testnet, ' + e
      this.alert.value?.toast()
      this.connectingWallet = undefined
      return
    }
    try {
      let result = await walletState.connector.accounts
      if (!Array.isArray(result) || result.length == 0) result = await walletState.connector.requestAccounts()
      const info = getAddressInfo(result[0])
      if (info.network != 'testnet') {
        throw new Error(`${result[0]} is not a testnet address`)
      }
      walletState.wallet = type
      this.dialog.value?.hide()
    } catch (e) {
      console.warn(e)
      this.alertMessage = e
      this.alert.value?.toast()
    }
    this.connectingWallet = undefined
  }

  async updateBalance() {
    const response = await fetch(
      `${import.meta.env.VITE_ORD_BASE_URL}/api/v1/brc20/address/${walletState.address}/balance`
    )
    const result = await response.json()
    const balance = result.data?.balance
    if (Array.isArray(balance)) this.ticks = balance.length
  }

  render() {
    return html`
      ${when(
        walletState.address,
        () => html`
          <sl-dropdown placement="bottom-end" @sl-show=${this.updateBalance.bind(this)}>
            <sl-button slot="trigger" caret pill>
              <p class="w-28 sm:w-auto truncate sm:text-clip">${walletState.address}</p>
            </sl-button>
            <sl-menu>
              <sl-menu-item .disabled=${this.ticks}>Ticks: ${this.ticks}</sl-menu-item>
              <sl-divider></sl-divider>
              <sl-menu-item @click=${this.disconnect.bind(this)}>
                <sl-icon slot="prefix" name="box-arrow-right"></sl-icon>
                Disconnect
              </sl-menu-item>
            </sl-menu>
          </sl-dropdown>
        `,
        () => html`
          <sl-button @click=${() => this.dialog.value?.show()}>Connect</sl-button>
          <sl-dialog label="Dialog" style="--width: xl;" ${ref(this.dialog)}>
            <span slot="label">Choose Wallet</span>
            <div class="space-y-2">
              ${map(
                WalletTypes,
                (type) =>
                  html`<sl-button
                    class="w-full"
                    .disabled=${this.connectingWallet}
                    .loading=${this.connectingWallet == type}
                    @click=${() => this.connect(type)}
                  >
                    <sl-icon slot="prefix" src="${type}.svg"></sl-icon>
                    ${WalletNames[type]}
                  </sl-button>`
              )}
            </div>
          </sl-dialog>
        `
      )}
      <sl-alert
        variant=${this.alertMessage instanceof Error ? 'danger' : 'warning'}
        duration="3000"
        closable
        ${ref(this.alert)}
      >
        <sl-icon
          slot="icon"
          name=${this.alertMessage instanceof Error ? 'exclamation-octagon' : 'info-circle'}
        ></sl-icon>
        ${this.alertMessage?.message ?? this.alertMessage}
      </sl-alert>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'connect-button': ConnectButton
  }
}
