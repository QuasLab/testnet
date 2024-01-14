import type { VercelRequest, VercelResponse } from '@vercel/node'
import * as bitcoin from 'bitcoinjs-lib'
import ecc from '@bitcoinerlab/secp256k1'
import { Taptree } from 'bitcoinjs-lib/src/types.js'
import { LEAF_VERSION_TAPSCRIPT } from 'bitcoinjs-lib/src/payments/bip341.js'
import { getDepositAddress, getDepositP2tr, hdKey } from '../api_lib/depositAddress.js'
import { scriptOrd, scriptQuas, toXOnly } from '../api_lib/scripts.js'

bitcoin.initEccLib(ecc)

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!process.env.BITCOIN_KEY) throw new Error('BITCOIN_KEY is not configured')

  try {
    const pubKey = request.query['pub'] as string
    if (!pubKey) throw new Error('missing arg pubKey')
    const address = request.query['address'] as string
    const tick = request.query['tick'] as string
    const amt = request.query['amt'] as string
    if (!address) throw new Error('missing arg address')
    if (!tick) throw new Error('missing arg tick')
    if (!amt) throw new Error('missing arg amt')

    // prepare inscribe address
    const txid = request.query['txid'] as string
    const brcJson = `{"p":"brc-20","op":"transfer","tick":"${tick}","amt":"${amt}"}`
    const inscribeScriptTree: Taptree = {
      output: scriptOrd(hdKey.publicKey, brcJson)
    }

    const inscribeRedeem = {
      output: inscribeScriptTree.output,
      redeemVersion: LEAF_VERSION_TAPSCRIPT
    }

    const inscribeP2tr = bitcoin.payments.p2tr({
      internalPubkey: Buffer.from(toXOnly(hdKey.publicKey)),
      scriptTree: inscribeScriptTree,
      redeem: inscribeRedeem,
      network: bitcoin.networks.testnet
    })

    if (!txid) response.status(200).send({ address: inscribeP2tr.address, data: brcJson })
    else {
      // reveal transaction
      var value = 546 + 153 + 221
      const revealPsbt = new bitcoin.Psbt({ network: bitcoin.networks.testnet })
      revealPsbt.addInput({
        hash: Buffer.from(txid, 'hex').reverse(),
        index: 0,
        witnessUtxo: { value: value, script: inscribeP2tr.output! },
        tapLeafScript: [
          {
            leafVersion: inscribeRedeem.redeemVersion!,
            script: inscribeRedeem.output,
            controlBlock: inscribeP2tr.witness![inscribeP2tr.witness!.length - 1]
          }
        ]
      })
      value -= 153
      revealPsbt.addOutput({ address: getDepositAddress(pubKey), value })
      const revealTx = revealPsbt.signAllInputs(hdKey).finalizeAllInputs().extractTransaction()
      await fetch('https://mempool.space/testnet/api/tx', {
        method: 'POST',
        body: revealTx.toHex()
      }).then((res) => {
        if (res.status == 200) {
          res.text().then((text) => {
            if (text.toLowerCase() != revealTx.getId().toLowerCase())
              console.error('tx hash mismatch, ours', revealTx.getId(), 'got', text)
          })
        } else {
          console.log(res.status)
          res.text().then((text) => {
            throw new Error(text)
          })
        }
      })
      // transfer transaction
      const mpcRedeem = {
        output: scriptQuas(hdKey.derive(0).publicKey, hdKey.derive(1).publicKey, 'withdraw'),
        redeemVersion: LEAF_VERSION_TAPSCRIPT
      }
      const mpcP2tr = getDepositP2tr(pubKey, mpcRedeem)
      const transferPsbt = new bitcoin.Psbt({ network: bitcoin.networks.testnet })
      transferPsbt.addInput({
        hash: revealTx.getHash(),
        index: 0,
        witnessUtxo: { value: value, script: mpcP2tr.output! },
        tapLeafScript: [
          {
            leafVersion: mpcRedeem.redeemVersion!,
            script: mpcRedeem.output,
            controlBlock: mpcP2tr.witness![mpcP2tr.witness!.length - 1]
          }
        ]
      })
      value -= 221
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
      response.status(200).send({ txs: [revealTx.getId(), transferTx.getId()] })
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
