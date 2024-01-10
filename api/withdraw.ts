import type { VercelRequest, VercelResponse } from '@vercel/node'
import * as btc from '@scure/btc-signer'
import { hex } from '@scure/base'
import { HDKey } from '@scure/bip32'
import { schnorr, secp256k1 } from '@noble/curves/secp256k1'
import * as bitcoin from 'bitcoinjs-lib'
import { Taptree } from 'bitcoinjs-lib/src/types'
import * as ecc from 'tiny-secp256k1'
import { BIP32Factory } from 'bip32'

bitcoin.initEccLib(ecc)
const bip32 = BIP32Factory(ecc)

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!process.env.BITCOIN_KEY) throw new Error('BITCOIN_KEY is not configured')

  const hdKey = HDKey.fromMasterSeed(hex.decode(process.env.BITCOIN_KEY ?? ''))
  const hdKey2 = bip32.fromSeed(Buffer.from(process.env.BITCOIN_KEY ?? '', 'hex'))
  var keys: HDKey[] = []
  var schnorrKeys: Uint8Array[] = []
  for (var i = 0; i < 3; i++) {
    keys[i] = hdKey.deriveChild(i)
    schnorrKeys[i] = schnorr.getPublicKey(keys[i].privateKey!)
  }

  try {
    const pubKey = request.query['pub'] as string
    const address = request.query['address'] as string
    if (!pubKey) throw new Error('missing public key')
    if (!address) throw new Error('missing output address')
    const Point = secp256k1.ProjectivePoint
    const userPoint = Point.fromHex(pubKey).multiply(secp256k1.utils.normPrivateKeyToScalar(hdKey.privateKey!))
    const userSchnorrKey = schnorr.getPublicKey(userPoint.toRawBytes().slice(1))

    const script = btc.p2tr(userSchnorrKey, btc.p2tr_ns(2, schnorrKeys), btc.TEST_NETWORK)

    const scriptTree: Taptree = [
      [{ output: Buffer.from(script.leaves![0].script) }, { output: Buffer.from(script.leaves![1].script) }],
      { output: Buffer.from(script.leaves![2].script) }
    ]
    // const redeem = {
    //   output: leafScript,
    //   redeemVersion: LEAF_VERSION_TAPSCRIPT
    // }
    const p2tr = bitcoin.payments.p2tr({
      internalPubkey: Buffer.from(userSchnorrKey),
      scriptTree,
      network: bitcoin.networks.testnet
    })

    console.log(p2tr.output?.toString('hex'), p2tr.address)

    const utxos: [] = await fetch(`https://mempool.space/testnet/api/address/${script.address}/utxo`).then((res) =>
      res.json()
    )
    const utxos1: btc.TransactionInputUpdate[] = utxos.map((utxo: any) => {
      return {
        ...script,
        // redeemScript: p2tr.redeem?.data,
        txid: hex.decode(utxo.txid),
        index: utxo.vout,
        witnessUtxo: { script: script.script, amount: BigInt(utxo.value) }
      }
    })

    const fee = await fetch('https://mempool.space/testnet/api/v1/fees/recommended').then((res) => res.json())

    const selected = btc.selectUTXO(utxos1, [], 'default', {
      changeAddress: address, // required, address to send change
      feePerByte: BigInt(fee.fastestFee <= 1 ? 2 : fee.fastestFee), // require, fee per vbyte in satoshi
      bip69: true, // lexicographical Indexing of Transaction Inputs and Outputs
      createTx: true, // create tx with selected inputs/outputs
      network: btc.TEST_NETWORK
    })
    if (!selected) throw new Error('Failed to select utxos')
    const { tx } = selected
    if (!tx) throw new Error('Failed to get tx for all utxos')
    const psbt = bitcoin.Psbt.fromBuffer(Buffer.from(tx.toPSBT()))
      .signInput(0, hdKey2.derive(0))
      .signInput(0, hdKey2.derive(1))
      .finalizeAllInputs()
    const newTx = psbt.extractTransaction()

    console.log(hex.encode(tx.toBytes()), newTx.getHash().toString('hex'), newTx.toHex())
    await fetch('https://mempool.space/testnet/api/tx', {
      method: 'POST',
      body: newTx.toHex()
    }).then((res) => {
      if (res.status == 200) {
        res.text().then((text) => {
          if (text.toLowerCase() != newTx.getHash().toString('hex').toLowerCase())
            console.error('tx hash mismatch, ours', newTx.getHash().toString('hex'), 'got', text)
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
      response.status(400).send({ message: err.message })
    } else {
      console.error(err)
      response.status(500).send({ message: 'unknown error' })
    }
    return
  }
}
