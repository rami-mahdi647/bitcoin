let walletState = {
  status: "loading",
  data: null,
  error: null,
};

let networkState = {
  status: "loading",
  data: null,
  error: null,
};

const availableBalance = document.getElementById("balance-available");
const pendingBalance = document.getElementById("balance-pending");
const lastMovement = document.getElementById("last-movement");
const availableHint = document.getElementById("available-hint");
const activeAddressCode = document.getElementById("active-address");
const copyActiveAddressButton = document.getElementById("copy-active-address");
const activeAddressStatus = document.getElementById("active-address-status");
const historyList = document.getElementById("history-list");
const addressList = document.getElementById("address-list");
const qrCode = document.getElementById("qr-code");

const sendForm = document.getElementById("send-form");
const addressInput = document.getElementById("send-address");
const amountInput = document.getElementById("send-amount");
const feeSelect = document.getElementById("send-fee");
const estimateButton = document.getElementById("estimate");
const formStatus = document.getElementById("form-status");
const addressError = document.getElementById("address-error");
const amountError = document.getElementById("amount-error");
const feeError = document.getElementById("fee-error");
const defaultFormStatus = formStatus ? formStatus.textContent : "";

const networkStatus = document.getElementById("network-status");
const blockHeight = document.getElementById("block-height");
const syncState = document.getElementById("sync-state");
const syncPercent = document.getElementById("sync-percent");
const syncProgress = document.getElementById("sync-progress");
const syncChip = document.getElementById("sync-chip");
const latency = document.getElementById("latency");
const mempool = document.getElementById("mempool");
const nextBlock = document.getElementById("next-block");
const peersInbound = document.getElementById("peers-inbound");
const peersOutbound = document.getElementById("peers-outbound");

const copyAddressButton = document.getElementById("copy-address");
const newAddressButton = document.getElementById("new-address");
const receiveStatus = document.getElementById("receive-status");
const receiveAmountInput = document.getElementById("receive-amount");

const seedSection = document.getElementById("seed-section");
const seedBox = document.getElementById("seed-phrase");
const toggleSeedButton = document.getElementById("toggle-seed");
const backupSeedButton = document.getElementById("backup-seed");
const seedStatus = document.getElementById("seed-status");

const miningForm = document.getElementById("mining-form");
const miningPoolInput = document.getElementById("mining-pool");
const miningHashrateInput = document.getElementById("mining-hashrate");
const miningPayoutInput = document.getElementById("mining-payout");
const miningStatus = document.getElementById("mining-status");

const contractsForm = document.getElementById("contracts-form");
const contractsTemplateInput = document.getElementById("contracts-template");
const contractsAmountInput = document.getElementById("contracts-amount");
const contractsExpiryInput = document.getElementById("contracts-expiry");
const contractsStatus = document.getElementById("contracts-status");

const coinjoinForm = document.getElementById("coinjoin-form");
const coinjoinInputsInput = document.getElementById("coinjoin-inputs");
const coinjoinOutputsInput = document.getElementById("coinjoin-outputs");
const coinjoinRoundsSelect = document.getElementById("coinjoin-rounds");
const coinjoinStatus = document.getElementById("coinjoin-status");

let seedVisible = false;
let seedWordsCache = [];

const formatBtc = (value) => `${Number(value || 0).toFixed(4)} BTC`;

const setTooltip = (element, text) => {
  if (!element) {
    return;
  }
  element.title = text;
  element.dataset.tooltip = text;
};

const setStatusMessage = (element, message, tone = "neutral") => {
  if (!element) {
    return;
  }
  element.textContent = message;
  element.classList.remove("is-success", "is-error");
  if (tone === "success") {
    element.classList.add("is-success");
  }
  if (tone === "error") {
    element.classList.add("is-error");
  }
};

const readJsonPayload = async (response) => {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
};

const isRpcConfigError = (message) =>
  typeof message === "string" && message.includes("BITCOIN_RPC");

