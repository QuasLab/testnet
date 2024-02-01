import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(request: VercelRequest, response: VercelResponse) {
  const address = request.query['address']
  const result = await fetch(
    `${process.env.UNISAT_URL ?? 'https://open-api-testnet.unisat.io'}/v1/indexer/address/${address}/brc20/summary`,
    {
      headers: { Authorization: `Bearer ${process.env.UNISAT_KEY}` }
    }
  )
  response.status(result.status).send(await result.text())
}
