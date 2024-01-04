import { State, property, storage } from '@lit-app/state'

class WalletState extends State {
  @storage({ key: 'wallet' }) @property() wallet?: string
  @property() address?: string
  @property() publicKey?: string
  get balance(): Promise<{
    confirmed: number
    unconfirmed: number
    total: number
  }> {
    if (this.wallet == 'unisat') return unisat.getBalance()
  }
}

export const walletState = new WalletState()
