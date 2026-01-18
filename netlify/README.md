# Netlify deployment

This folder contains the Netlify frontend and serverless functions used by the demo wallet UI.

## Required environment variables

The Netlify Functions expect access to a Bitcoin Core JSON-RPC endpoint that is reachable from Netlify.
Configure **either** a full RPC URL or the host/port pair:

- `BITCOIN_RPC_URL` (e.g. `https://user:pass@rpc.example.com:8332/wallet/mywallet`)
- `BITCOIN_RPC_HOST` and `BITCOIN_RPC_PORT` (e.g. `https://rpc.example.com` and `8332`)

Also set RPC credentials:

- `BITCOIN_RPC_USER`
- `BITCOIN_RPC_PASS`

Optional:

- `BITCOIN_RPC_WALLET` (wallet name appended to the URL when using host/port)
- `BITCOIN_NETWORK` (network label for antifraud metadata, default: `mainnet`)

## Seed backup endpoint variables

The seed backup endpoint (`/api/seed/backup`) can return a mocked seed for demo purposes. Configure
how the seed is sourced:

- `WALLET_SEED_STRATEGY` (`in_app` to return a mocked seed, anything else to omit seed words)
- `WALLET_SEED_WORDS` (optional, space-separated seed words returned when `WALLET_SEED_STRATEGY=in_app`)

## Optional environment variables for new endpoints

The new mock endpoints for mining, contracts, and CoinJoin do not require additional secrets.
If you want to label the mode shown in the UI responses, set:

- `MINING_MODE` (default: `mock`)
- `CONTRACTS_MODE` (default: `mock`)
- `COINJOIN_MODE` (default: `mock`)

## Antifraud ML service

The antifraud validation endpoint (`/api/antifraud/validate`) can call an external ML pipeline that
executes the 32-model ensemble. Configure the service URL and optional token:

- `ANTIFRAUD_ML_URL` (URL to the ML scoring endpoint)
- `ANTIFRAUD_ML_TOKEN` (optional bearer token for the service)
- `ANTIFRAUD_ML_TIMEOUT_MS` (optional timeout in ms, default: 4500)

You can also tune the decision policy and retention metadata returned to the UI:

- `ANTIFRAUD_THRESHOLD` (score threshold between 0 and 1, default: 0.7)
- `ANTIFRAUD_RETENTION_DAYS` (numeric metadata for retention policy)

**Contract expected from the ML service**

Request body:

```
{
  "transaction": {
    "address": "bc1q...",
    "amount": 0.25,
    "feeRate": 12,
    "network": "mainnet"
  },
  "ensemble": {
    "expectedModels": 32
  },
  "metadata": {
    "source": "netlify-wallet"
  }
}
```

Response body:

```
{
  "score": 0.42,
  "decision": "approve",
  "reason": "Riesgo bajo por comportamiento esperado.",
  "modelVersion": "ensemble-32-v3",
  "modelCount": 32,
  "signals": ["monto_medio", "direccion_segwit"]
}
```

When `ANTIFRAUD_ML_URL` is not set, the Netlify function runs a local mock ensemble of 32 networks.

### Privacy and retention

The antifraud validation forwards transaction metadata (address, amount, fee rate, network) to the
configured ML service. Ensure you have a privacy policy in place for any external processing and set
`ANTIFRAUD_RETENTION_DAYS` to match your retention commitments.

## Antifraud mesh signal exchange protocol

This protocol defines how internal antifraud signals are exchanged between peers or with an
aggregator. Messages are compact for real-time scoring and can be encoded as JSON (debug/ops) or
CBOR (binary, production). Required fields are identical across encodings.

### Message schema (JSON/CBOR)

```json
{
  "version": "1.0",
  "modelId": "ensemble-32-v3",
  "requestId": "req_01HZX9E2B9ZP0VZB2MZ2G6PX7Q",
  "signalVector": [0.14, 0.91, 0.02, 0.33],
  "confidence": 0.84,
  "timestamp": "2024-05-19T20:19:03.221Z",
  "nonce": "b5d15f1a-36c8-4f18-8a91-5ed2de0a2f2a",
  "metadata": {
    "network": "mainnet",
    "peerId": "mesh-node-07",
    "featureVersion": "fv3"
  }
}
```

**Required fields**

- `version`: Semantic version of the protocol (string, e.g. `1.0`).
- `modelId`: Unique model/ensemble identifier (string).
- `requestId`: Correlates signals across peers and the decision path (string).
- `signalVector`: Ordered numeric vector; length agreed by `modelId` (array of floats).
- `confidence`: 0.0–1.0 confidence score for the local model (float).
- `timestamp`: ISO 8601 UTC timestamp of emission (string).
- `nonce`: Unique per-message nonce for replay protection (string/uuid or 96-bit random).

**Optional fields**

- `metadata`: Extra fields for routing and auditing (object).
- `signature`: Detached Ed25519 signature over the canonical payload (base64).

### Versioning and size limits

- **Versioning:** `version` is semver. Backwards-compatible additions should not change existing
  field meaning. Breaking changes bump the major version (`2.0`).
- **Size limits:** enforce 8 KB maximum per message (after encoding). Recommended:
  `signalVector.length <= 256`, `metadata` <= 2 KB, and `requestId` <= 64 bytes.

### Transport selection

- **P2P mesh:** prefer **WebRTC** (data channels) or **QUIC** for low-latency peer discovery and
  NAT traversal.
- **Centralized aggregator:** use **gRPC over HTTPS** for streaming and fan-in/fan-out.

### Encryption + signing (end-to-end)

- **Key agreement:** X25519 (NaCl/libsodium).
- **Payload encryption:** ChaCha20-Poly1305 with a random 96-bit nonce per message.
- **Signatures:** Ed25519 over the canonicalized payload (before encryption) to prevent tampering.
- **Replay protection:** reject duplicate nonces per `(requestId, modelId)` within a sliding window.

### Validation flow

```
broadcast (peer emits signal)
        |
        v
quorum (collect N-of-M valid, signed signals)
        |
        v
aggregation (weighted fusion of signalVector + confidence)
        |
        v
decision (approve / review / reject)
```

### Mesh-related environment variables

Configure the antifraud mesh in the Netlify function environment:

- `ANTIFRAUD_MESH_ENDPOINT` (mesh or aggregator endpoint URL)
- `ANTIFRAUD_MESH_PUBLIC_KEY` (Ed25519 public key, base64/hex)
- `ANTIFRAUD_MESH_PRIVATE_KEY` (Ed25519 private key, base64/hex; keep secret)
- `ANTIFRAUD_MESH_TIMEOUT_MS` (timeout in ms for mesh requests)

## RPC connectivity requirement

Netlify must be able to reach the Bitcoin Core RPC endpoint over the network (publicly accessible or via an approved tunnel/VPN). A local-only node on your workstation will not be reachable from Netlify.
