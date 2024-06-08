import type { VercelRequest, VercelResponse } from '@vercel/node'
import * as bitcoin from 'bitcoinjs-lib'
import { LEAF_VERSION_TAPSCRIPT } from 'bitcoinjs-lib/src/payments/bip341.js'
import ecc from '@bitcoinerlab/secp256k1'
import { getSupplyP2tr, hdKey } from '../api_lib/depositAddress.js'
import { getJson } from '../api_lib/fetch.js'
import { scriptQuas } from '../api_lib/scripts.js'
// import { protocolBalance } from '../api_lib/protocolBalance.js'
import { parseUnits } from '@ethersproject/units'
import { minimumFee } from '../api_lib/minimumFee.js'

bitcoin.initEccLib(ecc)

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    const address = request.query['address'] as string
    if (!address) throw new Error('missing output address')
    const amt = parseUnits(request.query['amt'] as string, 8).toNumber()
    if (!amt) throw new Error('missing arg amt')
    const redeem = {
      output: scriptQuas(hdKey.derive(0).publicKey, hdKey.derive(1).publicKey, 'borrow'),
      redeemVersion: LEAF_VERSION_TAPSCRIPT
    }
    const p2tr = getSupplyP2tr(redeem)
    var value = 0
    const psbt = new bitcoin.Psbt({ network: bitcoin.networks.testnet })
    const utxos: [] = await fetch(`https://mempool.space/testnet/api/address/${p2tr.address}/utxo`)
      .then(getJson)
      .then((utxos) =>
        utxos
          .map((utxo: any) => {
            if (utxo.value < 1000 || value > amt) return
            value += utxo.value
            return {
              hash: Buffer.from(utxo.txid, 'hex').reverse(),
              index: utxo.vout,
              witnessUtxo: { value: utxo.value, script: p2tr.output! },
              tapLeafScript: [
                {
                  leafVersion: redeem.redeemVersion!,
                  script: redeem.output,
                  controlBlock: p2tr.witness![p2tr.witness!.length - 1]
                }
              ]
            }
          })
          .filter((utxo: any) => utxo != undefined)
      )
    if (value <= amt) throw new Error('Insufficient BTC to borrow')
    utxos.forEach((utxo: any) => psbt.addInput(utxo))
    if (psbt.inputCount == 0) throw new Error('No UTXO can be withdrawn')
    psbt.addOutput({ address, value: amt })
    psbt.addOutput({ address: p2tr.address!, value: value - amt })
    psbt.signAllInputs(hdKey.derive(0)).signAllInputs(hdKey.derive(1)).finalizeAllInputs()

    const newFee = await minimumFee(psbt)
    var finalPsbt = new bitcoin.Psbt({ network: bitcoin.networks.testnet })
    // finalPsbt.setMaximumFeeRate(fastestFee + 1)
    utxos.forEach((utxo: any) => finalPsbt.addInput(utxo))
    finalPsbt.addOutput({ address, value: amt - newFee })
    finalPsbt.addOutput({ address: p2tr.address!, value: value - amt })
    finalPsbt.signAllInputs(hdKey.derive(0)).signAllInputs(hdKey.derive(1)).finalizeAllInputs()

    var finalTx = finalPsbt.extractTransaction()

    await fetch('https://mempool.space/testnet/api/tx', {
      method: 'POST',
      body: finalTx.toHex()
    }).then((res) => {
      if (res.status == 200) {
        res.text().then((text) => {
          if (text.toLowerCase() != finalTx.getId().toLowerCase())
            console.error('tx hash mismatch, ours', finalTx.getId(), 'got', text)
          response.status(200).send({ tx: text })
        })
      } else {
        console.log(res.status)
        res.text().then((text) => {
          throw new Error(text)
        })
      }
    })
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
