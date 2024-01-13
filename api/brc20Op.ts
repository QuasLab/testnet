import type { VercelRequest, VercelResponse } from '@vercel/node'
import * as bitcoin from 'bitcoinjs-lib'
import * as btc from '@scure/btc-signer'
import ecc from '@bitcoinerlab/secp256k1'
import { Taptree } from 'bitcoinjs-lib/src/types.js'
import { LEAF_VERSION_TAPSCRIPT } from 'bitcoinjs-lib/src/payments/bip341.js'

bitcoin.initEccLib(ecc)

const toXOnly = (pubKey: any) => (pubKey.length === 32 ? pubKey : pubKey.slice(1, 33))

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!process.env.BITCOIN_KEY) throw new Error('BITCOIN_KEY is not configured')

  try {
    const op = request.query['op'] as string
    if (!['mint', 'transfer'].includes(op)) throw new Error('op can only be mint or transfer')
    const pubKey = request.query['pub'] as string
    const address = request.query['address'] as string
    const tick = request.query['tick'] as string
    const amt = request.query['amt'] as string
    if (!pubKey) throw new Error('missing public key')
    if (!address) throw new Error('missing output address')
    if (!tick) throw new Error('missing brc-20 tick')
    if (!amt) throw new Error('missing brc-20 amt')

    const txid = request.query['txid'] as string
    const brcJson = `{"p":"brc-20","op":"${op}","tick":"${tick}","amt":"${amt}"}`
    const scriptTree: Taptree = {
      output: Buffer.from(
        btc.Script.encode([
          toXOnly(Buffer.from(pubKey, 'hex')),
          'CHECKSIG',
          'OP_0',
          'IF',
          Buffer.from('ord'),
          Buffer.from('01', 'hex'),
          Buffer.from('text/plain;charset=utf-8'),
          'OP_0',
          Buffer.from(brcJson),
          'ENDIF'
        ])
      )
    }

    const redeem = {
      output: scriptTree.output,
      redeemVersion: LEAF_VERSION_TAPSCRIPT
    }

    const p2tr = bitcoin.payments.p2tr({
      internalPubkey: toXOnly(Buffer.from(pubKey, 'hex')),
      scriptTree,
      redeem,
      network: bitcoin.networks.testnet
    })

    if (txid) {
      var value = 699
      const psbt = new bitcoin.Psbt({ network: bitcoin.networks.testnet })
      psbt.addInput({
        hash: Buffer.from(txid, 'hex').reverse(),
        index: 0,
        witnessUtxo: { value: value, script: p2tr.output! },
        tapLeafScript: [
          {
            leafVersion: redeem.redeemVersion!,
            script: redeem.output,
            controlBlock: p2tr.witness![p2tr.witness!.length - 1]
          }
        ]
      })
      psbt.addOutput({ address, value: value - 153 })
      console.log(psbt.toHex())
      response.status(200).send({ psbt: psbt.toHex() })
    } else response.status(200).send({ address: p2tr.address, data: brcJson })
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
