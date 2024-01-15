import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupplyP2tr } from '../api_lib/depositAddress.js'

export default async function handler(_: VercelRequest, response: VercelResponse) {
  try {
    response.status(200).send({ address: getSupplyP2tr().address })
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
