"use strict";

// ══════════════════════════════════════════════════════════════════════════════
// CONFIG
// ══════════════════════════════════════════════════════════════════════════════
const LS_KEY = "techstock_api_url";

function getApiUrl() {
  return (
    localStorage.getItem(LS_KEY) ||
    (window.TECHSTOCK_CONFIG && window.TECHSTOCK_CONFIG.apiUrl) ||
    (location.hostname === "localhost" ? "http://localhost:3000" : "")
  ).replace(/\/$/, "");
}

function setApiUrl(url) {
  localStorage.setItem(LS_KEY, url.replace(/\/$/, ""));
}

// ══════════════════════════════════════════════════════════════════════════════
// API CLIENT
// ══════════════════════════════════════════════════════════════════════════════
async function api(path, opts = {}) {
  const base = getApiUrl();
  if (!base) {
    throw new Error("Backend não configurado. Clique em ⚙ para configurar.");
  }

  try {
    const res = await fetch(base + path, {
      headers: { "Content-Type": "application/json", ...opts.headers },
      ...opts,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    return res.json();
  } catch (error) {
    console.error(`[API] Erro em ${path}:`, error);
    throw error;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// TOAST SYSTEM (Feedback visual)
// ══════════════════════════════════════════════════════════════════════════════
const Toast = {
  container: null,

  init() {
    if (this.container) return;
    this.container = document.createElement("div");
    this.container.id = "toast-container";
    this.container.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 400px;
      width: 100%;
      pointer-events: none;
    `;
    document.body.appendChild(this.container);
  },

  show(message, type = "info", duration = 4000) {
    this.init();

    const icons = {
      success: "✅",
      error: "❌",
      warning: "⚠️",
      info: "ℹ️",
    };

    const colors = {
      success: "#10b981",
      error: "#ef4444",
      warning: "#f59e0b",
      info: "#3b82f6",
    };

    const toast = document.createElement("div");
    toast.setAttribute("role", "alert");
    toast.setAttribute("aria-live", "polite");
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
      pointer-events: auto;
      background: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      border-left: 4px solid ${colors[type] || colors.info};
      display: flex;
      align-items: center;
      gap: 12px;
      animation: toastSlideIn 0.3s ease;
      transition: all 0.3s ease;
      font-size: 14px;
      color: #1a1a1a;
    `;

    toast.innerHTML = `
      <span style="font-size: 20px;">${icons[type] || icons.info}</span>
      <span style="flex: 1;">${message}</span>
      <button class="toast-close" style="background: none; border: none; font-size: 18px; cursor: pointer; color: #999; padding: 0 4px;">
        ✕
      </button>
    `;

    this.container.appendChild(toast);

    // Fechar com X
    toast.querySelector(".toast-close").addEventListener("click", () => {
      this.remove(toast);
    });

    // Auto-fechar
    if (duration > 0) {
      setTimeout(() => {
        this.remove(toast);
      }, duration);
    }

    return toast;
  },

  remove(toast) {
    toast.style.animation = "toastSlideOut 0.3s ease forwards";
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 300);
  },

  success(message, duration) {
    return this.show(message, "success", duration);
  },

  error(message, duration) {
    return this.show(message, "error", duration);
  },

  warning(message, duration) {
    return this.show(message, "warning", duration);
  },

  info(message, duration) {
    return this.show(message, "info", duration);
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// SANITIZAÇÃO E VALIDAÇÃO
// ══════════════════════════════════════════════════════════════════════════════
function esc(s) {
  if (s === null || s === undefined) return "";
  const str = String(s);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

function sanitizeInput(value, type = "string") {
  if (value === null || value === undefined) return "";

  switch (type) {
    case "number":
      return parseFloat(value) || 0;
    case "integer":
      return parseInt(value) || 0;
    case "codigo":
      return String(value)
        .toUpperCase()
        .trim()
        .replace(/[^A-Z0-9-]/g, "");
    default:
      return String(value).trim().slice(0, 500);
  }
}

function isValidUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    str,
  );
}

function validateProduto(data) {
  const errors = [];

  if (!data.nome || data.nome.trim().length < 2) {
    errors.push("Nome deve ter pelo menos 2 caracteres");
  }
  if (data.nome && data.nome.length > 100) {
    errors.push("Nome não pode exceder 100 caracteres");
  }

  if (!data.codigo || !/^[A-Z0-9-]{4,20}$/.test(data.codigo)) {
    errors.push("Código deve ter 4-20 caracteres alfanuméricos");
  }

  const qty = Number(data.quantidade);
  if (isNaN(qty) || qty < 0 || qty > 999999) {
    errors.push("Quantidade deve ser entre 0 e 999.999");
  }

  const price = Number(data.preco_custo);
  if (isNaN(price) || price < 0 || price > 999999.99) {
    errors.push("Preço deve ser entre 0 e R$ 999.999,99");
  }

  return errors;
}

function validateMovimentacao(data) {
  const errors = [];

  if (!data.produto_id) {
    errors.push("Produto é obrigatório");
  }

  const qty = Number(data.quantidade);
  if (isNaN(qty) || qty < 1 || qty > 999999) {
    errors.push("Quantidade deve ser entre 1 e 999.999");
  }

  if (!["entrada", "saida", "ajuste"].includes(data.tipo)) {
    errors.push("Tipo de movimentação inválido");
  }

  if (data.motivo && data.motivo.length > 200) {
    errors.push("Motivo não pode exceder 200 caracteres");
  }

  return errors;
}

// ══════════════════════════════════════════════════════════════════════════════
// ESTADO GLOBAL
// ══════════════════════════════════════════════════════════════════════════════
let cats = [];
const _prodCache = new Map();
let searchTimeout = null;

// ══════════════════════════════════════════════════════════════════════════════
// MODAIS
// ══════════════════════════════════════════════════════════════════════════════
const MODAL_NO_OUTSIDE_CLOSE = new Set([
  "ov-prod",
  "ov-cfg",
  "ov-hist",
  "ov-mov-novo",
]);

function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;

  modal.classList.add("open");
  modal.setAttribute("aria-modal", "true");

  // Focar no primeiro input ou título
  const focusable = modal.querySelector(
    'input:not([type="hidden"]), select, textarea, button, h3',
  );
  if (focusable) {
    setTimeout(() => focusable.focus(), 50);
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;

  modal.classList.remove("open");
  modal.removeAttribute("aria-modal");
}

function initModais() {
  document.querySelectorAll(".ov").forEach((overlay) => {
    if (MODAL_NO_OUTSIDE_CLOSE.has(overlay.id)) return;

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) {
        overlay.classList.remove("open");
        overlay.removeAttribute("aria-modal");
      }
    });
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    document.querySelectorAll(".ov.open").forEach((o) => {
      if (!MODAL_NO_OUTSIDE_CLOSE.has(o.id)) {
        o.classList.remove("open");
        o.removeAttribute("aria-modal");
      }
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  initModais();
  checkApi();
  loadCats();
  loadDash();
  setupSearch();
  setInterval(checkApi, 30000);
});

// ══════════════════════════════════════════════════════════════════════════════
// BUSCA COM DEBOUNCE
// ══════════════════════════════════════════════════════════════════════════════
function setupSearch() {
  const busca = document.getElementById("busca");
  if (!busca) return;

  busca.addEventListener("input", function () {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      loadProd();
    }, 400);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// STATUS DA API
// ══════════════════════════════════════════════════════════════════════════════
async function checkApi() {
  const el = document.getElementById("api-badge");
  if (!el) return;

  el.className = "api-badge busy";
  el.textContent = "⬤ Conectando...";

  try {
    const d = await api("/api/health");
    el.className = "api-badge ok";
    el.textContent = d.ok ? "⬤ API Online" : "⬤ API Degradada";

    const hi = document.getElementById("hostname-info");
    if (hi && d.hostname) {
      hi.textContent = `host: ${d.hostname}`;
    }
  } catch (error) {
    el.className = "api-badge fail";
    el.textContent = "⬤ API Offline";
    console.warn("[API] Health check failed:", error.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// NAVEGAÇÃO
// ══════════════════════════════════════════════════════════════════════════════
const pages = ["dashboard", "produtos", "movimentacoes", "alertas"];

function showPage(name) {
  pages.forEach((p, i) => {
    const pg = document.getElementById("page-" + p);
    const btn = document.querySelectorAll(".nav-btn")[i];

    if (pg) {
      pg.classList.toggle("active", p === name);
      pg.setAttribute("aria-hidden", p !== name);
    }
    if (btn) {
      btn.classList.toggle("active", p === name);
      btn.setAttribute("aria-selected", p === name);
    }
  });

  // Carregar dados da página
  switch (name) {
    case "dashboard":
      loadDash();
      break;
    case "produtos":
      loadProd();
      break;
    case "movimentacoes":
      loadMovPage();
      break;
    case "alertas":
      loadAlert();
      break;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
async function loadDash() {
  try {
    const [st, crit] = await Promise.all([
      api("/api/stats"),
      api("/api/produtos?alerta=1"),
    ]);

    // Atualizar cards
    document.getElementById("s-total").textContent = st.total_produtos || 0;
    document.getElementById("s-alert").textContent = st.alertas_estoque || 0;
    document.getElementById("s-mov").textContent = st.movimentos_hoje || 0;
    document.getElementById("s-valor").textContent =
      "R$ " +
      Number(st.valor_total || 0).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
      });

    // Banner de alertas
    const b = document.getElementById("banner");
    if (st.alertas_estoque > 0) {
      b.classList.remove("hidden");
      document.getElementById("banner-txt").textContent =
        `${st.alertas_estoque} produto(s) abaixo do mínimo!`;
    } else {
      b.classList.add("hidden");
    }

    // Tabela de itens críticos
    const tb = document.getElementById("dash-tb");
    if (!crit || !crit.length) {
      tb.innerHTML =
        '<tr class="empty"><td colspan="5">✅ Nenhum item crítico</td></tr>';
      return;
    }

    tb.innerHTML = crit
      .map(
        (p) => `
      <tr>
        <td>${codeBadge(p.codigo)}</td>
        <td>${esc(p.nome)}</td>
        <td>${catBadge(p.categoria_nome, p.categoria_cor)}</td>
        <td>${esc(p.localizacao || "—")}</td>
        <td>${qBar(p.quantidade, p.qtd_minima)}</td>
      </tr>
    `,
      )
      .join("");
  } catch (error) {
    console.error("[Dashboard] Erro:", error);
    Toast.error("Erro ao carregar dashboard: " + error.message);
    document.getElementById("dash-tb").innerHTML = errRow(5, error.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// CATEGORIAS
// ══════════════════════════════════════════════════════════════════════════════
async function loadCats() {
  try {
    cats = await api("/api/categorias");

    // Popula selects de categoria
    ["p-cat", "f-cat"].forEach((id) => {
      const s = document.getElementById(id);
      if (!s) return;

      const base =
        id === "f-cat"
          ? '<option value="">Todas categorias</option>'
          : '<option value="">Sem categoria</option>';

      s.innerHTML =
        base +
        cats
          .map((c) => `<option value="${c.id}">${esc(c.nome)}</option>`)
          .join("");
    });
  } catch (error) {
    console.warn("[Categorias] Erro ao carregar:", error);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PRODUTOS
// ══════════════════════════════════════════════════════════════════════════════
async function loadProd() {
  const tb = document.getElementById("prod-tb");
  tb.innerHTML = loadRow(7);

  try {
    const params = new URLSearchParams();
    const busca = document.getElementById("busca")?.value || "";
    const cat = document.getElementById("f-cat")?.value || "";

    if (busca) params.set("busca", busca);
    if (cat) params.set("categoria_id", cat);

    const rows = await api("/api/produtos?" + params);

    // Atualizar cache
    _prodCache.clear();
    rows.forEach((p) => _prodCache.set(p.id, p));

    if (!rows.length) {
      tb.innerHTML =
        '<tr class="empty"><td colspan="7">Nenhum produto encontrado</td></tr>';
      return;
    }

    tb.innerHTML = rows
      .map(
        (p) => `
      <tr>
        <td>${codeBadge(p.codigo)}</td>
        <td>
          <div style="font-weight:500">${esc(p.nome)}</div>
          ${p.descricao ? `<div style="font-size:12px;color:var(--muted)">${esc(p.descricao)}</div>` : ""}
        </td>
        <td>${catBadge(p.categoria_nome, p.categoria_cor)}</td>
        <td>${esc(p.localizacao || "—")}</td>
        <td>${qBar(p.quantidade, p.qtd_minima)}</td>
        <td>R$ ${Number(p.preco_custo).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
        <td>
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            <button class="btn btn-sm btn-g" data-id="${p.id}" onclick="openMovById(this)" title="Movimentar" aria-label="Movimentar estoque">↕</button>
            <button class="btn btn-sm btn-o" data-id="${p.id}" onclick="openHistById(this)" title="Histórico" aria-label="Ver histórico">📋</button>
            <button class="btn btn-sm btn-o" data-id="${p.id}" onclick="openEditById(this)" title="Editar" aria-label="Editar produto">✏️</button>
            <button class="btn btn-sm btn-r" data-id="${p.id}" data-nome="${esc(p.nome)}" onclick="delProdById(this)" title="Inativar" aria-label="Inativar produto">🗑</button>
          </div>
        </td>
      </tr>
    `,
      )
      .join("");
  } catch (error) {
    console.error("[Produtos] Erro:", error);
    Toast.error("Erro ao carregar produtos: " + error.message);
    tb.innerHTML = errRow(7, error.message);
  }
}

function openEditById(btn) {
  const p = _prodCache.get(Number(btn.dataset.id));
  if (p) openEdit(p);
}

function openMovById(btn) {
  const p = _prodCache.get(Number(btn.dataset.id));
  if (p) openMov(p.id, p.nome);
}

function openHistById(btn) {
  openHist(Number(btn.dataset.id));
}

function delProdById(btn) {
  delProd(Number(btn.dataset.id), btn.dataset.nome);
}

// ══════════════════════════════════════════════════════════════════════════════
// ALERTAS
// ══════════════════════════════════════════════════════════════════════════════
async function loadAlert() {
  const tb = document.getElementById("alert-tb");
  tb.innerHTML = loadRow(6);

  try {
    const rows = await api("/api/produtos?alerta=1");

    if (!rows.length) {
      tb.innerHTML =
        '<tr class="empty"><td colspan="6">✅ Nenhum produto abaixo do mínimo!</td></tr>';
      return;
    }

    tb.innerHTML = rows
      .map(
        (p) => `
      <tr>
        <td>${codeBadge(p.codigo, "b-bad")}</td>
        <td><strong>${esc(p.nome)}</strong></td>
        <td>${catBadge(p.categoria_nome, p.categoria_cor)}</td>
        <td>${esc(p.localizacao || "—")}</td>
        <td>${qBar(p.quantidade, p.qtd_minima)}</td>
        <td>
          <button class="btn btn-sm btn-g" data-id="${p.id}" onclick="openMovById(this)" aria-label="Repor estoque">📥 Repor</button>
        </td>
      </tr>
    `,
      )
      .join("");
  } catch (error) {
    console.error("[Alertas] Erro:", error);
    Toast.error("Erro ao carregar alertas: " + error.message);
    tb.innerHTML = errRow(6, error.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// MOVIMENTAÇÕES — PÁGINA DEDICADA
// ══════════════════════════════════════════════════════════════════════════════
async function loadMovPage() {
  await loadMovProdSelect();
  await fetchMovs();
}

async function loadMovProdSelect() {
  const sel = document.getElementById("mn-prod");
  if (!sel || sel.dataset.loaded) return;

  try {
    const prods = await api("/api/produtos");
    sel.innerHTML =
      '<option value="">Todos os produtos</option>' +
      prods
        .map((p) => `<option value="${p.id}">${esc(p.nome)}</option>`)
        .join("");
    sel.dataset.loaded = "1";
  } catch (error) {
    console.warn("[Movimentos] Erro ao carregar produtos:", error);
  }
}

async function fetchMovs() {
  const tb = document.getElementById("mov-tb");
  if (!tb) return;
  tb.innerHTML = loadRow(7);

  const tipo = document.getElementById("mn-tipo")?.value || "";
  const prodId = document.getElementById("mn-prod")?.value || "";

  const icons = { entrada: "📥", saida: "📤", ajuste: "⚖️" };
  const tipoCls = { entrada: "b-ok", saida: "b-bad", ajuste: "b-warn" };
  const tipoLabels = { entrada: "Entrada", saida: "Saída", ajuste: "Ajuste" };

  function renderRows(rows) {
    // Verificar se rows existe e é um array
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      tb.innerHTML =
        '<tr class="empty"><td colspan="7">Nenhum movimento encontrado.</td></tr>';
      return;
    }

    // Filtrar movimentos válidos
    const validRows = rows.filter((m) => m && typeof m === "object" && m.id);

    if (validRows.length === 0) {
      tb.innerHTML =
        '<tr class="empty"><td colspan="7">Nenhum movimento válido encontrado.</td></tr>';
      return;
    }

    // Aplicar filtro de tipo (se selecionado)
    let filteredRows = validRows;
    if (tipo) {
      filteredRows = filteredRows.filter((m) => m.tipo === tipo);
    }

    // Ordenar por data (mais recente primeiro)
    filteredRows.sort((a, b) => {
      const dateA = new Date(a.criado_em || a.data || 0);
      const dateB = new Date(b.criado_em || b.data || 0);
      return dateB - dateA;
    });

    // Atualizar contador
    document.getElementById("mov-count").textContent =
      `${filteredRows.length} registro(s)`;

    if (filteredRows.length === 0) {
      tb.innerHTML =
        '<tr class="empty"><td colspan="7">Nenhum movimento encontrado com este filtro.</td></tr>';
      return;
    }

    // Renderizar cada movimento
    tb.innerHTML = filteredRows
      .map((m) => {
        // Garantir valores padrão
        const tipo = m.tipo || "desconhecido";
        const quantidade = Number(m.quantidade) || 0;
        const quantidadeAnterior = Number(m.quantidade_anterior) || 0;
        const quantidadeNova = Number(m.quantidade_nova) || 0;
        const criadoEm = m.criado_em || m.data || new Date().toISOString();
        const motivo = m.motivo || "—";
        const responsavel = m.responsavel || "—";

        // Nome do produto - tentar diferentes campos
        let produtoNome = m.produto_nome || "—";
        if (!produtoNome || produtoNome === "—") {
          // Tentar buscar do cache
          const prodId = Number(m.produto_id);
          const cached = _prodCache.get(prodId);
          if (cached && cached.nome) {
            produtoNome = cached.nome;
          }
        }

        // Calcular delta e classe
        let delta, cls;
        if (tipo === "entrada") {
          delta = `+${quantidade}`;
          cls = "pos";
        } else if (tipo === "saida") {
          delta = `-${quantidade}`;
          cls = "neg";
        } else if (tipo === "ajuste") {
          delta = `→${quantidadeNova}`;
          cls = "";
        } else {
          delta = `→${quantidadeNova || quantidade}`;
          cls = "";
        }

        // Formatar data
        let dt;
        try {
          const dateObj = new Date(criadoEm);
          if (isNaN(dateObj.getTime())) {
            dt = "Data inválida";
          } else {
            dt = dateObj.toLocaleString("pt-BR");
          }
        } catch {
          dt = "Data inválida";
        }

        // Badge e ícone
        const tipoIcon = icons[tipo] || "📋";
        const tipoClasse = tipoCls[tipo] || "b-info";
        const tipoDisplay = tipoLabels[tipo] || tipo.toUpperCase();

        return `
        <tr>
          <td>${dt}</td>
          <td><span class="badge ${tipoClasse}">${tipoIcon} ${tipoDisplay}</span></td>
          <td><strong>${produtoNome}</strong></td>
          <td style="text-align:center">${quantidadeAnterior}</td>
          <td style="text-align:center;font-weight:700" class="${cls}">${delta}</td>
          <td style="text-align:center">${quantidadeNova}</td>
          <td style="color:var(--muted);font-size:12px">${motivo} · ${responsavel}</td>
        </tr>
      `;
      })
      .join("");
  }

  try {
    if (prodId) {
      // Buscar movimentos de um produto específico
      const response = await api(`/api/movimentos/${prodId}`);
      // A API pode retornar os dados diretamente ou em um objeto {data: []}
      const rows = response.data || response || [];
      renderRows(rows);
    } else {
      // Buscar movimentos de todos os produtos
      // Popular cache de produtos se estiver vazio
      if (_prodCache.size === 0) {
        try {
          const prods = await api("/api/produtos");
          prods.forEach((p) => _prodCache.set(p.id, p));
        } catch (e) {
          console.warn("[Movimentos] Erro ao carregar produtos:", e);
        }
      }

      const ids = [..._prodCache.keys()];
      if (ids.length === 0) {
        tb.innerHTML =
          '<tr class="empty"><td colspan="7">Nenhum produto encontrado.</td></tr>';
        return;
      }

      // Buscar movimentos de todos os produtos em paralelo
      const results = await Promise.all(
        ids.map((id) => api(`/api/movimentos/${id}`).catch(() => null)),
      );

      // Filtrar resultados válidos e extrair dados
      const allRows = results
        .filter((r) => r !== null)
        .flatMap((r) => r.data || r || []);

      renderRows(allRows);
    }
  } catch (error) {
    console.error("[Movimentos] Erro:", error);
    Toast.error("Erro ao carregar movimentações: " + error.message);
    tb.innerHTML = errRow(7, error.message);
  }
}

function abrirNovaMovimentacao() {
  document.getElementById("mn-mov-pid").value = "";
  document.getElementById("mn-mov-psel").value = "";
  document.getElementById("mn-mov-tipo").value = "saida";
  document.getElementById("mn-mov-qty").value = 1;
  document.getElementById("mn-mov-motivo").value = "";
  document.getElementById("mn-mov-resp").value = "web";
  document.getElementById("mn-mov-pnome").textContent = "";
  openModal("ov-mov-novo");
}

async function onMovProdSelect() {
  const sel = document.getElementById("mn-mov-psel");
  const id = sel.value;
  const nome = sel.options[sel.selectedIndex]?.text || "";
  document.getElementById("mn-mov-pid").value = id;
  document.getElementById("mn-mov-pnome").textContent = nome
    ? `Produto: ${nome}`
    : "";
}

async function saveMovNovo() {
  const prodId = document.getElementById("mn-mov-pid").value;
  if (!prodId) {
    Toast.warning("Selecione um produto.");
    document.getElementById("mn-mov-psel").focus();
    return;
  }

  const qtd = Number(document.getElementById("mn-mov-qty").value);
  if (!qtd || qtd <= 0 || !Number.isInteger(qtd)) {
    Toast.warning("Quantidade deve ser um número inteiro maior que zero.");
    document.getElementById("mn-mov-qty").focus();
    return;
  }

  const body = {
    produto_id: Number(prodId),
    tipo: document.getElementById("mn-mov-tipo").value,
    quantidade: qtd,
    motivo: sanitizeInput(
      document.getElementById("mn-mov-motivo").value.trim(),
    ),
    responsavel:
      sanitizeInput(document.getElementById("mn-mov-resp").value.trim()) ||
      "web",
  };

  // Validar
  const errors = validateMovimentacao(body);
  if (errors.length > 0) {
    Toast.warning(errors.join(" | "));
    return;
  }

  try {
    await api("/api/movimentos", {
      method: "POST",
      body: JSON.stringify(body),
    });

    closeModal("ov-mov-novo");
    Toast.success("Movimentação registrada com sucesso!");

    // Recarregar dados
    document.getElementById("mn-prod").dataset.loaded = "";
    await loadMovPage();
    loadDash();
  } catch (error) {
    console.error("[Movimento] Erro:", error);
    Toast.error("Erro ao registrar movimentação: " + error.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// CÓDIGO AUTOMÁTICO
// ══════════════════════════════════════════════════════════════════════════════
const CAT_PREFIX = {
  informática: "TI",
  informatica: "TI",
  elétrico: "EL",
  eletrico: "EL",
  escritório: "ES",
  escritorio: "ES",
  ferramentas: "FE",
  limpeza: "LI",
};

function catToPrefix(nome) {
  if (!nome) return "PR";
  const norm = nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return (
    CAT_PREFIX[nome.toLowerCase()] ||
    CAT_PREFIX[norm] ||
    nome
      .replace(/[^a-zA-Z]/g, "")
      .substring(0, 2)
      .toUpperCase() ||
    "PR"
  );
}

async function gerarCodigo(categoriaId) {
  const el = document.getElementById("p-cod");
  if (!el) return;

  let prefix = "PR";
  try {
    if (!cats.length) await loadCats();
    const cat = cats.find((c) => String(c.id) === String(categoriaId));
    prefix = catToPrefix(cat ? cat.nome : "");
  } catch {
    // Usa PR
  }

  el.value = `${prefix}-…`;

  try {
    const produtos = await api(
      categoriaId
        ? `/api/produtos?categoria_id=${categoriaId}`
        : "/api/produtos",
    );
    const re = new RegExp(`^${prefix}-(\\d+)$`);
    const nums = produtos
      .map((p) => {
        const m = String(p.codigo || "").match(re);
        return m ? parseInt(m[1], 10) : 0;
      })
      .filter((n) => n > 0);
    const proximo = nums.length ? Math.max(...nums) + 1 : 1;
    el.value = `${prefix}-${String(proximo).padStart(3, "0")}`;
  } catch {
    el.value = `${prefix}-001`;
  }
}

async function onCatChange() {
  const id = document.getElementById("p-id")?.value;
  if (!id) {
    await gerarCodigo(document.getElementById("p-cat").value);
  }
}

function setCodReadonly(el) {
  if (!el) return;
  el.readOnly = true;
  el.style.cssText =
    "width:100%;background:#F1F5F9;color:#64748B;cursor:default;" +
    "border:1px solid #E2E8F0;border-radius:8px;padding:8px 12px;font-size:14px;";
}

// ══════════════════════════════════════════════════════════════════════════════
// CRUD PRODUTO
// ══════════════════════════════════════════════════════════════════════════════
async function openNovo() {
  document.getElementById("m-prod-title").textContent = "Novo Produto";
  document.getElementById("p-id").value = "";
  document.getElementById("p-nome").value = "";
  document.getElementById("p-desc").value = "";
  document.getElementById("p-loc").value = "";
  document.getElementById("p-qty").value = 0;
  document.getElementById("p-min").value = 5;
  document.getElementById("p-custo").value = 0;
  document.getElementById("p-un").value = "un";
  document.getElementById("p-cat").value = "";

  // Habilitar quantidade
  const qtyEl = document.getElementById("p-qty");
  qtyEl.readOnly = false;
  qtyEl.style.cssText = "";
  const hint = document.getElementById("p-qty-hint");
  if (hint) hint.textContent = "";

  setCodReadonly(document.getElementById("p-cod"));
  openModal("ov-prod");
  await gerarCodigo("");
}

function openEdit(p) {
  document.getElementById("m-prod-title").textContent = "Editar Produto";
  document.getElementById("p-id").value = p.id;
  document.getElementById("p-nome").value = p.nome;
  document.getElementById("p-desc").value = p.descricao || "";
  document.getElementById("p-loc").value = p.localizacao || "";
  document.getElementById("p-qty").value = p.quantidade;
  document.getElementById("p-min").value = p.qtd_minima;
  document.getElementById("p-custo").value = p.preco_custo;
  document.getElementById("p-un").value = p.unidade || "un";
  document.getElementById("p-cat").value = p.categoria_id || "";

  // Em edição, quantidade é somente leitura
  const qtyEl = document.getElementById("p-qty");
  qtyEl.readOnly = true;
  qtyEl.style.cssText =
    "width:100%;background:#F1F5F9;color:#64748B;cursor:default;" +
    "border:1px solid #E2E8F0;border-radius:8px;padding:8px 12px;font-size:14px;";

  const hint = document.getElementById("p-qty-hint");
  if (hint) {
    hint.innerHTML = `<span style="font-size:11px;color:var(--muted)">Use o botão ↕ para movimentar estoque</span>`;
  }

  const cod = document.getElementById("p-cod");
  cod.value = p.codigo;
  setCodReadonly(cod);
  openModal("ov-prod");
}

async function saveProd() {
  const id = document.getElementById("p-id").value;
  const nome = sanitizeInput(document.getElementById("p-nome").value.trim());

  if (!nome || nome.length < 2) {
    Toast.warning("Nome é obrigatório (mínimo 2 caracteres).");
    document.getElementById("p-nome").focus();
    return;
  }

  let codigo = sanitizeInput(document.getElementById("p-cod").value, "codigo");
  if (!codigo || codigo.includes("…")) {
    await gerarCodigo(document.getElementById("p-cat").value);
    codigo = sanitizeInput(document.getElementById("p-cod").value, "codigo");
  }

  if (!codigo || codigo.includes("…")) {
    const cat = cats.find(
      (c) => String(c.id) === String(document.getElementById("p-cat").value),
    );
    codigo = `${catToPrefix(cat ? cat.nome : "")}-${Date.now().toString().slice(-3)}`;
    document.getElementById("p-cod").value = codigo;
  }

  const data = {
    codigo,
    nome,
    descricao:
      sanitizeInput(document.getElementById("p-desc").value.trim()) || null,
    categoria_id:
      sanitizeInput(document.getElementById("p-cat").value, "integer") || null,
    unidade: sanitizeInput(document.getElementById("p-un").value),
    quantidade: sanitizeInput(
      document.getElementById("p-qty").value,
      "integer",
    ),
    qtd_minima: sanitizeInput(
      document.getElementById("p-min").value,
      "integer",
    ),
    preco_custo: sanitizeInput(
      document.getElementById("p-custo").value,
      "number",
    ),
    localizacao:
      sanitizeInput(document.getElementById("p-loc").value.trim()) || null,
  };

  // Validar
  const errors = validateProduto(data);
  if (errors.length > 0) {
    Toast.warning(errors.join(" | "));
    return;
  }

  try {
    const endpoint = id ? `/api/produtos/${id}` : "/api/produtos";
    const method = id ? "PUT" : "POST";

    await api(endpoint, {
      method,
      body: JSON.stringify(data),
    });

    closeModal("ov-prod");
    Toast.success("Produto salvo com sucesso!");
    loadProd();
    loadDash();
  } catch (error) {
    console.error("[Produto] Erro ao salvar:", error);
    Toast.error("Erro ao salvar produto: " + error.message);
  }
}

async function delProd(id, nome) {
  if (
    !confirm(
      `⚠️ Confirmar inativação de "${nome}"?\nEsta ação não pode ser desfeita.`,
    )
  )
    return;

  try {
    await api(`/api/produtos/${id}`, { method: "DELETE" });
    Toast.success(`Produto "${nome}" inativado com sucesso`);
    loadProd();
    loadDash();
  } catch (error) {
    console.error("[Produto] Erro ao inativar:", error);
    Toast.error("Erro ao inativar produto: " + error.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// MOVIMENTAÇÃO (modal rápido — via botão ↕ na tabela)
// ══════════════════════════════════════════════════════════════════════════════
function openMov(id, nome) {
  document.getElementById("m-pid").value = id;
  document.getElementById("m-pnome").textContent = nome;
  document.getElementById("m-qty").value = 1;
  document.getElementById("m-tipo").value = "saida";
  document.getElementById("m-motivo").value = "";
  document.getElementById("m-resp").value = "web";
  openModal("ov-mov");
}

async function saveMov() {
  const qtd = Number(document.getElementById("m-qty").value);
  if (!qtd || qtd <= 0 || !Number.isInteger(qtd)) {
    Toast.warning("Quantidade deve ser um número inteiro maior que zero.");
    document.getElementById("m-qty").focus();
    return;
  }

  const body = {
    produto_id: Number(document.getElementById("m-pid").value),
    tipo: document.getElementById("m-tipo").value,
    quantidade: qtd,
    motivo: sanitizeInput(document.getElementById("m-motivo").value.trim()),
    responsavel:
      sanitizeInput(document.getElementById("m-resp").value.trim()) || "web",
  };

  // Validar
  const errors = validateMovimentacao(body);
  if (errors.length > 0) {
    Toast.warning(errors.join(" | "));
    return;
  }

  try {
    await api("/api/movimentos", {
      method: "POST",
      body: JSON.stringify(body),
    });

    closeModal("ov-mov");
    Toast.success("Movimentação registrada com sucesso!");
    loadProd();
    loadDash();

    // Recarregar página atual se for alertas ou movimentações
    const activePage = document.querySelector(".page.active");
    if (activePage) {
      const id = activePage.id;
      if (id === "page-alertas") loadAlert();
      if (id === "page-movimentacoes") loadMovPage();
    }
  } catch (error) {
    console.error("[Movimento] Erro:", error);
    Toast.error("Erro ao registrar movimentação: " + error.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// HISTÓRICO
// ══════════════════════════════════════════════════════════════════════════════
async function openHist(id) {
  openModal("ov-hist");
  const b = document.getElementById("hist-body");
  b.innerHTML =
    '<div style="text-align:center;padding:30px;color:var(--muted)"><span class="spin" aria-hidden="true"></span>Carregando...</div>';

  try {
    const movs = await api(`/api/movimentos/${id}`);

    if (!movs || !movs.length) {
      b.innerHTML =
        '<div style="text-align:center;padding:30px;color:var(--muted)">Sem movimentos</div>';
      return;
    }

    const icons = { entrada: "📥", saida: "📤", ajuste: "⚖️" };

    b.innerHTML = movs
      .map((m) => {
        const delta =
          m.tipo === "entrada"
            ? `+${m.quantidade}`
            : m.tipo === "saida"
              ? `-${m.quantidade}`
              : `→${m.quantidade_nova}`;
        const cls =
          m.tipo === "entrada" ? "pos" : m.tipo === "saida" ? "neg" : "";
        const dt = new Date(m.criado_em).toLocaleString("pt-BR");

        return `
        <div class="hi">
          <div class="hi-ico ${m.tipo}">${icons[m.tipo]}</div>
          <div class="hi-d">
            <div class="hi-t">${m.tipo.toUpperCase()} · ${dt}</div>
            <div class="hi-m">${esc(m.motivo || "—")} · ${esc(m.responsavel)}</div>
            <div class="hi-m">${m.quantidade_anterior} → ${m.quantidade_nova}</div>
          </div>
          <div class="hi-q ${cls}">${delta}</div>
        </div>
      `;
      })
      .join("");
  } catch (error) {
    console.error("[Histórico] Erro:", error);
    b.innerHTML = `<div style="color:var(--red);text-align:center;padding:20px">Erro: ${esc(error.message)}</div>`;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// CONFIG DE ENDPOINT
// ══════════════════════════════════════════════════════════════════════════════
function openConfig() {
  const urlEl = document.getElementById("cfg-url");
  const atualEl = document.getElementById("cfg-atual");

  if (urlEl) urlEl.value = getApiUrl();
  if (atualEl) atualEl.textContent = getApiUrl() || "(não configurado)";

  const resEl = document.getElementById("cfg-res");
  if (resEl) {
    resEl.textContent = "";
    resEl.className = "tr-res";
  }

  openModal("ov-cfg");
}

async function testApi() {
  const url = document
    .getElementById("cfg-url")
    .value.trim()
    .replace(/\/$/, "");
  const el = document.getElementById("cfg-res");

  if (!url) {
    el.className = "tr-res fail";
    el.textContent = "❌ Informe a URL";
    return;
  }

  el.className = "tr-res busy";
  el.textContent = "🔌 Testando...";

  try {
    const r = await fetch(url + "/api/health", {
      signal: AbortSignal.timeout(6000),
    });
    const d = await r.json();

    el.className = "tr-res ok";
    el.textContent = d.ok
      ? `✅ OK · DB: ${d.db?.ts ? new Date(d.db.ts).toLocaleTimeString("pt-BR") : "?"} · Host: ${d.hostname}`
      : "⚠️ API respondeu com erro";
  } catch (error) {
    el.className = "tr-res fail";
    el.textContent = `❌ ${error.message}`;
  }
}

function saveConfig() {
  const url = document
    .getElementById("cfg-url")
    .value.trim()
    .replace(/\/$/, "");

  if (!url) {
    Toast.warning("Informe a URL do backend.");
    return;
  }

  setApiUrl(url);
  closeModal("ov-cfg");
  Toast.success("Configuração salva! Recarregando a página...");

  setTimeout(() => {
    location.reload();
  }, 1000);
}

// ══════════════════════════════════════════════════════════════════════════════
// UTILS
// ══════════════════════════════════════════════════════════════════════════════
function codeBadge(c, cls = "b-info") {
  return `<span class="badge ${cls}">${esc(c)}</span>`;
}

function catBadge(nome, cor) {
  if (!nome) return '<span style="color:var(--muted)">—</span>';
  const bg = cor ? cor + "22" : "#f1f5f9";
  const tc = cor || "#64748b";
  return `<span style="background:${bg};color:${tc};padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600">${esc(nome)}</span>`;
}

function qBar(qty, min) {
  const pct = min > 0 ? Math.min((qty / (min * 2)) * 100, 100) : 100;
  const cls = qty <= 0 ? "bad" : qty <= min ? "warn" : "ok";
  const badge =
    qty <= 0
      ? '<span class="badge b-bad">ZERADO</span>'
      : qty <= min
        ? '<span class="badge b-warn">BAIXO</span>'
        : "";

  return `
    <div class="qb">
      <div class="bar">
        <div class="bar-fill ${cls}" style="width:${pct}%"></div>
      </div>
      <span class="qn">${qty}</span>
      ${badge}
    </div>
  `;
}

function loadRow(cols) {
  return `<tr class="empty"><td colspan="${cols}"><span class="spin" aria-hidden="true"></span>Carregando...</td></tr>`;
}

function errRow(cols, msg) {
  return `<tr class="empty"><td colspan="${cols}" style="color:var(--red)">Erro: ${esc(msg)} · <button class="btn btn-sm btn-o" onclick="openConfig()">⚙ Configurar</button></td></tr>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// EXPORTAÇÃO DE FUNÇÕES GLOBAIS (para uso no HTML)
// ══════════════════════════════════════════════════════════════════════════════
window.showPage = showPage;
window.openModal = openModal;
window.closeModal = closeModal;
window.openNovo = openNovo;
window.saveProd = saveProd;
window.delProd = delProd;
window.delProdById = delProdById;
window.openMov = openMov;
window.saveMov = saveMov;
window.openMovById = openMovById;
window.openEdit = openEdit;
window.openEditById = openEditById;
window.openHist = openHist;
window.openHistById = openHistById;
window.openConfig = openConfig;
window.saveConfig = saveConfig;
window.testApi = testApi;
window.onCatChange = onCatChange;
window.abrirNovaMovimentacao = abrirNovaMovimentacao;
window.saveMovNovo = saveMovNovo;
window.onMovProdSelect = onMovProdSelect;

// Exportar Toast para uso global
window.Toast = Toast;

console.log("[TechStock] Aplicação inicializada com sucesso!");
