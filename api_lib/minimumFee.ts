import * as bitcoin from 'bitcoinjs-lib'
import { mempool } from './mempool.js'

export async function minimumFee(psbt: bitcoin.Psbt): Promise<number> {
  const {
    bitcoin: { fees }
  } = mempool()

  const { fastestFee, minimumFee } = await fees.getFeesRecommended()

  return Math.max(300, minimumFee, psbt.extractTransaction(true).virtualSize() * fastestFee)
}
