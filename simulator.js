// assets/js/pages/simulator.js

let currentPrices = {};
let priceHistory = {}; // { instrument: [price, price, ...] } — en mémoire depuis l'ouverture de la page
let selectedInstrument = null;
let pendingTrade = null; // { instrument, action }
let pollTimer = null;

(async function init() {
  const profile = await requireAuth();
  if (!profile) return;
  renderSidebar("simulator", profile);

  document.getElementById("tradeCancelBtn").addEventListener("click", closeTradeModal);
  document.getElementById("tradeConfirmBtn").addEventListener("click", confirmTrade);
  document.getElementById("feedbackCloseBtn").addEventListener("click", () => {
    document.getElementById("feedbackModal").style.display = "none";
  });
  document.getElementById("chartBuyBtn").addEventListener("click", () => openTradeModal(selectedInstrument, "buy"));
  document.getElementById("chartSellBtn").addEventListener("click", () => openTradeModal(selectedInstrument, "sell"));

  await Promise.all([loadBalance(), loadMarket(), loadPortfolioAndHistory()]);

  // Actualise les prix toutes les 4 secondes pour un effet "marché en direct".
  pollTimer = setInterval(loadMarket, 4000);
  window.addEventListener("beforeunload", () => clearInterval(pollTimer));
})();

async function loadBalance() {
  const session = await getCurrentSession();
  let { data: account } = await supabaseClient
    .from("simulator_accounts")
    .select("virtual_balance")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!account) {
    const { data: created } = await supabaseClient
      .from("simulator_accounts")
      .insert({ user_id: session.user.id })
      .select("virtual_balance")
      .single();
    account = created;
  }

  updateBalanceDisplay(account ? account.virtual_balance : 0);
}

function updateBalanceDisplay(balance) {
  document.getElementById("balanceValue").textContent = formatUsd(balance);
}

async function loadMarket() {
  try {
    const { instruments } = await callEdgeFunction("get-market-prices", {});
    currentPrices = {};
    instruments.forEach((i) => {
      currentPrices[i.instrument] = i;
      if (!priceHistory[i.instrument]) priceHistory[i.instrument] = [];
      const hist = priceHistory[i.instrument];
      if (hist[hist.length - 1] !== i.current_price) {
        hist.push(i.current_price);
        if (hist.length > 60) hist.shift();
      }
    });

    if (!selectedInstrument) selectedInstrument = instruments[0]?.instrument || null;

    renderInstrumentTabs(instruments);
    renderChart();
    renderMarket(instruments);
    renderPortfolioOnly();
  } catch (err) {
    console.error("Erreur chargement des prix:", err);
    document.getElementById("marketTable").innerHTML =
      '<p class="loading-text">Impossible de charger les prix du marché.</p>';
  }
}

function renderInstrumentTabs(instruments) {
  document.getElementById("instrumentTabs").innerHTML = instruments
    .map(
      (i) =>
        `<button class="instrument-tab ${i.instrument === selectedInstrument ? "active" : ""}" data-sel="${i.instrument}">${i.instrument}</button>`
    )
    .join("");

  document.querySelectorAll("[data-sel]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedInstrument = btn.dataset.sel;
      document.querySelectorAll(".instrument-tab").forEach((el) => el.classList.remove("active"));
      btn.classList.add("active");
      renderChart();
    });
  });
}

function renderChart() {
  if (!selectedInstrument) return;
  const data = currentPrices[selectedInstrument];
  const hist = priceHistory[selectedInstrument] || [];
  if (!data) return;

  const change = data.current_price - data.previous_price;
  const changePercent = data.previous_price ? (change / data.previous_price) * 100 : 0;
  const direction = change >= 0 ? "up" : "down";

  document.getElementById("chartPrice").textContent = formatUsd(data.current_price);
  const changeEl = document.getElementById("chartChange");
  changeEl.textContent = `${change >= 0 ? "▲" : "▼"} ${Math.abs(changePercent).toFixed(2)}%`;
  changeEl.className = `chart-change ${direction}`;

  const high = hist.length ? Math.max(...hist) : data.current_price;
  const low = hist.length ? Math.min(...hist) : data.current_price;
  document.getElementById("chartHigh").textContent = formatUsd(high);
  document.getElementById("chartLow").textContent = formatUsd(low);

  drawLineChart(hist.length > 1 ? hist : [data.current_price, data.current_price], direction);
}

