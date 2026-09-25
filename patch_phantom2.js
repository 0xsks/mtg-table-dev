const fs = require('fs');
let code = fs.readFileSync('public/js/app.js', 'utf8');

const replacement = `
      const pPh = $("#prov-phantom");
      if (pPh) {
        pPh.onclick = async () => {
           try {
             const provider = window.phantom?.ethereum || (window.ethereum?.isPhantom ? window.ethereum : null);
             if (!provider) {
                toast("Phantom Wallet not detected! Please install Phantom.");
                return;
             }
             
             pPh.querySelector("button").disabled = true;
             pPh.querySelector("button").textContent = "Connecting...";
             
             // Request accounts
             const accounts = await provider.request({ method: "eth_requestAccounts" });
             if (!accounts || accounts.length === 0) {
               pPh.querySelector("button").disabled = false;
               pPh.querySelector("button").textContent = "Connect Phantom";
               return;
             }
             const addr = accounts[0];
             
             let chainId = "unknown";
             try { chainId = await provider.request({ method: "eth_chainId" }); } catch(e) {}
             
             // Sign message
             const nonce = "0x" + Math.random().toString(16).slice(2, 10);
             const message = \`\${location.host} wants you to sign in with your Ethereum account:\\n\${addr}\\n\\nSign in to Multiverse Hearth to unlock decentralized wagers, save custom decks, and claim 1,000 Starter Gold.\\n\\nURI: \${location.origin}\\nVersion: 1\\nChain ID: \${chainId}\\nNonce: \${nonce}\\nIssued At: \${new Date().toISOString()}\`;
             
             let signature = "";
             try {
                pPh.querySelector("button").textContent = "Sign Wallet Prompt...";
                // Phantom ETH requires personal_sign with hex encoded payload or plain text
                const msgHex = "0x" + Array.from(new TextEncoder().encode(message)).map(b => b.toString(16).padStart(2, "0")).join("");
                signature = await provider.request({ method: "personal_sign", params: [msgHex, addr] });
             } catch (sigErr) {
                toast("Signing rejected: " + sigErr.message);
                pPh.querySelector("button").disabled = false;
                pPh.querySelector("button").textContent = "Connect Phantom";
                return;
             }
             
             // Send to server
             pPh.querySelector("button").textContent = "Verifying...";
             const res = await api("/api/auth/web3", {
                 method: "POST",
                 second,
                 body: { address: addr, chain: "ethereum_testnet", signature, message }
             });
             if (res && res.token) {
                 setToken(res.token, second);
                 setCachedUser(res.user, second);
                 closeAuthModal();
                 if (typeof window.MTG_RPG !== "undefined" && window.MTG_RPG.updateUser) window.MTG_RPG.updateUser(res.user);
                 else draw();
                 toast("Web3 Phantom Connected! (ETH Testnet)");
             } else {
                 toast(res.error || "Web3 auth failed");
             }
           } catch(e) {
             toast("Phantom connection failed: " + (e.message || e));
             pPh.querySelector("button").disabled = false;
             pPh.querySelector("button").textContent = "Connect Phantom";
           }
        };
      }`;

code = code.replace(/const pPh = \$\("#prov-phantom"\);\s*if \(pPh\) pPh\.onclick = \(\) => triggerSignFlow\("solana", "Phantom"\);/, replacement);
// Also change "Phantom (Faux)" to "Phantom (ETH)"
code = code.replace(/<h4 style="margin:8px 0 4px 0">Phantom \(Faux\)<\/h4>/, '<h4 style="margin:8px 0 4px 0">Phantom (ETH)</h4>');

fs.writeFileSync('public/js/app.js', code);
