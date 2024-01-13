import { BaseWallet } from './base'

export class UniSat extends BaseWallet {
  protected get instance() {
    return (window as any).unisat
  }
}
