import { LitElement, html, unsafeCSS } from 'lit'
import { customElement, state } from 'lit/decorators.js'
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
import { Ref, createRef, ref } from 'lit/directives/ref.js'
import { walletState } from '../state/wallet'
import { when } from 'lit/directives/when.js'
import { getAddressInfo } from 'bitcoin-address-validation'

@customElement('connect-button')
export class ConnectButton extends LitElement {
  static styles = [unsafeCSS(style)]
  @state() dialog = createRef<SlDialog>()
  @state() alert = createRef<SlAlert>()
  @state() alertMessage: any
  @state() connectingWallet = ''
  @state() address = ''
  @state() ticks: any

  connectedCallback(): void {
    super.connectedCallback()
    switch (walletState.wallet) {
      case 'okx':
        this.connectOkx()
        break
      case 'unisat':
        this.connectUniSat()
        break
    }
  }

  connect() {
    this.dialog.value?.show()
  }

  disconnect() {
    walletState.reset()
    walletState.wallet = ''
    this.address = ''
  }

  async connectUniSat() {
    if (typeof unisat === 'undefined') {
      this.alertMessage = 'Wallet is not installed.'
      this.alert.value?.toast()
      return
    }
    this.connectingWallet = 'unisat'
    try {
      const res = await unisat.getNetwork()
      if (res != 'testnet') await unisat.switchNetwork('testnet')
    } catch (e) {
      console.warn(e)
      this.alertMessage = 'Failed to swith to testnet'
      this.alert.value?.toast()
    }
    try {
      let result = await unisat.getAccounts()
      if (!Array.isArray(result) || result.length == 0) result = await unisat.requestAccounts()
      const info = getAddressInfo(result[0])
      if (info.network != 'testnet') {
        throw new Error(`${result.address} is not a testnet address`)
      }
      walletState.wallet = 'unisat'
      this.address = walletState.address = result[0]
      // walletState.publicKey = result.publicKey
      this.dialog.value?.hide()
    } catch (e) {
      console.warn(e)
      this.alertMessage = e
      this.alert.value?.toast()
    }
    this.connectingWallet = ''
  }

  async connectOkx() {
    if (typeof okxwallet === 'undefined') {
      this.alertMessage = 'Wallet is not installed.'
      this.alert.value?.toast()
      return
    }
    this.connectingWallet = 'okx'
    try {
      const result = await okxwallet.bitcoin.connect()
      const info = getAddressInfo(result.address)
      if (info.network != 'testnet') {
        throw new Error(`${result.address} is not a testnet address`)
      }
      walletState.wallet = 'okx'
      this.address = walletState.address = result.address
      walletState.publicKey = result.publicKey
      this.dialog.value?.hide()
    } catch (e) {
      console.warn(e)
      this.alertMessage = e
      this.alert.value?.toast()
    }
    this.connectingWallet = ''
  }

  async updateBalance() {
    const response = await fetch(`https://ord.testnet.fans3.org/api/v1/brc20/address/${this.address}/balance`)
    const result = await response.json()
    const balance = result.data?.balance
    if (Array.isArray(balance)) this.ticks = balance.length
  }

  render() {
    return html`
      ${when(
        this.address,
        () => html`
          <sl-dropdown placement="bottom-end" @sl-show=${this.updateBalance.bind(this)}>
            <sl-button slot="trigger" caret pill>${this.address}</sl-button>
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
          <sl-button @click=${this.connect.bind(this)}>Connect</sl-button>
          <sl-dialog label="Dialog" style="--width: xl;" ${ref(this.dialog)}>
            <span slot="label">Choose Wallet</span>
            <div class="space-y-2">
              <sl-button
                class="w-full"
                .disabled=${this.connectingWallet}
                .loading=${this.connectingWallet == 'unisat'}
                @click=${this.connectUniSat.bind(this)}
              >
                <sl-icon slot="prefix" src="unisat.svg"></sl-icon>
                UniSat
              </sl-button>
              <sl-button
                class="w-full"
                .disabled=${this.connectingWallet}
                .loading=${this.connectingWallet == 'okx'}
                @click=${this.connectOkx.bind(this)}
              >
                <sl-icon slot="prefix" src="okx.svg"></sl-icon>
                OKX
              </sl-button>
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