const showRpcConfigAlert = (message) => {
  if (!formStatus || !message) {
    return;
  }
  formStatus.textContent = message;
  formStatus.dataset.rpcAlert = "true";
};

const clearRpcConfigAlert = () => {
  if (!formStatus) {
    return;
  }
  if (formStatus.dataset.rpcAlert === "true") {
    formStatus.textContent = defaultFormStatus || "Listo para firmar y transmitir.";
    delete formStatus.dataset.rpcAlert;
  }
};

const getWalletData = () =>
  walletState.data || {
    available: 0,
    pending: 0,
    lastMovement: 0,
    addresses: [],
    seedWords: [],
    history: [],
  };

const updateBalances = () => {
  if (walletState.status === "loading") {
    availableBalance.textContent = "Cargando...";
    pendingBalance.textContent = "Cargando...";
    lastMovement.textContent = "Cargando...";
    availableHint.textContent = "—";
    if (activeAddressCode) {
      activeAddressCode.textContent = "Cargando...";
    }
    if (copyActiveAddressButton) {
      copyActiveAddressButton.disabled = true;
    }
    if (activeAddressStatus) {
      activeAddressStatus.textContent = "Esperando datos de la wallet.";
    }
    return;
  }

  if (walletState.status === "error") {
    availableBalance.textContent = "—";
    pendingBalance.textContent = "—";
    lastMovement.textContent = "—";
    availableHint.textContent = "—";
    if (activeAddressCode) {
      activeAddressCode.textContent = "Sin datos";
    }
    if (copyActiveAddressButton) {
      copyActiveAddressButton.disabled = true;
    }
    if (activeAddressStatus) {
      activeAddressStatus.textContent = "No se pudo cargar la dirección.";
    }
    return;
  }

  const data = getWalletData();
  availableBalance.textContent = formatBtc(data.available);
  pendingBalance.textContent = formatBtc(data.pending);
  lastMovement.textContent = `${data.lastMovement > 0 ? "+" : ""}${Number(data.lastMovement || 0).toFixed(4)} BTC`;
  availableHint.textContent = Number(data.available || 0).toFixed(4);
  if (activeAddressCode) {
    activeAddressCode.textContent = data.addresses[0] || "Sin dirección disponible";
  }
  if (copyActiveAddressButton) {
    copyActiveAddressButton.disabled = !data.addresses[0];
  }
  if (activeAddressStatus) {
    activeAddressStatus.textContent = data.addresses[0]
      ? "Lista para compartir."
      : "Genera una nueva dirección para recibir fondos.";
  }
};

const renderHistory = () => {
  historyList.innerHTML = "";

  if (walletState.status === "loading") {
    const li = document.createElement("li");
    li.className = "history-item";
    li.textContent = "Cargando movimientos...";
    historyList.appendChild(li);
    return;
  }

  if (walletState.status === "error") {
    const li = document.createElement("li");
    li.className = "history-item";
    li.textContent = "No se pudo cargar el historial. Intenta de nuevo.";
    historyList.appendChild(li);
    return;
  }

  const data = getWalletData();
  if (!data.history.length) {
    const li = document.createElement("li");
    li.className = "history-item";
    li.textContent = "Sin movimientos recientes.";
    historyList.appendChild(li);
    return;
  }

  data.history.forEach((item) => {
    const li = document.createElement("li");
    li.className = "history-item";
    li.innerHTML = `
      <div class="history-meta">
        <span>${item.type} · ${item.id}</span>
        <span class="status-pill tx-status ${item.status === "confirmado" ? "confirmed" : item.status === "pendiente" ? "pending" : "failed"}">
          ${item.status}
        </span>
      </div>
      <strong>${item.amount}</strong>
      <div class="history-meta">
        <span>${item.from}</span>
        <span>${item.time}</span>
      </div>
    `;
    historyList.appendChild(li);
  });
};

