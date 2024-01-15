import { Script } from '@scure/btc-signer'

export const toXOnly = (pubKey: Uint8Array) => (pubKey.length === 32 ? pubKey : pubKey.slice(1, 33))

export function scriptOrd(publicKey: Uint8Array, brcJson: string) {
  return Buffer.from(
    Script.encode([
      toXOnly(publicKey),
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
      toXOnly(pubKey1),
      'CHECKSIGVERIFY',
      toXOnly(pubkey2),
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
