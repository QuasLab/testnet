import type { VercelRequest, VercelResponse } from '@vercel/node'
import { schnorr, secp256k1 } from '@noble/curves/secp256k1'
import * as bitcoin from 'bitcoinjs-lib'
// import * as btc from '@scure/btc-signer'
import ecc from '@bitcoinerlab/secp256k1'
import { getScriptTree, hdKey } from '../api_lib/scriptTree.js'

bitcoin.initEccLib(ecc)

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    const pubKey = request.query['pub'] as string
    if (!pubKey) throw new Error('missing public key')
    const Point = secp256k1.ProjectivePoint
    const userPoint = Point.fromHex(pubKey).multiply(secp256k1.utils.normPrivateKeyToScalar(hdKey.privateKey!))
    const userSchnorrKey = schnorr.getPublicKey(userPoint.toRawBytes().slice(1))
    const scriptTree = getScriptTree()
    // function logScript(i: any): any {
    //   return Array.isArray(i)
    //     ? i.map((i: any) => logScript(i))
    //     : [i.output.toString('hex'), bitcoin.script.toASM(i.output), btc.Script.decode(i.output).toString()]
    // }
    // console.log(
    //   JSON.stringify(
    //     (scriptTree as any[]).map((i) => logScript(i)),
    //     undefined,
    //     1
    //   )
    // )
    const p2tr = bitcoin.payments.p2tr({
      internalPubkey: Buffer.from(userSchnorrKey),
      scriptTree,
      network: bitcoin.networks.testnet
    })
    response.status(200).send({ address: p2tr.address })
    // console.log(p2tr.address)
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
