import { State, property, storage } from '@lit-app/state'
import { Balance, Wallet, WalletType } from './wallets'
import { UniSat } from './wallets/unisat'
import { OKX } from './wallets/okx'
import { getJson } from '../../api_lib/fetch'

export { StateController, type Unsubscribe } from '@lit-app/state'

export type Brc20Balance = {
  tick: string
  decimals: number
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
  private promises: Record<string, Promise<any>> = {}

  // ---- address ----
  @property({ skipReset: true }) private _address?: string
  public get address(): string | undefined {
    if (!this._address) this.updateAddress()
    return this._address
  }
  public async getAddress() {
    return this._address ?? this.updateAddress()
  }

  public async updateAddress(): Promise<string> {
    return (this.promises['address'] ??= this.getConnector()
      .then((connector) => connector.accounts)
      .then((accounts) => (this._address = accounts[0]))
      .finally(() => delete this.promises['address']))
  }

  protected onAccountChanged = (accounts: string[]) => {
    this.reset(false)
    if (accounts) this._address = accounts[0]
  }

  // ---- public key ----
  @property() private _publicKey?: string
  public get publicKey(): string | undefined {
    if (this._publicKey) return this._publicKey
    this.updatePublicKey()
  }
  public async getPublicKey() {
    return this._publicKey ?? this.updatePublicKey()
  }

  public async updatePublicKey() {
    return (this.promises['publicKey'] ??= this.getConnector()
      .then((connector) => connector.publicKey)
      .then((pubKey) => (this._publicKey = pubKey))
      .finally(() => delete this.promises['publicKey']))
  }

  // ---- deposit address ----
  @property() private _depositaddress?: string
  public get depositaddress(): string | undefined {
    if (this._depositaddress) return this._depositaddress
    this.updateDepositAddress()
  }
  public async getDepositAddress() {
    return this._depositaddress ?? this.updateDepositAddress()
  }

  public async updateDepositAddress() {
    return (this.promises['depositAddress'] ??= fetch(`/api/depositAddress`)
      .then(getJson)
      .then((js) => js.address)
      .finally(() => delete this.promises['depositAddress']))
  }

  // ---- brc20 deposit address ----
  @property() private _depositBrc20address?: string
  public get depositBrc20address(): string | undefined {
    if (this._depositBrc20address) return this._depositBrc20address
    this.updateDepositBrc20Address()
  }
  public async getDepositBrc20Address() {
    return this._depositBrc20address ?? this.updateDepositBrc20Address()
  }

  public async updateDepositBrc20Address() {
    return (this.promises['depositBrc20Address'] ??= this.getPublicKey()
      .then((publicKey) => fetch(`/api/depositBrc20Address?pub=${publicKey}`))
      .then(getJson)
      .then((js) => js.address)
      .finally(() => delete this.promises['depositBrc20Address']))
  }

  // ---- balance ----
  @property({ type: Object }) private _balance?: Balance
  public get balance(): Balance | undefined {
    if (this._balance) return this._balance
    this.updateBalance()
  }

  public async getBalance() {
    return this._balance ?? this.updateBalance()
  }

  public async updateBalance(): Promise<Balance> {
    return (this.promises['balance'] ??= this.getConnector()
      .then((connector) => connector.balance)
      .then((balance) => (this._balance = balance))
      .finally(() => delete this.promises['balance']))
  }

  // ---- brc20 balances ----
  @property({ type: Array }) private _brc20Balance?: Brc20Balance[]
  public get brc20Balance(): Brc20Balance[] | undefined {
    if (this._brc20Balance) return this._brc20Balance
    this.updateBrc20Balance()
  }
  public async getBrc20Balance() {
    return this._brc20Balance ?? this.updateBrc20Balance()
  }

  public async updateBrc20Balance(): Promise<Brc20Balance[]> {
    return (this.promises['brc20Balance'] ??= this.getAddress()
      .then((address) => fetch(`${import.meta.env.VITE_ORD_BASE_URL}/api/v1/brc20/address/${address}/balance`))
      .then((res) => res.json())
      .then(
        (res) =>
          (this._brc20Balance = res.data.balance.map((b: any) => {
            return { decimals: 18, ...b }
          }))
      )
      .finally(() => delete this.promises['brc20Balance']))
  }

  // ---- protocol balance ----
  @property({ type: Object }) private _protocolBalance?: Balance
  public get protocolBalance(): Balance | undefined {
    if (this._protocolBalance) return this._protocolBalance
    this.updateProtocolBalance()
  }

  public async getProtocolBalance() {
    return this._protocolBalance ?? this.updateProtocolBalance()
  }

  public async updateProtocolBalance(): Promise<Balance> {
    return (this.promises['protocolBalance'] ??= this.getAddress()
      .then((address) => fetch(`/api/protocolBalance?address=${address}`))
      .then(getJson)
      .then((balance) => (this._protocolBalance = balance))
      .finally(() => delete this.promises['protocolBalance']))
  }

  // ---- collateral balance ----
  @property({ type: Object }) private _collateralBalance?: Brc20Balance[]
  public get collateralBalance(): Brc20Balance[] | undefined {
    if (this._collateralBalance) return this._collateralBalance
    this.updateCollateralBalance()
  }

  public async getCollateralBalance() {
    return this._collateralBalance ?? this.updateCollateralBalance()
  }

  public async updateCollateralBalance(): Promise<Brc20Balance[]> {
    return (this.promises['collateralBalance'] ??= this.getDepositBrc20Address()
      .then((address) => fetch(`${import.meta.env.VITE_ORD_BASE_URL}/api/v1/brc20/address/${address}/balance`))
      .then((res) => res.json())
      .then((res) => res.data.balance)
      .then((balances) => (this._collateralBalance = balances))
      .finally(() => delete this.promises['collateralBalance']))
  }

  // --- wallet connector ----
  private _connector?: Wallet
  get connector(): Wallet | undefined {
    if (!this._connector && this.wallet) this.useWallet(this.wallet)

    return this._connector
  }
  /** Get an available connector, will wait until one is ready */
  public async getConnector(): Promise<Wallet> {
    return (
      this.connector ??
      (this.promises['connector'] ??= new Promise<Wallet>((resolve) => {
        this.subscribe((_, v) => {
          if (v) {
            resolve(v)
            delete this.promises['connector']
          }
        }, '_connector')
      }))
    )
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

  reset(resetConnectorAndAddress = true): void {
    super.reset()
    ;[...this.propertyMap]
      // @ts-ignore
      .filter(([key, definition]) => definition.skipReset !== true && definition.resetValue === undefined)
      .forEach(([key, definition]) => {
        ;(this as {} as { [key: string]: unknown })[key as string] = definition.resetValue
      })
    this.promises = {}
    if (resetConnectorAndAddress) {
      this._connector?.removeListener('accountsChanged', this.onAccountChanged)
      this._connector = undefined
      this._address = undefined
    }
  }
}

export const walletState = new WalletState()