const renderAddresses = () => {
  addressList.innerHTML = "";

  if (walletState.status === "loading") {
    const li = document.createElement("li");
    li.className = "address-item";
    li.textContent = "Cargando direcciones...";
    addressList.appendChild(li);
    return;
  }

  if (walletState.status === "error") {
    const li = document.createElement("li");
    li.className = "address-item";
    li.textContent = "No se pudieron cargar las direcciones.";
    addressList.appendChild(li);
    return;
  }

  const data = getWalletData();
  if (!data.addresses.length) {
    const li = document.createElement("li");
    li.className = "address-item";
    li.textContent = "Sin direcciones disponibles.";
    addressList.appendChild(li);
    return;
  }

  data.addresses.slice(0, 3).forEach((address, index) => {
    const li = document.createElement("li");
    li.className = "address-item";
    li.innerHTML = `
      <div>
        <div>Dirección ${index + 1}</div>
        <code>${address}</code>
      </div>
      <span class="helper">${index === 0 ? "Activa" : "Guardada"}</span>
    `;
    addressList.appendChild(li);
  });
};

const getReceiveAmount = () => {
  if (!receiveAmountInput) {
    return null;
  }
  const amount = Number(receiveAmountInput.value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  return amount;
};

const buildBitcoinUri = (address, amount) => {
  if (!address) {
    return "";
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return `bitcoin:${address}`;
  }
  return `bitcoin:${address}?amount=${amount}`;
};

const renderQr = () => {
  if (!qrCode) {
    return;
  }
  qrCode.innerHTML = "";
  const data = getWalletData();
  const address = data.addresses[0];

  if (!address) {
    qrCode.classList.add("qr-empty");
    qrCode.textContent = "Sin dirección disponible.";
    return;
  }

  const amount = getReceiveAmount();
  const payload = buildBitcoinUri(address, amount);
  const canvas = document.createElement("canvas");
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Código QR de recepción");
  qrCode.classList.remove("qr-empty");
  qrCode.appendChild(canvas);

  if (!window.QRCode || typeof window.QRCode.toCanvas !== "function") {
    qrCode.classList.add("qr-empty");
    qrCode.textContent = "No se pudo cargar el generador QR.";
    return;
  }

  window.QRCode.toCanvas(
    canvas,
    payload,
    {
      width: 220,
      margin: 1,
      color: {
        dark: "#7be7ff",
        light: "#050914",
      },
    },
    (error) => {
      if (error) {
        qrCode.classList.add("qr-empty");
        qrCode.textContent = "No se pudo generar el QR.";
      }
    },
  );
};

const resetErrors = () => {
  addressError.textContent = "";
  amountError.textContent = "";
  feeError.textContent = "";
};

const validateAddress = (value) => {
  const trimmed = value.trim();
  const startsOk = trimmed.startsWith("bc1") || trimmed.startsWith("1") || trimmed.startsWith("3");
  return trimmed.length >= 26 && startsOk;
};

const validateAmount = (value) => {
  const amount = Number(value);
  if (walletState.status !== "ready") {
    return false;
  }
  return !Number.isNaN(amount) && amount > 0 && amount <= getWalletData().available;
};

const validateFee = (value) => {
  const fee = Number(value);
  return !Number.isNaN(fee) && fee >= 1;
};

const simulateEstimate = () => {
  const fee = Number(feeSelect.value);
  if (!validateFee(fee)) {
    feeError.textContent = "Selecciona una tarifa válida.";
    return;
  }
  const eta = fee >= 20 ? "~10 min" : fee >= 12 ? "~25 min" : "~45 min";
  formStatus.textContent = `Tiempo estimado de confirmación: ${eta}.`;
};

const formatRiskScore = (score) => {
  if (!Number.isFinite(score)) {
    return "—";
  }
  return `${(score * 100).toFixed(1)}%`;
};

const requestAntifraudValidation = async ({ address, amount, feeRate }) => {
  const response = await fetch("/api/antifraud/validate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      address,
      amount,
      feeRate,
    }),
  });

  const payload = await readJsonPayload(response);
  if (!response.ok) {
    throw new Error(payload?.error || `Error antifraude (${response.status})`);
  }
  return payload;
};

