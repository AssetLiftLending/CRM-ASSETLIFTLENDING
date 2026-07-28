import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const KEY = Buffer.from(process.env.ENCRYPTION_KEY ?? 'default-key-change-this-in-prod!!', 'utf8').slice(0, 32)

export function encrypt(text: string): string {
  const iv     = randomBytes(16)
  const cipher = createCipheriv('aes-256-cbc', KEY, iv)
  const enc    = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  return iv.toString('hex') + ':' + enc.toString('hex')
}

export function decrypt(encrypted: string): string {
  const [ivHex, encHex] = encrypted.split(':')
  const iv       = Buffer.from(ivHex, 'hex')
  const enc      = Buffer.from(encHex, 'hex')
  const decipher = createDecipheriv('aes-256-cbc', KEY, iv)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}

// Mask SSN for display: XXX-XX-1234
export function maskSSN(ssn: string) {
  const clean = ssn.replace(/\D/g, '')
  return `XXX-XX-${clean.slice(-4)}`
}
