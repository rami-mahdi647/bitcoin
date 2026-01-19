const { spawn } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const miningSessions = new Map();

const parseBody = (body) => {
  if (!body) {
    return null;
  }
  try {
    return JSON.parse(body);
  } catch (error) {
    return null;
  }
};

const parseMinerArgs = (value) => {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map(String);
    }
  } catch (error) {
    // Fallback to whitespace split.
  }
  return value
    .split(" ")
    .map((segment) => segment.trim())
    .filter(Boolean);
};

const validatePoolUrl = (poolUrl) => {
  if (!poolUrl) {
    return { valid: false, error: "Debes indicar la URL del pool." };
  }
  let parsed;
  try {
    parsed = new URL(poolUrl);
  } catch (error) {
    return { valid: false, error: "La URL del pool no es válida." };
  }
  const allowedProtocols = new Set(["stratum+tcp:", "stratum+ssl:", "stratum+tls:"]);
  if (!allowedProtocols.has(parsed.protocol)) {
    return {
      valid: false,
      error: "El pool debe usar stratum+tcp, stratum+ssl o stratum+tls.",
    };
  }
  if (parsed.username || parsed.password) {
    return {
      valid: false,
      error: "No incluyas credenciales en la URL del pool.",
    };
  }
  return { valid: true, url: parsed };
};

const getMiningMode = () => (process.env.MINING_MODE || "mock").toLowerCase();

const getMiningTarget = () => (process.env.MINING_TARGET || "pool").toLowerCase();

const getMissingRealConfig = (target) => {
  const required = {
    pool: ["MINING_POOL_USER", "MINING_POOL_PASSWORD"],
    local: ["MINER_BINARY_PATH", "MINER_API_TOKEN"],
  };
  return (required[target] || []).filter((key) => !process.env[key]);
};

const startLocalWorker = ({ sessionId, payoutAddress, hashrate }) => {
  const binaryPath = process.env.MINER_BINARY_PATH;
  if (!binaryPath) {
    return { error: "Falta MINER_BINARY_PATH para minería local." };
  }
  if (!fs.existsSync(binaryPath)) {
    return { error: "El binario de minería configurado no existe." };
  }

  const minerArgs = parseMinerArgs(process.env.MINER_ARGS);
  const workingDir = process.env.MINER_WORKDIR || path.dirname(binaryPath);
  const child = spawn(binaryPath, minerArgs, {
    cwd: workingDir,
    env: {
      ...process.env,
      MINING_SESSION_ID: sessionId,
      MINING_PAYOUT_ADDRESS: payoutAddress,
      MINING_HASHRATE: String(hashrate),
      MINER_API_TOKEN: process.env.MINER_API_TOKEN,
    },
    detached: true,
    stdio: "ignore",
  });

  child.unref();

  return {
    pid: child.pid,
    startedAt: new Date().toISOString(),
  };
};

const createPoolConfig = ({ poolUrl, payoutAddress, hashrate }) => ({
  protocol: "stratum",
  url: poolUrl,
  user: process.env.MINING_POOL_USER,
  password: process.env.MINING_POOL_PASSWORD,
  worker: process.env.MINING_POOL_WORKER || "netlify-wallet",
  payoutAddress,
  requestedHashrate: hashrate,
  tls: poolUrl.startsWith("stratum+ssl:") || poolUrl.startsWith("stratum+tls:"),
});

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Método no permitido" }),
    };
  }

  const payload = parseBody(event.body);
  const poolUrl = payload?.poolUrl?.trim();
  const payoutAddress = payload?.payoutAddress?.trim();
  const hashrate = Number(payload?.hashrate);

  if (!poolUrl || !payoutAddress || !Number.isFinite(hashrate) || hashrate <= 0) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "Solicitud inválida. Revisa pool, hashrate y dirección de cobro.",
      }),
    };
  }

  const mode = getMiningMode();
  const target = getMiningTarget();
  const sessionId = `mining-${crypto.randomUUID()}`;

  if (mode === "real") {
    if (!["pool", "local"].includes(target)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "MINING_TARGET debe ser 'pool' o 'local'.",
        }),
      };
    }

    const missingConfig = getMissingRealConfig(target);
    if (missingConfig.length > 0) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          error: "Minería real deshabilitada: faltan secretos requeridos.",
          missing: missingConfig,
        }),
      };
    }
  }

  let runtimeDetails = null;
  let message = `Minería activada en modo ${mode}.`;

  if (mode === "real" && target === "local") {
    const worker = startLocalWorker({ sessionId, payoutAddress, hashrate });
    if (worker.error) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: worker.error,
        }),
      };
    }
    runtimeDetails = { worker };
    message = "Worker local iniciado para minería real.";
  }

  if (mode === "real" && target === "pool") {
    const validation = validatePoolUrl(poolUrl);
    if (!validation.valid) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: validation.error,
        }),
      };
    }
    runtimeDetails = {
      stratum: createPoolConfig({ poolUrl, payoutAddress, hashrate }),
    };
    message = "Configuración stratum creada para minería en pool.";
  }

  miningSessions.set(sessionId, {
    id: sessionId,
    mode,
    target,
    startedAt: new Date().toISOString(),
    poolUrl,
    payoutAddress,
    hashrate,
    runtimeDetails,
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: `${message} Sesión ${sessionId}.`,
      sessionId,
      mode,
      target,
      runtimeDetails,
      received: {
        poolUrl,
        payoutAddress,
        hashrate,
      },
    }),
  };
};
