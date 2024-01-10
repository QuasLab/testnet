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
    if (!pubKey) throw new Error('missing public key')
    const Point = secp256k1.ProjectivePoint
    const userPoint = Point.fromHex(pubKey).multiply(secp256k1.utils.normPrivateKeyToScalar(hdKey.privateKey!))
    const userSchnorrKey = schnorr.getPublicKey(userPoint.toRawBytes().slice(1))
    const script = btc.p2tr(userSchnorrKey, [btc.p2tr_ns(2, schnorrKeys)], btc.TEST_NETWORK)
    response.status(200).send({ address: script.address })
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
