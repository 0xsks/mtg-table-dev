const fs = require('fs');
let code = fs.readFileSync('public/js/app.js', 'utf8');

// The block to replace:
// const pMm = $("#prov-metamask");
// ... down to ...
// // Avatar Preset Buttons

const replacement = `const pMm = $("#prov-metamask");
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
                closeAuthModal();
                if (window.MTG_RPG?.updateUser) window.MTG_RPG.updateUser(res.user); else window.location.reload();
            } else {
                toast(res.error || "Web3 auth failed");
                pMm.querySelector("button").textContent = "Connect EVM";
            }
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
            const sigHex = Array.from(sigResp.signature).map(b => b.toString(16).padStart(2, "0")).join("");
            
            pPh.querySelector("button").textContent = "Verifying...";
            const res = await api("/api/auth/web3", {
                method: "POST", second,
                body: { address: addr, chain: "solana", signature: sigHex, message: msg }
            });
            if (res && res.token) {
                setToken(res.token, second);
                setCachedUser(res.user, second);
                closeAuthModal();
                if (window.MTG_RPG?.updateUser) window.MTG_RPG.updateUser(res.user); else window.location.reload();
            } else {
                toast(res.error || "Web3 auth failed");
                pPh.querySelector("button").textContent = "Connect Solana";
            }
          } catch(e) { toast("Solana Auth Error: " + (e.message || e)); pPh.querySelector("button").textContent = "Connect Solana"; }
        };
      }

      // Avatar Preset Buttons`;

code = code.replace(/const pMm = \$\("#prov-metamask"\);[\s\S]*?\/\/ Avatar Preset Buttons/, replacement);

// And strip out triggerSignFlow if it exists
code = code.replace(/const triggerSignFlow = \(chain = "ethereum", providerName = "MetaMask"\) => \{[\s\S]*?if \(cancelBtn\) cancelBtn\.onclick = \(\) => \{ signBox\.style\.display = "none"; \};\n      \};\n/, '');

fs.writeFileSync('public/js/app.js', code);
