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

## RPC connectivity requirement

Netlify must be able to reach the Bitcoin Core RPC endpoint over the network (publicly accessible or via an approved tunnel/VPN). A local-only node on your workstation will not be reachable from Netlify.
