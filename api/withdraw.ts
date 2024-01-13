import type { VercelRequest, VercelResponse } from '@vercel/node'
import { schnorr, secp256k1 } from '@noble/curves/secp256k1'
import * as bitcoin from 'bitcoinjs-lib'
import * as btc from '@scure/btc-signer'
import { LEAF_VERSION_TAPSCRIPT } from 'bitcoinjs-lib/src/payments/bip341.js'
import * as ecc from 'tiny-secp256k1'
import { BIP32Factory } from 'bip32'
import { getScriptTree, hdKey } from '../api_lib/scriptTree.js'
import { getJson } from '../api_lib/fetch.js'

bitcoin.initEccLib(ecc)
const bip32 = BIP32Factory(ecc)

const toXOnly = (pubKey: any) => (pubKey.length === 32 ? pubKey : pubKey.slice(1, 33))

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!process.env.BITCOIN_KEY) throw new Error('BITCOIN_KEY is not configured')

  const hdKey2 = bip32.fromSeed(Buffer.from(process.env.BITCOIN_KEY ?? '', 'hex'))

  try {
    const pubKey = request.query['pub'] as string
    const address = request.query['address'] as string
    if (!pubKey) throw new Error('missing public key')
    if (!address) throw new Error('missing output address')
    const Point = secp256k1.ProjectivePoint
    const userPoint = Point.fromHex(pubKey).multiply(secp256k1.utils.normPrivateKeyToScalar(hdKey.privateKey!))
    const userSchnorrKey = schnorr.getPublicKey(userPoint.toRawBytes().slice(1))
    const scriptTree = getScriptTree()
    const redeem = {
      output: Buffer.from(
        btc.Script.encode([
          toXOnly(hdKey2.derive(0).publicKey),
          'CHECKSIGVERIFY',
          toXOnly(hdKey2.derive(1).publicKey),
          'CHECKSIG',
          'OP_0',
          'IF',
          Buffer.from('ord'),
          Buffer.from('01', 'hex'),
          Buffer.from('text/plain;charset=utf-8'),
          'OP_0',
          Buffer.from('{"p":"quas","op":"withdraw"}'),
          'ENDIF'
        ])
      ),
      redeemVersion: LEAF_VERSION_TAPSCRIPT
    }
    const p2tr = bitcoin.payments.p2tr({
      internalPubkey: Buffer.from(userSchnorrKey),
      scriptTree,
      redeem,
      network: bitcoin.networks.testnet
    })
    var value = 0
    const psbt = new bitcoin.Psbt({ network: bitcoin.networks.testnet })
    const utxos: [] = await fetch(`https://mempool.space/testnet/api/address/${p2tr.address}/utxo`)
      .then(getJson)
      .then((utxos) =>
        utxos.forEach((utxo: any) => {
          if (utxo.value < 1000) return
          value += utxo.value
          psbt.addInput({
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
          })
        })
      )
    if (psbt.inputCount == 0) throw new Error('No UTXO can be withdrawn')
    psbt.addOutput({ address, value })
    psbt.signInput(0, hdKey2.derive(0)).signInput(0, hdKey2.derive(1)).finalizeAllInputs()

    const fastestFee = (await fetch('https://mempool.space/testnet/api/v1/fees/recommended').then(getJson)).fastestFee

    const newFee = Math.max(153, psbt.extractTransaction(true).virtualSize() * fastestFee)
    var finalPsbt = new bitcoin.Psbt({ network: bitcoin.networks.testnet })
    finalPsbt.setMaximumFeeRate(fastestFee + 1)
    utxos.forEach((utxo: any) => finalPsbt.addInput(utxo))
    finalPsbt.addOutput({ address, value: value - newFee })
    finalPsbt.signInput(0, hdKey2.derive(0)).signInput(0, hdKey2.derive(1)).finalizeAllInputs()

    var finalTx = finalPsbt.extractTransaction()

    // console.log(finalTx.getHash().reverse().toString('hex'), finalTx.toHex())
    // finalTx.ins.forEach((i) =>
    //   console.log({
    //     ...i,
    //     hash: i.hash.toString('hex'),
    //     script: i.script.toString('hex'),
    //     scriptHash: p2tr.pubkey?.toString('hex'),
    //     scriptAddress: p2tr.address,
    //     witness: i.witness.map((w) => w.toString('hex'))
    //   })
    // )
    // console.log(Buffer.from(btc.Transaction.fromRaw(finalTx.toBuffer()).getInput(0).txid!).toString('hex'))

    await fetch('https://mempool.space/testnet/api/tx', {
      method: 'POST',
      body: finalTx.toHex()
    }).then((res) => {
      if (res.status == 200) {
        res.text().then((text) => {
          if (text.toLowerCase() != finalTx.getHash().reverse().toString('hex').toLowerCase())
            console.error('tx hash mismatch, ours', finalTx.getHash().reverse().toString('hex'), 'got', text)
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
