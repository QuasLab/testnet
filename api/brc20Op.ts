import type { VercelRequest, VercelResponse } from '@vercel/node'
import * as bitcoin from 'bitcoinjs-lib'
import ecc from '@bitcoinerlab/secp256k1'

bitcoin.initEccLib(ecc)

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    const op = request.query['op'] as string
    if (!['mint', 'transfer'].includes(op)) throw new Error('op can only be mint or transfer')
    const tick = request.query['tick'] as string
    const amt = request.query['amt'] as string
    if (!tick) throw new Error('missing brc-20 tick')
    if (!amt) throw new Error('missing brc-20 amt')

    const brcJson = `{"p":"brc-20","op":"${op}","tick":"${tick}","amt":"${amt}"}`
    response.status(200).send({ data: brcJson })
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
