import type { VercelRequest, VercelResponse } from '@vercel/node'
import { okxFetch } from '../api_lib/okxFetch.js'

export default async function handler(request: VercelRequest, response: VercelResponse) {
  const slug = request.query['slug']
  const result = await okxFetch({ api: '/api/v5/mktplace/nft/ordinals/collections' + (slug ? '?slug=' + slug : '') })
  response.status(result.status).send(await result.text())
}
