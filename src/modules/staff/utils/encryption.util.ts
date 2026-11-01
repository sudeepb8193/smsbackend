import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Derive a 32-byte key from environment secret
 */
function getEncryptionKey(): Buffer {
  const secret =
    process.env.NATIONAL_ID_ENCRYPTION_KEY ||
    process.env.JWT_ACCESS_SECRET ||
    'salonflow_pro_secret_key_prod_32ch';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt sensitive plain text using AES-256-GCM
 * Output format: base64(iv + authTag + cipherText)
 */
export function encryptSensitiveData(text: string): string {
  if (!text || typeof text !== 'string') return text;

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();

  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64');
}

/**
 * Decrypt sensitive cipher text using AES-256-GCM
 */
export function decryptSensitiveData(encryptedBase64: string): string {
  if (!encryptedBase64 || typeof encryptedBase64 !== 'string') return encryptedBase64;

  try {
    const combined = Buffer.from(encryptedBase64, 'base64');
    if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
      return encryptedBase64; // Not properly formatted or already plaintext
    }

    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encryptedText = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    // If decryption fails (e.g. legacy plaintext or wrong key), return masked or original
    return '••••••••';
  }
}

/**
 * Mask National ID for regular viewing (e.g. "•••• •••• 1234")
 */
export function maskNationalId(plainText: string): string {
  if (!plainText) return '';
  const cleaned = plainText.replace(/[\s-]/g, '');
  if (cleaned.length <= 4) {
    return '••••' + cleaned;
  }
  const lastFour = cleaned.slice(-4);
  const maskedPrefix = '•'.repeat(Math.max(4, cleaned.length - 4));
  return `${maskedPrefix.slice(0, 4)} ${maskedPrefix.slice(4, 8)} ${lastFour}`.trim();
}

