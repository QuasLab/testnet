import mempoolJS from '@mempool/mempool.js'
import { MempoolReturn } from '@mempool/mempool.js/lib/interfaces/index.js'

export function mempool(): MempoolReturn {
  return mempoolJS({ hostname: 'mempool.space', network: 'testnet' })
}
