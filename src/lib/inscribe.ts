import * as ordinals from 'micro-ordinals'
import * as btc from '@scure/btc-signer'
import { hex, utf8 } from '@scure/base'
import { toXOnlyU8 } from './utils'
import { P2TROut } from '@scure/btc-signer/lib/payment'

export function prepareInscription(
  tick: string,
  op: string,
  amt: number,
  address: string,
  pubKey: string,
  feeRates: any
): { inscription: ordinals.Inscription; customScripts: btc.CustomScript[]; revealPayment: P2TROut; fee: any } {
  const customScripts = [ordinals.OutOrdinalReveal]

  const inscription = {
    tags: { contentType: 'text/plain;charset=utf-8' },
    body: utf8.decode(JSON.stringify({ p: 'brc-20', op, tick, amt: amt.toString() }))
  }

  // fake transfer to calculate fee
  const fakePrivKey = hex.decode('0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a')
  const fakePayment = btc.p2tr(
    undefined,
    ordinals.p2tr_ord_reveal(btc.utils.pubSchnorr(fakePrivKey), [inscription]),
    btc.TEST_NETWORK,
    false,
    customScripts
  )

  const fakeAmount = 2000n
  const fakeFee = 500n

  const fakeTx = new btc.Transaction({ customScripts })
  fakeTx.addInput({
    ...fakePayment,
    txid: '75ddabb27b8845f5247975c8a5ba7c6f336c4570708ebe230caf6db5217ae858',
    index: 0,
    witnessUtxo: { script: fakePayment.script, amount: fakeAmount }
  })
  fakeTx.addOutputAddress(address, fakeAmount - fakeFee, btc.TEST_NETWORK)
  // fake signing to finalize and calculate vsize
  fakeTx.signIdx(fakePrivKey, 0, undefined, new Uint8Array(32))
  fakeTx.finalize()
  const fee = BigInt(Math.max(300, feeRates.minimumFee, fakeTx.vsize * feeRates.fastestFee))

  const revealPayment = btc.p2tr(
    undefined,
    ordinals.p2tr_ord_reveal(toXOnlyU8(hex.decode(pubKey)), [inscription]),
    btc.TEST_NETWORK,
    false,
    customScripts
  )
  return { inscription, customScripts, revealPayment, fee }
}
