import { BaseWallet } from './base'

export class UniSat extends BaseWallet {
  protected get instance() {
    return (window as any).unisat
  }
  sendInscription(toAddress: string, inscriptionId: string, options?: { feeRate: number }): Promise<string> {
    return this.instance.sendInscription(toAddress, inscriptionId, options).then((ret: any) => ret.txid)
  }
}