const copyActiveAddress = async (statusElement) => {
  const data = getWalletData();
  const address = data.addresses[0];
  if (!address) {
    statusElement.textContent = "No hay dirección disponible.";
    return;
  }
  try {
    await navigator.clipboard.writeText(address);
    statusElement.textContent = "Dirección copiada. Comparte con cuidado.";
  } catch (error) {
    statusElement.textContent = "No se pudo copiar automáticamente.";
  }
};

sendForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  resetErrors();

  if (walletState.status !== "ready") {
    formStatus.textContent = "Espera a que cargue la información del wallet.";
    return;
  }

  const addressValue = addressInput.value.trim();
  const amountValue = amountInput.value;
  const feeValue = feeSelect.value;

  let hasError = false;

  if (!validateAddress(addressValue)) {
    addressError.textContent = "Dirección inválida. Revisa el formato (bc1, 1 o 3).";
    hasError = true;
  }

  if (!validateAmount(amountValue)) {
    amountError.textContent = "Monto inválido o superior al saldo disponible.";
    hasError = true;
  }

  if (!validateFee(feeValue)) {
    feeError.textContent = "Selecciona una tarifa válida.";
    hasError = true;
  }

  if (hasError) {
    formStatus.textContent = "Corrige los campos antes de continuar.";
    return;
  }

  const amountNumber = Number(amountValue);
  const feeNumber = Number(feeValue);
  formStatus.textContent = "Analizando riesgo antifraude...";

  try {
    const antifraud = await requestAntifraudValidation({
      address: addressValue,
      amount: amountNumber,
      feeRate: feeNumber,
    });

    const threshold = Number(antifraud?.threshold ?? 0.7);
    const riskScore = Number(antifraud?.score ?? 0);
    if (antifraud?.decision !== "approve" || riskScore >= threshold) {
      formStatus.textContent = antifraud?.reason
        ? `Transacción bloqueada por riesgo alto. ${antifraud.reason}`
        : "Transacción bloqueada por riesgo alto.";
      return;
    }

    formStatus.textContent = `Aprobada por análisis antifraude (${formatRiskScore(riskScore)}). Enviando transacción...`;

    const response = await fetch("/api/tx/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        address: addressValue,
        amount: amountNumber,
        feeRate: feeNumber,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error || `Error del backend (${response.status})`);
    }

    if (payload.wallet) {
      walletState = {
        status: "ready",
        data: {
          ...getWalletData(),
          ...payload.wallet,
        },
        error: null,
      };
      updateBalances();
      renderHistory();
      renderAddresses();
      renderQr();
    }

    if (payload.mempool?.bytes) {
      const mempoolValue = (payload.mempool.bytes / 1e6).toFixed(1);
      mempool.textContent = `${mempoolValue} MB`;
      setTooltip(mempool, `${mempoolValue} MB · tamaño del mempool en MB`);
    }

    formStatus.textContent = `Transacción ${payload.txid || ""} enviada (${payload.status || "pendiente"}).`;
    sendForm.reset();
  } catch (error) {
    formStatus.textContent =
      error instanceof Error ? error.message : "No se pudo enviar la transacción.";
  }
});

estimateButton.addEventListener("click", () => {
  resetErrors();
  simulateEstimate();
});

copyAddressButton.addEventListener("click", async () => {
  await copyActiveAddress(receiveStatus);
});

if (copyActiveAddressButton && activeAddressStatus) {
  copyActiveAddressButton.addEventListener("click", async () => {
    await copyActiveAddress(activeAddressStatus);
  });
}

if (receiveAmountInput) {
  receiveAmountInput.addEventListener("input", () => {
    renderQr();
  });
}

