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

const normalizeList = (entries) =>
  Array.isArray(entries)
    ? entries.map((entry) => String(entry).trim()).filter(Boolean)
    : [];

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Método no permitido" }),
    };
  }

  const payload = parseBody(event.body);
  const inputs = normalizeList(payload?.inputs);
  const outputs = normalizeList(payload?.outputs);
  const rounds = Number(payload?.rounds);

  if (!inputs.length || !outputs.length || !Number.isFinite(rounds) || rounds <= 0) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "Solicitud inválida. Define inputs, outputs y rondas.",
      }),
    };
  }

  const mode = process.env.COINJOIN_MODE || "mock";
  const sessionId = `coinjoin-${Date.now().toString(36)}`;

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: `CoinJoin coordinado en modo ${mode}. Sesión ${sessionId}.`,
      sessionId,
      received: {
        inputs: inputs.length,
        outputs: outputs.length,
        rounds,
      },
    }),
  };
};
