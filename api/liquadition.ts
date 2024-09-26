import type { VercelRequest, VercelResponse } from '@vercel/node'
import { USDMClient, NewFuturesOrderParams } from 'binance'

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    // const symbol = 'BTCUSDT'
    var k = request.query['k'] as string
    var s = request.query['s'] as string
    var amount = request.query['a'] as string
    var symbol = request.query['symbol'] as string

    if (!k) throw new Error('missing API key!')
    if (!s) throw new Error('missing API secret!')
    if (!amount) throw new Error('missing amount!')
    if (!symbol) throw new Error('missing symbol!')
    const client = new USDMClient({
      api_key: k,
      api_secret: s,
      baseUrl: 'https://testnet.binancefuture.com',
      beautifyResponses: true
    })
    //get balances list
    const assetPrices = await client.getMarkPrice({
      symbol: symbol
    })
    const markPrice: number = Number(assetPrices.markPrice)

    console.log('market price:', markPrice)

    const entryOrder: NewFuturesOrderParams<string> = {
      positionSide: 'BOTH',
      quantity: amount,
      reduceOnly: 'false',
      side: 'BUY',
      symbol: symbol,
      type: 'MARKET'
    }
    const openedOrder = await client.submitMultipleOrders([entryOrder]).catch((e) => console.log(e?.body || e))
    console.log(openedOrder)
    response.status(200).send({ result: openedOrder[0] })
  } catch (e) {
    console.log('Error:', e)
    response.status(500).send(e.body)
  }
}

function trimToDecimalPlaces(number: number, precision: number): number {
  const array: any[] = number.toString().split('.')
  array.push(array.pop().substring(0, precision))
  const trimmedstr = array.join('.')
  return parseFloat(trimmedstr)
}
