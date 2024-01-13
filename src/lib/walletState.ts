import { State, property, storage } from '@lit-app/state'
import { Balance, Wallet, WalletType } from './wallets'
import { UniSat } from './wallets/unisat'
import { OKX } from './wallets/okx'
import { getJson } from '../../api_lib/fetch'

export { StateController, type Unsubscribe } from '@lit-app/state'

export type Brc20Balance = {
  tick: string
  availableBalance: string
  transferableBalance: string
  overallBalance: string
}

export type UTXO = {
  txid: string
  vout: number
  status: {
    confirmed: boolean
    block_height: number
    block_hash: string
    block_time: number
  }
  value: number
}

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
    return (this._addressPromise ??= this.getConnector()
      .then((connector) => connector.accounts)
      .then((accounts) => (this._address = accounts[0]))
      .finally(() => (this._addressPromise = undefined)))
  }

  @property() private _publicKey?: string
  public get publicKey(): string | undefined {
    if (this._publicKey) return this._publicKey
    this.updatePublicKey()
  }
  public async getPublicKey() {
    return this._publicKey ?? this.updatePublicKey()
  }

  private _publicKeyPromise?: Promise<string>
  public async updatePublicKey() {
    return (this._publicKeyPromise ??= this.getConnector()
      .then((connector) => connector.publicKey)
      .then((pubKey) => (this._publicKey = pubKey))
      .finally(() => (this._publicKeyPromise = undefined)))
  }

  @property() private _depositaddress?: string
  public get depositaddress(): string | undefined {
    if (this._depositaddress) return this._depositaddress
    this.updateDepositAddress()
  }
  public async getDepositAddress() {
    return this._depositaddress ?? this.updateDepositAddress()
  }

  private _depositaddressPromise?: Promise<string>
  public async updateDepositAddress() {
    return (this._depositaddressPromise ??= this.getPublicKey()
      .then((publicKey) => fetch(`/api/depositAddress?pub=${publicKey}`))
      .then(getJson)
      .then((js) => js.address)
      .finally(() => (this._depositaddressPromise = undefined)))
  }

  @property({ type: Object }) private _balance?: Balance
  private _balancePromise?: Promise<Balance>
  public get balance(): Balance | undefined {
    if (!this._balance && !this._balancePromise)
      this._balancePromise = this.getConnector()
        .then((connector) => connector.balance)
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
    return (this._brc20BalancePromise ??= this.getAddress()
      .then((address) => fetch(`${import.meta.env.VITE_ORD_BASE_URL}/api/v1/brc20/address/${address}/balance`))
      .then((res) => res.json())
      .then((res) => res.data.balance)
      .then((balances) => (this._brc20Balance = balances))
      .catch((e) => console.log(`failed to fetch brc20 balance for ${walletState.address}, error:`, e))
      .finally(() => (this._brc20BalancePromise = undefined)))
  }

  @property({ type: Object }) private _protocolBalance?: UTXO[]
  private _protocolBalancePromise?: any
  public get protocolBalance(): UTXO[] | undefined {
    if (!this._protocolBalance && !this._protocolBalancePromise) {
      this._protocolBalancePromise = this.getDepositAddress()
        .then((address) => fetch(`https://mempool.space/testnet/api/address/${address}/utxo`))
        .then(getJson)
        .then((utxos: Array<UTXO>) => (this._protocolBalance = utxos.filter((item) => item.value >= 1000)))
        .finally(() => (this._protocolBalancePromise = undefined))
    }
    return this._protocolBalance
  }

  @property({ type: Object }) private _collateralBalance?: Brc20Balance[]
  public get collateralBalance(): Brc20Balance[] | undefined {
    if (this._collateralBalance) return this._collateralBalance
    this.updateCollateralBalance()
  }

  public async getCollateraBalance() {
    return this._collateralBalance ?? this.updateCollateralBalance()
  }

  private _collateralBalancePromise?: any
  public async updateCollateralBalance(): Promise<Brc20Balance[]> {
    return (this._collateralBalancePromise ??= this.getDepositAddress()
      .then((address) => fetch(`${import.meta.env.VITE_ORD_BASE_URL}/api/v1/brc20/address/${address}/balance`))
      .then((res) => res.json())
      .then((res) => res.data.balance)
      .then((balances) => (this._collateralBalance = balances))
      .catch((e) => console.log(`failed to fetch brc20 balance for ${walletState.depositaddress}, error:`, e))
      .finally(() => (this._collateralBalancePromise = undefined)))
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
    return (
      this.connector ??
      (this._connectorPromise ??= new Promise<Wallet>((resolve) => {
        this.subscribe((_, v) => {
          if (v) {
            resolve(v)
            this._connectorPromise = undefined
          }
        }, '_connector')
      }))
    )
  }

  protected onAccountChanged = (accounts: string[]) => {
    this.reset(true)
    if (accounts) this._address = accounts[0]
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

  reset(skipConnector = false): void {
    super.reset()
    ;[...this.propertyMap]
      // @ts-ignore
      .filter(([key, definition]) => definition.skipReset !== true && definition.resetValue === undefined)
      .forEach(([key, definition]) => {
        ;(this as {} as { [key: string]: unknown })[key as string] = definition.resetValue
      })
    if (skipConnector) return
    this._connector?.removeListener('accountsChanged', this.onAccountChanged)
    this._connector = undefined
  }
}

export const walletState = new WalletState()