newAddressButton.addEventListener("click", async () => {
  if (walletState.status !== "ready") {
    receiveStatus.textContent = "No es posible generar una dirección aún.";
    return;
  }

  receiveStatus.textContent = "Generando dirección en el backend...";

  try {
    const response = await fetch("/api/wallet/new-address", {
      method: "POST",
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error || `Error del backend (${response.status})`);
    }

    walletState = {
      status: "ready",
      data: {
        ...getWalletData(),
        addresses: payload.addresses || (payload.address ? [payload.address] : []),
      },
      error: null,
    };
    renderAddresses();
    renderQr();
    updateBalances();
    receiveStatus.textContent = "Nueva dirección generada y lista para compartir.";
  } catch (error) {
    receiveStatus.textContent =
      error instanceof Error ? error.message : "No se pudo generar una nueva dirección.";
  }
});

const renderSeed = () => {
  if (!seedSection || !seedBox || !toggleSeedButton || !backupSeedButton || !seedStatus) {
    return;
  }

  if (walletState.status !== "ready") {
    seedSection.hidden = false;
    seedBox.textContent = "Cargando estado de la seed...";
    toggleSeedButton.disabled = true;
    backupSeedButton.disabled = true;
    return;
  }

  const data = getWalletData();
  if (data.seedStrategy !== "in_app") {
    seedWordsCache = [];
    seedVisible = false;
    seedSection.hidden = true;
    return;
  }

  seedSection.hidden = false;
  toggleSeedButton.disabled = false;
  backupSeedButton.disabled = false;

  if (!seedWordsCache.length) {
    seedBox.textContent = "Seed protegida. Usa el respaldo cifrado para almacenarla.";
    seedVisible = false;
    toggleSeedButton.textContent = "Mostrar seed";
    return;
  }

  seedBox.textContent = seedVisible ? seedWordsCache.join(" ") : "•••• •••• •••• •••• •••• ••••";
  toggleSeedButton.textContent = seedVisible ? "Ocultar seed" : "Mostrar seed";
};

const requestSeedCredentials = () => {
  const confirmed = window.confirm(
    "Estás por acceder al seed. Hazlo sólo en un entorno seguro. ¿Deseas continuar?",
  );
  if (!confirmed) {
    return null;
  }

  const confirmation = window.prompt('Escribe "RESPALDAR" para confirmar la acción.');
  if (!confirmation || confirmation.trim().toUpperCase() !== "RESPALDAR") {
    seedStatus.textContent = "Confirmación cancelada.";
    return null;
  }

  const password = window.prompt("Define una contraseña fuerte (mínimo 10 caracteres).");
  if (!password || password.trim().length < 10) {
    seedStatus.textContent = "Contraseña inválida.";
    return null;
  }

  const passwordRepeat = window.prompt("Repite la contraseña para continuar.");
  if (!passwordRepeat || passwordRepeat !== password) {
    seedStatus.textContent = "Las contraseñas no coinciden.";
    return null;
  }

  return { confirmation: confirmation.trim(), password: password.trim() };
};

toggleSeedButton.addEventListener("click", () => {
  if (seedVisible) {
    seedVisible = false;
    seedWordsCache = [];
    renderSeed();
    seedStatus.textContent = "Seed ocultada.";
    return;
  }

  const credentials = requestSeedCredentials();
  if (!credentials) {
    return;
  }

  seedStatus.textContent = "Validando acceso...";
  fetch("/api/seed/backup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...credentials, mode: "reveal" }),
  })
    .then(async (response) => {
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo revelar la seed.");
      }
      seedWordsCache = Array.isArray(payload.seedWords) ? payload.seedWords : [];
      seedVisible = true;
      renderSeed();
      seedStatus.textContent = "Seed revelada temporalmente. Ocúltala al terminar.";
    })
    .catch((error) => {
      seedStatus.textContent =
        error instanceof Error ? error.message : "No se pudo revelar la seed.";
    });
});

