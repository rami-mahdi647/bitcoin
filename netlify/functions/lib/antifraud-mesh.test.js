const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

const {
  collectMeshSignals,
  decryptPayload,
  encryptPayload,
  signPayload,
  verifySignature,
} = require("./antifraud-mesh");

const makeTransaction = () => ({
  amount: 0.5,
  feeRate: 12,
  address: "bc1qexampleaddress1234",
  network: "mainnet",
});

test("serializa y deserializa mensajes cifrados", () => {
  const sender = crypto.createECDH("prime256v1");
  sender.generateKeys();
  const receiver = crypto.createECDH("prime256v1");
  receiver.generateKeys();
  const senderSecret = sender.computeSecret(receiver.getPublicKey());
  const receiverSecret = receiver.computeSecret(sender.getPublicKey());

  const payload = { foo: "bar", list: [1, 2, 3], ok: true };
  const encrypted = encryptPayload(senderSecret, JSON.stringify(payload));
  const decrypted = decryptPayload(receiverSecret, encrypted);

  assert.deepEqual(JSON.parse(decrypted), payload);
});

test("verifica firmas válidas y rechaza firmas inválidas", () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  });
  const originalPrivateKey = process.env.ANTIFRAUD_MESH_PRIVATE_KEY;

  process.env.ANTIFRAUD_MESH_PRIVATE_KEY = privateKey.export({
    type: "pkcs8",
    format: "pem",
  });
  const message = JSON.stringify({ ping: "mesh", ts: Date.now() });
  const signature = signPayload(message);

  assert.ok(signature);
  assert.equal(
    verifySignature(message, signature, publicKey.export({ type: "spki", format: "pem" })),
    true
  );
  assert.equal(verifySignature(message, "invalid", publicKey.export({ type: "spki", format: "pem" })), false);

  if (originalPrivateKey === undefined) {
    delete process.env.ANTIFRAUD_MESH_PRIVATE_KEY;
  } else {
    process.env.ANTIFRAUD_MESH_PRIVATE_KEY = originalPrivateKey;
  }
});

test("retorna fallback por quorum insuficiente cuando nodos no responden", async (t) => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  global.fetch = async () => {
    throw new Error("Network down");
  };
  process.env.ANTIFRAUD_MESH_ENABLED = "true";
  process.env.ANTIFRAUD_MESH_ENDPOINTS =
    "https://mesh-01.example.com,https://mesh-02.example.com";
  process.env.ANTIFRAUD_MESH_QUORUM = "2";

  t.after(() => {
    global.fetch = originalFetch;
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
  });

  const result = await collectMeshSignals({
    transaction: makeTransaction(),
    threshold: 0.7,
  });

  assert.equal(result.decision, "insufficient");
  assert.equal(result.participants, 0);
  assert.ok(result.discrepancies.includes("quorum_insuficiente"));
});
