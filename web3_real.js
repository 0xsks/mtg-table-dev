const fs = require('fs');
let code = fs.readFileSync('public/js/app.js', 'utf8');

// Replace UI
code = code.replace(
  /<div class="web3-provider-grid"[\s\S]*?<\/div>\s*`\s*\}/,
  `<div class="web3-provider-grid" style="display:grid;grid-template-columns:repeat(2, 1fr);gap:12px;margin-top:18px">
                <div class="card-panel web3-prov-card" style="text-align:center;padding:18px;cursor:pointer;border:1px solid var(--line)" id="prov-metamask">
                  <span style="font-size:40px">🦊</span>
                  <h4 style="margin:8px 0 4px 0">Ethereum Wallet</h4>
                  <p class="faint" style="font-size:11px;margin:0">MetaMask, Phantom (ETH), Coinbase</p>
                  <button type="button" class="btn small gold" style="margin-top:12px;width:100%">Connect EVM</button>
                </div>

                <div class="card-panel web3-prov-card" style="text-align:center;padding:18px;cursor:pointer;border:1px solid var(--line)" id="prov-phantom">
                  <span style="font-size:40px">👻</span>
                  <h4 style="margin:8px 0 4px 0">Solana Wallet</h4>
                  <p class="faint" style="font-size:11px;margin:0">Phantom, Solflare, Backpack</p>
                  <button type="button" class="btn small ghost" style="margin-top:12px;width:100%">Connect Solana</button>
                </div>
              </div>
            \`
            }`
);

// Remove the faux signature box entirely
code = code.replace(
  /<!-- Signature Challenge Modal Box -->[\s\S]*?<div id="web3-signing-box"[\s\S]*?<\/div>\s*<\/div>/,
  ''
);

// We need to replace the logic at the bottom of renderWeb3Auth
// Since there's multiple patches, let's just find the `const pMm = $("#prov-metamask");` block and replace it.
code = code.replace(
  /const swWalBtn = \$\("#btn-switch-wallet"\);[\s\S]*?const pMm = \$\("#prov-metamask"\);/,
  `const swWalBtn = $("#btn-switch-wallet");
      if (swWalBtn) {
        swWalBtn.onclick = () => {
          const cur = getCachedUser(second);
          if (cur) {
            cur.walletAddress = null;
            setCachedUser(cur, second);
          }
          draw();
        };
      }

      const pMm = $("#prov-metamask");`
);

// Replace the event listeners for pMm and pPh
code = code.replace(
  /const pMm = \$\("#prov-metamask"\);[\s\S]*?if \(pBu\) \{[\s\S]*?draw\(\);\n        \};\n      \}/,
  `const pMm = $("#prov-metamask");
      if (pMm) {
        pMm.onclick = async () => {
          try {
            const provider = window.ethereum;
            if (!provider) return toast("No EVM provider found. Install MetaMask or Phantom!");
            pMm.querySelector("button").textContent = "Connecting...";
            const accs = await provider.request({ method: "eth_requestAccounts" });
            const addr = accs[0];
            pMm.querySelector("button").textContent = "Signing...";
            
            const msg = \`Sign in to MTG Table:\\n\${addr}\\n\\nNonce: \${Date.now()}\`;
            const msgHex = "0x" + Array.from(new TextEncoder().encode(msg)).map(b => b.toString(16).padStart(2,"0")).join("");
            const sig = await provider.request({ method: "personal_sign", params: [msgHex, addr] });
            
            pMm.querySelector("button").textContent = "Verifying...";
            const res = await api("/api/auth/web3", {
                method: "POST", second,
                body: { address: addr, chain: "ethereum", signature: sig, message: msg }
            });
            if (res && res.token) {
                setToken(res.token, second);
                setCachedUser(res.user, second);
                closeModal();
                if (window.MTG_RPG?.updateUser) window.MTG_RPG.updateUser(res.user); else window.location.reload();
            } else toast(res.error || "Web3 auth failed");
          } catch(e) { toast("EVM Auth Error: " + (e.message || e)); pMm.querySelector("button").textContent = "Connect EVM"; }
        };
      }
      
      const pPh = $("#prov-phantom");
      if (pPh) {
        pPh.onclick = async () => {
          try {
            const provider = window.phantom?.solana || window.solana;
            if (!provider || !provider.isPhantom) return toast("No Phantom Solana wallet found!");
            pPh.querySelector("button").textContent = "Connecting...";
            const resp = await provider.connect();
            const addr = resp.publicKey.toString();
            pPh.querySelector("button").textContent = "Signing...";
            
            const msg = \`Sign in to MTG Table:\\n\${addr}\\n\\nNonce: \${Date.now()}\`;
            const encoded = new TextEncoder().encode(msg);
            const sigResp = await provider.signMessage(encoded, "utf8");
            // sigResp.signature is a Uint8Array. Convert to hex for transmission
            const sigHex = Array.from(sigResp.signature).map(b => b.toString(16).padStart(2, "0")).join("");
            
            pPh.querySelector("button").textContent = "Verifying...";
            const res = await api("/api/auth/web3", {
                method: "POST", second,
                body: { address: addr, chain: "solana", signature: sigHex, message: msg }
            });
            if (res && res.token) {
                setToken(res.token, second);
                setCachedUser(res.user, second);
                closeModal();
                if (window.MTG_RPG?.updateUser) window.MTG_RPG.updateUser(res.user); else window.location.reload();
            } else toast(res.error || "Web3 auth failed");
          } catch(e) { toast("Solana Auth Error: " + (e.message || e)); pPh.querySelector("button").textContent = "Connect Solana"; }
        };
      }
      
      const pBu = null;
      if (pBu) {
      `
);

// We need to strip out `triggerSignFlow` completely since we don't need it.
code = code.replace(/const triggerSignFlow = \(chain = "ethereum", providerName = "MetaMask"\) => \{[\s\S]*?if \(cancelBtn\) cancelBtn\.onclick = \(\) => \{ signBox\.style\.display = "none"; \};\n      \};\n/, '');

fs.writeFileSync('public/js/app.js', code);
