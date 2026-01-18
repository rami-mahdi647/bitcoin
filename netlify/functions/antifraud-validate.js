const DEFAULT_THRESHOLD = 0.7;
const DEFAULT_TIMEOUT_MS = 4500;
const MODEL_COUNT = 32;

const clamp = (value, min = 0, max = 1) => Math.min(Math.max(value, min), max);

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

const hashString = (value) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const buildSignals = (transaction) => {
  const signals = [];
  if (transaction.amount >= 5) {
    signals.push("monto_alto");
  } else if (transaction.amount >= 1) {
    signals.push("monto_medio");
  }

  if (transaction.feeRate >= 30) {
    signals.push("tarifa_alta");
  } else if (transaction.feeRate <= 2) {
    signals.push("tarifa_baja");
  }

  if (transaction.address.startsWith("1") || transaction.address.startsWith("3")) {
    signals.push("direccion_legacy");
  } else {
    signals.push("direccion_segwit");
  }

  return signals;
};

const baseRiskFromSignals = (signals) => {
  let risk = 0.18;
  if (signals.includes("monto_medio")) {
    risk += 0.18;
  }
  if (signals.includes("monto_alto")) {
    risk += 0.32;
  }
  if (signals.includes("tarifa_alta")) {
    risk += 0.12;
  }
  if (signals.includes("tarifa_baja")) {
    risk += 0.08;
  }
  if (signals.includes("direccion_legacy")) {
    risk += 0.08;
  }
  return clamp(risk);
};

const buildReason = (decision, score, threshold, signals) => {
  const scoreLabel = `score ${(score * 100).toFixed(1)}%`;
  const thresholdLabel = `umbral ${(threshold * 100).toFixed(0)}%`;
  if (decision === "approve") {
    return `Aprobada: ${scoreLabel} por debajo del ${thresholdLabel}. Señales: ${signals.join(", ")}.`;
  }
  return `Bloqueada: ${scoreLabel} supera el ${thresholdLabel}. Señales: ${signals.join(", ")}.`;
};

const runLocalEnsemble = (transaction, threshold) => {
  const signals = buildSignals(transaction);
  const baseRisk = baseRiskFromSignals(signals);
  const modelScores = Array.from({ length: MODEL_COUNT }, (_, index) => {
    const seed = hashString(`${transaction.address}|${transaction.amount}|${transaction.feeRate}|${index}`);
    const jitter = ((seed % 1000) / 1000 - 0.5) * 0.15;
    return clamp(baseRisk + jitter);
  });
  const averageScore = modelScores.reduce((sum, score) => sum + score, 0) / MODEL_COUNT;
  const decision = averageScore >= threshold ? "reject" : "approve";

  return {
    score: Number(averageScore.toFixed(4)),
    decision,
    reason: buildReason(decision, averageScore, threshold, signals),
    modelVersion: "mock-ensemble-32-v1",
    modelCount: MODEL_COUNT,
    signals,
  };
};

const callExternalService = async (transaction, threshold) => {
  const serviceUrl = process.env.ANTIFRAUD_ML_URL;
  if (!serviceUrl) {
    return null;
  }

  const timeoutMs = Number(process.env.ANTIFRAUD_ML_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(serviceUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.ANTIFRAUD_ML_TOKEN
          ? { Authorization: `Bearer ${process.env.ANTIFRAUD_ML_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({
        transaction,
        ensemble: {
          expectedModels: MODEL_COUNT,
        },
        metadata: {
          source: "netlify-wallet",
        },
      }),
      signal: controller.signal,
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error || `Servicio antifraude (${response.status})`);
    }

    const score = Number(payload?.score);
    if (!Number.isFinite(score)) {
      throw new Error("Respuesta antifraude inválida: score ausente");
    }

    const decision =
      payload?.decision || (score >= threshold ? "reject" : "approve");

    return {
      score: clamp(score),
      decision,
      reason: payload?.reason || buildReason(decision, score, threshold, payload?.signals || []),
      modelVersion: payload?.modelVersion || "external",
      modelCount: payload?.modelCount || MODEL_COUNT,
      signals: payload?.signals || [],
    };
  } finally {
    clearTimeout(timeoutId);
  }
};

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Método no permitido" }),
    };
  }

  const payload = parseBody(event.body);
  const address = payload?.address?.trim();
  const amount = Number(payload?.amount);
  const feeRate = Number(payload?.feeRate);

  if (!address || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(feeRate) || feeRate <= 0) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "Solicitud inválida. Incluye dirección, monto y tarifa.",
      }),
    };
  }

  const threshold = clamp(Number(process.env.ANTIFRAUD_THRESHOLD || DEFAULT_THRESHOLD));

  const transaction = {
    address,
    amount,
    feeRate,
    network: process.env.BITCOIN_NETWORK || "mainnet",
  };

  try {
    const externalResult = await callExternalService(transaction, threshold);
    const result = externalResult || runLocalEnsemble(transaction, threshold);
    const decision = result.decision === "approve" ? "approve" : "reject";

    return {
      statusCode: 200,
      body: JSON.stringify({
        score: result.score,
        decision,
        reason: result.reason,
        threshold,
        modelCount: result.modelCount,
        modelVersion: result.modelVersion,
        signals: result.signals,
        policy: {
          threshold,
          mode: externalResult ? "external" : "local",
          retentionDays: Number(process.env.ANTIFRAUD_RETENTION_DAYS || 0),
        },
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : "Error antifraude",
      }),
    };
  }
};