backupSeedButton.addEventListener("click", () => {
  const credentials = requestSeedCredentials();
  if (!credentials) {
    return;
  }

  seedStatus.textContent = "Generando respaldo cifrado...";
  fetch("/api/seed/backup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...credentials, mode: "export" }),
  })
    .then(async (response) => {
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo generar el respaldo.");
      }

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `seed-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);

      seedStatus.textContent = "Respaldo generado. Guarda el archivo cifrado con cuidado.";
    })
    .catch((error) => {
      seedStatus.textContent =
        error instanceof Error ? error.message : "No se pudo generar el respaldo.";
    });
});

if (miningForm) {
  miningForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const poolUrl = miningPoolInput?.value.trim();
    const hashrate = Number(miningHashrateInput?.value);
    const payoutAddress = miningPayoutInput?.value.trim();

    if (!poolUrl || !Number.isFinite(hashrate) || hashrate <= 0 || !payoutAddress) {
      setStatusMessage(
        miningStatus,
        "Completa el pool, hashrate y dirección de cobro.",
        "error",
      );
      return;
    }

    setStatusMessage(miningStatus, "Configurando minería en el backend...");

    try {
      const response = await fetch("/api/mining", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          poolUrl,
          hashrate,
          payoutAddress,
        }),
      });
      const payload = await readJsonPayload(response);
      if (!response.ok) {
        throw new Error(payload?.error || `Error del backend (${response.status})`);
      }

      setStatusMessage(
        miningStatus,
        payload?.message || "Minería activada y monitoreo en curso.",
        "success",
      );
      miningForm.reset();
    } catch (error) {
      setStatusMessage(
        miningStatus,
        error instanceof Error ? error.message : "No se pudo iniciar la minería.",
        "error",
      );
    }
  });
}

if (contractsForm) {
  contractsForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const template = contractsTemplateInput?.value.trim();
    const amount = Number(contractsAmountInput?.value);
    const expiry = contractsExpiryInput?.value;

    if (!template || !Number.isFinite(amount) || amount <= 0 || !expiry) {
      setStatusMessage(
        contractsStatus,
        "Incluye plantilla, monto válido y fecha de vencimiento.",
        "error",
      );
      return;
    }

    setStatusMessage(contractsStatus, "Generando borrador del contrato...");

    try {
      const response = await fetch("/api/contracts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          template,
          amount,
          expiry,
        }),
      });
      const payload = await readJsonPayload(response);
      if (!response.ok) {
        throw new Error(payload?.error || `Error del backend (${response.status})`);
      }

      setStatusMessage(
        contractsStatus,
        payload?.message || "Borrador listo para revisión y firma.",
        "success",
      );
      contractsForm.reset();
    } catch (error) {
      setStatusMessage(
        contractsStatus,
        error instanceof Error ? error.message : "No se pudo crear el contrato.",
        "error",
      );
    }
  });
}

if (coinjoinForm) {
  coinjoinForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const inputsRaw = coinjoinInputsInput?.value.trim();
    const outputsRaw = coinjoinOutputsInput?.value.trim();
    const rounds = Number(coinjoinRoundsSelect?.value || 0);

    if (!inputsRaw || !outputsRaw || !Number.isFinite(rounds) || rounds <= 0) {
      setStatusMessage(
        coinjoinStatus,
        "Define inputs, outputs y número de rondas.",
        "error",
      );
      return;
    }

    const inputs = inputsRaw.split(/[\n,]+/).map((entry) => entry.trim()).filter(Boolean);
    const outputs = outputsRaw.split(/[\n,]+/).map((entry) => entry.trim()).filter(Boolean);

    if (!inputs.length || !outputs.length) {
      setStatusMessage(
        coinjoinStatus,
        "Agrega al menos un input y un output.",
        "error",
      );
      return;
    }

    setStatusMessage(coinjoinStatus, "Coordinando sesión CoinJoin...");

    try {
      const response = await fetch("/api/coinjoin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs,
          outputs,
          rounds,
        }),
      });
      const payload = await readJsonPayload(response);
      if (!response.ok) {
        throw new Error(payload?.error || `Error del backend (${response.status})`);
      }

      setStatusMessage(
        coinjoinStatus,
        payload?.message || "CoinJoin iniciado. Esperando participantes.",
        "success",
      );
      coinjoinForm.reset();
    } catch (error) {
      setStatusMessage(
        coinjoinStatus,
        error instanceof Error ? error.message : "No se pudo iniciar CoinJoin.",
        "error",
      );
    }
  });
}

const formatChainLabel = (chain) => {
  if (chain === "main") {
    return "Red principal";
  }
  if (chain === "test") {
    return "Testnet";
  }
  if (chain === "signet") {
    return "Signet";
  }
  return chain ? chain.toUpperCase() : "Red";
};

const renderNetwork = () => {
  const latencyTooltipBase = "ms promedio entre peers";
  const mempoolTooltipBase = "tamaño del mempool en MB";
  if (networkState.status === "loading") {
    blockHeight.textContent = "Altura: Cargando...";
    syncState.textContent = "Peers: Cargando...";
    syncPercent.textContent = "—";
    latency.textContent = "—";
    mempool.textContent = "—";
    nextBlock.textContent = "—";
    setTooltip(latency, "No disponible");
    setTooltip(mempool, "No disponible");
    if (peersInbound) {
      peersInbound.textContent = "Entrantes: —";
    }
    if (peersOutbound) {
      peersOutbound.textContent = "Salientes: —";
    }
    networkStatus.textContent = "Red principal · Sincronizando";
    networkStatus.classList.add("warning");
    networkStatus.classList.remove("success");
    if (syncProgress) {
      syncProgress.style.width = "0%";
      syncProgress.classList.add("warning");
      syncProgress.classList.remove("success");
    }
    if (syncChip) {
      syncChip.textContent = "Sincronizando";
      syncChip.classList.add("warning");
      syncChip.classList.remove("success");
    }
    return;
  }

  if (networkState.status === "error") {
    blockHeight.textContent = "Altura: —";
    syncState.textContent = "Peers: —";
    syncPercent.textContent = "—";
    latency.textContent = "—";
    mempool.textContent = "—";
    nextBlock.textContent = "—";
    setTooltip(latency, "No disponible");
    setTooltip(mempool, "No disponible");
    if (peersInbound) {
      peersInbound.textContent = "Entrantes: —";
    }
    if (peersOutbound) {
      peersOutbound.textContent = "Salientes: —";
    }
    networkStatus.textContent = "Estado de red no disponible";
    networkStatus.classList.add("warning");
    networkStatus.classList.remove("success");
    if (syncProgress) {
      syncProgress.style.width = "0%";
      syncProgress.classList.add("warning");
      syncProgress.classList.remove("success");
    }
    if (syncChip) {
      syncChip.textContent = "Sin conexión";
      syncChip.classList.add("warning");
      syncChip.classList.remove("success");
    }
    return;
  }

  const data = networkState.data || {};
  const syncValue = Number(data.verificationProgress ?? 0);
  const syncPercentValue = Number.isFinite(syncValue)
    ? Math.min(Math.max(syncValue * 100, 0), 100)
    : 0;
  const syncDisplay = Number.isFinite(syncValue) ? syncPercentValue.toFixed(2) : "—";
  const peers = data.peers?.total ?? 0;
  const inboundPeers = Number.isFinite(data.peers?.inbound) ? data.peers.inbound : null;
  const outboundPeers = Number.isFinite(data.peers?.outbound) ? data.peers.outbound : null;
  const height = Number.isFinite(data.blocks) ? data.blocks : null;
  const latencyValue = Number.isFinite(data.avgPingMs) ? Math.round(data.avgPingMs) : null;
  const mempoolValue = Number.isFinite(data.mempoolBytes)
    ? (data.mempoolBytes / (1024 * 1024)).toFixed(1)
    : null;
  const nextBlockMinutes = Number.isFinite(data.nextBlockMinutes) ? Math.round(data.nextBlockMinutes) : 10;
  const chainLabel = formatChainLabel(data.chain);

  blockHeight.textContent = height ? `Altura: ${height.toLocaleString("es-ES")}` : "Altura: —";
  syncState.textContent = `Peers: ${peers} activos`;
  syncPercent.textContent = syncDisplay === "—" ? "—" : `${syncDisplay}%`;
  latency.textContent = latencyValue !== null ? `${latencyValue} ms` : "—";
  mempool.textContent = mempoolValue !== null ? `${mempoolValue} MB` : "—";
  setTooltip(
    latency,
    latencyValue !== null ? `${latencyValue} ${latencyTooltipBase}` : "No disponible"
  );
  setTooltip(
    mempool,
    mempoolValue !== null ? `${mempoolValue} MB · ${mempoolTooltipBase}` : "No disponible"
  );
  nextBlock.textContent = `~${nextBlockMinutes} min`;
  if (peersInbound) {
    peersInbound.textContent = `Entrantes: ${inboundPeers !== null ? inboundPeers : "—"}`;
  }
  if (peersOutbound) {
    peersOutbound.textContent = `Salientes: ${outboundPeers !== null ? outboundPeers : "—"}`;
  }

  const isSynced = Number.isFinite(syncValue) ? syncValue >= 0.9995 : false;
  networkStatus.textContent = isSynced ? `${chainLabel} · Sincronizada` : `${chainLabel} · Sincronizando`;
  networkStatus.classList.toggle("warning", !isSynced);
  networkStatus.classList.toggle("success", isSynced);
  if (syncProgress) {
    syncProgress.style.width = `${syncPercentValue}%`;
    syncProgress.classList.toggle("warning", !isSynced);
    syncProgress.classList.toggle("success", isSynced);
  }
  if (syncChip) {
    syncChip.textContent = isSynced ? "Completo" : "En progreso";
    syncChip.classList.toggle("warning", !isSynced);
    syncChip.classList.toggle("success", isSynced);
  }
};

const cycleNetwork = async () => {
  networkState = { status: "loading", data: null, error: null };
  renderNetwork();

  try {
    const response = await fetch("/api/network/status");
    let payload = null;
    try {
      payload = await response.json();
    } catch (parseError) {
      payload = null;
    }
    if (!response.ok) {
      throw new Error(payload?.error || `Respuesta inválida (${response.status})`);
    }
    networkState = { status: "ready", data: payload, error: null };
    clearRpcConfigAlert();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    if (isRpcConfigError(message)) {
      showRpcConfigAlert(message);
    }
    networkState = {
      status: "error",
      data: null,
      error: message,
    };
  }

  renderNetwork();
};

const loadWalletSummary = async () => {
  walletState = { status: "loading", data: null, error: null };
  updateBalances();
  renderHistory();
  renderAddresses();
  renderQr();
  renderSeed();

  try {
    const response = await fetch("/api/wallet/summary");
    let payload = null;
    try {
      payload = await response.json();
    } catch (parseError) {
      payload = null;
    }
    if (!response.ok) {
      throw new Error(payload?.error || `Respuesta inválida (${response.status})`);
    }
    walletState = { status: "ready", data: payload, error: null };
    clearRpcConfigAlert();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    if (isRpcConfigError(message)) {
      showRpcConfigAlert(message);
    }
    walletState = {
      status: "error",
      data: null,
      error: message,
    };
  }

  updateBalances();
  renderHistory();
  renderAddresses();
  renderQr();
  renderSeed();
};

loadWalletSummary();
cycleNetwork();
setInterval(cycleNetwork, 6000);
