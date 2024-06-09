import type { VercelRequest, VercelResponse } from '@vercel/node'
import * as bitcoin from 'bitcoinjs-lib'
import ecc from '@bitcoinerlab/secp256k1'
import { LEAF_VERSION_TAPSCRIPT } from 'bitcoinjs-lib/src/payments/bip341.js'
import { getBrc20SupplyP2tr, hdKey } from '../api_lib/depositAddress.js'
import { scriptQuas } from '../api_lib/scripts.js'
import { mempool } from '../api_lib/mempool.js'
import { prepareMPCTransferInscription } from '../api_lib/inscribe.js'

bitcoin.initEccLib(ecc)

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    const pubKey = request.query['pub'] as string
    if (!pubKey) throw new Error('missing arg pubKey')
    const address = request.query['address'] as string
    if (!address) throw new Error('missing arg address')

    const txid = request.query['txid'] as string

    const mpcRedeem = {
      output: scriptQuas(hdKey.derive(0).publicKey, hdKey.derive(1).publicKey, 'withdraw'),
      redeemVersion: LEAF_VERSION_TAPSCRIPT
    }
    const mpcP2tr = getBrc20SupplyP2tr(pubKey, mpcRedeem)

    if (!txid) {
      const feeRates = await mempool().bitcoin.fees.getFeesRecommended()

      const { fee: transferFee } = prepareMPCTransferInscription('withdraw', address, pubKey, feeRates)
      response.status(200).send({
        address: mpcP2tr.address,
        transferFee: transferFee.toString()
      })
    } else {
      const transferFee = Number(request.query['transferFee'] as string)

      var value = 600 + transferFee
      // transfer transaction
      const transferPsbt = new bitcoin.Psbt({ network: bitcoin.networks.testnet })
      transferPsbt.addInput({
        hash: Buffer.from(txid, 'hex').reverse(),
        index: 0,
        witnessUtxo: { value, script: mpcP2tr.output! },
        tapLeafScript: [
          {
            leafVersion: mpcRedeem.redeemVersion!,
            script: mpcRedeem.output,
            controlBlock: mpcP2tr.witness![mpcP2tr.witness!.length - 1]
          }
        ]
      })
      value -= transferFee
      transferPsbt.addOutput({ address, value })
      const transferTx = transferPsbt
        .signAllInputs(hdKey.derive(0))
        .signAllInputs(hdKey.derive(1))
        .finalizeAllInputs()
        .extractTransaction()
      await fetch('https://mempool.space/testnet/api/tx', {
        method: 'POST',
        body: transferTx.toHex()
      }).then((res) => {
        if (res.status == 200) {
          res.text().then((text) => {
            if (text.toLowerCase() != transferTx.getId().toLowerCase())
              console.error('tx hash mismatch, ours', transferTx.getId(), 'got', text)
          })
        } else {
          console.log(res.status)
          res.text().then((text) => {
            throw new Error(text)
          })
        }
      })
      response.status(200).send({ txs: [transferTx.getId()] })
    }
  } catch (err) {
    if (err instanceof Error) {
      console.log(err)
      response.status(400).send(err.message)
    } else {
      console.error(err)
      response.status(500).send('unknown error')
    }
    return
  }
}