function drawLineChart(points, direction) {
  const svg = document.getElementById("priceChart");
  const width = 600;
  const height = 220;
  const padding = 10;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const stepX = (width - padding * 2) / Math.max(points.length - 1, 1);
  const coords = points.map((p, i) => {
    const x = padding + i * stepX;
    const y = height - padding - ((p - min) / range) * (height - padding * 2);
    return [x, y];
  });

  const linePath = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const areaPath = `${linePath} L${coords[coords.length - 1][0].toFixed(2)},${height} L${coords[0][0].toFixed(2)},${height} Z`;

  const color = direction === "up" ? "#22c55e" : "#ef4444";

  svg.innerHTML = `
    <defs>
      <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.25" />
        <stop offset="100%" stop-color="${color}" stop-opacity="0" />
      </linearGradient>
    </defs>
    <path d="${areaPath}" fill="url(#chartFill)" stroke="none" />
    <path d="${linePath}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  `;
}

function renderMarket(instruments) {
  document.getElementById("marketTable").innerHTML = instruments
    .map((i) => {
      const change = i.current_price - i.previous_price;
      const changePercent = i.previous_price ? (change / i.previous_price) * 100 : 0;
      const direction = change >= 0 ? "up" : "down";
      const arrow = change >= 0 ? "▲" : "▼";

      return `
        <div class="market-row" data-row-instrument="${i.instrument}">
          <div>
            <div class="instrument-name">${i.display_name}</div>
            <div class="instrument-code">${i.instrument}</div>
          </div>
          <div style="text-align:right;">
            <div>${formatUsd(i.current_price)}</div>
            <div class="price-change ${direction}">${arrow} ${Math.abs(changePercent).toFixed(2)}%</div>
          </div>
          <div class="market-actions">
            <button class="btn-buy" data-instrument="${i.instrument}" data-action="buy">Acheter</button>
            <button class="btn-sell" data-instrument="${i.instrument}" data-action="sell">Vendre</button>
          </div>
        </div>`;
    })
    .join("");

  document.querySelectorAll(".btn-buy, .btn-sell").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openTradeModal(btn.dataset.instrument, btn.dataset.action);
    });
  });

  document.querySelectorAll("[data-row-instrument]").forEach((row) => {
    row.addEventListener("click", () => {
      selectedInstrument = row.dataset.rowInstrument;
      document.querySelectorAll(".instrument-tab").forEach((el) => {
        el.classList.toggle("active", el.dataset.sel === selectedInstrument);
      });
      renderChart();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

function openTradeModal(instrument, action) {
  if (!instrument) return;
  pendingTrade = { instrument, action };
  const price = currentPrices[instrument]?.current_price || 0;
  document.getElementById("tradeModalTitle").textContent = `${action === "buy" ? "Acheter" : "Vendre"} ${instrument}`;
  document.getElementById("tradeQuantity").value = "";
  document.getElementById("tradeEstimate").textContent = `Prix actuel : ${formatUsd(price)}`;
  showFieldError("tradeQuantityError", null);
  document.getElementById("tradeModal").style.display = "flex";

  document.getElementById("tradeQuantity").oninput = (e) => {
    const qty = parseFloat(e.target.value);
    if (!isNaN(qty) && qty > 0) {
      document.getElementById("tradeEstimate").textContent = `Coût estimé : ${formatUsd(qty * price)}`;
    } else {
      document.getElementById("tradeEstimate").textContent = `Prix actuel : ${formatUsd(price)}`;
    }
  };
}

function closeTradeModal() {
  document.getElementById("tradeModal").style.display = "none";
  pendingTrade = null;
}

async function confirmTrade() {
  const qtyInput = document.getElementById("tradeQuantity");
  const quantity = parseFloat(qtyInput.value);

  if (isNaN(quantity) || quantity <= 0) {
    showFieldError("tradeQuantityError", "Veuillez entrer une quantité valide.");
    return;
  }
  showFieldError("tradeQuantityError", null);

  const confirmBtn = document.getElementById("tradeConfirmBtn");
  confirmBtn.disabled = true;
  confirmBtn.textContent = "Traitement...";

  try {
    const result = await callEdgeFunction("execute-trade", {
      instrument: pendingTrade.instrument,
      action: pendingTrade.action,
      quantity,
    });

    closeTradeModal();
    updateBalanceDisplay(result.new_balance);
    showFeedback(result);
    await loadPortfolioAndHistory();
  } catch (err) {
    console.error("Erreur exécution trade:", err);
    showFieldError("tradeQuantityError", err.message);
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.textContent = "Confirmer";
  }
}

function showFeedback(result) {
  const { trade, feedback } = result;
  document.getElementById(
    "feedbackTitle"
  ).textContent = `${trade.action === "buy" ? "Achat" : "Vente"} exécuté — ${trade.instrument}`;

  const section = (key, label) => {
    const items = feedback[key] || [];
    if (items.length === 0) return "";
    return `
      <div class="feedback-section ${key}">
        <h4>${label}</h4>
        <ul>${items.map((t) => `<li>${t}</li>`).join("")}</ul>
      </div>`;
  };

  document.getElementById("feedbackContent").innerHTML =
    section("well_done", "✓ Bien fait") + section("mistakes", "⚠ À améliorer") + section("lessons", "💡 Leçon à retenir");

  document.getElementById("feedbackModal").style.display = "flex";
}

let cachedTrades = [];

async function loadPortfolioAndHistory() {
  const session = await getCurrentSession();

  const { data: account } = await supabaseClient
    .from("simulator_accounts")
    .select("id")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!account) {
    document.getElementById("portfolioTable").innerHTML = '<p class="loading-text">Aucune position.</p>';
    document.getElementById("tradesHistory").innerHTML = '<p class="loading-text">Aucun trade pour le moment.</p>';
    return;
  }

  const { data: trades, error } = await supabaseClient
    .from("simulator_trades")
    .select("*")
    .eq("account_id", account.id)
    .order("executed_at", { ascending: false });
  if (error) {
    console.error("Erreur chargement trades:", error.message);
    return;
  }

  cachedTrades = trades;
  renderPortfolio(trades);
  renderHistory(trades);
}

function renderPortfolioOnly() {
  if (cachedTrades.length > 0) renderPortfolio(cachedTrades);
}

function renderPortfolio(trades) {
  const holdings = {};
  trades.forEach((t) => {
    const delta = t.action === "buy" ? Number(t.quantity) : -Number(t.quantity);
    holdings[t.instrument] = (holdings[t.instrument] || 0) + delta;
  });

  const rows = Object.entries(holdings).filter(([, qty]) => qty > 0.00001);
  const container = document.getElementById("portfolioTable");

  if (rows.length === 0) {
    container.innerHTML = '<p class="loading-text">Aucune position ouverte.</p>';
    return;
  }

  container.innerHTML = rows
    .map(([instrument, qty]) => {
      const price = currentPrices[instrument]?.current_price;
      const value = price ? price * qty : null;
      return `
        <div class="portfolio-row">
          <div>${instrument}</div>
          <div>${qty} unité(s)</div>
          <div>${value !== null ? formatUsd(value) : "—"}</div>
        </div>`;
    })
    .join("");
}

function renderHistory(trades) {
  const container = document.getElementById("tradesHistory");
  if (trades.length === 0) {
    container.innerHTML = '<p class="loading-text">Aucun trade pour le moment.</p>';
    return;
  }

  container.innerHTML = trades
    .slice(0, 20)
    .map((t) => {
      const date = new Date(t.executed_at).toLocaleString("fr-FR");
      const tagClass = t.action === "buy" ? "btn-buy" : "btn-sell";
      return `
        <div class="trade-row">
          <div>
            <span class="trade-feedback-tag ${tagClass}">${t.action === "buy" ? "Achat" : "Vente"}</span>
            ${t.instrument}
          </div>
          <div>${t.quantity} @ ${formatUsd(t.price)}</div>
          <div style="color:var(--color-text-muted);font-size:13px;">${date}</div>
        </div>`;
    })
    .join("");
}

function formatUsd(value) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "USD" }).format(value || 0);
}
