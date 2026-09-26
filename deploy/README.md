# Deploying to a long-lived Node host

The app holds WebSocket connections and keeps live game state, so it needs a
long-lived process and a durable disk. It does not run on a serverless
platform like Vercel: those cannot hold a WebSocket open, they discard
filesystem writes between invocations, and they run many instances that cannot
see each other's memory.

This deploys it as a systemd service on a single host.

## Layout

| Path | Contents |
| --- | --- |
| `/opt/mtg-table` | the code, replaced on every deploy |
| `/var/lib/mtg-table` | all mutable state — accounts, tables, guilds, decks, images, the token secret |
| `/etc/mtg-table/env` | `AUTH_SECRET` and TLS paths, mode `0600` |

The split matters: `DATA_DIR` points the server at `/var/lib/mtg-table`, so
replacing `/opt/mtg-table` cannot destroy player data. The card catalog is
read-only and stays in the checkout, and is copied into a fresh state
directory on first boot so the deck library is present.

## One-time host setup

```bash
# node 20 or newer
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# service account
sudo useradd --system --home /opt/mtg-table --shell /usr/sbin/nologin mtg
sudo install -d -o mtg -g mtg -m 0750 /var/lib/mtg-table
```

## First deploy and every deploy after

```bash
deploy/deploy.sh user@your-host
```

The script syncs the code (excluding `node_modules` and mutable data), runs
`npm ci --omit=dev`, installs the systemd unit, generates `AUTH_SECRET` **only
if it is not already set**, restarts the service, and then checks that the
card catalog actually loaded.

Overrides: `APP_DIR`, `DATA_DIR`, `SERVICE`, `SERVICE_USER`.

## TLS

Unset, the server mints a self-signed certificate for its local interfaces and
browsers will warn. On a tailnet, issue a real one:

```bash
tailscale cert racknerd.your-tailnet.ts.net
```

then in `/etc/mtg-table/env`:

```
TLS_CERT=/var/lib/mtg-table/tls/fullchain.pem
TLS_KEY=/var/lib/mtg-table/tls/privkey.pem
```

`TLS_CERT` and `TLS_KEY` must be set together or the server refuses to start.
Wallet sign-in needs a trusted origin, so do not skip this if you intend to use
the app in a browser.

## What must be true of `AUTH_SECRET`

It signs every session token. It is generated once and then left alone,
because rotating it invalidates every outstanding token and logs everyone out.
It is stored outside the code directory, so it also survives a redeploy.

## Scaling past one host

This setup is deliberately single-instance. The authoritative state is on
disk, but live tables and challenge nonces live in process memory, so two
instances pointed at the same directory would disagree. Before running more
than one, move state into a shared database and move the image cache and
challenge store out of memory.

## Verifying a deploy

```bash
ssh user@your-host 'sudo journalctl -u mtg-table -n 80 --no-pager'
curl -sk https://your-host:8888/api/decks | head -c 200
```

Look for `catalog ready: ...` in the log. If the service will not start, the
usual cause is a missing `AUTH_SECRET` or a `TLS_CERT` without a `TLS_KEY`.
