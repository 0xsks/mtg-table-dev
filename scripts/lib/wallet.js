"use strict";
// Shared wallet sign-in helper for the end-to-end test scripts.
//
// Password auth is gone, so tests can't register/login with a username and
// password. Instead each player gets a freshly generated random keypair,
// signs a server-issued challenge, and comes back with a bearer token — the
// same three-step flow a real browser wallet performs.
//
// Requires no new dependency: ethers is already a runtime dep of the server.

const path = require("path");
const { BASE } = require("./target.js");

const { ethers } = require(path.join(__dirname, "..", "..", "node_modules", "ethers"));

async function post(pathname, body) {
  const res = await fetch(BASE + pathname, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`POST ${pathname} -> ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
  }
  return json;
}

async function get(pathname, token) {
  const res = await fetch(BASE + pathname, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res.json().catch(() => ({}));
}

/**
 * Generate a throwaway wallet and sign in with it.
 * Returns the user record (id, username, displayName, balance, ...)
 * plus `token` and the underlying `wallet` for signing anything further.
 */
async function signIn({ displayName } = {}) {
  const wallet = ethers.Wallet.createRandom();
  const address = await wallet.getAddress();

  const challenge = await post("/api/auth/challenge", { address, chain: "ethereum" });
  if (!challenge.nonce || !challenge.message) {
    throw new Error("challenge response missing nonce/message: " + JSON.stringify(challenge));
  }

  const signature = await wallet.signMessage(challenge.message);
  const session = await post("/api/auth/wallet", {
    address,
    chain: "ethereum",
    signature,
    message: challenge.message,
    nonce: challenge.nonce,
    ...(displayName ? { displayName } : {}),
  });

  if (!session.token || !session.user) {
    throw new Error("wallet sign-in returned no token: " + JSON.stringify(session).slice(0, 200));
  }

  return { ...session.user, token: session.token, address, wallet };
}

/** Authorization header helper for fetch calls. */
function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

module.exports = { signIn, auth, get, post };
