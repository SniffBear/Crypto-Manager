# Nexus Vault — Mobile & Web Client

Expo Router client for the Solana Vault backend. The app is designed around a local encrypted vault and authenticated API sessions.

## Requirements

- Node.js 22 LTS or newer compatible with the Expo SDK in `package.json`
- npm
- Android Studio / Xcode for native simulators, or a browser for web

## Setup

```bash
cp .env.example .env
npm ci
npm run start
```

Set `EXPO_PUBLIC_API_URL` for the backend address before starting Expo. The value is public and compiled into the client; do not put API keys, wallet secrets, or passwords in Expo environment variables. For a physical device, use the development computer's LAN address and configure the backend `FRONTEND_ORIGINS` accordingly.

## Quality checks

```bash
npm run typecheck
npm run lint
npm test
```

## Security model

- Session tokens are sent in the first WebSocket message, never in a query string.
- Provider credentials and private wallet material are managed by the backend and encrypted vault, not the client bundle.
- Live transaction execution is disabled by default in the backend. The client must treat execution availability as conditional and must display backend simulation results rather than optimistic assumptions.
- Do not add `.env`, keystore files, seed phrases, private keys, vault files, or backup exports to source control.