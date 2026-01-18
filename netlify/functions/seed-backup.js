const crypto = require("crypto");

const seedStrategy = process.env.WALLET_SEED_STRATEGY === "in_app" ? "in_app" : "external";

const requireSeed = () => {
  if (seedStrategy !== "in_app") {
    throw new Error("Seed external");
  }

  const seedWords = process.env.WALLET_SEED_WORDS
    ? process.env.WALLET_SEED_WORDS.split(/\s+/).filter(Boolean)
    : [];

  if (!seedWords.length) {
    throw new Error("Seed missing");
  }

  return seedWords;
};

const buildEncryptedPayload = (seedWords, password) => {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(password, salt, 32);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = JSON.stringify({
    seedWords,
    createdAt: new Date().toISOString(),
  });
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

  return {
    version: 1,
    kdf: "scrypt",
    cipher: "aes-256-gcm",
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: encrypted.toString("base64"),
  };
};

const parseBody = (event) => {
  if (!event.body) {
    return {};
  }
  try {
    return JSON.parse(event.body);
  } catch (error) {
    return {};
  }
};

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Método no permitido" }),
    };
  }

  let seedWords = [];
  try {
    seedWords = requireSeed();
  } catch (error) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: "Seed no disponible" }),
    };
  }

  const { password, confirmation, mode } = parseBody(event);
  if (typeof confirmation !== "string" || confirmation.trim().toUpperCase() !== "RESPALDAR") {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Confirmación inválida" }),
    };
  }

  if (typeof password !== "string" || password.trim().length < 10) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Contraseña insegura" }),
    };
  }

  if (mode === "reveal") {
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
      body: JSON.stringify({ seedWords }),
    };
  }

  const payload = buildEncryptedPayload(seedWords, password.trim());
  const date = new Date().toISOString().slice(0, 10);
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="seed-backup-${date}.json"`,
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(payload, null, 2),
  };
};
