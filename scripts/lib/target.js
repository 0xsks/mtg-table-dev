"use strict";
// Resolve which server the test scripts talk to.
//
// The server speaks HTTPS with a self-signed cert, so these default to
// https/wss. The older scripts hardcoded http:// and ws://, which could never
// actually reach it — they were dead before the wallet-auth change.
//
// Override with either of:
//   URL=https://host:port     full origin (BASE is accepted as an alias)
//   PORT=9000                 just the port, host stays 127.0.0.1

const PORT = process.env.PORT || 8877;
const ORIGIN = (process.env.URL || process.env.BASE || `https://127.0.0.1:${PORT}`).replace(/\/+$/, "");

// https -> wss, http -> ws
const WS_URL = process.env.WS_URL || ORIGIN.replace(/^http/, "ws") + "/ws";

// The cert is self-signed, so TLS verification has to be off for tests.
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === undefined) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

module.exports = { BASE: ORIGIN, WS_URL, PORT };
