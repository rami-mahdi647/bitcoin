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

  const mode = process.env.MINING_MODE || "mock";
  const sessionId = `mining-${Date.now().toString(36)}`;

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: `Minería activada en modo ${mode}. Sesión ${sessionId}.`,
      sessionId,
      received: {
        poolUrl,
        payoutAddress,
        hashrate,
      },
    }),
  };
};
