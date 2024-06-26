export function toXOnly(pubKey: Buffer): Buffer {
  return pubKey.length === 32 ? pubKey : pubKey.slice(1, 33)
}

export function toXOnlyU8(pubKey: Uint8Array): Uint8Array {
  return pubKey.length === 32 ? pubKey : pubKey.slice(1, 33)
}
