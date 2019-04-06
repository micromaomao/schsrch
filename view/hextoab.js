export default function (hex) {
  let a = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    let byte = hex[i] + hex[i + 1]
    a[i / 2] = parseInt(byte, 16)
  }
  return a.buffer.slice(a.byteOffset, a.byteOffset + a.byteLength)
}
