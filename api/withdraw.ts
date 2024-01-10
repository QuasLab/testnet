import type { VercelRequest, VercelResponse } from '@vercel/node'
import * as btc from '@scure/btc-signer'
import { hex } from '@scure/base'
import * as bip32 from '@scure/bip32'
import { schnorr, secp256k1 } from '@noble/curves/secp256k1'

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!process.env.BITCOIN_KEY) throw new Error('BITCOIN_KEY is not configured')

  const hdKey = bip32.HDKey.fromMasterSeed(hex.decode(process.env.BITCOIN_KEY ?? ''))
  var keys: bip32.HDKey[] = []
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
    const script = btc.p2tr(userSchnorrKey, [btc.p2tr_ns(2, schnorrKeys)], btc.TEST_NETWORK)

    const utxos: [] = await fetch(`https://mempool.space/testnet/api/address/${script.address}/utxo`).then((res) =>
      res.json()
    )
    const utxos1 = utxos.map((utxo: any) => {
      return {
        ...script,
        txid: hex.decode(utxo.txid),
        index: utxo.vout,
        witnessUtxo: { script: script.script, amount: BigInt(utxo.value) }
      }
    })
    console.log(utxos, utxos1)

    const fee = await fetch('https://mempool.space/testnet/api/v1/fees/recommended').then((res) => res.json())
    const selected = btc.selectUTXO(utxos1, [], 'default', {
      changeAddress: address, // required, address to send change
      feePerByte: BigInt(fee.fastestFee), // require, fee per vbyte in satoshi
      bip69: true, // lexicographical Indexing of Transaction Inputs and Outputs
      createTx: true, // create tx with selected inputs/outputs
      network: btc.TEST_NETWORK
    })
    if (!selected) throw new Error('Failed to select utxos')
    const { tx } = selected
    if (!tx) throw new Error('Failed to get tx for all utxos')
    console.log(tx)
    tx.sign(userPoint.toRawBytes().slice(1))
    tx.finalize()
    console.log(tx.hash, hex.encode(tx.toBytes()))
    await fetch('https://mempool.space/testnet/api/tx', {
      method: 'POST',
      body: hex.encode(tx.toBytes())
    }).then((res) => {
      console.log(res.status)
      return res.text().then((text) => console.log(text))
    })
    response.status(200).send({ tx: tx.hash })
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
