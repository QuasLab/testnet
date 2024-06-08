import { Script } from '@scure/btc-signer'
import { toXOnlyU8 } from './utils.js'

export function scriptOrd(publicKey: Uint8Array, brcJson: string) {
  return Buffer.from(
    Script.encode([
      toXOnlyU8(publicKey),
      'CHECKSIG',
      'OP_0',
      'IF',
      Buffer.from('ord'),
      Buffer.from('01', 'hex'),
      Buffer.from('text/plain;charset=utf-8'),
      'OP_0',
      Buffer.from(brcJson),
      'ENDIF'
    ])
  )
}

export function scriptQuas(pubKey1: Uint8Array, pubkey2: Uint8Array, action: string) {
  return Buffer.from(
    Script.encode([
      toXOnlyU8(pubKey1),
      'CHECKSIGVERIFY',
      toXOnlyU8(pubkey2),
      'CHECKSIG',
      'OP_0',
      'IF',
      Buffer.from('ord'),
      Buffer.from('01', 'hex'),
      Buffer.from('text/plain;charset=utf-8'),
      'OP_0',
      Buffer.from(`{"p":"quas","op":"${action}"}`),
      'ENDIF'
    ])
  )
}
