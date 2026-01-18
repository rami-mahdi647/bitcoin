const buildRpcUrl = () => {
  if (process.env.BITCOIN_RPC_URL) {
    return process.env.BITCOIN_RPC_URL;
  }
  const host = process.env.BITCOIN_RPC_HOST || "http://127.0.0.1";
  const port = process.env.BITCOIN_RPC_PORT || "8332";
  const wallet = process.env.BITCOIN_RPC_WALLET;
  const base = `${host.replace(/\/$/, "")}:${port}`;
  return wallet ? `${base}/wallet/${encodeURIComponent(wallet)}` : base;
};

const rpcCall = async (method, params = []) => {
  const rpcUser = process.env.BITCOIN_RPC_USER;
  const rpcPass = process.env.BITCOIN_RPC_PASS;
  const rpcUrl = buildRpcUrl();

  if (!rpcUser || !rpcPass) {
    throw new Error("RPC credentials missing");
  }

  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${rpcUser}:${rpcPass}`).toString("base64")}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: method,
      method,
      params,
    }),
  });

  const payload = await response.json();

  if (!response.ok || payload.error) {
    const message = payload.error?.message || response.statusText;
    throw new Error(message);
  }

  return payload.result;
};

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Método no permitido" }),
    };
  }

  try {
    const address = await rpcCall("getnewaddress");
    const received = await rpcCall("listreceivedbyaddress", [0, true]);
    const addresses = (received || [])
      .map((entry) => entry.address)
      .filter(Boolean);

    if (address && !addresses.includes(address)) {
      addresses.unshift(address);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        address,
        addresses,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : "RPC error",
      }),
    };
  }
};
