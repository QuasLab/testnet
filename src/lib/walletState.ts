import { State, property, storage } from '@lit-app/state'
import { Balance, Wallet, WalletType } from './wallets'
import { UniSat } from './wallets/unisat'
import { OKX } from './wallets/okx'

export { StateController } from '@lit-app/state'

class WalletState extends State {
  @storage({ key: 'wallet' }) @property() wallet?: WalletType

  @property() private _address?: string
  private _addressPromise?: any
  public get address(): string | undefined {
    if (!this._address && !this._addressPromise) {
      if (this.connector.installed)
        this._addressPromise = this.connector?.accounts
          .then((accounts) => {
            this._address = accounts[0]
          })
          .finally(() => (this._addressPromise = undefined))
    }
    return this._address
  }

  @property() private _publicKey?: string
  private _publicKeyPromise?: any
  public get publicKey(): string | undefined {
    if (!this._publicKey && !this._publicKeyPromise) {
      this._publicKeyPromise = this.connector?.publicKey
        .then((pubKey) => {
          this._publicKey = pubKey
        })
        .finally(() => (this._publicKeyPromise = undefined))
    }
    return this._publicKey
  }

  @property({ type: Object }) private _balance?: Balance
  private _balancePromise?: any
  public get balance(): Balance | undefined {
    if (!this._balance && !this._balancePromise) {
      this._balancePromise = this.connector?.balance
        .then((balance) => {
          this._balance = balance
        })
        .finally(() => (this._balancePromise = undefined))
    }
    return this._balance
  }

  @property({ type: Object }) private _protocolBalance?: any[]
  private _protocolBalancePromise?: any
  public get protocolBalance(): any[] | undefined {
    if (!this._protocolBalance && !this._protocolBalancePromise) {
      this._protocolBalancePromise = walletState.connector.publicKey
        .then((publicKey) => fetch(`/api/depositAddress?pub=${publicKey}`))
        .then((res) => {
          if (res.status != 200)
            return res.json().then((json) => {
              throw new Error(json.message)
            })
          return res.json()
        })
        .then((js) => js.address)
        .then((address) => fetch(`https://mempool.space/testnet/api/address/${address}/utxo`))
        .then((res) => {
          if (res.status != 200)
            return res.text().then((text) => {
              throw new Error(text)
            })
          return res.json()
        })
        .then((utxos) => (this._protocolBalance = utxos))
        .finally(() => (this._protocolBalancePromise = undefined))
    }
    return this._protocolBalance
  }

  // @property({ type: Object }) private _collateralBalance?: any[]
  @property({ value: 0 }) _collateralBalance = 0
  // private _collateralBalancePromise?: any
  public get collateralBalance(): number {
    return this._collateralBalance
  }

  // @property({ type: Object }) private _collateralBalance?: any[]
  @property({ value: 0 }) _borrowedBalance = 0
  // private _borrowedBalancePromise?: any
  public get borrowedBalance(): number {
    return this._borrowedBalance
  }

  private _connector?: Wallet
  get connector(): Wallet {
    if (!this._connector && this.wallet) this.useWallet(this.wallet)
    return this._connector!
  }

  protected onAccountChanged = (accounts: string[]) => {
    if (accounts) {
      this._address = accounts[0]
      this._balance = undefined
      this._protocolBalance = undefined
      this._collateralBalance = 0
      this._borrowedBalance = 0
      this._publicKey
    } else this.reset()
  }

  useWallet(type: WalletType) {
    this.reset()
    switch (type) {
      case 'unisat':
        this._connector = new UniSat()
        break
      case 'okx':
        this._connector = new OKX()
        break
      default:
        throw new Error(`unsupported wallet type: ${type}`)
    }
    this.connector?.on('accountsChanged', this.onAccountChanged)
  }

  reset(): void {
    super.reset()
    ;[...this.propertyMap]
      // @ts-ignore
      .filter(([key, definition]) => definition.skipReset !== true && definition.resetValue === undefined)
      .forEach(([key, definition]) => {
        ;(this as {} as { [key: string]: unknown })[key as string] = definition.resetValue
      })
    this._connector?.removeListener('accountsChanged', this.onAccountChanged)
    this._connector = undefined
  }
}

export const walletState = new WalletState()
