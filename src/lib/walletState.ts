import { State, property, storage } from '@lit-app/state'
import { Balance, Brc20Balance, Wallet, WalletType } from './wallets'
import { UniSat } from './wallets/unisat'
import { OKX } from './wallets/okx'

export { StateController, type Unsubscribe } from '@lit-app/state'

class WalletState extends State {
  @storage({ key: 'wallet' }) @property() wallet?: WalletType

  @property() private _address?: string
  public get address(): string | undefined {
    if (!this._address) this.updateAddress()
    return this._address
  }
  public async getAddress() {
    return this._address ?? this.updateAddress()
  }

  private _addressPromise?: Promise<string>
  public async updateAddress() {
    return (this._addressPromise ??= this.getConnector().then((connector) =>
      connector.accounts
        .then((accounts) => (this._address = accounts[0]))
        .finally(() => (this._addressPromise = undefined))
    ))
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
  private _balancePromise?: Promise<Balance>
  public get balance(): Balance | undefined {
    if (!this._balance && !this._balancePromise && this.connector)
      this._balancePromise = this.connector.balance
        .then((balance) => (this._balance = balance))
        .finally(() => (this._balancePromise = undefined))
    return this._balance
  }

  @property({ type: Array }) private _brc20Balance?: Brc20Balance[]
  public get brc20Balance(): Brc20Balance[] | undefined {
    if (this._brc20Balance) return this._brc20Balance
    this.updateBrc20Balance()
  }
  public async getBrc20Balance() {
    return this._brc20Balance ?? this.updateBrc20Balance()
  }

  private _brc20BalancePromise?: any
  public async updateBrc20Balance(): Promise<Brc20Balance[]> {
    return (this._brc20BalancePromise ??= walletState
      .getAddress()
      .then((address) => fetch(`${import.meta.env.VITE_ORD_BASE_URL}/api/v1/brc20/address/${address}/balance`))
      .then((res) => res.json())
      .then((res) => res.data.balance)
      .then((balances) => (this._brc20Balance = balances))
      .catch((e) => console.log(`failed to fetch brc20 balance for ${walletState.address}, error:`, e))
      .finally(() => (this._brc20BalancePromise = undefined)))
  }

  @property({ type: Object }) private _protocolBalance?: any[]
  private _protocolBalancePromise?: any
  public get protocolBalance(): any[] | undefined {
    if (!this._protocolBalance && !this._protocolBalancePromise) {
      this._protocolBalancePromise = walletState.connector?.publicKey
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
  get connector(): Wallet | undefined {
    if (!this._connector && this.wallet) this.useWallet(this.wallet)
    return this._connector
  }
  private _connectorPromise?: Promise<Wallet>
  /** Get an available connector, will wait until one is ready */
  public async getConnector(): Promise<Wallet> {
    if (this.connector) return this.connector
    return (this._connectorPromise ??= new Promise<Wallet>((resolve) => {
      this.subscribe((_, v) => {
        v && resolve(v)
      }, '_connector')
    }))
  }

  protected onAccountChanged = (accounts: string[]) => {
    if (accounts) {
      this._address = accounts[0]
      this._balance = undefined
      this._brc20Balance = undefined
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
    this._connector.on('accountsChanged', this.onAccountChanged)
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
