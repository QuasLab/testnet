import type { VercelRequest, VercelResponse } from '@vercel/node'
import { protocolBalance } from '../api_lib/protocolBalance.js'
import { getSupplyP2tr } from '../api_lib/depositAddress.js'
import { mempool } from '../api_lib/mempool.js'
import { Balance } from '../api_lib/types.js'

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.query['address'])
    return response.status(200).send(await protocolBalance(request.query['address'] as string))

  const {
    bitcoin: { addresses }
  } = mempool()

  const protocolAddress = await addresses.getAddress({ address: getSupplyP2tr().address! })
  const unconfirmed = protocolAddress.mempool_stats.funded_txo_sum - protocolAddress.mempool_stats.spent_txo_sum
  const confirmed = protocolAddress.chain_stats.funded_txo_sum - protocolAddress.chain_stats.spent_txo_sum
  const balance: Balance = { unconfirmed, confirmed, total: unconfirmed + confirmed }
  response.status(200).send(balance)
}
