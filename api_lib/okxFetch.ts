import { createHmac } from 'crypto'

export function okxFetch({ api, message, method = 'GET' }: { api: string; message?: object; method?: string }) {
  if (!process.env.OK_ACCESS_KEY || !process.env.OK_ACCESS_SECRET || !process.env.OK_ACCESS_PASSPHRASE)
    throw new Error('bad OK_ACCESS_* in .env')
  const apiBaseUrl = process.env.OK_ACCESS_URL ?? 'https://www.okx.com'
  const body = message ? JSON.stringify(message) : undefined

  const apiRequestUrl = apiBaseUrl + api

  const timestamp = new Date().toISOString()
  const headers = {
    'Content-Type': 'application/json',
    'OK-ACCESS-KEY': process.env.OK_ACCESS_KEY,
    'OK-ACCESS-SIGN': createHmac('sha256', process.env.OK_ACCESS_SECRET)
      .update(timestamp + method + api + (body ?? ''))
      .digest('base64'),
    'OK-ACCESS-TIMESTAMP': timestamp,
    'OK-ACCESS-PASSPHRASE': process.env.OK_ACCESS_PASSPHRASE
  }
  return fetch(apiRequestUrl, { method, headers, body })
}
