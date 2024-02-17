import { BaseWallet } from './base'

export class OKX extends BaseWallet {
  protected get instance() {
    return (window as any).okxwallet?.bitcoinTestnet
  }
}
