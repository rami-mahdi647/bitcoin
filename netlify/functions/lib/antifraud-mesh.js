const crypto = require("crypto");

const DEFAULT_TIMEOUT_MS = 1400;
const DEFAULT_RETRIES = 2;
const DEFAULT_QUORUM = 2;
const DEFAULT_DISCREPANCY_THRESHOLD = 0.35;

let localEcdh;

const clamp = (value, min = 0, max = 1) => Math.min(Math.max(value, min), max);

const loadNodes = () => {
  if (!process.env.ANTIFRAUD_MESH_NODES) {
    return [];
  }
  try {
    const parsed = JSON.parse(process.env.ANTIFRAUD_MESH_NODES);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((node) => node?.id && node?.url)
        .map((node) => ({
          id: node.id,
          url: node.url.replace(/\/$/, ""),
          ecdhPublicKey: node.ecdhPublicKey || null,
          signingPublicKey: node.signingPublicKey || null,
          weight: Number.isFinite(Number(node.weight)) ? Number(node.weight) : 1,
        }));
    }
  } catch (error) {
    return [];
  }
  return [];
};

const getLocalEcdh = () => {
  if (localEcdh) {
    return localEcdh;
  }
  const ecdh = crypto.createECDH("prime256v1");
  const privateKey = process.env.ANTIFRAUD_MESH_ECDH_PRIVATE_KEY;
  if (privateKey) {
    ecdh.setPrivateKey(Buffer.from(privateKey, "base64"));
  } else {
    ecdh.generateKeys();
  }
  localEcdh = ecdh;
  return localEcdh;
};

const getLocalEcdhPublicKey = () => getLocalEcdh().getPublicKey("base64");

const getLocalSigningKey = () => process.env.ANTIFRAUD_MESH_SIGNING_KEY || null;

const signPayload = (payload) => {
  const signingKey = getLocalSigningKey();
  if (!signingKey) {
    return null;
  }
  const signer = crypto.createSign("SHA256");
  signer.update(payload);
  signer.end();
  return signer.sign(signingKey, "base64");
};

const verifySignature = (payload, signature, publicKey) => {
  if (!signature || !publicKey) {
    return false;
  }
  const verifier = crypto.createVerify("SHA256");
  verifier.update(payload);
  verifier.end();
  return verifier.verify(publicKey, signature, "base64");
};

const deriveKey = (sharedSecret, salt) =>
  crypto.hkdfSync("sha256", sharedSecret, salt, "antifraud-mesh", 32);

const encryptPayload = (sharedSecret, body) => {
  const iv = crypto.randomBytes(12);
  const salt = crypto.randomBytes(16);
  const key = deriveKey(sharedSecret, salt);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(body, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("base64"),
    salt: salt.toString("base64"),
    cipher: ciphertext.toString("base64"),
    tag: tag.toString("base64"),
  };
};

const decryptPayload = (sharedSecret, encrypted) => {
  const key = deriveKey(sharedSecret, Buffer.from(encrypted.salt, "base64"));
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(encrypted.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(encrypted.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encrypted.cipher, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
};

const fetchWithRetry = async (url, options, timeoutMs, retries) => {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Mesh ${response.status}`);
      }
      return response;
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  throw lastError;
};

const sendHandshake = async (node, timeoutMs, retries) => {
  const payload = {
    fromId: process.env.ANTIFRAUD_MESH_NODE_ID || "local",
    ecdhPublicKey: getLocalEcdhPublicKey(),
    timestamp: new Date().toISOString(),
  };
  const unsigned = JSON.stringify(payload);
  const signature = signPayload(unsigned);
  const response = await fetchWithRetry(
    `${node.url}/mesh-handshake`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, signature }),
    },
    timeoutMs,
    retries
  );
  const reply = await response.json();
  return {
    ecdhPublicKey: reply?.ecdhPublicKey || node.ecdhPublicKey,
    signingPublicKey: reply?.signingPublicKey || node.signingPublicKey,
  };
};

const sendSignal = async ({
  node,
  payload,
  timeoutMs,
  retries,
  signalPath,
}) => {
  const sharedSecret = getLocalEcdh().computeSecret(
    Buffer.from(node.ecdhPublicKey, "base64")
  );
  const encrypted = encryptPayload(sharedSecret, JSON.stringify(payload));
  const envelope = {
    fromId: process.env.ANTIFRAUD_MESH_NODE_ID || "local",
    ecdhPublicKey: getLocalEcdhPublicKey(),
    timestamp: new Date().toISOString(),
    ...encrypted,
  };
  const unsigned = JSON.stringify(envelope);
  const signature = signPayload(unsigned);
  const response = await fetchWithRetry(
    `${node.url}${signalPath}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...envelope, signature }),
    },
    timeoutMs,
    retries
  );
  const reply = await response.json();
  const replyUnsigned = JSON.stringify({
    fromId: reply?.fromId,
    ecdhPublicKey: reply?.ecdhPublicKey,
    timestamp: reply?.timestamp,
    iv: reply?.iv,
    salt: reply?.salt,
    cipher: reply?.cipher,
    tag: reply?.tag,
  });
  if (!verifySignature(replyUnsigned, reply?.signature, node.signingPublicKey)) {
    throw new Error(`Firma inválida de ${node.id}`);
  }
  const replySecret = getLocalEcdh().computeSecret(
    Buffer.from(reply.ecdhPublicKey || node.ecdhPublicKey, "base64")
  );
  const decrypted = decryptPayload(replySecret, reply);
  return JSON.parse(decrypted);
};

