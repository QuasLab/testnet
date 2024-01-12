import { Inscription, Network, SignPsbtOptions, Wallet, WalletEvent } from '.'

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

  getInscriptions(cursor?: number, size?: number): Promise<{ total: number; list: Inscription[] }> {
    return this.instance.getInscriptions(cursor, size)
  }

  sendInscription(toAddress: string, inscriptionId: string, options?: { feeRate: number }): Promise<string> {
    return this.instance.sendInscription(toAddress, inscriptionId, options)
  }

  signPsbt(psbtHex: string, options?: SignPsbtOptions): Promise<string> {
    return this.instance.signPsbt(psbtHex, options)
  }

  signPsbts(psbtHexs: string[], options?: SignPsbtOptions): Promise<string[]> {
    return this.instance.signPsbts(psbtHexs, options)
  }

  pushPsbt(psbtHex: string): Promise<string> {
    return this.instance.pushPsbt(psbtHex)
  }
}
