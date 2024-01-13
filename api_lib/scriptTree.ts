import { schnorr } from '@noble/curves/secp256k1'
import { HDKey } from '@scure/bip32'
import { Script } from '@scure/btc-signer'
import { Taptree } from 'bitcoinjs-lib/src/types'

if (!process.env.BITCOIN_KEY) throw new Error('BITCOIN_KEY is not configured')

export const hdKey = HDKey.fromMasterSeed(Buffer.from(process.env.BITCOIN_KEY ?? '', 'hex'))
var keys: HDKey[] = []
var schnorrKeys: Uint8Array[] = []
for (var i = 0; i < 3; i++) {
  keys[i] = hdKey.deriveChild(i)
  schnorrKeys[i] = schnorr.getPublicKey(keys[i].privateKey!)
}

export function getScriptTree(): Taptree {
  return [
    [
      [
        [
          {
            output: Buffer.from(
              Script.encode([
                schnorrKeys[0],
                'CHECKSIGVERIFY',
                schnorrKeys[1],
                'CHECKSIG',
                'OP_0',
                'IF',
                Buffer.from('ord'),
                Buffer.from('01', 'hex'),
                Buffer.from('text/plain;charset=utf-8'),
                'OP_0',
                Buffer.from('{"p":"quas","op":"borrow"}'),
                'ENDIF'
              ])
            )
          },
          {
            output: Buffer.from(
              Script.encode([
                schnorrKeys[0],
                'CHECKSIGVERIFY',
                schnorrKeys[2],
                'CHECKSIG',
                'OP_0',
                'IF',
                Buffer.from('ord'),
                Buffer.from('01', 'hex'),
                Buffer.from('text/plain;charset=utf-8'),
                'OP_0',
                Buffer.from('{"p":"quas","op":"borrow"}'),
                'ENDIF'
              ])
            )
          }
        ],
        [
          {
            output: Buffer.from(
              Script.encode([
                schnorrKeys[1],
                'CHECKSIGVERIFY',
                schnorrKeys[2],
                'CHECKSIG',
                'OP_0',
                'IF',
                Buffer.from('ord'),
                Buffer.from('01', 'hex'),
                Buffer.from('text/plain;charset=utf-8'),
                'OP_0',
                Buffer.from('{"p":"quas","op":"borrow"}'),
                'ENDIF'
              ])
            )
          },
          {
            output: Buffer.from(
              Script.encode([
                schnorrKeys[0],
                'CHECKSIGVERIFY',
                schnorrKeys[1],
                'CHECKSIG',
                'OP_0',
                'IF',
                Buffer.from('ord'),
                Buffer.from('01', 'hex'),
                Buffer.from('text/plain;charset=utf-8'),
                'OP_0',
                Buffer.from('{"p":"quas","op":"repay"}'),
                'ENDIF'
              ])
            )
          }
        ]
      ],
      [
        [
          {
            output: Buffer.from(
              Script.encode([
                schnorrKeys[0],
                'CHECKSIGVERIFY',
                schnorrKeys[2],
                'CHECKSIG',
                'OP_0',
                'IF',
                Buffer.from('ord'),
                Buffer.from('01', 'hex'),
                Buffer.from('text/plain;charset=utf-8'),
                'OP_0',
                Buffer.from('{"p":"quas","op":"repay"}'),
                'ENDIF'
              ])
            )
          },
          {
            output: Buffer.from(
              Script.encode([
                schnorrKeys[1],
                'CHECKSIGVERIFY',
                schnorrKeys[2],
                'CHECKSIG',
                'OP_0',
                'IF',
                Buffer.from('ord'),
                Buffer.from('01', 'hex'),
                Buffer.from('text/plain;charset=utf-8'),
                'OP_0',
                Buffer.from('{"p":"quas","op":"repay"}'),
                'ENDIF'
              ])
            )
          }
        ],
        [
          {
            output: Buffer.from(
              Script.encode([
                schnorrKeys[0],
                'CHECKSIGVERIFY',
                schnorrKeys[1],
                'CHECKSIG',
                'OP_0',
                'IF',
                Buffer.from('ord'),
                Buffer.from('01', 'hex'),
                Buffer.from('text/plain;charset=utf-8'),
                'OP_0',
                Buffer.from('{"p":"quas","op":"withdraw"}'),
                'ENDIF'
              ])
            )
          },
          {
            output: Buffer.from(
              Script.encode([
                schnorrKeys[0],
                'CHECKSIGVERIFY',
                schnorrKeys[2],
                'CHECKSIG',
                'OP_0',
                'IF',
                Buffer.from('ord'),
                Buffer.from('01', 'hex'),
                Buffer.from('text/plain;charset=utf-8'),
                'OP_0',
                Buffer.from('{"p":"quas","op":"withdraw"}'),
                'ENDIF'
              ])
            )
          }
        ]
      ]
    ],
    {
      output: Buffer.from(
        Script.encode([
          schnorrKeys[1],
          'CHECKSIGVERIFY',
          schnorrKeys[2],
          'CHECKSIG',
          'OP_0',
          'IF',
          Buffer.from('ord'),
          Buffer.from('01', 'hex'),
          Buffer.from('text/plain;charset=utf-8'),
          'OP_0',
          Buffer.from('{"p":"quas","op":"withdraw"}'),
          'ENDIF'
        ])
      )
    }
  ]
}
