import type { VercelRequest, VercelResponse } from '@vercel/node'
import { protocolBalance } from '../api_lib/protocolBalance.js'

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.status(200).send(await protocolBalance(request.query['address'] as string))
}
