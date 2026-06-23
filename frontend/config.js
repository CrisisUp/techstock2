// config.js - Configuração centralizada do front-end

/**
 * TechStock - Configuração do Front-end
 * Este arquivo DEVE ser carregado ANTES do app.js
 *
 * Como configurar:
 * 1. Edite as variáveis abaixo diretamente
 * 2. OU use meta tags no HTML (recomendado)
 * 3. OU configure via localStorage (via interface)
 */

(function () {
  "use strict";

  // ──────────────────────────────────────────────────────────────
  // CONFIGURAÇÕES PADRÃO
  // ──────────────────────────────────────────────────────────────

  const DEFAULT_CONFIG = {
    // URL da API (pode ser sobrescrita pelo localStorage)
    apiUrl: location.hostname === "localhost" ? "http://localhost:3000" : "",

    // API Key (opcional - se vazia, não será enviada)
    // Em produção, configure via meta tag ou ambiente
    apiKey: "",

    // Timeout padrão para requisições (ms)
    timeout: 10000,

    // Prefixo para chaves do localStorage
    storagePrefix: "techstock_",
  };

  // ──────────────────────────────────────────────────────────────
  // CARREGAR CONFIGURAÇÕES
  // ──────────────────────────────────────────────────────────────

  let config = { ...DEFAULT_CONFIG };

  // 1. Tentar carregar do window (se definido pelo servidor)
  if (window.TECHSTOCK_CONFIG) {
    config = { ...config, ...window.TECHSTOCK_CONFIG };
  }

  // 2. Tentar carregar de meta tags (alternativa)
  const metaApiUrl = document.querySelector('meta[name="api-url"]');
  const metaApiKey = document.querySelector('meta[name="api-key"]');

  if (metaApiUrl) {
    config.apiUrl = metaApiUrl.getAttribute("content") || config.apiUrl;
  }
  if (metaApiKey) {
    config.apiKey = metaApiKey.getAttribute("content") || config.apiKey;
  }

  // 3. Tentar carregar do localStorage (sobrescreve)
  const savedUrl = localStorage.getItem("techstock_api_url");
  const savedKey = localStorage.getItem("techstock_api_key");

  if (savedUrl) {
    config.apiUrl = savedUrl;
  }
  if (savedKey) {
    config.apiKey = savedKey;
  }

  // ──────────────────────────────────────────────────────────────
  // EXPORTAÇÃO GLOBAL
  // ──────────────────────────────────────────────────────────────

  // Expor configuração completa
  window.TECHSTOCK_CONFIG = config;

  // Expor API Key separadamente para fácil acesso
  window.API_KEY = config.apiKey || "";

  // Expor URL da API separadamente
  window.API_URL = config.apiUrl || "";

  // ──────────────────────────────────────────────────────────────
  // LOG DE INICIALIZAÇÃO
  // ──────────────────────────────────────────────────────────────

  console.log("🔧 [Config] Inicializado:");
  console.log(`  📡 API URL: ${window.API_URL || "⚠️ Não configurada"}`);
  console.log(
    `  🔑 API Key: ${window.API_KEY ? "✅ Configurada" : "⚠️ Não configurada"}`,
  );
  console.log(`  ⏱️  Timeout: ${config.timeout}ms`);
  console.log(`  💾 Storage: ${config.storagePrefix}`);

  // ──────────────────────────────────────────────────────────────
  // FUNÇÕES AUXILIARES (para uso no console)
  // ──────────────────────────────────────────────────────────────

  /**
   * Configura a API Key dinamicamente
   * Uso: setApiKey('sua-chave-aqui')
   */
  window.setApiKey = function (key) {
    if (key && key.trim()) {
      window.API_KEY = key.trim();
      localStorage.setItem("techstock_api_key", key.trim());
      console.log("✅ API Key configurada com sucesso!");
      console.log(
        `   ${key.substring(0, 8)}...${key.substring(key.length - 4)}`,
      );
    } else {
      window.API_KEY = "";
      localStorage.removeItem("techstock_api_key");
      console.log("⚠️ API Key removida");
    }
  };

  /**
   * Obtém a API Key atual
   * Uso: getApiKey()
   */
  window.getApiKey = function () {
    return window.API_KEY || "";
  };

  /**
   * Configura a URL da API dinamicamente
   * Uso: setApiUrl('http://meu-servidor.com')
   */
  window.setApiUrl = function (url) {
    if (url && url.trim()) {
      const cleanUrl = url.trim().replace(/\/$/, "");
      window.API_URL = cleanUrl;
      localStorage.setItem("techstock_api_url", cleanUrl);
      console.log("✅ URL da API configurada:", cleanUrl);
    } else {
      window.API_URL = "";
      localStorage.removeItem("techstock_api_url");
      console.log("⚠️ URL da API removida");
    }
  };

  /**
   * Obtém a URL da API atual
   * Uso: getApiUrl()
   */
  window.getApiUrl = function () {
    return window.API_URL || "";
  };

  // ──────────────────────────────────────────────────────────────
  // EXPORTAÇÃO PARA MÓDULOS (se usado com bundlers)
  // ──────────────────────────────────────────────────────────────

  if (typeof module !== "undefined" && module.exports) {
    module.exports = config;
  }
})();