const deriveFeatures = (transaction) => {
  const amountBucket = transaction.amount >= 5 ? "alto" : transaction.amount >= 1 ? "medio" : "bajo";
  const feeBucket =
    transaction.feeRate >= 30 ? "alta" : transaction.feeRate <= 2 ? "baja" : "media";
  const addressType =
    transaction.address.startsWith("1") || transaction.address.startsWith("3")
      ? "legacy"
      : "segwit";
  const addressFingerprint = crypto
    .createHash("sha256")
    .update(transaction.address)
    .digest("hex")
    .slice(0, 10);
  return {
    amountBucket,
    feeBucket,
    addressType,
    addressPrefix: transaction.address.slice(0, 4),
    addressFingerprint,
    network: transaction.network,
  };
};

const aggregateSignals = (signals, threshold) => {
  if (!signals.length) {
    return null;
  }
  const weightedScores = signals.map((signal) => {
    const weight = Number.isFinite(signal.weight) ? signal.weight : 1;
    const confidence = Number.isFinite(signal.confidence)
      ? clamp(signal.confidence)
      : 1;
    return {
      weight,
      score: clamp(signal.score),
      confidence,
      decision: signal.decision,
      modelId: signal.modelId,
    };
  });
  const totalWeight = weightedScores.reduce(
    (sum, signal) => sum + signal.weight * signal.confidence,
    0
  );
  const weightedScore =
    weightedScores.reduce(
      (sum, signal) => sum + signal.score * signal.weight * signal.confidence,
      0
    ) / (totalWeight || 1);
  const rejectWeight = weightedScores.reduce(
    (sum, signal) =>
      sum +
      (signal.decision === "reject" ? signal.weight * signal.confidence : 0),
    0
  );
  const approveWeight = weightedScores.reduce(
    (sum, signal) =>
      sum +
      (signal.decision === "approve" ? signal.weight * signal.confidence : 0),
    0
  );
  const decision = weightedScore >= threshold ? "reject" : "approve";
  const maxScore = Math.max(...weightedScores.map((signal) => signal.score));
  const minScore = Math.min(...weightedScores.map((signal) => signal.score));
  const discrepancies = [];
  if (maxScore - minScore >= DEFAULT_DISCREPANCY_THRESHOLD) {
    discrepancies.push("dispersion_alta");
  }
  if (rejectWeight > 0 && approveWeight > 0) {
    discrepancies.push("criterios_opuestos");
  }
  return {
    score: clamp(weightedScore),
    decision,
    participants: weightedScores.length,
    discrepancies,
    approvals: approveWeight,
    rejections: rejectWeight,
    totalWeight,
  };
};

const collectMeshSignals = async ({ transaction, threshold }) => {
  const nodes = loadNodes();
  if (!nodes.length) {
    return null;
  }
  const timeoutMs = Number(
    process.env.ANTIFRAUD_MESH_TIMEOUT_MS || DEFAULT_TIMEOUT_MS
  );
  const retries = Number(process.env.ANTIFRAUD_MESH_RETRIES || DEFAULT_RETRIES);
  const signalPath = process.env.ANTIFRAUD_MESH_SIGNAL_PATH || "/mesh-signal";
  const quorum = Number(process.env.ANTIFRAUD_MESH_QUORUM || DEFAULT_QUORUM);

  const derived = deriveFeatures(transaction);
  const payload = {
    features: derived,
    context: {
      threshold,
      timestamp: new Date().toISOString(),
    },
  };

  const nodeResponses = [];
  for (const node of nodes) {
    let resolvedNode = node;
    if (!resolvedNode.ecdhPublicKey || !resolvedNode.signingPublicKey) {
      try {
        const handshake = await sendHandshake(node, timeoutMs, retries);
        resolvedNode = {
          ...resolvedNode,
          ...handshake,
        };
      } catch (error) {
        continue;
      }
    }
    if (!resolvedNode.ecdhPublicKey || !resolvedNode.signingPublicKey) {
      continue;
    }
    try {
      const signal = await sendSignal({
        node: resolvedNode,
        payload,
        timeoutMs,
        retries,
        signalPath,
      });
      nodeResponses.push({
        ...signal,
        weight: resolvedNode.weight,
      });
    } catch (error) {
      continue;
    }
  }

  if (nodeResponses.length < quorum) {
    return {
      score: null,
      decision: "insufficient",
      participants: nodeResponses.length,
      discrepancies: ["quorum_insuficiente"],
    };
  }

  return aggregateSignals(nodeResponses, threshold);
};

const blendWithMesh = ({ localScore, meshResult }) => {
  if (!meshResult || typeof meshResult.score !== "number") {
    return {
      combinedScore: localScore,
      meshDecision: null,
      discrepancies: meshResult?.discrepancies || [],
    };
  }
  const combinedScore = clamp(localScore * 0.6 + meshResult.score * 0.4);
  return {
    combinedScore,
    meshDecision: meshResult.decision,
    discrepancies: meshResult.discrepancies || [],
  };
};

module.exports = {
  collectMeshSignals,
  blendWithMesh,
  deriveFeatures,
};
