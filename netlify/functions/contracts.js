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
  const template = payload?.template?.trim();
  const expiry = payload?.expiry?.trim();
  const amount = Number(payload?.amount);

  if (!template || !expiry || !Number.isFinite(amount) || amount <= 0) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "Solicitud inválida. Agrega plantilla, monto y vencimiento.",
      }),
    };
  }

  const mode = process.env.CONTRACTS_MODE || "mock";
  const contractId = `contract-${Date.now().toString(36)}`;

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: `Contrato preparado en modo ${mode}. ID ${contractId}.`,
      contractId,
      received: {
        templateLength: template.length,
        amount,
        expiry,
      },
    }),
  };
};
