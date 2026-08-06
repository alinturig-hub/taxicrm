import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getEncryptionKey(): Buffer {
  const configuredKey =
    process.env.INTEGRATION_ENCRYPTION_KEY;

  if (!configuredKey) {
    throw new Error(
      "INTEGRATION_ENCRYPTION_KEY is not configured.",
    );
  }

  let key: Buffer;

  if (/^[a-f0-9]{64}$/i.test(configuredKey)) {
    key = Buffer.from(configuredKey, "hex");
  } else {
    key = Buffer.from(configuredKey, "base64");
  }

  if (key.length !== 32) {
    throw new Error(
      "INTEGRATION_ENCRYPTION_KEY must decode to exactly 32 bytes.",
    );
  }

  return key;
}

export function encryptSecret(value: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(
    ALGORITHM,
    getEncryptionKey(),
    iv,
  );

  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}

export function decryptSecret(payload: string): string {
  const [version, ivValue, tagValue, encryptedValue] =
    payload.split(".");

  if (
    version !== "v1" ||
    !ivValue ||
    !tagValue ||
    !encryptedValue
  ) {
    throw new Error("Invalid encrypted secret payload.");
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivValue, "base64"),
  );

  decipher.setAuthTag(
    Buffer.from(tagValue, "base64"),
  );

  return Buffer.concat([
    decipher.update(
      Buffer.from(encryptedValue, "base64"),
    ),
    decipher.final(),
  ]).toString("utf8");
}
