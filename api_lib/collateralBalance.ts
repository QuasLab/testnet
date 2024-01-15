import { Balance } from './types.js'
import { getSupplyP2tr } from './depositAddress.js'

import mempoolJS from '@mempool/mempool.js'
import { MempoolReturn } from '@mempool/mempool.js/lib/interfaces/index.js'
import { Tx } from '@mempool/mempool.js/lib/interfaces/bitcoin/transactions.js'
import { makeBitcoinAPI } from '@mempool/mempool.js/lib/services/api/index.js'
import { script } from 'bitcoinjs-lib'

function parseTxs(txs: Tx[], address: string, protocolAddress: string): number {
  var value = 0
  txs.forEach((tx) => {
    if (tx.vout[0].scriptpubkey_address == address) {
      //withdraw
      var sumIn = 0
      tx.vin?.forEach((vin) => {
        const witness = (vin as any).witness
        if (vin.prevout.scriptpubkey_address == protocolAddress && Array.isArray(witness) && witness.length == 4) {
          const p2trScript = script.decompile(Buffer.from(witness[2], 'hex'))
          if (p2trScript?.length == 12 && p2trScript[10].toString() == '{"p":"quas","op":"withdraw"}') {
            sumIn += vin.prevout.value
          }
        }
      })
      tx.vout.forEach((vout) => {
        if (vout.scriptpubkey_address == protocolAddress) {
          sumIn -= vout.value
        }
      })
      // console.log(tx.txid, 'withdraw', sumIn)
      value -= sumIn
    } else if (tx.vin[0].prevout.scriptpubkey_address == address) {
      // deposit
      var sumOut = 0
      tx.vout.forEach((vout) => {
        if (vout.scriptpubkey_address == protocolAddress) sumOut += vout.value
      })
      // console.log(tx.txid, 'deposit', sumOut)
      value += Math.min(sumOut)
    }
  })
  // console.log(value)
  return value
}

export async function collateralBalance(address: string): Promise<Balance> {
  const {
    bitcoin: { addresses }
  } = mempoolJS({ hostname: 'mempool.space', network: 'testnet' }) as MempoolReturn
  const { api } = makeBitcoinAPI({ hostname: 'mempool.space', network: 'testnet' })

  const protocolAddress = getSupplyP2tr().address!

  const txs = await addresses.getAddressTxsMempool({ address: protocolAddress })
  const unconfirmed = parseTxs(txs, address as string, protocolAddress)
  var confirmed = 0,
    lastTxid = ''
  while (true) {
    const { data: txs } = await api.get<Tx[]>(`/address/${protocolAddress}/txs/chain${lastTxid ? '/' + lastTxid : ''}`)
    if (txs.length == 0) break
    lastTxid = txs[txs.length - 1].txid as string
    // console.log(txs.length, lastTxid)
    confirmed += parseTxs(txs, address as string, protocolAddress)
  }
  const balance: Balance = { unconfirmed, confirmed, total: unconfirmed + confirmed }
  // console.log(balance)
  return balance
}
