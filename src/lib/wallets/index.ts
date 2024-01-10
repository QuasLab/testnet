export interface Wallet {
  installed: boolean
  network: Promise<Network>
  switchNetwork(network: Network): Promise<void>
  accounts: Promise<string[]>
  requestAccounts(): Promise<string[]>
  publicKey: Promise<string>
  balance: Promise<Balance>
  on(event: WalletEvent, handler: (accounts: Array<string>) => void): void
  removeListener(event: WalletEvent, handler: (accounts: Array<string>) => void): void
  sendBitcoin(toAddress: string, satoshis: number, options?: { feeRate: number }): Promise<string>
}

export type Balance = {
  confirmed: number
  unconfirmed: number
  total: number
}

export const WalletEvents = ['accountsChanged', 'networkChanged'] as const
export type WalletEvent = (typeof WalletEvents)[number]

export const Networks = ['testnet', 'livenet'] as const
export type Network = (typeof Networks)[number]

export const WalletTypes = ['unisat', 'okx'] as const
export type WalletType = (typeof WalletTypes)[number]

export const WalletNames: Record<WalletType, string> = {
  unisat: 'UniSat',
  okx: 'OKX'
} as const
