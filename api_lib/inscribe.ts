import * as bitcoin from 'bitcoinjs-lib'
import { getBrc20SupplyP2tr, hdKey } from './depositAddress.js'
import { scriptQuas } from './scripts.js'
import { LEAF_VERSION_TAPSCRIPT } from 'bitcoinjs-lib/src/payments/bip341.js'

export function prepareMPCTransferInscription(
  op: string,
  address: string,
  pubKey: string,
  feeRates: any
): { mpcRedeem: bitcoin.Payment; mpcP2tr: bitcoin.Payment; fee: bigint } {
  const mpcRedeem = {
    output: scriptQuas(hdKey.derive(0).publicKey, hdKey.derive(1).publicKey, op),
    redeemVersion: LEAF_VERSION_TAPSCRIPT
  }
  const mpcP2tr = getBrc20SupplyP2tr(pubKey, mpcRedeem)

  const fakeAmount = 2000
  const fakeFee = 500
  const fakePsbt = new bitcoin.Psbt({ network: bitcoin.networks.testnet })
  fakePsbt.addInput({
    hash: '75ddabb27b8845f5247975c8a5ba7c6f336c4570708ebe230caf6db5217ae858',
    index: 0,
    witnessUtxo: { value: fakeAmount, script: mpcP2tr.output! },
    tapLeafScript: [
      {
        leafVersion: mpcRedeem.redeemVersion!,
        script: mpcRedeem.output!,
        controlBlock: mpcP2tr.witness![mpcP2tr.witness!.length - 1]
      }
    ]
  })
  fakePsbt.addOutput({ address, value: fakeAmount - fakeFee })
  const fakeTx = fakePsbt
    .signAllInputs(hdKey.derive(0))
    .signAllInputs(hdKey.derive(1))
    .finalizeAllInputs()
    .extractTransaction()
  const fee = BigInt(Math.max(300, feeRates.minimumFee, fakeTx.virtualSize() * feeRates.fastestFee))

  return { mpcRedeem, mpcP2tr, fee }
}
