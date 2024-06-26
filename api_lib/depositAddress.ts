import { schnorr, secp256k1 } from '@noble/curves/secp256k1'
import { Taptree } from 'bitcoinjs-lib/src/types'
import * as bitcoin from 'bitcoinjs-lib'
import * as ecc from '@bitcoinerlab/secp256k1'
import { scriptQuas } from './scripts.js'
import { BIP32Factory, BIP32Interface } from 'bip32'
import { toXOnly } from './utils.js'

bitcoin.initEccLib(ecc)
const bip32 = BIP32Factory(ecc)

if (!process.env.BITCOIN_KEY) throw new Error('BITCOIN_KEY is not configured')

export const hdKey = bip32.fromSeed(Buffer.from(process.env.BITCOIN_KEY ?? '', 'hex'))
var keys: BIP32Interface[] = []
for (var i = 0; i < 3; i++) {
  keys[i] = hdKey.derive(i)
}

function scriptLeaf(a: number, b: number, action: string) {
  return scriptQuas(keys[a].publicKey, keys[b].publicKey, action)
}

export function getSupplyP2tr(redeem?: any) {
  return bitcoin.payments.p2tr({
    internalPubkey: Buffer.from(toXOnly(hdKey.publicKey)),
    scriptTree: getMPCScriptTree(),
    redeem,
    network: bitcoin.networks.testnet
  })
}

export function getBrc20SupplyP2tr(pubKey: string, redeem?: any) {
  const Point = secp256k1.ProjectivePoint
  const userPoint = Point.fromHex(pubKey).multiply(secp256k1.utils.normPrivateKeyToScalar(hdKey.privateKey!))
  const userSchnorrKey = schnorr.getPublicKey(userPoint.toRawBytes().slice(1))
  const scriptTree = getMPCScriptTree()
  // function logScript(i: any): any {
  //   return Array.isArray(i)
  //     ? i.map((i: any) => logScript(i))
  //     : [i.output.toString('hex'), bitcoin.script.toASM(i.output), btc.Script.decode(i.output).toString()]
  // }
  // console.log(
  //   JSON.stringify(
  //     (scriptTree as any[]).map((i) => logScript(i)),
  //     undefined,
  //     1
  //   )
  // )
  return bitcoin.payments.p2tr({
    internalPubkey: Buffer.from(userSchnorrKey),
    scriptTree,
    redeem,
    network: bitcoin.networks.testnet
  })
}

export function getBrc20SupplyAddress(pubKey: string) {
  return getBrc20SupplyP2tr(pubKey).address!
}

export function getMPCScriptTree(): Taptree {
  return [
    [
      [
        [{ output: scriptLeaf(0, 1, 'borrow') }, { output: scriptLeaf(0, 2, 'borrow') }],
        [{ output: scriptLeaf(1, 2, 'borrow') }, { output: scriptLeaf(0, 1, 'repay') }]
      ],
      [
        [{ output: scriptLeaf(0, 2, 'repay') }, { output: scriptLeaf(1, 2, 'repay') }],
        [{ output: scriptLeaf(0, 1, 'withdraw') }, { output: scriptLeaf(0, 2, 'withdraw') }]
      ]
    ],
    { output: scriptLeaf(1, 2, 'withdraw') }
  ]
}
