import { Network, Wallet, WalletEvent } from '.'

export abstract class BaseWallet implements Wallet {
  protected get instance(): any {
    return undefined
  }

  get installed() {
    return typeof this.instance !== 'undefined'
  }

  get network() {
    return this.instance.getNetwork()
  }

  switchNetwork(network: Network): Promise<void> {
    return this.instance.switchNetwork(network)
  }

  get accounts() {
    return this.instance.getAccounts()
  }

  requestAccounts() {
    return this.instance.requestAccounts()
  }

  get publicKey() {
    return this.instance.getPublicKey()
  }

  get balance() {
    return Promise.resolve({
      confirmed: Math.floor(Math.random() * 1e8),
      unconfirmed: Math.floor(Math.random() * 1e8),
      total: Math.floor(Math.random() * 1e8)
    })
    return this.instance.getBalance()
  }

  on(event: WalletEvent, handler: (accounts: Array<string>) => void) {
    this.instance.on(event, handler)
  }

  removeListener(event: WalletEvent, handler: (accounts: Array<string>) => void) {
    this.instance.removeListener(event, handler)
  }

  sendBitcoin(toAddress: string, satoshis: number, options?: { feeRate: number }): Promise<string> {
    return this.instance.sendBitcoin(toAddress, satoshis, options)
  }
}
