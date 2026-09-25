(() => {
  const { $, $$, api, toast, escapeHtml, nav, bindNav, manaPips, go, openModal, closeModal, getCachedUser, identity } = window.MTG;

  function emptyDeck() {
    return { id: null, name: "Untitled deck", format: "duel", commander: null, cards: [] };
  }

  function counts(deck) {
    let main = 0, side = 0, command = 0;
    for (const r of deck.cards) {
      const n = r.count || 1;
      if (r.board === "side") side += n;
      else if (r.board === "command") command += n;
      else main += n;
    }
    return { main, side, command };
  }

  function curve(deck) {
    const bins = [0, 0, 0, 0, 0, 0, 0, 0];
    for (const r of deck.cards) {
      if (r.board && r.board !== "main") continue;
      const c = Math.min(7, Math.floor(r.cmc || 0));
      bins[c] += r.count || 1;
    }
    return bins;
  }

  function addCard(deck, card, board = "main") {
    const existing = deck.cards.find((r) => r.id === card.id && (r.board || "main") === board);
    const max = deck.format === "commander" && board !== "side" ? 1 : 4;
    if (existing) existing.count = Math.min(max, (existing.count || 1) + 1);
    else {
      deck.cards.push({
        id: card.id,
        name: card.name,
        count: 1,
        board,
        mana_cost: card.mana_cost,
        type_line: card.type_line,
        cmc: card.cmc,
        colors: card.colors,
        image_small: card.image_small,
      });
    }
    if (board === "command") deck.commander = { id: card.id, name: card.name };
  }

  window.MTG.openBuilderModal = async function openBuilderModal(r = {}) {
    const app = document.getElementById("app");
    const second = window.MTG_SECOND;
    const user = getCachedUser(second);
    const me = identity(second);

    // Fetch all decks so player's saved decks appear FIRST
    let allDecks = [];
    try {
      allDecks = (await api("/api/decks")) || [];
    } catch {
      allDecks = [];
    }

    const myDecks = allDecks.filter((d) => {
      if (user && d.userId === user.id) return true;
      if (!user && (d.userId === me.id || (!d.userId && !d.starter))) return true;
      return false;
    });
    const starterDecks = allDecks.filter((d) => d.starter);
    const otherDecks = allDecks.filter((d) => !myDecks.some((m) => m.id === d.id) && !d.starter);
    let sortedDecks = [...myDecks, ...starterDecks, ...otherDecks];

    let deck = emptyDeck();
    if (r.id) {
      try {
        deck = await api(`/api/decks/${r.id}`);
      } catch {
        toast("Deck not found");
      }
    } else if (!r.isNew && myDecks.length > 0) {
      // Player's saved deck appears first! Load their primary saved deck
      try {
        deck = await api(`/api/decks/${myDecks[0].id}`);
      } catch {
        deck = emptyDeck();
      }
    }

    function renderDeckPills() {
      let html = "";
      if (myDecks.length > 0) {
        html += `<div style="font-size:10px; color:var(--gold-2); margin-top:8px; margin-bottom:4px; font-weight:bold; width: 100%;">🎴 Your Saved Decks</div>`;
        html += myDecks.map(renderPill).join("");
      } else {
        html += `<div style="font-size:10px; color:var(--muted); margin-top:8px; margin-bottom:4px; font-style:italic; width: 100%;">No saved decks yet.</div>`;
      }
      
      const rest = sortedDecks.filter(d => !myDecks.some(m => m.id === d.id));
      if (rest.length > 0) {
        html += `<div style="font-size:10px; color:#38bdf8; margin-top:12px; margin-bottom:4px; font-weight:bold; width: 100%;">⭐ Starter & Guest Decks</div>`;
        html += rest.map(renderPill).join("");
      }
      return html;
    }
    
    function renderPill(d) {
        const isMine = myDecks.some((m) => m.id === d.id);
        const isActive = deck && deck.id === d.id;
        return `
          <button type="button" class="builder-deck-pill ${isActive ? "active" : ""} ${isMine ? "is-mine" : "is-starter"}" data-did="${d.id}" title="${escapeHtml(d.name)} (${d.format})">
            <span class="builder-deck-pill-icon">${isMine ? "🎴" : "⭐"}</span>
            <span class="builder-deck-pill-name">${escapeHtml(d.name)}</span>
            <span class="builder-deck-pill-count">${(d.counts && (d.counts.main + d.counts.command)) || ""}</span>
          </button>
        `;
    }

    if(window.MTG.openModal) window.MTG.openModal(`<div class="builder builder-hud" style="width: 100%; height: 100%; box-sizing: border-box; overflow: hidden;">
        <div class="builder-left">
          <div class="row">
            <input class="grow" id="q" type="search" placeholder="Search spells, faeries, artifacts, dragons… ✨" />
            <select id="type">
              <option value="">Any type</option>
              <option>Creature</option>
              <option>Instant</option>
              <option>Sorcery</option>
              <option>Enchantment</option>
              <option>Artifact</option>
              <option>Planeswalker</option>
              <option>Land</option>
              <option>Battle</option>
            </select>
            <select id="era">
              <option value="">Any era</option>
            </select>
            <select id="set">
              <option value="">Any set</option>
            </select>
          </div>
          <div class="filters" id="colors">
            ${["W", "U", "B", "R", "G", "C"].map((c) => `<button class="color-btn ${c}" data-c="${c}" title="${c === "C" ? "Colorless" : c}">${c}</button>`).join("")}
            <span class="filter-label">Cost</span>
            ${[0, 1, 2, 3, 4, "5+"].map((n) => `<button class="cmc-btn" data-cmc="${n}">${n}</button>`).join("")}
            <select id="color-mode" class="color-mode-select" title="Color Filter Mode">
              <option value="identity" selected>Deck Identity (≤)</option>
              <option value="any">Match Any (≥)</option>
              <option value="includes">Multicolor (All)</option>
              <option value="exact">Exact (=)</option>
            </select>
            <label class="muted" style="display:flex;gap:6px;align-items:center;margin-left:8px">
              <input type="checkbox" id="tokens" /> tokens
            </label>
          </div>
          <div class="search-meta-bar" id="search-meta"></div>
          <div class="results" id="results"><div class="empty">Loading catalog…</div></div>
          <div class="search-pagination" id="search-pagination"></div>
        </div>
        <div class="builder-right">
          <!-- Sticky Game HUD Action Bar: deck name, format + all deck actions pinned, never scrolls under the fold -->
          <div class="builder-topbar">
            <div class="deck-head">
              <input id="deck-name" class="grow" value="${escapeHtml(deck.name)}" placeholder="Deck name…" />
              <select id="fmt">
                <option value="duel" ${deck.format === "duel" ? "selected" : ""}>Duel</option>
                <option value="commander" ${deck.format === "commander" ? "selected" : ""}>Commander</option>
                <option value="casual" ${deck.format === "casual" ? "selected" : ""}>Casual</option>
              </select>
              <button class="btn gold" id="save" title="Save this deck to your account">💾 Save</button>
              <button class="btn ghost small" id="save-copy" title="Save as a new personal deck copy">📋 Copy</button>
            </div>
            <div class="builder-toolbar">
              <span class="builder-toolbar-label">Deck Tools</span>
              <button class="btn ghost small" id="import">Import list</button>
              <button class="btn ghost small" id="export">Export</button>
              <button class="btn ghost small" id="new">New Deck</button>
              ${deck.id && !deck.starter ? `<button class="btn danger small" id="del">Delete</button>` : ""}
            </div>
          </div>

          <!-- Saved Decks Bar: Player Saved Decks Appear First -->
          <div class="builder-decks-bar">
            <div class="builder-decks-header">
              <div style="display:flex;align-items:center;gap:6px">
                <span class="builder-decks-title">🎴 Saved Decks (${myDecks.length})</span>
                ${myDecks.length > 0 ? `<span class="chip gold" style="font-size:9px;padding:1px 6px">Saved Decks First</span>` : ""}
              </div>
              <div style="display:flex;gap:6px">
                <button type="button" class="btn small ghost" id="btn-builder-new-deck" title="Start a fresh blank deck">+ New</button>
                <button type="button" class="btn small ghost" id="btn-builder-all-decks" title="Open full deck browser">📂 All Decks (${allDecks.length})</button>
              </div>
            </div>
            <div class="builder-decks-pills" id="builder-decks-pills">
              ${renderDeckPills()}
            </div>
          </div>

          <div class="deck-meta-bar" style="display:flex;align-items:center;justify-content:space-between;margin:4px 0 10px 0;font-size:12px">
            <div id="deck-owner-status">
              ${user
                ? `<span class="chip gold" style="font-size:11px">👤 Account: <b>${escapeHtml(user.displayName || user.username)}</b></span>`
                : `<span class="chip muted" style="font-size:11px">👤 Guest Deck (${escapeHtml(me.name)})</span>`
              }
              ${deck.starter ? `<span class="chip" style="font-size:11px;margin-left:6px">⭐ Starter Deck (Saving forks your personal copy)</span>` : ""}
              ${deck.authorName && (!user || deck.userId !== user.id) && !deck.starter ? `<span class="chip" style="font-size:11px;margin-left:6px">Author: ${escapeHtml(deck.authorName)}</span>` : ""}
            </div>
            <div class="faint" id="deck-saved-note"></div>
          </div>
          <div class="stats" id="stats"></div>
          <div id="cmd-slot"></div>
          <div class="deck-list" id="list"></div>
        </div>
      </div>
      <div class="preview" id="preview" hidden></div>`);

    function showZoom(card, ev) {
      const pv = $("#preview");
      if (!card || !pv) return;
      const img = card.image || `/api/img/${card.id}?size=normal`;
      pv.hidden = false;
      pv.style.left = Math.min((ev && ev.clientX) || 24, innerWidth - 270) + "px";
      pv.style.top = Math.min((ev && ev.clientY) || 80, innerHeight - 380) + "px";
      pv.innerHTML = `<img src="${img}" alt="${escapeHtml(card.name || "")}"><div class="oracle"><b>${escapeHtml(card.name || "")}</b> ${manaPips(card.mana_cost)}<div class="faint">${escapeHtml(card.type_line || "")}</div><div>${escapeHtml(card.oracle_text || "")}</div></div>`;
    }
    function hideZoom() {
      const pv = $("#preview");
      if (pv) pv.hidden = true;
    }

    const colors = new Set();
    const cmcs = new Set();
    let timer = null;
    let lastHits = [];
    let setGroups = [];

    api("/api/sets")
      .then((groups) => {
        setGroups = groups || [];
        const era = $("#era");
        if (!era) return;
        era.innerHTML =
          `<option value="">Any era</option>` +
          setGroups
            .map((g) => `<option value="${escapeHtml(g.id)}">${escapeHtml(g.name)}</option>`)
            .join("");
        fillSets();
      })
      .catch(() => {});

    function fillSets() {
      const era = $("#era")?.value || "";
      const sel = $("#set");
      if (!sel) return;
      const groups = era ? setGroups.filter((g) => g.id === era) : setGroups;
      const opts = ['<option value="">Any set</option>'];
      for (const g of groups) {
        for (const s of g.sets || []) {
          opts.push(
            `<option value="${escapeHtml(s.code)}">${escapeHtml(s.name)} (${s.count})</option>`
          );
        }
      }
      sel.innerHTML = opts.join("");
    }

    function renderStats() {
      const c = counts(deck);
      const cv = curve(deck);
      const max = Math.max(1, ...cv);
      $("#stats").innerHTML = `
        <div class="stat"><b>${c.main}</b><span>Main</span>
          <div class="curve">${cv.map((n) => `<i style="height:${(n / max) * 100}%"></i>`).join("")}</div>
        </div>
        <div class="stat"><b>${c.side}</b><span>Sideboard</span></div>
        <div class="stat"><b>${c.command}</b><span>Command</span></div>
        <div class="stat"><b>${c.main + c.command}</b><span>Total</span></div>`;
    }

    function renderList() {
      const groups = { command: [], main: [], side: [] };
      for (const row of deck.cards) groups[row.board || "main"].push(row);
      const block = (title, rows) =>
        rows.length
          ? `<div class="section-title">${title}</div>` +
            rows
              .map(
                (row) => `
            <div class="deck-row" data-id="${row.id}" data-board="${row.board || "main"}">
              <img src="${row.image_small || "/api/img/" + row.id + "?size=small"}" alt="" />
              <div>
                <b>${escapeHtml(row.name)}</b>
                <div>${manaPips(row.mana_cost)} <span class="faint">${escapeHtml(row.type_line || "")}</span></div>
              </div>
              <div class="qty">
                <button class="btn small ghost" data-d="-1">−</button>
                <b>${row.count}</b>
                <button class="btn small ghost" data-d="1">+</button>
              </div>
              <button class="btn small ghost" data-rm="1">✕</button>
            </div>`
              )
              .join("")
          : "";
      $("#list").innerHTML =
        block("Commander", groups.command) +
        block("Main deck", groups.main) +
        block("Sideboard", groups.side) || `<div class="empty">Add cards from the left, or import a list.</div>`;
      renderStats();
    }

    let searchOffset = 0;
    const searchLimit = 60;
    let searchTotal = 0;
    let searchHasMore = false;
    let searchLoading = false;
    let searchReqId = 0;

    function renderCardsHtml(cardList) {
      return cardList
        .map(
          (c) => `
        <div class="result" data-id="${c.id}">
          <img src="${c.image_small}" alt="${escapeHtml(c.name)}" loading="lazy" />
          <div class="meta">
            <b>${escapeHtml(c.name)}</b>
            <span>${manaPips(c.mana_cost)} ${escapeHtml(c.type_line)}${c.set ? " · " + escapeHtml((c.set || "").toUpperCase()) : ""}</span>
          </div>
        </div>`
        )
        .join("");
    }

    function updateSearchFooter() {
      const meta = $("#search-meta");
      if (meta) {
        const hasFilters =
          ($("#q")?.value || "").trim() ||
          colors.size ||
          cmcs.size ||
          $("#type")?.value ||
          $("#set")?.value ||
          $("#era")?.value ||
          $("#tokens")?.checked;
        meta.innerHTML = `
          <span>Showing <b>${lastHits.length}</b> of <b>${searchTotal.toLocaleString()}</b> cards</span>
          ${hasFilters ? `<button type="button" class="btn link small" id="btn-clear-search-filters" style="font-size:11px;color:var(--gold);padding:0;background:none;border:none;cursor:pointer">Reset filters</button>` : ""}
        `;
        const btnClear = $("#btn-clear-search-filters");
        if (btnClear) {
          btnClear.onclick = () => {
            if ($("#q")) $("#q").value = "";
            if ($("#type")) $("#type").value = "";
            if ($("#set")) $("#set").value = "";
            if ($("#era")) $("#era").value = "";
            if ($("#tokens")) $("#tokens").checked = false;
            colors.clear();
            cmcs.clear();
            $$(".color-btn.on").forEach((b) => b.classList.remove("on"));
            $$(".cmc-btn.on").forEach((b) => b.classList.remove("on"));
            search(true);
          };
        }
      }

      const pag = $("#search-pagination");
      if (pag) {
        if (searchHasMore) {
          const remaining = Math.max(0, searchTotal - lastHits.length);
          pag.innerHTML = `
            <button type="button" class="btn gold small" id="btn-load-more" style="padding:6px 16px;cursor:pointer">
              ⬇️ Load More Cards (${remaining.toLocaleString()} remaining)
            </button>
          `;
          const btnLoad = $("#btn-load-more");
          if (btnLoad) {
            btnLoad.onclick = () => search(false);
          }
        } else if (lastHits.length > 0) {
          pag.innerHTML = `<span class="faint" style="font-size:11px">✨ All ${searchTotal.toLocaleString()} cards loaded</span>`;
        } else {
          pag.innerHTML = "";
        }
      }
    }

    async function search(reset = true) {
      if (reset) {
        searchOffset = 0;
        searchHasMore = false;
        searchTotal = 0;
      } else if (!searchHasMore || searchLoading) {
        return;
      }

      searchLoading = true;
      const thisReq = ++searchReqId;

      const q = ($("#q")?.value || "").trim();
      const type = $("#type")?.value || "";
      const set = $("#set")?.value || "";
      const era = $("#era")?.value || "";
      const isToken = $("#tokens")?.checked;
      const colorMode = $("#color-mode")?.value || "identity";

      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (type) params.set("type", type);
      if (colors.size) params.set("colors", [...colors].join(""));
      if (colorMode) params.set("colorMode", colorMode);
      if (isToken) params.set("token", "1");
      if (set) params.set("set", set);
      else if (era) params.set("group", era);
      if (cmcs.size) params.set("cmc", [...cmcs].join(","));
      params.set("limit", String(searchLimit));
      params.set("offset", String(searchOffset));

      if (reset) {
        const meta = $("#search-meta");
        if (meta) meta.innerHTML = `<span class="faint">Searching…</span>`;
        const pag = $("#search-pagination");
        if (pag) pag.innerHTML = "";
      } else {
        const pag = $("#search-pagination");
        if (pag) pag.innerHTML = `<span class="faint">Loading more cards…</span>`;
      }

      try {
        const data = await api("/api/cards?" + params.toString());
        if (thisReq !== searchReqId) return;

        const newCards = data.cards || [];
        searchTotal = Number(data.total != null ? data.total : newCards.length);
        searchHasMore = !!data.hasMore;

        if (reset) {
          lastHits = newCards;
          searchOffset = newCards.length;
          if (newCards.length === 0) {
            $("#results").innerHTML = `<div class="empty">No cards matched your filters.</div>`;
          } else {
            $("#results").innerHTML = renderCardsHtml(newCards);
          }
        } else {
          lastHits = lastHits.concat(newCards);
          searchOffset += newCards.length;
          const container = $("#results");
          if (container) {
            const temp = document.createElement("div");
            temp.innerHTML = renderCardsHtml(newCards);
            while (temp.firstChild) {
              container.appendChild(temp.firstChild);
            }
          }
        }

        updateSearchFooter();
      } catch (err) {
        if (thisReq !== searchReqId) return;
        toast("Search error: " + (err.message || err));
      } finally {
        if (thisReq === searchReqId) searchLoading = false;
      }
    }

    $("#q").addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => search(true), 180);
    });
    $("#type").onchange = () => search(true);
    $("#era").onchange = () => {
      fillSets();
      search(true);
    };
    $("#set").onchange = () => search(true);
    const colorModeEl = $("#color-mode");
    if (colorModeEl) colorModeEl.onchange = () => search(true);
    $("#tokens").onchange = () => search(true);
    $("#colors").addEventListener("click", (e) => {
      const cost = e.target.closest("[data-cmc]");
      if (cost) {
        const n = cost.dataset.cmc;
        if (cmcs.has(n)) cmcs.delete(n);
        else cmcs.add(n);
        cost.classList.toggle("on", cmcs.has(n));
        search(true);
        return;
      }
      const b = e.target.closest("[data-c]");
      if (!b) return;
      const c = b.dataset.c;
      if (colors.has(c)) colors.delete(c);
      else colors.add(c);
      b.classList.toggle("on", colors.has(c));
      search(true);
    });

    const leftPane = $(".builder-left");
    if (leftPane) {
      leftPane.addEventListener("scroll", () => {
        if (searchLoading || !searchHasMore) return;
        if (leftPane.scrollHeight - leftPane.scrollTop - leftPane.clientHeight < 380) {
          search(false);
        }
      });
    }

    $("#results").addEventListener("pointermove", (e) => {
      const el = e.target.closest("[data-id]");
      if (!el) return hideZoom();
      const card = lastHits.find((c) => c.id === el.dataset.id);
      if (card) showZoom(card, e);
    });
    $("#results").addEventListener("pointerleave", hideZoom);
    $("#list").addEventListener("pointermove", (e) => {
      const el = e.target.closest("[data-id]");
      if (!el) return hideZoom();
      const row = deck.cards.find((r) => r.id === el.dataset.id);
      if (!row) return hideZoom();
      const card = { ...row, image: `/api/img/${row.id}?size=normal`, oracle_text: row.oracle_text || "" };
      showZoom(card, e);
    });
    $("#list").addEventListener("pointerleave", hideZoom);

    $("#results").addEventListener("click", (e) => {
      const el = e.target.closest("[data-id]");
      if (!el) return;
      const card = lastHits.find((c) => c.id === el.dataset.id);
      if (!card) return;
      const board = deck.format === "commander" && /Legendary/.test(card.type_line) && /Creature/.test(card.type_line) && !deck.cards.some((r) => r.board === "command")
        ? "command"
        : e.shiftKey
          ? "side"
          : "main";
      addCard(deck, card, board);
      renderList();
    });

    $("#list").addEventListener("click", (e) => {
      const rowEl = e.target.closest(".deck-row");
      if (!rowEl) return;
      const row = deck.cards.find((r) => r.id === rowEl.dataset.id && (r.board || "main") === rowEl.dataset.board);
      if (!row) return;
      if (e.target.dataset.d) {
        row.count = (row.count || 1) + Number(e.target.dataset.d);
        if (row.count <= 0) deck.cards = deck.cards.filter((r) => r !== row);
      }
      if (e.target.dataset.rm) deck.cards = deck.cards.filter((r) => r !== row);
      renderList();
    });

    $("#fmt").onchange = () => {
      deck.format = $("#fmt").value;
    };
    $("#deck-name").onchange = () => {
      deck.name = $("#deck-name").value;
    };

    async function saveDeck(forceFork = false) {
      deck.name = ($("#deck-name")?.value || "").trim() || "Untitled deck";
      deck.format = $("#fmt")?.value || "duel";
      deck.userId = user ? user.id : me.id;
      deck.authorName = user ? (user.displayName || user.username) : me.name;

      try {
        let saved;
        if (deck.id && !forceFork) {
          saved = await api(`/api/decks/${deck.id}`, {
            method: "PUT",
            body: { ...deck, fork: forceFork },
          });
        } else {
          saved = await api("/api/decks", {
            method: "POST",
            body: { ...deck, id: undefined },
          });
        }
        Object.assign(deck, saved);
        deck.starter = false;
        if (location.hash !== `#/builder/${deck.id}`) {
          history.replaceState(null, "", `#/builder/${deck.id}`);
        }
        const author = user ? (user.displayName || user.username) : me.name;
        toast(`✨ Deck saved to ${author}'s account!`);
        const note = $("#deck-saved-note");
        if (note) note.textContent = `Saved ${new Date().toLocaleTimeString()}`;
        updateOwnerStatus();

        // Update list of decks so saved decks appear first
        const updatedCounts = counts(deck);
        const deckSummary = {
          id: deck.id,
          userId: deck.userId,
          authorName: deck.authorName,
          name: deck.name,
          format: deck.format,
          commander: deck.commander,
          counts: updatedCounts,
          updated: Date.now(),
          starter: false,
          cover: deck.cards && deck.cards[0] ? `/api/img/${deck.cards[0].id}?size=normal` : "/img/cardback.jpg",
        };
        const exAll = allDecks.findIndex((x) => x.id === deck.id);
        if (exAll >= 0) allDecks[exAll] = deckSummary;
        else allDecks.unshift(deckSummary);

        const exMy = myDecks.findIndex((x) => x.id === deck.id);
        if (exMy >= 0) myDecks[exMy] = deckSummary;
        else myDecks.unshift(deckSummary);

        sortedDecks = [...myDecks, ...starterDecks, ...otherDecks];
        const pillsEl = $("#builder-decks-pills");
        if (pillsEl) pillsEl.innerHTML = renderDeckPills();
        loadDeckIntoUI(deck);
      } catch (err) {
        toast("Save error: " + (err.message || err));
      }
    }

    function updateOwnerStatus() {
      const ownerEl = $("#deck-owner-status");
      if (!ownerEl) return;
      ownerEl.innerHTML = `
        ${user
          ? `<span class="chip gold" style="font-size:11px">👤 Account: <b>${escapeHtml(user.displayName || user.username)}</b></span>`
          : `<span class="chip muted" style="font-size:11px">👤 Guest Deck (${escapeHtml(me.name)})</span>`
        }
        ${deck.starter ? `<span class="chip" style="font-size:11px;margin-left:6px">⭐ Starter Deck (Saving forks your personal copy)</span>` : ""}
        ${deck.authorName && (!user || deck.userId !== user.id) && !deck.starter ? `<span class="chip" style="font-size:11px;margin-left:6px">Author: ${escapeHtml(deck.authorName)}</span>` : ""}
      `;
    }

    function loadDeckIntoUI(targetDeck = deck) {
      deck = targetDeck;
      if ($("#deck-name")) $("#deck-name").value = deck.name || "";
      if ($("#fmt")) $("#fmt").value = deck.format || "duel";
      if (deck.id) history.replaceState(null, "", `#/builder/${deck.id}`);
      else history.replaceState(null, "", "#/builder?new=1");
      renderList();
      updateOwnerStatus();
      $$(".builder-deck-pill").forEach((p) => p.classList.toggle("active", p.dataset.did === deck.id));
      const del = $("#del");
      if (del) del.style.display = deck.id && !deck.starter ? "" : "none";
    }

    // Pill click handler to switch between decks
    const pillsWrap = $("#builder-decks-pills");
    if (pillsWrap) {
      pillsWrap.onclick = async (e) => {
        const pill = e.target.closest(".builder-deck-pill");
        if (!pill) return;
        const did = pill.dataset.did;
        if (!did || (deck && deck.id === did)) return;
        try {
          const next = await api(`/api/decks/${did}`);
          if (next) {
            loadDeckIntoUI(next);
            toast(`Loaded deck "${next.name}" ✨`);
          }
        } catch (err) {
          toast("Could not load deck: " + (err.message || err));
        }
      };
    }

    // + New Deck button
    const btnNew = $("#btn-builder-new-deck");
    if (btnNew) {
      btnNew.onclick = () => {
        loadDeckIntoUI(emptyDeck());
        toast("New empty deck ready ✨");
      };
    }

    // Browse All Decks modal (Saved Decks First)
    const btnAll = $("#btn-builder-all-decks");
    if (btnAll) {
      btnAll.onclick = () => {
        openModal(`
          <div style="max-width:580px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
              <h2 style="margin:0">🎴 Saved & Starter Decks</h2>
              <span class="chip gold">Saved Decks First</span>
            </div>
            <p class="muted" style="margin:0 0 12px 0;font-size:12px">Select any saved deck to edit in the deck builder:</p>
            <div style="max-height:380px;overflow-y:auto;display:flex;flex-direction:column;gap:8px" id="modal-deck-list">
              ${sortedDecks.map((d) => {
                const isMine = myDecks.some((m) => m.id === d.id);
                return `
                  <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(255,255,255,0.03);border:1px solid ${isMine ? "var(--gold)" : "var(--line)"};border-radius:8px">
                    <div style="display:flex;align-items:center;gap:10px">
                      <img src="${d.cover || "/img/cardback.jpg"}" style="width:32px;height:44px;object-fit:cover;border-radius:4px" />
                      <div>
                        <b style="font-size:13px">${escapeHtml(d.name)}</b>
                        <div class="faint" style="font-size:11px">${escapeHtml(d.format)} · ${(d.counts && (d.counts.main + d.counts.command)) || 0} cards · ${isMine ? "✨ Your Saved Deck" : "⭐ Starter"}</div>
                      </div>
                    </div>
                    <button type="button" class="btn small gold btn-modal-load-deck" data-did="${d.id}">Load ✏️</button>
                  </div>
                `;
              }).join("")}
            </div>
            <div style="margin-top:14px;text-align:right">
              <button type="button" class="btn ghost small" id="modal-close-deck-picker">Close</button>
            </div>
          </div>
        `);
        $("#modal-close-deck-picker").onclick = closeModal;
        $$(".btn-modal-load-deck").forEach((b) => {
          b.onclick = async () => {
            closeModal();
            try {
              const next = await api(`/api/decks/${b.dataset.did}`);
              if (next) {
                loadDeckIntoUI(next);
                toast(`Loaded deck "${next.name}" ✨`);
              }
            } catch (err) {
              toast("Could not load deck: " + (err.message || err));
            }
          };
        });
      };
    }

    $("#save").onclick = () => saveDeck(false);
    const copyBtn = $("#save-copy");
    if (copyBtn) copyBtn.onclick = () => saveDeck(true);

    $("#new").onclick = () => {
      loadDeckIntoUI(emptyDeck());
      toast("New empty deck ready ✨");
    };
    const del = $("#del");
    if (del) {
      del.onclick = async () => {
        if (!confirm("Delete this deck?")) return;
        await api(`/api/decks/${deck.id}`, { method: "DELETE" });
        toast("Deck deleted");
        allDecks = allDecks.filter((x) => x.id !== deck.id);
        const nextDeck = allDecks[0] ? await api(`/api/decks/${allDecks[0].id}`) : emptyDeck();
        loadDeckIntoUI(nextDeck);
        sortedDecks = sortedDecks.filter((x) => x.id !== deck.id);
        const pEl = $("#builder-decks-pills");
        if (pEl) pEl.innerHTML = renderDeckPills();
      };
    }

    $("#export").onclick = () => {
      const lines = [];
      for (const board of ["command", "main", "side"]) {
        const rows = deck.cards.filter((r) => (r.board || "main") === board);
        if (!rows.length) continue;
        if (board === "command") lines.push("Commander:");
        if (board === "side") lines.push("", "Sideboard:");
        for (const r of rows) lines.push(`${r.count} ${r.name}`);
      }
      openModal(`<h2>Export</h2><textarea style="width:100%;height:320px">${escapeHtml(lines.join("\n"))}</textarea><p class="muted">Copy this into Moxfield, XMage, or another table.</p><button class="btn" id="close-m">Close</button>`);
      $("#close-m").onclick = closeModal;
    };

    $("#import").onclick = () => {
      openModal(`
        <h2>Import deck list</h2>
        <p class="muted">One card per line. <code>4 Lightning Bolt</code>, <code>SB:</code>, <code>Commander:</code> all work.</p>
        <textarea id="imp" style="width:100%;height:280px" placeholder="4 Lightning Bolt&#10;20 Mountain"></textarea>
        <div class="row" style="margin-top:10px">
          <button class="btn gold" id="do-imp">Parse</button>
          <button class="btn ghost" id="close-m">Cancel</button>
        </div>
        <div id="imp-err" class="muted"></div>`);
      $("#close-m").onclick = closeModal;
      $("#do-imp").onclick = async () => {
        const parsed = await api("/api/decks/parse", { method: "POST", body: { text: $("#imp").value } });
        deck.cards = parsed.cards;
        deck.commander = parsed.cards.find((c) => c.board === "command") || null;
        $("#imp-err").textContent = parsed.unknown.length ? "Unknown: " + parsed.unknown.join(", ") : "All names matched.";
        renderList();
        setTimeout(closeModal, 600);
      };
    };

    renderList();
    if (r.browse) {
      $("#q").placeholder = "Browse the catalog…";
    }
    search(true);
  };
})();
