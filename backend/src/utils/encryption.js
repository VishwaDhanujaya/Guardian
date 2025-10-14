const { createCipheriv, createDecipheriv, randomBytes } = require("node:crypto");

const logger = require("./logger");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
let cachedKey;

function resolveKey() {
  if (cachedKey) {
    return cachedKey;
  }

  const configuredKey = process.env.DATA_ENCRYPTION_KEY;
  if (configuredKey) {
    const normalized = configuredKey.trim();
    const encoding = normalized.length === 64 ? "hex" : "base64";
    const keyBuffer = Buffer.from(normalized, encoding);
    if (keyBuffer.length !== 32) {
      throw new Error("DATA_ENCRYPTION_KEY must be a 32 byte key");
    }
    cachedKey = keyBuffer;
    return cachedKey;
  }

  logger.warn(
    "DATA_ENCRYPTION_KEY missing. Generating ephemeral key for runtime only.",
  );
  cachedKey = randomBytes(32);
  return cachedKey;
}

function encrypt(value) {
  if (value === null || value === undefined) {
    return value;
  }

  const key = resolveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${encrypted.toString("base64")}:${authTag.toString("base64")}`;
}

function decrypt(value) {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value !== "string" || !value.includes(":")) {
    return value;
  }

  try {
    const [ivPart, dataPart, authTagPart] = value.split(":");
    const key = resolveKey();
    const decipher = createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(ivPart, "base64"),
    );
    decipher.setAuthTag(Buffer.from(authTagPart, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataPart, "base64")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch (error) {
    logger.error("Unable to decrypt field", { error: error.message });
    return value;
  }
}

module.exports = {
  encrypt,
  decrypt,
};
