const fs = require('fs');
let code = fs.readFileSync('public/js/app.js', 'utf8');

const replacement = `
      const phantomBtn = $("#prov-phantom");
      if (phantomBtn) {
        phantomBtn.onclick = async () => {
           try {
             const provider = window.phantom?.ethereum || (window.ethereum?.isPhantom ? window.ethereum : null);
             if (!provider) {
                toast("Phantom Wallet not detected! Please install Phantom.");
                return;
             }
             // Switch to Sepolia Testnet logic? We can request eth_chainId just to check.
             const accounts = await provider.request({ method: "eth_requestAccounts" });
             if (!accounts || accounts.length === 0) return;
             const addr = accounts[0];
             
             let chainId = "unknown";
             try { chainId = await provider.request({ method: "eth_chainId" }); } catch(e) {}
             
             // Sign message
             const nonce = "0x" + Math.random().toString(16).slice(2, 10);
             const message = \`\${location.host} wants you to sign in with your Ethereum account:\\n\${addr}\\n\\nSign in to Multiverse Hearth to unlock decentralized wagers, save custom decks, and claim 1,000 Starter Gold.\\n\\nURI: \${location.origin}\\nVersion: 1\\nChain ID: \${chainId}\\nNonce: \${nonce}\\nIssued At: \${new Date().toISOString()}\`;
             
             let signature = "";
             try {
                // Some providers want hex string, some just want string
                const msgHex = "0x" + Array.from(new TextEncoder().encode(message)).map(b => b.toString(16).padStart(2, "0")).join("");
                signature = await provider.request({ method: "personal_sign", params: [msgHex, addr] });
             } catch (sigErr) {
                // fallback for some Solana phantom implementations if they don't support personal_sign on eth yet
                // But Phantom eth DOES support personal_sign!
                toast("Signing rejected: " + sigErr.message);
                return;
             }
             
             // Send to server
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
                 toast("Web3 Phantom Connected!");
             } else {
                 toast(res.error || "Web3 auth failed");
             }
           } catch(e) {
             toast("Phantom connection failed: " + (e.message || e));
           }
        };
      }`;

code = code.replace(/const phantomBtn = \$\("#prov-phantom"\);\s*if \(phantomBtn\) phantomBtn\.onclick = \(\) => triggerSignFlow\("solana", "Phantom"\);/, replacement);

// We should also update the HTML description to reflect real ETH Testnet
code = code.replace(/<p class="faint" style="font-size:11px;margin:0">Simulate Solana Phantom wallet connection<\/p>/, '<p class="faint" style="font-size:11px;margin:0">Real Ethereum Testnet Phantom Wallet connection</p>');

fs.writeFileSync('public/js/app.js', code);
