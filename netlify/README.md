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

## RPC connectivity requirement

Netlify must be able to reach the Bitcoin Core RPC endpoint over the network (publicly accessible or via an approved tunnel/VPN). A local-only node on your workstation will not be reachable from Netlify.
