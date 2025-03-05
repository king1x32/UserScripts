// ==UserScript==
// @name         Gemini AI Translator (Inline & Popup)
// @namespace    Gemini AI Translator (Inline & Popup)
// @version      4.1
// @author       King1x32
// @icon         https://raw.githubusercontent.com/king1x32/UserScripts/refs/heads/main/kings.jpg
// @description  Dịch văn bản (bôi đen văn bản), hình ảnh, audio, video bằng Google Gemini API. Hỗ trợ popup phân tích từ vựng, popup dịch và dịch nhanh.
// @match        *://*/*
// @match        file:///*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @require      https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js
// @downloadURL  https://raw.githubusercontent.com/king1x32/UserScripts/refs/heads/main/Gemini_AI_Translator_(Inline&Popup).user.js
// @updateURL    https://raw.githubusercontent.com/king1x32/UserScripts/refs/heads/main/Gemini_AI_Translator_(Inline&Popup).user.js
// ==/UserScript==
(function() {
  "use strict";
  const CONFIG = {
    API: {
      providers: {
        gemini: {
          baseUrl: "https://generativelanguage.googleapis.com/v1beta/models",
          models: {
            fast: [
              "gemini-2.0-flash-lite",
              "gemini-2.0-flash",
              "gemini-2.0-flash-exp",
            ],
            pro: ["gemini-2.0-pro-exp-02-05", "gemini-2.0-pro-exp"],
            vision: [
              "gemini-2.0-flash-thinking-exp-01-21",
              "gemini-2.0-flash-thinking-exp",
            ],
          },
          headers: { "Content-Type": "application/json" },
          body: (prompt) => ({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: { temperature: 0.7 },
          }),
          responseParser: (response) => {
            console.log("Parsing response:", response);
            if (typeof response === "string") {
              return response;
            }
            if (response?.candidates?.[0]?.content?.parts?.[0]?.text) {
              return response.candidates[0].content.parts[0].text;
            }
            throw new Error("Không thể đọc kết quả từ API");
          },
        },
        openai: {
          url: () => "https://api.groq.com/openai/v1/chat/completions",
          headers: (apiKey) => ({
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          }),
          body: (prompt) => ({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
          }),
          responseParser: (response) => response.choices?.[0]?.message?.content,
        },
      },
      currentProvider: "gemini",
      apiKey: {
        gemini: [
          "", // Default key
        ],
        openai: [
          "", // Default key
        ],
      },
      currentKeyIndex: {
        gemini: 0,
        openai: 0,
      },
      maxRetries: 3,
      retryDelay: 1000,
    },
    OCR: {
      generation: {
        temperature: 0.2,
        topP: 0.9,
        topK: 50,
      },
      maxFileSize: 15 * 1024 * 1024, // 15MB
      supportedFormats: [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/heic",
        "image/heif",
      ],
    },
    MEDIA: {
      generation: {
        temperature: 0.2,
        topP: 0.9,
        topK: 50,
      },
      audio: {
        maxSize: 100 * 1024 * 1024, // 100MB
        supportedFormats: [
          "audio/wav",
          "audio/mp3",
          "audio/ogg",
          "audio/m4a",
          "audio/aac",
          "audio/flac",
          "audio/wma",
          "audio/opus",
          "audio/amr",
          "audio/midi",
          "audio/mpa",
        ],
      },
      video: {
        maxSize: 200 * 1024 * 1024, // 200MB
        supportedFormats: [
          "video/mp4",
          "video/webm",
          "video/ogg",
          "video/x-msvideo",
          "video/quicktime",
          "video/x-ms-wmv",
          "video/x-flv",
          "video/3gpp",
          "video/3gpp2",
          "video/x-matroska",
        ],
      },
    },
    contextMenu: {
      enabled: true
    },
    pageTranslation: {
      enabled: true, // Bật/tắt tính năng
      autoTranslate: true,
      showInitialButton: true, // Hiện nút dịch ban đầu
      buttonTimeout: 10000, // Thời gian hiển thị nút (10 giây)
      excludeSelectors: [
        "script",
        "style",
        "noscript",
        "iframe",
        "code",
        "pre",
        ".translator-tools-container",
        ".translator-notification",
        ".center-translate-status",
        ".page-translate-button",
        "[contenteditable='true']",
        "input",
        "textarea",
        "button",
        ".no-translate",
        "[data-notranslate]",
        "[translate='no']",
      ],
    },
    CACHE: {
      text: {
        maxSize: 100, // Tối đa 100 entries cho text
        expirationTime: 300000, // 5 phút
      },
      image: {
        maxSize: 50, // Tối đa 50 entries cho ảnh
        expirationTime: 1800000, // 30 phút
      },
      media: {
        maxSize: 50, // Số lượng media được cache tối đa
        expirationTime: 1800000, // 30 phút
      },
    },
    RATE_LIMIT: {
      maxRequests: 5,
      perMilliseconds: 10000,
    },
    THEME: {
      mode: "dark",
      light: {
        background: "#ddd",
        text: "#333",
        border: "#bbb",
        title: "#333",
        content: "#555",
        button: {
          close: { background: "#ff4444", text: "#ddd" },
          translate: { background: "#007BFF", text: "#ddd" },
        },
      },
      dark: {
        background: "#222",
        text: "#ddd",
        border: "#444",
        title: "#ddd",
        content: "#bbb",
        button: {
          close: { background: "#aa2222", text: "#ddd" },
          translate: { background: "#004a99", text: "#ddd" },
        },
      },
    },
    STYLES: {
      translation: {
        marginTop: "10px",
        padding: "10px",
        backgroundColor: "#f0f0f0",
        borderLeft: "3px solid #4CAF50",
        color: "#333",
        position: "relative",
        fontFamily: "SF Pro Rounded, sans-serif",
        fontSize: "16px",
      },
      popup: {
        position: "fixed",
        border: "1px solid",
        padding: "20px",
        zIndex: "2147483647",
        maxWidth: "90vw",
        minWidth: "300px",
        maxHeight: "80vh",
        boxShadow: "0 0 10px rgba(0, 0, 0, 0.1)",
        borderRadius: "15px",
        fontFamily: "SF Pro Rounded, Arial, sans-serif",
        fontSize: "16px",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
      },
      button: {
        position: "fixed",
        border: "none",
        borderRadius: "3px",
        padding: "5px 10px",
        cursor: "pointer",
        zIndex: "2147483647",
        fontSize: "14px",
      },
      dragHandle: {
        padding: "10px",
        borderBottom: "1px solid",
        cursor: "move",
        userSelect: "none",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderTopLeftRadius: "15px",
        borderTopRightRadius: "15px",
      },
    },
  };
  const DEFAULT_SETTINGS = {
    theme: CONFIG.THEME.mode,
    apiProvider: CONFIG.API.currentProvider,
    apiKey: {
      gemini: [
        "", // Default key
      ],
      openai: [
        "", // Default key
      ],
    },
    currentKeyIndex: {
      gemini: 0,
      openai: 0,
    },
    geminiOptions: {
      modelType: "fast", // 'fast', 'pro', 'vision', 'custom'
      fastModel: "gemini-2.0-flash-lite",
      proModel: "gemini-2.0-pro-exp-02-05",
      visionModel: "gemini-2.0-flash-thinking-exp-01-21",
      customModel: "",
    },
    contextMenu: {
      enabled: true
    },
    pageTranslation: {
      enabled: true, // Bật/tắt tính năng
      autoTranslate: true,
      showInitialButton: true, // Hiện nút dịch ban đầu
      buttonTimeout: 10000, // Thời gian hiển thị nút (10 giây)
      excludeSelectors: [
        "script",
        "style",
        "noscript",
        "iframe",
        "code",
        "pre",
        ".translator-tools-container",
        ".translator-notification",
        ".center-translate-status",
        ".page-translate-button",
        "[contenteditable='true']",
        "input",
        "textarea",
        "button",
        ".no-translate",
        "[data-notranslate]",
        "[translate='no']",
      ],
    },
    ocrOptions: {
      enabled: true,
      preferredProvider: CONFIG.API.currentProvider,
      displayType: "popup",
      maxFileSize: CONFIG.OCR.maxFileSize,
      temperature: CONFIG.OCR.generation.temperature,
      topP: CONFIG.OCR.generation.topP,
      topK: CONFIG.OCR.generation.topK,
    },
    mediaOptions: {
      enabled: true,
      temperature: CONFIG.MEDIA.generation.temperature,
      topP: CONFIG.MEDIA.generation.topP,
      topK: CONFIG.MEDIA.generation.topK,
      audio: {
        processingInterval: 2000, // 2 seconds
        bufferSize: 16384,
        format: {
          sampleRate: 44100,
          numChannels: 1,
          bitsPerSample: 16,
        },
      },
    },
    displayOptions: {
      showOriginalText: true,
      fontSize: "16px",
      minPopupWidth: "300px",
      maxPopupWidth: "90vw",
    },
    shortcuts: {
      settingsEnabled: true,
      enabled: true,
      pageTranslate: { key: "f", altKey: true },
      quickTranslate: { key: "q", altKey: true },
      popupTranslate: { key: "e", altKey: true },
      advancedTranslate: { key: "a", altKey: true },
    },
    clickOptions: {
      enabled: true,
      singleClick: { translateType: "popup" },
      doubleClick: { translateType: "quick" },
      hold: { translateType: "advanced" },
    },
    touchOptions: {
      enabled: true,
      sensitivity: 100,
      twoFingers: { translateType: "popup" },
      threeFingers: { translateType: "advanced" },
      fourFingers: { translateType: "quick" },
    },
    cacheOptions: {
      text: {
        enabled: true,
        maxSize: CONFIG.CACHE.text.maxSize,
        expirationTime: CONFIG.CACHE.text.expirationTime,
      },
      image: {
        enabled: true,
        maxSize: CONFIG.CACHE.image.maxSize,
        expirationTime: CONFIG.CACHE.image.expirationTime,
      },
      media: {
        enabled: true,
        maxSize: CONFIG.CACHE.media.maxSize,
        expirationTime: CONFIG.CACHE.media.expirationTime,
      },
    },
    rateLimit: {
      maxRequests: CONFIG.RATE_LIMIT.maxRequests,
      perMilliseconds: CONFIG.RATE_LIMIT.perMilliseconds,
    },
  };
  class NetworkOptimizer {
    constructor() {
      this.queue = [];
      this.processing = false;
      this.retryDelays = [1000, 2000, 4000];
    }

    async optimizeRequest(request) {
      const priority = this.calculatePriority(request);
      const optimizedRequest = {
        ...request,
        priority,
        retries: 0,
        timestamp: Date.now(),
      };

      this.queue.push(optimizedRequest);
      if (!this.processing) {
        this.processQueue();
      }
    }

    calculatePriority(request) {
      return request.urgent ? 1 : 0;
    }

    async processQueue() {
      this.processing = true;
      while (this.queue.length > 0) {
        const batch = this.createBatch();
        await this.processBatch(batch);
      }
      this.processing = false;
    }

    createBatch() {
      return this.queue.sort((a, b) => b.priority - a.priority).slice(0, 5);
    }

    async processBatch(batch) {
      try {
        await Promise.all(batch.map((request) => this.executeRequest(request)));
      } catch (error) {
        console.error("Batch processing error:", error);
      }
    }

    async executeRequest(request) {
      try {
        const response = await fetch(request.url, request.options);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
      } catch (error) {
        if (request.retries < this.retryDelays.length) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.retryDelays[request.retries]),
          );
          request.retries++;
          return this.executeRequest(request);
        }
        throw error;
      }
    }
  }
  class MobileOptimizer {
    constructor(ui) {
      this.ui = ui;
      this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (this.isMobile) {
        this.optimizeForMobile();
      }
    }

    optimizeForMobile() {
      this.reduceDOMOperations();
      this.optimizeTouchHandling();
      this.adjustUIForMobile();
    }

    reduceDOMOperations() {
      const observer = new MutationObserver((mutations) => {
        requestAnimationFrame(() => {
          mutations.forEach((mutation) => {
            if (mutation.type === "childList") {
              this.optimizeAddedNodes(mutation.addedNodes);
            }
          });
        });
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }

    optimizeTouchHandling() {
      let touchStartY = 0;
      let touchStartX = 0;

      document.addEventListener(
        "touchstart",
        (e) => {
          touchStartY = e.touches[0].clientY;
          touchStartX = e.touches[0].clientX;
        },
        { passive: true },
      );

      document.addEventListener(
        "touchmove",
        (e) => {
          const touchY = e.touches[0].clientY;
          const touchX = e.touches[0].clientX;

          if (
            Math.abs(touchY - touchStartY) > 10 ||
            Math.abs(touchX - touchStartX) > 10
          ) {
            this.ui.removeTranslateButton();
          }
        },
        { passive: true },
      );
    }

    adjustUIForMobile() {
      const style = document.createElement("style");
      style.textContent = `
      .translator-tools-container {
        bottom: 10px !important;
        right: 10px !important;
      }

      .translator-tools-button {
        padding: 8px 15px !important;
        font-size: 14px !important;
      }

      .translator-tools-dropdown {
        width: 250px !important;
        max-height: 60vh !important;
        overflow-y: auto !important;
      }

      .translator-tools-item {
        padding: 10px !important;
      }

      .draggable {
        max-width: 95vw !important;
        max-height: 80vh !important;
      }
    `;
      document.head.appendChild(style);
    }

    optimizeAddedNodes(nodes) {
      nodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const images = node.getElementsByTagName("img");
          Array.from(images).forEach((img) => {
            if (!img.loading) img.loading = "lazy";
          });
        }
      });
    }
  }
  class UserSettings {
    constructor(translator) {
      this.translator = translator;
      this.settings = this.loadSettings();
      this.isSettingsUIOpen = false;
    }
    createSettingsUI() {
      if (this.isSettingsUIOpen) {
        return;
      }
      this.isSettingsUIOpen = true;
      const container = document.createElement("div");
      const isDark = this.settings.theme === "dark";
      const geminiModels = {
        fast: CONFIG.API.providers.gemini.models.fast || [],
        pro: CONFIG.API.providers.gemini.models.pro || [],
        vision: CONFIG.API.providers.gemini.models.vision || [],
      };
      container.style.cssText = `
        all: initial;
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: ${isDark ? "#222" : "#f5f5f5"};
        color: ${isDark ? "#ddd" : "#333"};
        padding: 20px;
        border-radius: 10px;
        z-index: 2147483647;
        width: auto;
        max-width: 90vw;
        min-width: 400px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 0 10px rgba(0,0,0,0.5);
        font-family: Arial, sans-serif !important;
        font-size: 14px !important;
        line-height: 1.4 !important;
        box-sizing: border-box !important;
    `;
      const resetStyle = `
        * {
            all: revert;
            box-sizing: border-box !important;
            font-family: Arial, sans-serif !important;
            margin: 0;
            padding: 0;
        }
        .settings-grid {
            display: grid !important;
            grid-template-columns: 160px auto !important;
            align-items: center !important;
            gap: 10px !important;
            margin-bottom: 8px !important;
        }
        .settings-label {
            min-width: 100px !important;
            text-align: left !important;
            padding-right: 10px !important;
        }
        .settings-input {
            min-width: 100px !important;
            margin-left: 5px !important;
        }
        h2 {
            flex: 1 !important;
            display: flex !important;
            font-family: Arial, sans-serif !important;
            align-items: center !important;
            justify-content: center !important;
            margin-bottom: 15px;
            font-weight: bold;
            color: ${isDark ? "#678" : "#333"};
            grid-column: 1 / -1 !important;
        }
        h3 {
            font-family: Arial, sans-serif !important;
            margin-bottom: 15px;
            font-weight: bold;
            color: ${isDark ? "#678" : "#333"};
            grid-column: 1 / -1 !important;
        }
        input[type="text"],
        input[type="number"],
        select {
            font-family: Arial, sans-serif !important;
            font-size: 14px !important;
            padding: 5px !important;
            margin: 5px 5px 5px 5px;
            border-radius: 4px !important;
            border: 1px solid ${isDark ? "#666" : "#bbb"} !important;
            background: ${isDark ? "#444" : "#ddd"} !important;
            color: ${isDark ? "#ddd" : "#000"} !important;
            width: auto;
            min-width: 100px;
            max-width: auto;
            height: auto !important;
        }
        input[type="radio"],
        input[type="checkbox"] {
            align-items: center !important;
            justify-content: center !important;
        }
        #apiKey {
            width: calc(100% - 13px) !important;
            min-width: calc(100% - 13px) !important;
            max-width: calc(100% - 13px) !important;
            margin-left: 5px !important;
            box-sizing: border-box !important;
        }
        button {
            font-family: Arial, sans-serif !important;
            font-size: 14px !important;
            background: ${isDark ? "#444" : "#ddd"};
            color: ${isDark ? "#ddd" : "#000"} !important;
            padding: 5px 15px !important;
            border-radius: 4px !important;
            cursor: pointer !important;
            border: none !important;
            margin: 5px !important;
        }
        #cancelSettings {
            background: ${isDark ? "#666" : "#ddd"} !important;
            color: ${isDark ? "#ddd" : "#000"} !important;
            padding: 5px 15px !important;
            border-radius: 4px !important;
            cursor: pointer !important;
            border: none !important;
            margin: 5px !important;
        }
        #cancelSettings:hover {
            background: ${isDark ? "#888" : "#aaa"} !important;
        }
        #saveSettings {
            background: #007BFF !important;
            padding: 5px 15px !important;
            border-radius: 4px !important;
            cursor: pointer !important;
            border: none !important;
            margin: 5px !important;
        }
        #saveSettings:hover {
            background: #009ddd !important;
        }
        button {
          font-family: Arial, sans-serif !important;
          font-size: 14px !important;
          border: none !important;
          border-radius: 6px !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
          font-weight: 500 !important;
          letter-spacing: 0.3px !important;
        }
        button:hover {
          transform: translateY(-1px) !important;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
        }
        button:active {
          transform: translateY(0) !important;
        }
        #exportSettings:hover {
          background: #218838 !important;
        }
        #importSettings:hover {
          background: #138496 !important;
        }
        #cancelSettings:hover {
          background: ${isDark ? "#777" : "#dae0e5"} !important;
        }
        #saveSettings:hover {
          background: #0056b3 !important;
        }
        @keyframes buttonPop {
          0% { transform: scale(1); }
          50% { transform: scale(0.98); }
          100% { transform: scale(1); }
        }
        button:active {
          animation: buttonPop 0.2s ease;
        }
        .radio-group {
            display: flex !important;
            gap: 15px !important;
        }
        .radio-group label {
            flex: 1 !important;
            display: flex !important;
            color: ${isDark ? "#ddd" : "#000"} !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 5px !important;
        }
        .radio-group input[type="radio"] {
            margin-right: 5px !important;
        }
        .shortcut-container {
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
        }
        .shortcut-prefix {
            white-space: nowrap !important;
            color: ${isDark ? "#aaa" : "#555"} !important;
            font-size: 14px !important;
            min-width: 45px !important;
        }
        .shortcut-input {
            flex: 1 !important;
            min-width: 60px !important;
            max-width: 100px !important;
        }
    `;
      const styleElement = document.createElement("style");
      styleElement.textContent = resetStyle;
      container.appendChild(styleElement);
      container.innerHTML += `
<h2>Cài đặt Translator AI</h2>
<div style="margin-bottom: 15px;">
  <h3>GIAO DIỆN</h3>
  <div class="radio-group">
    <label>
      <input type="radio" name="theme" value="light" ${!isDark ? "checked" : ""
        }>
      <span>Sáng</span>
    </label>
    <label>
      <input type="radio" name="theme" value="dark" ${isDark ? "checked" : ""}>
      <span>Tối</span>
    </label>
  </div>
</div>
<div style="margin-bottom: 15px;">
  <h3>API PROVIDER</h3>
  <div class="radio-group">
    <label>
      <input type="radio" name="apiProvider" value="gemini" ${this.settings.apiProvider === "gemini" ? "checked" : ""
        }>
      <span>Gemini</span>
    </label>
    <label>
      <input type="radio" name="apiProvider" value="openai" ${this.settings.apiProvider === "openai" ? "checked" : ""
        }>
      <span>OpenAI</span>
    </label>
  </div>
</div>
<div style="margin-bottom: 15px;">
  <h3>API KEYS</h3>
  <div id="geminiKeys" style="margin-bottom: 10px;">
    <h4 style="margin-bottom: 5px;">Gemini API Keys</h4>
    <div class="api-keys-container">
      ${this.settings.apiKey.gemini
          .map(
            (key) => `
        <div class="api-key-entry" style="display: flex; gap: 10px; margin-bottom: 5px;">
          <input type="text" class="gemini-key" value="${key}" style="flex: 1; width: 100%;">
          <button class="remove-key" data-provider="gemini" data-index="${this.settings.apiKey.gemini.indexOf(
              key,
            )}" style="background: #ff4444;">×</button>
        </div>
      `,
          )
          .join("")}
    </div>
    <button id="addGeminiKey" style="background: #28a745; margin-top: 5px;">+ Add Gemini Key</button>
  </div>
  <div id="openaiKeys" style="margin-bottom: 10px;">
    <h4 style="margin-bottom: 5px;">OpenAI API Keys</h4>
    <div class="api-keys-container">
      ${this.settings.apiKey.openai
          .map(
            (key) => `
        <div class="api-key-entry" style="display: flex; gap: 10px; margin-bottom: 5px;">
          <input type="text" class="openai-key" value="${key}" style="flex: 1; width: 100%;">
          <button class="remove-key" data-provider="openai" data-index="${this.settings.apiKey.openai.indexOf(
              key,
            )}" style="background: #ff4444;">×</button>
        </div>
      `,
          )
          .join("")}
    </div>
    <button id="addOpenaiKey" style="background: #28a745; margin-top: 5px;">+ Add OpenAI Key</button>
  </div>
</div>
<div style="margin-bottom: 15px;">
  <h3>MODEL GEMINI</h3>
  <div class="settings-grid">
    <span class="settings-label">Sử dụng loại model:</span>
    <select id="geminiModelType" class="settings-input">
      <option value="fast" ${this.settings.geminiOptions?.modelType === "fast" ? "selected" : ""
        }>Nhanh</option>
      <option value="pro" ${this.settings.geminiOptions?.modelType === "pro" ? "selected" : ""
        }>Pro</option>
      <option value="vision" ${this.settings.geminiOptions?.modelType === "vision" ? "selected" : ""
        }>Suy luận</option>
      <option value="custom" ${this.settings.geminiOptions?.modelType === "custom" ? "selected" : ""
        }>Tùy chỉnh</option>
    </select>
  </div>
  <div id="fastModelContainer" class="settings-grid" ${this.settings.geminiOptions?.modelType !== "fast"
          ? 'style="display: none;"'
          : ""
        }>
    <span class="settings-label">Model Nhanh:</span>
    <select id="fastModel" class="settings-input">
      ${geminiModels.fast
          .map(
            (model) => `
      <option value="${model}" ${this.settings.geminiOptions?.fastModel === model ? "selected" : ""
              }>${model}</option>
      `,
          )
          .join("")}
    </select>
  </div>
  <div id="proModelContainer" class="settings-grid" ${this.settings.geminiOptions?.modelType !== "pro"
          ? 'style="display: none;"'
          : ""
        }>
    <span class="settings-label">Model Chuyên nghiệp:</span>
    <select id="proModel" class="settings-input">
      ${geminiModels.pro
          .map(
            (model) => `
      <option value="${model}" ${this.settings.geminiOptions?.proModel === model ? "selected" : ""
              }>${model}</option>
      `,
          )
          .join("")}
    </select>
  </div>
  <div id="visionModelContainer" class="settings-grid" ${this.settings.geminiOptions?.modelType !== "vision"
          ? 'style="display: none;"'
          : ""
        }>
    <span class="settings-label">Model Suy luận:</span>
    <select id="visionModel" class="settings-input">
      ${geminiModels.vision
          .map(
            (model) => `
      <option value="${model}" ${this.settings.geminiOptions?.visionModel === model ? "selected" : ""
              }>${model}</option>
      `,
          )
          .join("")}
    </select>
  </div>
  <div id="customModelContainer" class="settings-grid" ${this.settings.geminiOptions?.modelType !== "custom"
          ? 'style="display: none;"'
          : ""
        }>
    <span class="settings-label">Model tùy chỉnh:</span>
    <input type="text" id="customModel" class="settings-input" value="${this.settings.geminiOptions?.customModel || ""
        }"
      placeholder="Nhập tên model">
  </div>
</div>
<div style="margin-bottom: 15px;">
  <h3>TOOLS DỊCH</h3>
  <div class="settings-grid">
    <span class="settings-label">Hiển thị Tools dịch (OCR + MEDIA):</span>
    <input type="checkbox" id="showTranslatorTools"
      ${localStorage.getItem("translatorToolsEnabled") === "true"
          ? "checked"
          : ""
        }>
  </div>
</div>
<div style="margin-bottom: 15px;">
  <h3>DỊCH TOÀN TRANG</h3>
  <div class="settings-grid">
    <span class="settings-label">Bật tính năng dịch trang:</span>
    <input type="checkbox" id="pageTranslationEnabled" ${this.settings.pageTranslation?.enabled ? "checked" : ""
        }>
  </div>
  <div class="settings-grid">
    <span class="settings-label">Hiện nút dịch 10s đầu:</span>
    <input type="checkbox" id="showInitialButton" ${this.settings.pageTranslation?.showInitialButton ? "checked" : ""
        }>
  </div>
  <div class="settings-grid">
    <span class="settings-label">Tự động dịch trang không phải tiếng Việt:</span>
    <input type="checkbox" id="autoTranslatePage" ${this.settings.pageTranslation?.autoTranslate ? "checked" : ""
        }>
  </div>
  <div class="settings-grid" style="align-items: start !important;">
    <span class="settings-label">Bỏ qua các elements (CSS selectors):</span>
    <div style="flex: 1;">
      <textarea id="excludeSelectors"
        style="width: 100%; min-height: 100px; margin: 5px 0; padding: 8px;
        background: ${isDark ? "#444" : "#fff"};
        color: ${isDark ? "#fff" : "#000"};
        border: 1px solid ${isDark ? "#666" : "#ccc"};
        border-radius: 4px;
        font-family: monospace;
        font-size: 13px;"
      >${this.settings.pageTranslation?.excludeSelectors?.join("\n") || ""
        }</textarea>
      <div style="font-size: 12px; color: ${isDark ? "#999" : "#666"
        }; margin-top: 4px;">
        Hãy nhập mỗi selector một dòng!
      </div>
    </div>
  </div>
</div>
<div style="margin-bottom: 15px;">
  <h3>DỊCH VĂN BẢN TRONG ẢNH</h3>
  <div class="settings-grid">
    <span class="settings-label">Bật OCR dịch:</span>
    <input type="checkbox" id="ocrEnabled" ${this.settings.ocrOptions?.enabled ? "checked" : ""
        }>
  </div>
  <div class="settings-grid">
    <span class="settings-label">Temperature:</span>
    <input type="number" id="ocrTemperature" class="settings-input" value="${this.settings.ocrOptions.temperature
        }"
      min="0" max="1" step="0.1">
  </div>
  <div class="settings-grid">
    <span class="settings-label">Top P:</span>
    <input type="number" id="ocrTopP" class="settings-input" value="${this.settings.ocrOptions.topP
        }" min="0" max="1"
      step="0.1">
  </div>
  <div class="settings-grid">
    <span class="settings-label">Top K:</span>
    <input type="number" id="ocrTopK" class="settings-input" value="${this.settings.ocrOptions.topK
        }" min="1"
      max="100" step="1">
  </div>
</div>
<div style="margin-bottom: 15px;">
  <h3>DỊCH MEDIA</h3>
  <div class="settings-grid">
    <span class="settings-label">Bật dịch Media:</span>
    <input type="checkbox" id="mediaEnabled" ${this.settings.mediaOptions.enabled ? "checked" : ""
        }>
  </div>
  <div class="settings-grid">
    <span class="settings-label">Temperature:</span>
    <input type="number" id="mediaTemperature" class="settings-input"
      value="${this.settings.mediaOptions.temperature
        }" min="0" max="1" step="0.1">
  </div>
  <div class="settings-grid">
    <span class="settings-label">Top P:</span>
    <input type="number" id="mediaTopP" class="settings-input" value="${this.settings.mediaOptions.topP
        }" min="0"
      max="1" step="0.1">
  </div>
  <div class="settings-grid">
    <span class="settings-label">Top K:</span>
    <input type="number" id="mediaTopK" class="settings-input" value="${this.settings.mediaOptions.topK
        }" min="1"
      max="100" step="1">
  </div>
</div>
<div style="margin-bottom: 15px;">
  <h3>HIỂN THỊ</h3>
  <div class="settings-grid">
    <span class="settings-label">Hiện văn bản gốc:</span>
    <input type="checkbox" id="showOriginalText" ${this.settings.displayOptions?.showOriginalText ? "checked" : ""
        }>
  </div>
  <div class="settings-grid">
    <span class="settings-label">Cỡ chữ:</span>
    <select id="fontSize" class="settings-input">
      <option value="12px" ${this.settings.displayOptions?.fontSize === "12px" ? "selected" : ""
        }>Nhỏ (12px)</option>
      <option value="14px" ${this.settings.displayOptions?.fontSize === "14px" ? "selected" : ""
        }>Hơi nhỏ (14px)
      </option>
      <option value="16px" ${this.settings.displayOptions?.fontSize === "16px" ? "selected" : ""
        }>Vừa (16px)</option>
      <option value="18px" ${this.settings.displayOptions?.fontSize === "18px" ? "selected" : ""
        }>Hơi lớn (18px)
      </option>
      <option value="20px" ${this.settings.displayOptions?.fontSize === "20px" ? "selected" : ""
        }>Lớn (20px)</option>
      <option value="22px" ${this.settings.displayOptions?.fontSize === "22px" ? "selected" : ""
        }>Cực lớn (22px)
      </option>
      <option value="24px" ${this.settings.displayOptions?.fontSize === "24px" ? "selected" : ""
        }>Siêu lớn (24px)
      </option>
    </select>
  </div>
  <div class="settings-grid">
    <span class="settings-label">Độ rộng tối thiểu:</span>
    <select id="minPopupWidth" class="settings-input">
      <option value="100px" ${this.settings.displayOptions?.minPopupWidth === "100px"
          ? "selected"
          : ""
        }>Rất nhỏ
        (100px)</option>
      <option value="200px" ${this.settings.displayOptions?.minPopupWidth === "200px"
          ? "selected"
          : ""
        }>Hơi nhỏ
        (200px)</option>
      <option value="300px" ${this.settings.displayOptions?.minPopupWidth === "300px"
          ? "selected"
          : ""
        }>Nhỏ (300px)
      </option>
      <option value="400px" ${this.settings.displayOptions?.minPopupWidth === "400px"
          ? "selected"
          : ""
        }>Vừa (400px)
      </option>
      <option value="500px" ${this.settings.displayOptions?.minPopupWidth === "500px"
          ? "selected"
          : ""
        }>Hơi lớn
        (500px)</option>
      <option value="600px" ${this.settings.displayOptions?.minPopupWidth === "600px"
          ? "selected"
          : ""
        }>Lớn (600px)
      </option>
      <option value="700px" ${this.settings.displayOptions?.minPopupWidth === "700px"
          ? "selected"
          : ""
        }>Cực lớn
        (700px)</option>
      <option value="800px" ${this.settings.displayOptions?.minPopupWidth === "800px"
          ? "selected"
          : ""
        }>Siêu lớn
        (800px)</option>
    </select>
  </div>
  <div class="settings-grid">
    <span class="settings-label">Độ rộng tối đa:</span>
    <select id="maxPopupWidth" class="settings-input">
      <option value="30vw" ${this.settings.displayOptions?.maxPopupWidth === "30vw" ? "selected" : ""
        }>30% màn hình
      </option>
      <option value="40vw" ${this.settings.displayOptions?.maxPopupWidth === "40vw" ? "selected" : ""
        }>40% màn hình
      </option>
      <option value="50vw" ${this.settings.displayOptions?.maxPopupWidth === "50vw" ? "selected" : ""
        }>50% màn hình
      </option>
      <option value="60vw" ${this.settings.displayOptions?.maxPopupWidth === "60vw" ? "selected" : ""
        }>60% màn hình
      </option>
      <option value="70vw" ${this.settings.displayOptions?.maxPopupWidth === "70vw" ? "selected" : ""
        }>70% màn hình
      </option>
      <option value="80vw" ${this.settings.displayOptions?.maxPopupWidth === "80vw" ? "selected" : ""
        }>80% màn hình
      </option>
      <option value="90vw" ${this.settings.displayOptions?.maxPopupWidth === "90vw" ? "selected" : ""
        }>90% màn hình
      </option>
    </select>
  </div>
</div>
<div style="margin-bottom: 15px;">
  <h3>CONTEXT MENU</h3>
  <div class="settings-grid">
    <span class="settings-label">Bật Context Menu:</span>
    <input type="checkbox" id="contextMenuEnabled" ${this.settings.contextMenu?.enabled ? "checked" : ""
        }>
  </div>
</div>
<div style="margin-bottom: 15px;">
  <h3>PHÍM TẮT</h3>
  <div class="settings-grid">
    <span class="settings-label">Bật phím tắt mở cài đặt:</span>
    <input type="checkbox" id="settingsShortcutEnabled" ${this.settings.shortcuts?.settingsEnabled ? "checked" : ""
        }>
  </div>
  <div class="settings-grid">
    <span class="settings-label">Bật phím tắt dịch:</span>
    <input type="checkbox" id="shortcutsEnabled" ${this.settings.shortcuts?.enabled ? "checked" : ""
        }>
  </div>
  <div class="settings-grid">
    <span class="settings-label">Dịch trang:</span>
    <div class="shortcut-container">
      <span class="shortcut-prefix">Alt +</span>
      <input type="text" id="pageTranslateKey" class="shortcut-input settings-input"
        value="${this.settings.shortcuts.pageTranslate.key}" ${!this.settings.shortcuts?.enabled ? "disabled" : ""
        }>
    </div>
  </div>
  <div class="settings-grid">
    <span class="settings-label">Dịch nhanh:</span>
    <div class="shortcut-container">
      <span class="shortcut-prefix">Alt +</span>
      <input type="text" id="quickKey" class="shortcut-input settings-input"
        value="${this.settings.shortcuts.quickTranslate.key}" ${!this.settings.shortcuts?.enabled ? "disabled" : ""
        }>
    </div>
  </div>
  <div class="settings-grid">
    <span class="settings-label">Dịch popup:</span>
    <div class="shortcut-container">
      <span class="shortcut-prefix">Alt +</span>
      <input type="text" id="popupKey" class="shortcut-input settings-input"
        value="${this.settings.shortcuts.popupTranslate.key}" ${!this.settings.shortcuts?.enabled ? "disabled" : ""
        }>
    </div>
  </div>
  <div class="settings-grid">
    <span class="settings-label">Dịch nâng cao:</span>
    <div class="shortcut-container">
      <span class="shortcut-prefix">Alt +</span>
      <input type="text" id="advancedKey" class="shortcut-input settings-input" value="${this.settings.shortcuts.advancedTranslate.key
        }" ${!this.settings.shortcuts?.enabled ? "disabled" : ""}>
    </div>
  </div>
</div>
<div style="margin-bottom: 15px;">
  <h3>NÚT DỊCH</h3>
  <div class="settings-grid">
    <span class="settings-label">Bật nút dịch:</span>
    <input type="checkbox" id="translationButtonEnabled" ${this.settings.clickOptions?.enabled ? "checked" : ""
        }>
  </div>
  <div class="settings-grid">
    <span class="settings-label">Nhấp đơn:</span>
    <select id="singleClickSelect" class="settings-input">
      <option value="quick" ${this.settings.clickOptions.singleClick.translateType === "quick"
          ? "selected"
          : ""
        }>Dịch
        nhanh</option>
      <option value="popup" ${this.settings.clickOptions.singleClick.translateType === "popup"
          ? "selected"
          : ""
        }>Dịch
        popup</option>
      <option value="advanced" ${this.settings.clickOptions.singleClick.translateType === "advanced"
          ? "selected"
          : ""
        }>Dịch nâng cao</option>
    </select>
  </div>
  <div class="settings-grid">
    <span class="settings-label">Nhấp đúp:</span>
    <select id="doubleClickSelect" class="settings-input">
      <option value="quick" ${this.settings.clickOptions.doubleClick.translateType === "quick"
          ? "selected"
          : ""
        }>Dịch
        nhanh</option>
      <option value="popup" ${this.settings.clickOptions.doubleClick.translateType === "popup"
          ? "selected"
          : ""
        }>Dịch
        popup</option>
      <option value="advanced" ${this.settings.clickOptions.doubleClick.translateType === "advanced"
          ? "selected"
          : ""
        }>Dịch nâng cao</option>
    </select>
  </div>
  <div class="settings-grid">
    <span class="settings-label">Giữ nút:</span>
    <select id="holdSelect" class="settings-input">
      <option value="quick" ${this.settings.clickOptions.hold.translateType === "quick"
          ? "selected"
          : ""
        }>Dịch nhanh
      </option>
      <option value="popup" ${this.settings.clickOptions.hold.translateType === "popup"
          ? "selected"
          : ""
        }>Dịch popup
      </option>
      <option value="advanced" ${this.settings.clickOptions.hold.translateType === "advanced"
          ? "selected"
          : ""
        }>Dịch
        nâng cao</option>
    </select>
  </div>
</div>
<div style="margin-bottom: 15px;">
  <h3>CẢM ỨNG ĐA ĐIỂM</h3>
  <div class="settings-grid">
    <span class="settings-label">Bật cảm ứng:</span>
    <input type="checkbox" id="touchEnabled" ${this.settings.touchOptions?.enabled ? "checked" : ""
        }>
  </div>
  <div class="settings-grid">
    <span class="settings-label">Hai ngón tay:</span>
    <select id="twoFingersSelect" class="settings-input">
      <option value="quick" ${this.settings.touchOptions?.twoFingers?.translateType === "quick"
          ? "selected"
          : ""
        }>
        Dịch nhanh</option>
      <option value="popup" ${this.settings.touchOptions?.twoFingers?.translateType === "popup"
          ? "selected"
          : ""
        }>
        Dịch popup</option>
      <option value="advanced" ${this.settings.touchOptions?.twoFingers?.translateType === "advanced"
          ? "selected"
          : ""
        }>Dịch nâng cao</option>
    </select>
  </div>
  <div class="settings-grid">
    <span class="settings-label">Ba ngón tay:</span>
    <select id="threeFingersSelect" class="settings-input">
      <option value="quick" ${this.settings.touchOptions?.threeFingers?.translateType === "quick"
          ? "selected"
          : ""
        }>
        Dịch nhanh</option>
      <option value="popup" ${this.settings.touchOptions?.threeFingers?.translateType === "popup"
          ? "selected"
          : ""
        }>
        Dịch popup</option>
      <option value="advanced" ${this.settings.touchOptions?.threeFingers?.translateType === "advanced"
          ? "selected"
          : ""
        }>Dịch nâng cao</option>
    </select>
  </div>
  <div class="settings-grid">
    <span class="settings-label">Độ nhạy (ms):</span>
    <input type="number" id="touchSensitivity" class="settings-input"
      value="${this.settings.touchOptions?.sensitivity || 100
        }" min="50" max="350" step="50">
  </div>
</div>
<div style="margin-bottom: 15px;">
  <h3>RATE LIMIT</h3>
  <div class="settings-grid">
    <span class="settings-label">Số yêu cầu tối đa:</span>
    <input type="number" id="maxRequests" class="settings-input" value="${this.settings.rateLimit?.maxRequests || CONFIG.RATE_LIMIT.maxRequests
        }" min="1" max="50" step="1">
  </div>
  <div class="settings-grid">
    <span class="settings-label">Thời gian chờ (ms):</span>
    <input type="number" id="perMilliseconds" class="settings-input" value="${this.settings.rateLimit?.perMilliseconds ||
        CONFIG.RATE_LIMIT.perMilliseconds
        }" min="1000" step="1000">
  </div>
</div>
<div style="margin-bottom: 15px;">
  <h3>CACHE</h3>
  <div style="margin-bottom: 10px;">
    <h4 style="color: ${isDark ? " #678" : "#333"
        }; margin-bottom: 8px;">Text Cache</h4>
    <div class="settings-grid">
      <span class="settings-label">Bật cache text:</span>
      <input type="checkbox" id="textCacheEnabled" ${this.settings.cacheOptions?.text?.enabled ? "checked" : ""
        }>
    </div>
    <div class="settings-grid">
      <span class="settings-label">Kích thước cache text:</span>
      <input type="number" id="textCacheMaxSize" class="settings-input" value="${this.settings.cacheOptions?.text?.maxSize || CONFIG.CACHE.text.maxSize
        }" min="10" max="1000">
    </div>
    <div class="settings-grid">
      <span class="settings-label">Thời gian cache text (ms):</span>
      <input type="number" id="textCacheExpiration" class="settings-input" value="${this.settings.cacheOptions?.text?.expirationTime ||
        CONFIG.CACHE.text.expirationTime
        }" min="60000" step="60000">
    </div>
    <div style="margin-bottom: 10px;">
      <h4 style="color: ${isDark ? " #678" : "#333"
        }; margin-bottom: 8px;">Image Cache</h4>
      <div class="settings-grid">
        <span class="settings-label">Bật cache ảnh:</span>
        <input type="checkbox" id="imageCacheEnabled" ${this.settings.cacheOptions?.image?.enabled ? "checked" : ""
        }>
      </div>
      <div class="settings-grid">
        <span class="settings-label">Kích thước cache ảnh:</span>
        <input type="number" id="imageCacheMaxSize" class="settings-input" value="${this.settings.cacheOptions?.image?.maxSize ||
        CONFIG.CACHE.image.maxSize
        }" min="10" max="100">
      </div>
      <div class="settings-grid">
        <span class="settings-label">Thời gian cache ảnh (ms):</span>
        <input type="number" id="imageCacheExpiration" class="settings-input" value="${this.settings.cacheOptions?.image?.expirationTime ||
        CONFIG.CACHE.image.expirationTime
        }" min="60000" step="60000">
      </div>
    </div>
    <div style="margin-bottom: 10px;">
      <h4 style="color: ${isDark ? " #678" : "#333"
        }; margin-bottom: 8px;">Media Cache</h4>
      <div class="settings-grid">
        <span class="settings-label">Bật cache media:</span>
        <input type="checkbox" id="mediaCacheEnabled" ${this.settings.cacheOptions.media?.enabled ? "checked" : ""
        }>
      </div>
      <div class="settings-grid">
        <span class="settings-label">Media cache entries:</span>
        <input type="number" id="mediaCacheMaxSize" class="settings-input" value="${this.settings.cacheOptions.media?.maxSize ||
        CONFIG.CACHE.media.maxSize
        }" min="5" max="100">
      </div>
      <div class="settings-grid">
        <span class="settings-label">Thời gian expire (giây):</span>
        <input type="number" id="mediaCacheExpirationTime" class="settings-input" value="${this.settings.cacheOptions.media?.expirationTime / 1000 ||
        CONFIG.CACHE.media.expirationTime / 1000
        }" min="60000" step="60000">
      </div>
    </div>
  </div>
</div>
<div style="border-top: 1px solid ${isDark ? "#444" : "#ddd"
        }; margin-top: 20px; padding-top: 20px;">
  <h3>SAO LƯU CÀI ĐẶT</h3>
  <div style="display: flex; gap: 10px; margin-bottom: 15px;">
    <button id="exportSettings" style="flex: 1; background: #28a745 !important; min-width: 140px; height: 36px; display: flex; align-items: center; justify-content: center; gap: 8px;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Xuất cài đặt
    </button>
    <input type="file" id="importInput" accept=".json" style="display: none;">
    <button id="importSettings" style="flex: 1; background: #17a2b8 !important; min-width: 140px; height: 36px; display: flex; align-items: center; justify-content: center; gap: 8px;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
      Nhập cài đặt
    </button>
  </div>
</div>
<div style="border-top: 1px solid ${isDark ? "#444" : "#ddd"
        }; margin-top: 20px; padding-top: 20px;">
  <div style="display: flex; gap: 10px; justify-content: flex-end;">
    <button id="cancelSettings" style="min-width: 100px; height: 36px; background: ${isDark ? "#666" : "#e9ecef"
        } !important; color: ${isDark ? "#fff" : "#333"} !important;">
      Hủy
    </button>
    <button id="saveSettings" style="min-width: 100px; height: 36px; background: #007bff !important; color: white !important;">
      Lưu
    </button>
  </div>
</div>
      `;
      container.className = "translator-settings-container";
      const addGeminiKey = container.querySelector("#addGeminiKey");
      const addOpenaiKey = container.querySelector("#addOpenaiKey");
      const geminiContainer = container.querySelector(
        "#geminiKeys .api-keys-container",
      );
      const openaiContainer = container.querySelector(
        "#openaiKeys .api-keys-container",
      );
      addGeminiKey.addEventListener("click", () => {
        const newEntry = document.createElement("div");
        newEntry.className = "api-key-entry";
        newEntry.style.cssText =
          "display: flex; gap: 10px; margin-bottom: 5px;";
        const currentKeysCount = geminiContainer.children.length;
        newEntry.innerHTML = `
    <input type="text" class="gemini-key" value="" style="flex: 1; width: 100%;">
    <button class="remove-key" data-provider="gemini" data-index="${currentKeysCount}" style="background: #ff4444;">×</button>
  `;
        geminiContainer.appendChild(newEntry);
      });
      addOpenaiKey.addEventListener("click", () => {
        const newEntry = document.createElement("div");
        newEntry.className = "api-key-entry";
        newEntry.style.cssText =
          "display: flex; gap: 10px; margin-bottom: 5px;";
        const currentKeysCount = openaiContainer.children.length;
        newEntry.innerHTML = `
    <input type="text" class="openai-key" value="" style="flex: 1; width: 100%;">
    <button class="remove-key" data-provider="openai" data-index="${currentKeysCount}" style="background: #ff4444;">×</button>
  `;
        openaiContainer.appendChild(newEntry);
      });
      container.addEventListener("click", (e) => {
        if (e.target.classList.contains("remove-key")) {
          const provider = e.target.dataset.provider;
          const index = parseInt(e.target.dataset.index);
          e.target.parentElement.remove();
          const container = document.querySelector(
            `#${provider}Keys .api-keys-container`,
          );
          Array.from(container.querySelectorAll(".remove-key")).forEach(
            (btn, i) => {
              btn.dataset.index = i;
            },
          );
        }
      });
      const modelTypeSelect = container.querySelector("#geminiModelType");
      const fastContainer = container.querySelector("#fastModelContainer");
      const proContainer = container.querySelector("#proModelContainer");
      const visionContainer = container.querySelector("#visionModelContainer");
      const customContainer = container.querySelector("#customModelContainer");
      modelTypeSelect.addEventListener("change", (e) => {
        const selectedType = e.target.value;
        fastContainer.style.display = selectedType === "fast" ? "" : "none";
        proContainer.style.display = selectedType === "pro" ? "" : "none";
        visionContainer.style.display = selectedType === "vision" ? "" : "none";
        customContainer.style.display = selectedType === "custom" ? "" : "none";
      });
      const handleEscape = (e) => {
        if (e.key === "Escape") {
          document.removeEventListener("keydown", handleEscape);
          if (container && container.parentNode) {
            container.parentNode.removeChild(container);
          }
        }
      };
      document.addEventListener("keydown", handleEscape);
      container.addEventListener("remove", () => {
        document.removeEventListener("keydown", handleEscape);
      });
      const exportBtn = container.querySelector("#exportSettings");
      const importBtn = container.querySelector("#importSettings");
      const importInput = container.querySelector("#importInput");
      exportBtn.addEventListener("click", () => {
        try {
          this.exportSettings();
          this.showNotification("Export settings thành công");
        } catch (error) {
          this.showNotification("Lỗi export settings", "error");
        }
      });
      importBtn.addEventListener("click", () => {
        importInput.click();
      });
      importInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          await this.importSettings(file);
          this.showNotification("Import settings thành công");
          setTimeout(() => location.reload(), 1500);
        } catch (error) {
          this.showNotification(error.message, "error");
        }
      });
      const cancelButton = container.querySelector("#cancelSettings");
      cancelButton.addEventListener("click", () => {
        if (container && container.parentNode) {
          container.parentNode.removeChild(container);
        }
      });
      const saveButton = container.querySelector("#saveSettings");
      saveButton.addEventListener("click", () => {
        this.saveSettings(container);
        container.remove();
        location.reload();
      });
      return container;
    }
    exportSettings() {
      const settings = this.settings;
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `king1x32-translator-settings-${timestamp}.json`;
      const blob = new Blob([JSON.stringify(settings, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
    async importSettings(file) {
      try {
        const content = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error("Không thể đọc file"));
          reader.readAsText(file);
        });
        const importedSettings = JSON.parse(content);
        if (!this.validateImportedSettings(importedSettings)) {
          throw new Error("File settings không hợp lệ");
        }
        const mergedSettings = this.mergeWithDefaults(importedSettings);
        GM_setValue("translatorSettings", JSON.stringify(mergedSettings));
        return true;
      } catch (error) {
        console.error("Import error:", error);
        throw new Error(`Lỗi import: ${error.message}`);
      }
    }
    validateImportedSettings(settings) {
      const requiredFields = [
        "theme",
        "apiProvider",
        "apiKey",
        "geminiOptions",
        "ocrOptions",
        "mediaOptions",
        "displayOptions",
        "shortcuts",
        "clickOptions",
        "touchOptions",
        "cacheOptions",
        "rateLimit",
      ];
      if (settings.pageTranslation) {
        if (!Array.isArray(settings.pageTranslation.excludeSelectors)) {
          settings.pageTranslation.excludeSelectors =
            DEFAULT_SETTINGS.pageTranslation.excludeSelectors;
        }
      }
      return requiredFields.every((field) => settings.hasOwnProperty(field));
    }
    showNotification(message, type = "info") {
      const notification = document.createElement("div");
      notification.className = "translator-notification";
      const colors = {
        info: "#4a90e2",
        success: "#28a745",
        warning: "#ffc107",
        error: "#dc3545",
      };
      const backgroundColor = colors[type] || colors.info;
      const textColor = type === "warning" ? "#000" : "#fff";
      Object.assign(notification.style, {
        position: "fixed",
        top: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        backgroundColor,
        color: textColor,
        padding: "10px 20px",
        borderRadius: "5px",
        zIndex: "2147483647",
        animation: "fadeInOut 2s ease",
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
      });
      notification.textContent = message;
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 2000);
    }
    loadSettings() {
      const savedSettings = GM_getValue("translatorSettings");
      return savedSettings
        ? this.mergeWithDefaults(JSON.parse(savedSettings))
        : DEFAULT_SETTINGS;
    }
    mergeWithDefaults(savedSettings) {
      return {
        ...DEFAULT_SETTINGS,
        ...savedSettings,
        geminiOptions: {
          ...DEFAULT_SETTINGS.geminiOptions,
          ...(savedSettings?.geminiOptions || {}),
        },
        apiKey: {
          gemini: [
            ...(savedSettings?.apiKey?.gemini ||
              DEFAULT_SETTINGS.apiKey.gemini),
          ],
          openai: [
            ...(savedSettings?.apiKey?.openai ||
              DEFAULT_SETTINGS.apiKey.openai),
          ],
        },
        currentKeyIndex: {
          ...DEFAULT_SETTINGS.currentKeyIndex,
          ...(savedSettings?.currentKeyIndex || {}),
        },
        contextMenu: {
          ...DEFAULT_SETTINGS.contextMenu,
          ...(savedSettings?.contextMenu || {}),
        },
        pageTranslation: {
          ...DEFAULT_SETTINGS.pageTranslation,
          ...(savedSettings?.pageTranslation || {}),
        },
        ocrOptions: {
          ...DEFAULT_SETTINGS.ocrOptions,
          ...(savedSettings?.ocrOptions || {}),
        },
        displayOptions: {
          ...DEFAULT_SETTINGS.displayOptions,
          ...(savedSettings?.displayOptions || {}),
        },
        shortcuts: {
          ...DEFAULT_SETTINGS.shortcuts,
          ...(savedSettings?.shortcuts || {}),
        },
        clickOptions: {
          ...DEFAULT_SETTINGS.clickOptions,
          ...(savedSettings?.clickOptions || {}),
        },
        touchOptions: {
          ...DEFAULT_SETTINGS.touchOptions,
          ...(savedSettings?.touchOptions || {}),
        },
        cacheOptions: {
          text: {
            ...DEFAULT_SETTINGS.cacheOptions.text,
            ...(savedSettings?.cacheOptions?.text || {}),
          },
          image: {
            ...DEFAULT_SETTINGS.cacheOptions.image,
            ...(savedSettings?.cacheOptions?.image || {}),
          },
          media: {
            ...DEFAULT_SETTINGS.cacheOptions.media,
            ...(savedSettings?.cacheOptions?.media || {}),
          },
          page: {
            ...DEFAULT_SETTINGS.cacheOptions.page,
            ...(savedSettings?.cacheOptions?.page || {}),
          },
        },
        rateLimit: {
          ...DEFAULT_SETTINGS.rateLimit,
          ...(savedSettings?.rateLimit || {}),
        },
      };
    }
    saveSettings(settingsUI) {
      const geminiKeys = Array.from(settingsUI.querySelectorAll(".gemini-key"))
        .map((input) => input.value.trim())
        .filter((key) => key !== "");
      const openaiKeys = Array.from(settingsUI.querySelectorAll(".openai-key"))
        .map((input) => input.value.trim())
        .filter((key) => key !== "");
      const maxWidthVw = settingsUI.querySelector("#maxPopupWidth").value;
      const maxWidthPx = (window.innerWidth * parseInt(maxWidthVw)) / 100;
      const minWidthPx = parseInt(
        settingsUI.querySelector("#minPopupWidth").value,
      );
      const finalMinWidth =
        minWidthPx > maxWidthPx
          ? maxWidthVw
          : settingsUI.querySelector("#minPopupWidth").value;
      const newSettings = {
        theme: settingsUI.querySelector('input[name="theme"]:checked').value,
        apiProvider: settingsUI.querySelector(
          'input[name="apiProvider"]:checked',
        ).value,
        apiKey: {
          gemini:
            geminiKeys.length > 0
              ? geminiKeys
              : [DEFAULT_SETTINGS.apiKey.gemini[0]],
          openai:
            openaiKeys.length > 0
              ? openaiKeys
              : [DEFAULT_SETTINGS.apiKey.openai[0]],
        },
        currentKeyIndex: {
          gemini: 0,
          openai: 0,
        },
        geminiOptions: {
          modelType: settingsUI.querySelector("#geminiModelType").value,
          fastModel: settingsUI.querySelector("#fastModel").value,
          proModel: settingsUI.querySelector("#proModel").value,
          visionModel: settingsUI.querySelector("#visionModel").value,
          customModel: settingsUI.querySelector("#customModel").value,
        },
        contextMenu: {
          enabled: settingsUI.querySelector("#contextMenuEnabled").checked,
        },
        pageTranslation: {
          enabled: settingsUI.querySelector("#pageTranslationEnabled").checked,
          autoTranslate: settingsUI.querySelector("#autoTranslatePage").checked,
          showInitialButton:
            settingsUI.querySelector("#showInitialButton").checked,
          buttonTimeout: DEFAULT_SETTINGS.pageTranslation.buttonTimeout,
          excludeSelectors: settingsUI
            .querySelector("#excludeSelectors")
            .value.split("\n")
            .map((s) => s.trim())
            .filter((s) => s && s.length > 0),
        },
        ocrOptions: {
          enabled: settingsUI.querySelector("#ocrEnabled").checked,
          preferredProvider: settingsUI.querySelector(
            'input[name="apiProvider"]:checked',
          ).value,
          displayType: "popup",
          maxFileSize: CONFIG.OCR.maxFileSize,
          temperature: parseFloat(
            settingsUI.querySelector("#ocrTemperature").value,
          ),
          topP: parseFloat(settingsUI.querySelector("#ocrTopP").value),
          topK: parseInt(settingsUI.querySelector("#ocrTopK").value),
        },
        mediaOptions: {
          enabled: settingsUI.querySelector("#mediaEnabled").checked,
          temperature: parseFloat(
            settingsUI.querySelector("#mediaTemperature").value,
          ),
          topP: parseFloat(settingsUI.querySelector("#mediaTopP").value),
          topK: parseInt(settingsUI.querySelector("#mediaTopK").value),
        },
        displayOptions: {
          showOriginalText:
            settingsUI.querySelector("#showOriginalText").checked,
          fontSize: settingsUI.querySelector("#fontSize").value,
          minPopupWidth: finalMinWidth,
          maxPopupWidth: maxWidthVw,
        },
        shortcuts: {
          settingsEnabled: settingsUI.querySelector("#settingsShortcutEnabled")
            .checked,
          enabled: settingsUI.querySelector("#shortcutsEnabled").checked,
          pageTranslate: {
            key: settingsUI.querySelector("#pageTranslateKey").value,
            altKey: true,
          },
          quickTranslate: {
            key: settingsUI.querySelector("#quickKey").value,
            altKey: true,
          },
          popupTranslate: {
            key: settingsUI.querySelector("#popupKey").value,
            altKey: true,
          },
          advancedTranslate: {
            key: settingsUI.querySelector("#advancedKey").value,
            altKey: true,
          },
        },
        clickOptions: {
          enabled: settingsUI.querySelector("#translationButtonEnabled")
            .checked,
          singleClick: {
            translateType: settingsUI.querySelector("#singleClickSelect").value,
          },
          doubleClick: {
            translateType: settingsUI.querySelector("#doubleClickSelect").value,
          },
          hold: {
            translateType: settingsUI.querySelector("#holdSelect").value,
          },
        },
        touchOptions: {
          enabled: settingsUI.querySelector("#touchEnabled").checked,
          sensitivity: parseInt(
            settingsUI.querySelector("#touchSensitivity").value,
          ),
          twoFingers: {
            translateType: settingsUI.querySelector("#twoFingersSelect").value,
          },
          threeFingers: {
            translateType: settingsUI.querySelector("#threeFingersSelect")
              .value,
          },
        },
        cacheOptions: {
          text: {
            enabled: settingsUI.querySelector("#textCacheEnabled").checked,
            maxSize: parseInt(
              settingsUI.querySelector("#textCacheMaxSize").value,
            ),
            expirationTime: parseInt(
              settingsUI.querySelector("#textCacheExpiration").value,
            ),
          },
          image: {
            enabled: settingsUI.querySelector("#imageCacheEnabled").checked,
            maxSize: parseInt(
              settingsUI.querySelector("#imageCacheMaxSize").value,
            ),
            expirationTime: parseInt(
              settingsUI.querySelector("#imageCacheExpiration").value,
            ),
          },
          media: {
            enabled: document.getElementById("mediaCacheEnabled").checked,
            maxSize: parseInt(
              document.getElementById("mediaCacheMaxSize").value,
            ),
            expirationTime:
              parseInt(
                document.getElementById("mediaCacheExpirationTime").value,
              ) * 1000,
          },
        },
        rateLimit: {
          maxRequests: parseInt(settingsUI.querySelector("#maxRequests").value),
          perMilliseconds: parseInt(
            settingsUI.querySelector("#perMilliseconds").value,
          ),
        },
      };
      const isToolsEnabled = settingsUI.querySelector(
        "#showTranslatorTools",
      ).checked;
      const currentState =
        localStorage.getItem("translatorToolsEnabled") === "true";
      if (isToolsEnabled !== currentState) {
        localStorage.setItem(
          "translatorToolsEnabled",
          isToolsEnabled.toString(),
        );
        this.translator.ui.removeToolsListeners();
        this.translator.ui.removeToolsContainer();
        this.translator.ui.removeAllProcessingIndicators();
        this.translator.ui.resetState();
        const overlays = document.querySelectorAll(".translator-overlay");
        overlays.forEach((overlay) => overlay.remove());
        if (isToolsEnabled) {
          this.translator.ui.setupTranslatorTools();
        }
      }
      const mergedSettings = this.mergeWithDefaults(newSettings);
      GM_setValue("translatorSettings", JSON.stringify(mergedSettings));
      this.settings = mergedSettings;
      const event = new CustomEvent("settingsChanged", {
        detail: mergedSettings,
      });
      document.dispatchEvent(event);
      return mergedSettings;
    }
    getSetting(path) {
      return path.split(".").reduce((obj, key) => obj?.[key], this.settings);
    }
  }
  class OCRManager {
    constructor(translator) {
      if (!translator) {
        throw new Error("Translator instance is required for OCRManager");
      }
      this.translator = translator;
      this.isProcessing = false;
      this.imageCache = new ImageCache();
    }

    async captureScreen() {
      try {
        this.translator.ui.showProcessingStatus(
          "Đang chuẩn bị chụp màn hình...",
        );

        // Ẩn các elements của translator
        const elements = document.querySelectorAll(
          ".translator-tools-container, .translator-notification, .center-translate-status",
        );
        elements.forEach((el) => {
          if (el) el.style.visibility = "hidden";
        });

        await new Promise((resolve) => setTimeout(resolve, 100));

        // Cấu hình html2canvas
        const options = {
          useCORS: true,
          allowTaint: true,
          foreignObjectRendering: true,
          scale: window.devicePixelRatio || 1,
          logging: false,
          width: window.innerWidth,
          height: window.innerHeight,
          windowWidth: document.documentElement.scrollWidth,
          windowHeight: document.documentElement.scrollHeight,
          x: window.pageXOffset,
          y: window.pageYOffset,
          onclone: function(clonedDoc) {
            const elements = clonedDoc.querySelectorAll(
              ".translator-tools-container, .translator-notification, .center-translate-status",
            );
            elements.forEach((el) => {
              if (el) el.style.display = "none";
            });
          },
        };

        this.translator.ui.updateProcessingStatus("Đang chụp màn hình...", 30);
        const canvas = await html2canvas(document.documentElement, options);

        this.translator.ui.updateProcessingStatus("Đang xử lý ảnh...", 60);
        const blob = await new Promise((resolve, reject) => {
          try {
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  resolve(blob);
                } else {
                  reject(new Error("Failed to create blob from canvas"));
                }
              },
              "image/png",
              1.0,
            );
          } catch (error) {
            reject(error);
          }
        });

        // Khôi phục visibility của các elements
        elements.forEach((el) => {
          if (el) el.style.visibility = "";
        });

        this.translator.ui.updateProcessingStatus("Đang chuẩn bị OCR...", 80);
        const file = new File([blob], "king1x32_screenshot.png", { type: "image/png" });
        return file;
      } catch (error) {
        console.error("Screen capture error:", error);
        // Khôi phục visibility trong trường hợp lỗi
        const elements = document.querySelectorAll(
          ".translator-tools-container, .translator-notification, .center-translate-status",
        );
        elements.forEach((el) => {
          if (el) el.style.visibility = "";
        });
        throw new Error(`Không thể chụp màn hình: ${error.message}`);
      }
    }

    async processImage(file) {
      try {
        this.isProcessing = true;
        this.translator.ui.showProcessingStatus("Đang xử lý ảnh...");

        const base64Image = await this.fileToBase64(file);
        this.translator.ui.updateProcessingStatus("Đang kiểm tra cache...", 20);

        // Kiểm tra cache
        if (
          this.imageCache &&
          this.translator.userSettings.settings.cacheOptions.image.enabled
        ) {
          const cachedResult = await this.imageCache.get(base64Image);
          if (cachedResult) {
            this.translator.ui.updateProcessingStatus(
              "Đã tìm thấy trong cache",
              100,
            );
            return cachedResult;
          }
        }

        this.translator.ui.updateProcessingStatus("Đang nhận diện text...", 40);

        const settings = this.translator.userSettings.settings;
        const selectedModel = this.translator.api.getGeminiModel();

        const requestBody = {
          contents: [
            {
              parts: [
                {
                  text:
                    file.name === "king1x32_screenshot.png"
                      ? "Đây là ảnh chụp màn hình. Hãy đọc và dịch toàn bộ text trong ảnh sang tiếng Việt một cách tự nhiên và chính xác. Chỉ trả về bản dịch, không cần giải thích gì thêm."
                      : "Đọc hiểu thật kĩ và dịch toàn bộ văn bản trong hình ảnh sang tiếng Việt thật tự nhiên và chính xác. Chỉ trả về bản dịch, không cần giải thích gì thêm.",
                },
                {
                  inline_data: {
                    mime_type: file.type,
                    data: base64Image,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: settings.ocrOptions.temperature,
            topP: settings.ocrOptions.topP,
            topK: settings.ocrOptions.topK,
          },
        };

        this.translator.ui.updateProcessingStatus("Đang xử lý OCR...", 60);

        const results =
          await this.translator.api.keyManager.executeWithMultipleKeys(
            async (key) => {
              const response = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                  method: "POST",
                  url: `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${key}`,
                  headers: { "Content-Type": "application/json" },
                  data: JSON.stringify(requestBody),
                  onload: (response) => {
                    if (response.status === 200) {
                      try {
                        const result = JSON.parse(response.responseText);
                        if (
                          result?.candidates?.[0]?.content?.parts?.[0]?.text
                        ) {
                          resolve(result.candidates[0].content.parts[0].text);
                        } else {
                          reject(new Error("Không thể đọc kết quả từ API"));
                        }
                      } catch (error) {
                        reject(new Error("Không thể parse kết quả API"));
                      }
                    } else if (
                      response.status === 429 ||
                      response.status === 403
                    ) {
                      reject(new Error("API key rate limit exceeded"));
                    } else {
                      reject(new Error(`API Error: ${response.status}`));
                    }
                  },
                  onerror: (error) =>
                    reject(new Error(`Lỗi kết nối: ${error}`)),
                });
              });
              return response;
            },
            settings.apiProvider,
          );

        this.translator.ui.updateProcessingStatus("Đang hoàn thiện...", 80);

        if (!results || results.length === 0) {
          throw new Error("Không thể trích xuất text từ ảnh");
        }

        const finalResult = results[0];

        // Lưu vào cache nếu thành công
        if (this.imageCache && settings.cacheOptions.image.enabled) {
          await this.imageCache.set(base64Image, finalResult);
        }

        this.translator.ui.updateProcessingStatus("Hoàn thành", 100);
        return finalResult;
      } catch (error) {
        console.error("OCR processing error:", error);
        throw error;
      } finally {
        this.isProcessing = false;
        setTimeout(() => this.translator.ui.removeProcessingStatus(), 1000);
      }
    }
    fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = () => reject(new Error("Không thể đọc file"));
        reader.readAsDataURL(file);
      });
    }
  }
  class MediaManager {
    constructor(translator) {
      this.translator = translator;
      this.isProcessing = false;
      this.mediaCache = new MediaCache();
    }

    async processMediaFile(file) {
      try {
        // Kiểm tra định dạng và kích thước
        if (!this.isValidFormat(file)) {
          throw new Error("Định dạng file không được hỗ trợ");
        }

        if (!this.isValidSize(file)) {
          throw new Error(
            `File quá lớn. Kích thước tối đa: ${this.getMaxSizeInMB(file)}MB`,
          );
        }

        this.isProcessing = true;
        this.translator.ui.showProcessingStatus("Đang xử lý media...");

        const base64Media = await this.fileToBase64(file);
        this.translator.ui.updateProcessingStatus("Đang kiểm tra cache...", 20);

        // Kiểm tra cache
        const cacheEnabled =
          this.translator.userSettings.settings.cacheOptions.media?.enabled;
        if (cacheEnabled && this.mediaCache) {
          const cachedResult = await this.mediaCache.get(base64Media);
          if (cachedResult) {
            this.translator.ui.updateProcessingStatus(
              "Đã tìm thấy trong cache",
              100,
            );
            this.translator.ui.displayPopup(cachedResult, null, "Bản dịch");
            return;
          }
        }

        this.translator.ui.updateProcessingStatus(
          "Đang xử lý audio/video...",
          40,
        );

        // Lấy settings từ user settings
        const settings = this.translator.userSettings.settings;
        const mediaSettings = settings.mediaOptions;
        const selectedModel = this.translator.api.getGeminiModel();

        // Tạo request body
        const requestBody = {
          contents: [
            {
              parts: [
                {
                  text: "Đây là nội dung audio/video. Chỉ cần nghe thôi nên hãy lắng nghe thật kĩ và dịch sang tiếng Việt thật tự nhiên, đảm bảo truyền tải đúng ý nghĩa và ngữ cảnh của đoạn thoại thật chuẩn. Chỉ trả về bản dịch, không cần giải thích thêm.",
                },
                {
                  inline_data: {
                    mime_type: file.type,
                    data: base64Media,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: mediaSettings.temperature,
            topP: mediaSettings.topP,
            topK: mediaSettings.topK,
          },
        };

        this.translator.ui.updateProcessingStatus("Đang dịch...", 60);

        // Gửi request đến API
        const results =
          await this.translator.api.keyManager.executeWithMultipleKeys(
            async (key) => {
              const response = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                  method: "POST",
                  url: `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${key}`,
                  headers: { "Content-Type": "application/json" },
                  data: JSON.stringify(requestBody),
                  onload: (response) => {
                    if (response.status === 200) {
                      try {
                        const result = JSON.parse(response.responseText);
                        if (
                          result?.candidates?.[0]?.content?.parts?.[0]?.text
                        ) {
                          resolve(result.candidates[0].content.parts[0].text);
                        } else {
                          reject(new Error("Invalid response format"));
                        }
                      } catch (error) {
                        reject(new Error("Failed to parse response"));
                      }
                    } else if (
                      response.status === 429 ||
                      response.status === 403
                    ) {
                      reject(new Error("API key rate limit exceeded"));
                    } else {
                      reject(new Error(`API Error: ${response.status}`));
                    }
                  },
                  onerror: (error) =>
                    reject(new Error(`Connection error: ${error}`)),
                });
              });
              return response;
            },
            settings.apiProvider,
          );

        this.translator.ui.updateProcessingStatus("Đang hoàn thiện...", 80);

        if (!results || results.length === 0) {
          throw new Error("Không thể xử lý media");
        }

        const finalResult = results[0];

        // Lưu vào cache nếu được bật
        if (cacheEnabled && this.mediaCache) {
          await this.mediaCache.set(base64Media, finalResult);
        }

        this.translator.ui.updateProcessingStatus("Hoàn thành", 100);
        this.translator.ui.displayPopup(finalResult, null, "Bản dịch");
      } catch (error) {
        console.error("Media processing error:", error);
        throw new Error(`Không thể xử lý file: ${error.message}`);
      } finally {
        this.isProcessing = false;
        setTimeout(() => this.translator.ui.removeProcessingStatus(), 1000);
      }
    }
    isValidFormat(file) {
      const extension = file.name.split(".").pop().toLowerCase();
      const mimeMapping = {
        mp3: "audio/mp3",
        wav: "audio/wav",
        ogg: "audio/ogg",
        m4a: "audio/m4a",
        aac: "audio/aac",
        flac: "audio/flac",
        wma: "audio/wma",
        opus: "audio/opus",
        amr: "audio/amr",
        midi: "audio/midi",
        mid: "audio/midi",
        mp4: "video/mp4",
        webm: "video/webm",
        ogv: "video/ogg",
        avi: "video/x-msvideo",
        mov: "video/quicktime",
        wmv: "video/x-ms-wmv",
        flv: "video/x-flv",
        "3gp": "video/3gpp",
        "3g2": "video/3gpp2",
        mkv: "video/x-matroska",
      };
      const mimeType = mimeMapping[extension];
      if (mimeType?.startsWith("audio/")) {
        return CONFIG.MEDIA.audio.supportedFormats.includes(mimeType);
      } else if (mimeType?.startsWith("video/")) {
        return CONFIG.MEDIA.video.supportedFormats.includes(mimeType);
      }
      return false;
    }
    isValidSize(file) {
      const maxSize = file.type.startsWith("audio/")
        ? CONFIG.MEDIA.audio.maxSize
        : CONFIG.MEDIA.video.maxSize;
      return file.size <= maxSize;
    }
    getMaxSizeInMB(file) {
      const maxSize = file.type.startsWith("audio/")
        ? CONFIG.MEDIA.audio.maxSize
        : CONFIG.MEDIA.video.maxSize;
      return Math.floor(maxSize / (1024 * 1024));
    }
    fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = () => reject(new Error("Không thể đọc file"));
        reader.readAsDataURL(file);
      });
    }
    cleanup() {
      try {
        if (this.audioCtx) {
          this.audioCtx.close();
          this.audioCtx = null;
        }
        if (this.processor) {
          this.processor.disconnect();
          this.processor = null;
        }
        if (this.container) {
          this.container.remove();
          this.container = null;
        }
        this.mediaElement = null;
        this.audioBuffer = null;
      } catch (error) {
        console.error("Error during cleanup:", error);
      }
    }
  }
  class RateLimiter {
    constructor(translator) {
      this.translator = translator;
      this.queue = [];
      this.lastRequestTime = 0;
      this.requestCount = 0;
    }
    async waitForSlot() {
      const now = Date.now();
      const settings = this.translator.userSettings.settings;
      const { maxRequests, perMilliseconds } = settings.rateLimit;
      this.queue = this.queue.filter((time) => now - time < perMilliseconds);
      if (this.queue.length >= maxRequests) {
        const oldestRequest = this.queue[0];
        const waitTime = perMilliseconds - (now - oldestRequest);
        if (waitTime > 0) {
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
        this.queue.shift();
      }
      this.queue.push(now);
    }
  }
  class PageTranslator {
    constructor(translator) {
      this.translator = translator;
      this.MIN_TEXT_LENGTH = 100;
      this.originalTexts = new Map();
      this.isTranslated = false;
      this.pageCache = new Map();
      this.rateLimiter = new RateLimiter(translator);
      this.pdfLoaded = true;
    }
    async detectLanguage() {
      try {
        const text = document.body.innerText.slice(0, 1000);
        if (!text.trim()) {
          throw new Error("Không tìm thấy nội dung để phát hiện ngôn ngữ");
        }
        const prompt =
          "Detect language of this text and return only ISO code (e.g. 'en', 'vi'): " +
          text;
        if (!this.translator.api) {
          throw new Error("API không khả dụng");
        }
        const response = await this.translator.api.request(prompt);
        const languageCode = response.trim().toLowerCase();
        if (languageCode === "vi") {
          return {
            isVietnamese: true,
            message: "Trang web đã ở tiếng Việt",
          };
        }
        return {
          isVietnamese: false,
          message: `Đã phát hiện ngôn ngữ: ${languageCode}`,
        };
      } catch (error) {
        console.error("Language detection error:", error);
        throw new Error("Không thể phát hiện ngôn ngữ: " + error.message);
      }
    }
    async checkAndTranslate() {
      try {
        const settings = this.translator.userSettings.settings;
        if (!settings.pageTranslation.autoTranslate) {
          return {
            success: false,
            message: "Tự động dịch đang tắt",
          };
        }
        const languageCheck = await this.detectLanguage();
        if (languageCheck.isVietnamese) {
          return {
            success: false,
            message: languageCheck.message,
          };
        }
        return await this.translatePage();
      } catch (error) {
        console.error("Translation check error:", error);
        return {
          success: false,
          message: error.message,
        };
      }
    }
    async translatePage() {
      try {
        if (!document.body) {
          throw new Error("Trang web chưa load xong");
        }
        if (this.isTranslated) {
          this.restoreOriginalText();
          this.isTranslated = false;
          this.updateUI("Dịch trang", "📄 Dịch trang");
          return {
            success: true,
            message: "Đã chuyển về văn bản gốc",
          };
        }
        const textNodes = this.collectTextNodes();
        if (textNodes.length === 0) {
          return {
            success: false,
            message: "Không tìm thấy nội dung cần dịch",
          };
        }
        const chunks = this.createChunks(textNodes);
        const totalChunks = chunks.length;
        const settings = this.translator.userSettings.settings;
        const provider = settings.apiProvider;
        const availableKeys = settings.apiKey[provider].filter((key) => {
          const failedInfo = this.translator.api.keyManager.failedKeys.get(key);
          return !failedInfo || Date.now() - failedInfo.timestamp >= 60000;
        });
        if (availableKeys.length === 0) {
          throw new Error("Không có API key khả dụng");
        }
        const chunkGroups = this.distributeChunks(chunks, availableKeys.length);
        const results = await Promise.allSettled(
          chunkGroups.map((group, index) =>
            this.translateChunkGroup(group, availableKeys[index]),
          ),
        );
        let completedChunks = 0;
        let failedChunks = 0;
        results.forEach((result, index) => {
          if (result.status === "fulfilled") {
            completedChunks += chunkGroups[index].length;
          } else {
            failedChunks += chunkGroups[index].length;
            console.error(`Group ${index} failed:`, result.reason);
          }
        });
        this.isTranslated = true;
        this.updateUI("Văn bản gốc", "📄 Văn bản gốc");
        return {
          success: true,
          completed: completedChunks,
          failed: failedChunks,
          total: totalChunks,
          message: `Đã dịch xong ${completedChunks}/${totalChunks} phần${failedChunks > 0 ? `, ${failedChunks} phần thất bại` : ""
            }`,
        };
      } catch (error) {
        console.error("Page translation error:", error);
        return {
          success: false,
          message: error.message,
        };
      }
    }
    async detectContext(text) {
      const prompt = `Analyze the context and writing style of this text and return JSON format with these properties:
    - style: formal/informal/technical/casual
    - tone: professional/friendly/neutral/academic
    - domain: general/technical/business/academic/other
    Text: "${text}"`;

      try {
        const analysis = await this.translator.api.request(prompt);
        const result = JSON.parse(analysis);
        return {
          style: result.style,
          tone: result.tone,
          domain: result.domain,
        };
      } catch (error) {
        console.error("Context detection failed:", error);
        return {
          style: "neutral",
          tone: "neutral",
          domain: "general",
        };
      }
    }
    distributeChunks(chunks, groupCount) {
      const groups = Array(groupCount)
        .fill()
        .map(() => []);
      let currentSize = 0;
      let currentGroup = 0;
      chunks.forEach((chunk) => {
        groups[currentGroup].push(chunk);
        currentSize += chunk.length;
        if (currentSize >= Math.ceil(chunks.length / groupCount)) {
          currentGroup = (currentGroup + 1) % groupCount;
          currentSize = 0;
        }
      });
      return groups.filter((group) => group.length > 0);
    }
    async translateChunkGroup(chunks, apiKey) {
      const results = [];
      for (const chunk of chunks) {
        try {
          await this.rateLimiter.waitForSlot();
          const result = await this.translateChunkWithKey(chunk, apiKey);
          if (result) {
            results.push(result);
          }
        } catch (error) {
          if (
            error.message.includes("rate limit") ||
            error.message.includes("API key not valid")
          ) {
            this.translator.api.keyManager.markKeyAsFailed(apiKey);
            throw error;
          }
          console.error("Chunk translation error:", error);
        }
      }
      return results;
    }
    async translateChunkWithKey(chunk, apiKey) {
      const textsToTranslate = chunk
        .map((node) => node.textContent.trim())
        .filter((text) => text.length > 0)
        .join("\n");
      if (!textsToTranslate) return false;
      try {
        const selectedModel = this.translator.api.getGeminiModel();
        const response = await new Promise((resolve, reject) => {
          GM_xmlhttpRequest({
            method: "POST",
            url: `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`,
            headers: { "Content-Type": "application/json" },
            data: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `Dịch sang tiếng Việt (Vietnamese), thật tự nhiên, đúng ngữ cảnh, giữ nguyên định dạng phông chữ ban đầu, chỉ trả về bản dịch, không giải thích thêm: "${textsToTranslate}"`,
                    },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.1,
                topP: 0.1,
                topK: 1,
              },
            }),
            onload: (response) => {
              if (response.status === 200) {
                try {
                  const result = JSON.parse(response.responseText);
                  if (result?.candidates?.[0]?.content?.parts?.[0]?.text) {
                    resolve(result.candidates[0].content.parts[0].text);
                  } else {
                    reject(new Error("Invalid response format"));
                  }
                } catch (error) {
                  reject(new Error("Failed to parse response"));
                }
              } else {
                if (response.status === 400) {
                  reject(new Error("API key not valid"));
                } else if (response.status === 429) {
                  reject(new Error("API key rate limit exceeded"));
                } else {
                  reject(new Error(`API Error: ${response.status}`));
                }
              }
            },
            onerror: (error) => reject(error),
          });
        });
        const translations = response.split("\n");
        chunk.forEach((node, index) => {
          if (translations[index]) {
            this.originalTexts.set(node, node.textContent);
            node.textContent = translations[index].trim();
          }
        });
        return true;
      } catch (error) {
        throw error;
      }
    }
    async translateHTML(htmlContent) {
      try {
        // Tạo DOM parser
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, "text/html");

        // Loại bỏ các script và style
        const scripts = doc.getElementsByTagName("script");
        const styles = doc.getElementsByTagName("style");
        [...scripts, ...styles].forEach((element) => element.remove());

        // Thu thập các node cần dịch
        const translatableNodes = this.getTranslatableHTMLNodes(doc.body);
        const chunks = this.createHTMLChunks(translatableNodes);

        // Hiển thị trạng thái
        this.translator.ui.showTranslatingStatus();

        // Dịch từng chunk
        for (const chunk of chunks) {
          const textsToTranslate = chunk.nodes.map((node) => ({
            text: node.textContent.trim(),
            type: node.nodeType,
            isAttribute: node.isAttribute,
            attributeName: node.attributeName,
          }));

          const prompt = `Dịch các đoạn văn bản sau sang tiếng Việt, giữ nguyên format và ý nghĩa:
                ${textsToTranslate.map((item) => item.text).join("\n---\n")}`;

          const translation = await this.translator.api.request(prompt);
          const translatedTexts = translation.split("\n---\n");

          // Cập nhật nội dung đã dịch
          chunk.nodes.forEach((node, index) => {
            if (node.isAttribute) {
              node.ownerElement.setAttribute(
                node.attributeName,
                translatedTexts[index].trim(),
              );
            } else {
              node.textContent = translatedTexts[index].trim();
            }
          });
        }

        // Trả về HTML đã dịch
        return doc.documentElement.outerHTML;
      } catch (error) {
        console.error("Lỗi dịch HTML:", error);
        throw error;
      } finally {
        this.translator.ui.removeTranslatingStatus();
      }
    }

    getTranslatableHTMLNodes(element) {
      const translatableNodes = [];
      const excludeSelectors = [
        "script",
        "style",
        "noscript",
        "code",
        "pre",
        ".notranslate",
        '[translate="no"]',
      ];

      // Tìm tất cả text nodes
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;

          // Kiểm tra các selector loại trừ
          if (excludeSelectors.some((selector) => parent.matches?.(selector))) {
            return NodeFilter.FILTER_REJECT;
          }

          // Chấp nhận node nếu có nội dung
          return node.textContent.trim()
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        },
      });

      let node;
      while ((node = walker.nextNode())) {
        translatableNodes.push(node);
      }

      // Tìm các thuộc tính cần dịch
      const elements = element.getElementsByTagName("*");
      const translatableAttributes = ["title", "alt", "placeholder"];

      for (const el of elements) {
        for (const attr of translatableAttributes) {
          if (el.hasAttribute(attr)) {
            const value = el.getAttribute(attr);
            if (value && value.trim()) {
              const node = document.createTextNode(value);
              node.isAttribute = true;
              node.attributeName = attr;
              node.ownerElement = el;
              translatableNodes.push(node);
            }
          }
        }
      }

      return translatableNodes;
    }

    createHTMLChunks(nodes, maxChunkSize = 1000) {
      const chunks = [];
      let currentChunk = { nodes: [], size: 0 };

      for (const node of nodes) {
        const textLength = node.textContent.length;

        if (currentChunk.size + textLength > maxChunkSize) {
          if (currentChunk.nodes.length > 0) {
            chunks.push(currentChunk);
          }
          currentChunk = { nodes: [node], size: textLength };
        } else {
          currentChunk.nodes.push(node);
          currentChunk.size += textLength;
        }
      }

      if (currentChunk.nodes.length > 0) {
        chunks.push(currentChunk);
      }

      return chunks;
    }
    async loadPDFJS() {
      if (!this.pdfLoaded) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = window.pdfjsWorker;
        this.pdfLoaded = true;
      }
    }
    async translatePDF(file) {
      try {
        await this.loadPDFJS();

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        let translatedContent = [];
        const totalPages = pdf.numPages;

        // Tạo canvas để render PDF
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
          const page = await pdf.getPage(pageNum);

          // Lấy viewport
          const viewport = page.getViewport({ scale: 2.0 }); // Scale 2.0 để chất lượng ảnh tốt hơn

          // Set canvas size
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          // Render page to canvas
          await page.render({
            canvasContext: ctx,
            viewport: viewport,
          }).promise;

          // Convert canvas to image file
          const imageBlob = await new Promise((resolve) => {
            canvas.toBlob(resolve, "image/png");
          });
          const imageFile = new File([imageBlob], "page.png", {
            type: "image/png",
          });

          // OCR trang PDF đã được convert sang ảnh
          try {
            // Sử dụng OCR từ translator instance
            const ocrResult = await this.translator.ocr.processImage(imageFile);

            // Nếu có kết quả OCR, thực hiện dịch
            if (ocrResult && ocrResult.trim()) {
              const translated = await this.translator.api.request(
                `Dịch sang tiếng Việt, giữ nguyên format và ý nghĩa: "${ocrResult}"`,
              );

              translatedContent.push({
                pageNum,
                original: ocrResult,
                translated: translated,
              });
            } else {
              throw new Error("Không nhận diện được text");
            }
          } catch (error) {
            console.error(`Error processing page ${pageNum}:`, error);
            translatedContent.push({
              pageNum,
              original: `[OCR Error on page ${pageNum}: ${error.message}]`,
              translated: `[Translation Error on page ${pageNum}: ${error.message}]`,
            });
          }

          // Cập nhật tiến độ
          this.translator.ui.updateProgress(
            "Đang xử lý PDF",
            Math.round((pageNum / totalPages) * 100),
          );

          // Clear canvas cho trang tiếp theo
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        // Cleanup
        canvas.remove();

        // Generate output HTML
        return this.generateTranslatedPDF(translatedContent);
      } catch (error) {
        console.error("Lỗi xử lý PDF:", error);
        throw error;
      }
    }

    generateTranslatedPDF(translatedContent) {
      const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        line-height: 1.6;
                        max-width: 900px;
                        margin: 0 auto;
                        padding: 20px;
                    }
                    .page {
                        margin-bottom: 40px;
                        padding: 20px;
                        border: 1px solid #ddd;
                        border-radius: 5px;
                        page-break-after: always;
                    }
                    .page-number {
                        font-size: 18px;
                        font-weight: bold;
                        margin-bottom: 20px;
                        color: #666;
                    }
                    .content {
                        margin-bottom: 20px;
                    }
                    .original {
                        color: #666;
                        margin-bottom: 20px;
                        padding: 15px;
                        background: #f5f5f5;
                        border-radius: 5px;
                        white-space: pre-wrap;
                    }
                    .translated {
                        color: #000;
                        padding: 15px;
                        background: #fff;
                        border: 1px solid #eee;
                        border-radius: 5px;
                        white-space: pre-wrap;
                    }
                    h3 {
                        color: #333;
                        margin: 10px 0;
                    }
                </style>
            </head>
            <body>
                ${translatedContent
          .map(
            (page) => `
                    <div class="page">
                        <div class="page-number">Trang ${page.pageNum}</div>
                        <div class="content">
                            <h3>Văn bản gốc:</h3>
                            <div class="original">${page.original}</div>
                            <h3>Bản dịch:</h3>
                            <div class="translated">${page.translated}</div>
                        </div>
                    </div>
                `,
          )
          .join("")}
            </body>
            </html>
        `;

      return new Blob([htmlContent], { type: "text/html" });
    }

    groupIntoParagraphs(textItems) {
      let paragraphs = [];
      let currentParagraph = {
        text: "",
        format: {},
        type: "text",
      };

      for (let i = 0; i < textItems.length; i++) {
        const item = textItems[i];
        const nextItem = textItems[i + 1];

        // Xác định loại nội dung
        if (item.fontSize > 20) {
          currentParagraph.type = "heading";
        } else if (item.text.match(/^\d+\./)) {
          currentParagraph.type = "list-item";
        }

        // Thêm text vào paragraph hiện tại
        currentParagraph.text += item.text;

        // Lưu thông tin định dạng
        currentParagraph.format = {
          fontSize: item.fontSize,
          fontFamily: item.fontFamily,
          isAnnotation: item.type === "annotation",
        };

        // Kiểm tra điều kiện kết thúc paragraph
        const shouldEndParagraph =
          !nextItem || // Hết items
          Math.abs(nextItem.y - item.y) > 1.5 * item.fontSize || // Khoảng cách dọc lớn
          (nextItem.fontSize > 20 && item.fontSize <= 20) || // Chuyển từ text thường sang heading
          item.text.endsWith(".") || // Kết thúc câu
          item.text.endsWith("?") ||
          item.text.endsWith("!");

        if (shouldEndParagraph) {
          if (currentParagraph.text.trim()) {
            paragraphs.push({ ...currentParagraph });
          }
          currentParagraph = {
            text: "",
            format: {},
            type: "text",
          };
        } else {
          currentParagraph.text += " ";
        }
      }

      return paragraphs;
    }

    generateEnhancedTranslatedPDF(translatedContent) {
      const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        line-height: 1.6;
                        max-width: 900px;
                        margin: 0 auto;
                        padding: 20px;
                    }
                    .page {
                        margin-bottom: 40px;
                        padding: 20px;
                        border: 1px solid #ddd;
                        border-radius: 5px;
                    }
                    .page-number {
                        font-size: 18px;
                        font-weight: bold;
                        margin-bottom: 20px;
                        color: #666;
                    }
                    .paragraph {
                        margin-bottom: 20px;
                        padding: 15px;
                        background: #f9f9f9;
                        border-radius: 5px;
                    }
                    .original {
                        color: #666;
                        margin-bottom: 10px;
                        padding-bottom: 10px;
                        border-bottom: 1px solid #eee;
                    }
                    .translated {
                        color: #000;
                    }
                    .heading {
                        font-size: 1.5em;
                        font-weight: bold;
                        color: #2c3e50;
                    }
                    .list-item {
                        margin-left: 20px;
                    }
                    .annotation {
                        font-style: italic;
                        color: #666;
                    }
                    @media print {
                        .page {
                            page-break-after: always;
                        }
                    }
                </style>
            </head>
            <body>
                ${translatedContent
          .map(
            (page) => `
                    <div class="page">
                        <div class="page-number">Trang ${page.pageNum}</div>
                        ${page.content
                .map(
                  (para) => `
                            <div class="paragraph ${para.type}">
                                <div class="original">${para.original}</div>
                                <div class="translated">${para.translated}</div>
                            </div>
                        `,
                )
                .join("")}
                    </div>
                `,
          )
          .join("")}
            </body>
            </html>
        `;

      return new Blob([htmlContent], { type: "text/html" });
    }

    splitIntoChunks(text, maxLength = 1000) {
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
      const chunks = [];
      let currentChunk = "";

      for (const sentence of sentences) {
        if ((currentChunk + sentence).length > maxLength && currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = "";
        }
        currentChunk += sentence + " ";
      }

      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }

      return chunks;
    }
    rateLimiter = {
      queue: [],
      lastRequestTime: 0,
      requestCount: 0,
      async waitForSlot() {
        const now = Date.now();
        const settings = this.translator.userSettings.settings;
        const { maxRequests, perMilliseconds } = settings.rateLimit;
        this.queue = this.queue.filter((time) => now - time < perMilliseconds);
        if (this.queue.length >= maxRequests) {
          const oldestRequest = this.queue[0];
          const waitTime = perMilliseconds - (now - oldestRequest);
          if (waitTime > 0) {
            await new Promise((resolve) => setTimeout(resolve, waitTime));
          }
          this.queue.shift();
        }
        this.queue.push(now);
      },
    };
    updateUI(menuText, buttonText) {
      const toolsContainer = document.querySelector(
        ".translator-tools-container",
      );
      if (toolsContainer) {
        const menuItem = toolsContainer.querySelector(
          '[data-type="pageTranslate"]',
        );
        if (menuItem) {
          const itemText = menuItem.querySelector(".item-text");
          if (itemText) {
            itemText.textContent = menuText;
          }
        }
      }
      const floatingButton = document.querySelector(".page-translate-button");
      if (floatingButton) {
        floatingButton.innerHTML = buttonText;
      }
    }
    async getPageCache(url) {
      const settings = this.translator.userSettings.settings;
      if (!settings.cacheOptions.page.enabled) return null;
      const cacheData = this.pageCache.get(url);
      if (
        cacheData &&
        Date.now() - cacheData.timestamp <
        settings.cacheOptions.page.expirationTime
      ) {
        return cacheData;
      }
      return null;
    }
    async setPageCache(translation, url) {
      const settings = this.translator.userSettings.settings;
      if (!settings.cacheOptions.page.enabled) return;
      if (this.pageCache.size >= settings.cacheOptions.page.maxSize) {
        const oldestKey = this.pageCache.keys().next().value;
        this.pageCache.delete(oldestKey);
      }
      this.pageCache.set(url, { translation, timestamp: Date.now() });
    }
    restoreOriginalText() {
      for (const [node, originalText] of this.originalTexts) {
        node.textContent = originalText;
      }
      this.originalTexts.clear();
    }
    applyTranslation(translation) {
      const lines = translation.split("\n");
      this.collectTextNodes().forEach((node, index) => {
        node.textContent = lines[index] || "";
      });
    }
    collectTextNodes() {
      const settings = this.translator.userSettings.settings;
      const excludeSelectors = settings.pageTranslation.excludeSelectors;
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            if (!node.textContent.trim()) {
              return NodeFilter.FILTER_REJECT;
            }
            let parent = node.parentElement;
            while (parent) {
              for (const selector of excludeSelectors) {
                try {
                  if (parent.matches && parent.matches(selector)) {
                    return NodeFilter.FILTER_REJECT;
                  }
                } catch (e) {
                  console.warn(`Invalid selector: ${selector}`, e);
                }
              }
              if (
                parent.getAttribute("translate") === "no" ||
                parent.getAttribute("class")?.includes("notranslate") ||
                parent.getAttribute("class")?.includes("no-translate")
              ) {
                return NodeFilter.FILTER_REJECT;
              }
              parent = parent.parentElement;
            }
            return NodeFilter.FILTER_ACCEPT;
          },
        },
      );
      const nodes = [];
      let node;
      while ((node = walker.nextNode())) {
        nodes.push(node);
      }
      return nodes;
    }
    createChunks(nodes) {
      const chunks = [];
      let currentChunk = [];
      let currentLength = 0;
      const maxChunkLength = 1000;
      for (const node of nodes) {
        const text = node.textContent.trim();
        if (
          currentLength + text.length > maxChunkLength &&
          currentChunk.length > 0
        ) {
          chunks.push(currentChunk);
          currentChunk = [];
          currentLength = 0;
        }
        currentChunk.push(node);
        currentLength += text.length;
      }
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
      }
      return chunks;
    }
  }
  class ImageCache {
    constructor() {
      this.maxSize = CONFIG.CACHE.image.maxSize;
      this.expirationTime = CONFIG.CACHE.image.expirationTime;
      this.cache = new Map();
      this.accessOrder = [];
    }
    async generateKey(imageData) {
      const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(imageData),
      );
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    async set(imageData, ocrResult) {
      const key = await this.generateKey(imageData);
      if (this.cache.has(key)) {
        const index = this.accessOrder.indexOf(key);
        this.accessOrder.splice(index, 1);
        this.accessOrder.push(key);
      } else {
        if (this.cache.size >= this.maxSize) {
          const oldestKey = this.accessOrder.shift();
          this.cache.delete(oldestKey);
        }
        this.accessOrder.push(key);
      }
      this.cache.set(key, {
        result: ocrResult,
        timestamp: Date.now(),
      });
    }
    async get(imageData) {
      const key = await this.generateKey(imageData);
      const data = this.cache.get(key);
      if (!data) return null;
      if (Date.now() - data.timestamp > this.expirationTime) {
        this.cache.delete(key);
        const index = this.accessOrder.indexOf(key);
        this.accessOrder.splice(index, 1);
        return null;
      }
      const index = this.accessOrder.indexOf(key);
      this.accessOrder.splice(index, 1);
      this.accessOrder.push(key);
      return data.result;
    }
    clear() {
      this.cache.clear();
      this.accessOrder = [];
    }
  }
  class MediaCache {
    constructor() {
      this.maxSize = CONFIG.CACHE.media.maxSize;
      this.expirationTime = CONFIG.CACHE.media.expirationTime;
      this.cache = new Map();
      this.accessOrder = [];
    }
    async generateKey(fileData) {
      const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(fileData),
      );
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    async set(fileData, translation) {
      const key = await this.generateKey(fileData);
      if (this.cache.has(key)) {
        const index = this.accessOrder.indexOf(key);
        this.accessOrder.splice(index, 1);
        this.accessOrder.push(key);
      } else {
        if (this.cache.size >= this.maxSize) {
          const oldestKey = this.accessOrder.shift();
          this.cache.delete(oldestKey);
        }
        this.accessOrder.push(key);
      }
      this.cache.set(key, {
        translation,
        timestamp: Date.now(),
      });
    }
    async get(fileData) {
      const key = await this.generateKey(fileData);
      const data = this.cache.get(key);
      if (!data) return null;
      if (Date.now() - data.timestamp > this.expirationTime) {
        this.cache.delete(key);
        const index = this.accessOrder.indexOf(key);
        this.accessOrder.splice(index, 1);
        return null;
      }
      const index = this.accessOrder.indexOf(key);
      this.accessOrder.splice(index, 1);
      this.accessOrder.push(key);
      return data.translation;
    }
    clear() {
      this.cache.clear();
      this.accessOrder = [];
    }
  }
  class TranslationCache {
    constructor(maxSize, expirationTime) {
      this.maxSize = maxSize;
      this.expirationTime = expirationTime;
      this.cache = new Map();
      this.accessOrder = [];
    }
    generateKey(text, isAdvanced) {
      return `${text}_${isAdvanced}`;
    }
    set(text, translation, isAdvanced) {
      const key = this.generateKey(text, isAdvanced);
      if (this.cache.has(key)) {
        const index = this.accessOrder.indexOf(key);
        this.accessOrder.splice(index, 1);
        this.accessOrder.push(key);
      } else {
        if (this.cache.size >= this.maxSize) {
          const oldestKey = this.accessOrder.shift();
          this.cache.delete(oldestKey);
        }
        this.accessOrder.push(key);
      }
      this.cache.set(key, {
        translation,
        timestamp: Date.now(),
      });
    }
    get(text, isAdvanced) {
      const key = this.generateKey(text, isAdvanced);
      const data = this.cache.get(key);
      if (!data) return null;
      if (Date.now() - data.timestamp > this.expirationTime) {
        this.cache.delete(key);
        const index = this.accessOrder.indexOf(key);
        this.accessOrder.splice(index, 1);
        return null;
      }
      const index = this.accessOrder.indexOf(key);
      this.accessOrder.splice(index, 1);
      this.accessOrder.push(key);
      return data.translation;
    }
    clear() {
      this.cache.clear();
      this.accessOrder = [];
    }
    optimizeStorage() {
      if (this.cache.size > this.maxSize * 0.9) {
        const itemsToKeep = Math.floor(this.maxSize * 0.7);
        const sortedItems = [...this.accessOrder].slice(-itemsToKeep);

        const tempCache = new Map();
        sortedItems.forEach((key) => {
          if (this.cache.has(key)) {
            tempCache.set(key, this.cache.get(key));
          }
        });

        this.cache = tempCache;
        this.accessOrder = sortedItems;
      }
    }

    async initDB() {
      if (!window.indexedDB) {
        console.warn("IndexedDB not supported");
        return;
      }

      return new Promise((resolve, reject) => {
        const request = indexedDB.open("translatorCache", 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains("translations")) {
            db.createObjectStore("translations", { keyPath: "id" });
          }
        };
      });
    }

    async saveToIndexedDB(key, value) {
      const db = await this.initDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(["translations"], "readwrite");
        const store = transaction.objectStore("translations");
        const request = store.put({ id: key, value, timestamp: Date.now() });

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }

    async loadFromIndexedDB(key) {
      const db = await this.initDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(["translations"], "readonly");
        const store = transaction.objectStore("translations");
        const request = store.get(key);

        request.onsuccess = () => resolve(request.result?.value);
        request.onerror = () => reject(request.error);
      });
    }
  }
  class APIKeyManager {
    constructor(settings) {
      this.settings = settings;
      this.failedKeys = new Map();
      this.activeKeys = new Map();
      this.keyRotationInterval = 60000; // 1 phút
      this.maxConcurrentRequests = 3; // Số request đồng thời tối đa cho mỗi key
      this.setupKeyRotation();
    }
    markKeyAsFailed(key) {
      if (!key) return;
      this.failedKeys.set(key, {
        timestamp: Date.now(),
        failures: (this.failedKeys.get(key)?.failures || 0) + 1,
      });
      if (this.activeKeys.has(key)) {
        this.activeKeys.delete(key);
      }
    }
    getAvailableKeys(provider) {
      const allKeys = this.settings.apiKey[provider];
      if (!allKeys || allKeys.length === 0) {
        throw new Error("Không có API key nào được cấu hình");
      }
      return allKeys.filter((key) => {
        if (!key) return false;
        const failedInfo = this.failedKeys.get(key);
        const activeInfo = this.activeKeys.get(key);
        const isFailed =
          failedInfo && Date.now() - failedInfo.timestamp < 60000;
        const isBusy =
          activeInfo && activeInfo.requests >= this.maxConcurrentRequests;
        return !isFailed && !isBusy;
      });
    }
    getRandomKey(provider) {
      const availableKeys = this.getAvailableKeys(provider);
      if (availableKeys.length === 0) {
        throw new Error("Không có API key khả dụng");
      }
      return availableKeys[Math.floor(Math.random() * availableKeys.length)];
    }
    async useKey(key, action) {
      let activeInfo = this.activeKeys.get(key) || { requests: 0 };
      activeInfo.requests++;
      this.activeKeys.set(key, activeInfo);
      try {
        const result = await action();
        return result;
      } catch (error) {
        if (
          error.message.includes("API key not valid") ||
          error.message.includes("rate limit") ||
          error.status === 400 ||
          error.status === 429
        ) {
          this.markKeyAsFailed(key);
        }
        throw error;
      } finally {
        activeInfo = this.activeKeys.get(key);
        if (activeInfo) {
          activeInfo.requests--;
          if (activeInfo.requests <= 0) {
            this.activeKeys.delete(key);
          } else {
            this.activeKeys.set(key, activeInfo);
          }
        }
      }
    }
    async executeWithMultipleKeys(
      promiseGenerator,
      provider,
      maxConcurrent = 3,
    ) {
      const availableKeys = this.getAvailableKeys(provider);
      if (!availableKeys || availableKeys.length === 0) {
        throw new Error("Không có API key khả dụng");
      }

      const errors = [];
      const promises = [];
      let currentKeyIndex = 0;

      const processNext = async () => {
        if (currentKeyIndex >= availableKeys.length) return null;
        const key = availableKeys[currentKeyIndex++];

        try {
          const result = await this.useKey(key, () => promiseGenerator(key));
          if (result) return result;
        } catch (error) {
          errors.push({ key, error });
          if (
            error.message.includes("API key not valid") ||
            error.message.includes("rate limit")
          ) {
            this.markKeyAsFailed(key);
          }
          return processNext();
        }
      };

      // Chạy nhiều promises song song
      for (let i = 0; i < Math.min(maxConcurrent, availableKeys.length); i++) {
        promises.push(processNext());
      }

      const results = await Promise.allSettled(promises);
      const successResults = results
        .filter((r) => r.status === "fulfilled" && r.value)
        .map((r) => r.value);

      if (successResults.length > 0) {
        return successResults;
      }

      throw new Error(
        `Tất cả API key đều thất bại: ${errors.map((e) => e.error.message).join(", ")}`,
      );
    }
    markKeyAsFailed(key) {
      this.failedKeys.set(key, {
        timestamp: Date.now(),
        failures: (this.failedKeys.get(key)?.failures || 0) + 1,
      });
    }
    setupKeyRotation() {
      setInterval(() => {
        const now = Date.now();
        for (const [key, info] of this.failedKeys.entries()) {
          if (now - info.timestamp >= 60000) {
            this.failedKeys.delete(key);
          }
        }
      }, this.keyRotationInterval);
    }
  }
  class APIManager {
    constructor(config, getSettings) {
      this.config = config;
      this.getSettings = getSettings;
      this.keyManager = new APIKeyManager(getSettings());
      this.currentProvider = getSettings().apiProvider;
      this.networkOptimizer = new NetworkOptimizer();
    }
    async request(prompt) {
      const provider = this.config.providers[this.currentProvider];
      if (!provider) {
        throw new Error(`Provider ${this.currentProvider} not found`);
      }
      let attempts = 0;
      let lastError;
      while (attempts < this.config.maxRetries) {
        try {
          const key = await this.keyManager.getRandomKey(this.currentProvider);
          const response = await this.keyManager.useKey(key, () =>
            this.makeRequest(provider, prompt, key),
          );
          return provider.responseParser(response);
        } catch (error) {
          console.error(`Attempt ${attempts + 1} failed:`, error);
          lastError = error;
          attempts++;
          if (error.message.includes("rate limit")) {
            continue;
          }
          await new Promise((resolve) =>
            setTimeout(resolve, this.config.retryDelay * Math.pow(2, attempts)),
          );
        }
      }
      throw (
        lastError || new Error("Failed to get translation after all retries")
      );
    }
    async batchRequest(prompts) {
      return this.keyManager.executeWithMultipleKeys(async (key) => {
        const results = [];
        for (const prompt of prompts) {
          const response = await this.makeRequest(
            this.config.providers[this.currentProvider],
            prompt,
            key,
          );
          results.push(response);
        }
        return results;
      }, this.currentProvider);
    }
    async makeRequest(provider, prompt, key) {
      const selectedModel = this.getGeminiModel();
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: "POST",
          url: `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${key}`,
          headers: { "Content-Type": "application/json" },
          data: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: this.getSettings().mediaOptions.temperature,
              topP: this.getSettings().mediaOptions.topP,
              topK: this.getSettings().mediaOptions.topK,
            },
          }),
          onload: (response) => {
            if (response.status === 200) {
              try {
                const result = JSON.parse(response.responseText);
                if (result?.candidates?.[0]?.content?.parts?.[0]?.text) {
                  resolve(result.candidates[0].content.parts[0].text);
                } else {
                  reject(new Error("Invalid response format"));
                }
              } catch (error) {
                reject(new Error("Failed to parse response"));
              }
            } else {
              if (response.status === 400) {
                reject(new Error("API key not valid"));
              } else if (response.status === 429) {
                reject(new Error("API key rate limit exceeded"));
              } else {
                reject(new Error(`API Error: ${response.status}`));
              }
            }
          },
          onerror: (error) => reject(error),
        });
      });
    }
    getGeminiModel() {
      const settings = this.getSettings();
      return settings.selectedModel || "gemini-2.0-flash-exp";
    }
    markKeyAsFailed(key) {
      if (this.keyManager) {
        this.keyManager.markKeyAsFailed(key);
      }
    }
  }
  class UIManager {
    constructor(translator) {
      if (!translator) {
        throw new Error("Translator instance is required");
      }
      // Khởi tạo các thuộc tính cơ bản trước
      this.translator = translator;
      this.isTranslating = false;
      this.translatingStatus = null;
      this.ignoreNextSelectionChange = false;
      this.touchCount = 0;
      this.currentTranslateButton = null;
      // Khởi tạo các managers
      this.mobileOptimizer = new MobileOptimizer(this);
      this.ss = new UserSettings(translator);
      this.ocr = new OCRManager(translator);
      this.media = new MediaManager(translator);
      this.page = new PageTranslator(translator);
      // Khởi tạo trạng thái tools
      const settings = this.translator.userSettings.settings;
      const toolsEnabled = settings.translatorToolsEnabled?.enabled;
      if (localStorage.getItem("translatorToolsEnabled") === null) {
        localStorage.setItem("translatorToolsEnabled", toolsEnabled.toString());
      }
      // Bind các methods
      this.handleSettingsShortcut = this.handleSettingsShortcut.bind(this);
      this.handleTranslationShortcuts =
        this.handleTranslationShortcuts.bind(this);
      this.handleTranslateButtonClick =
        this.handleTranslateButtonClick.bind(this);
      this.setupClickHandlers = this.setupClickHandlers.bind(this);
      this.handleTextSelection = this.handleTextSelection.bind(this);
      this.showTranslatingStatus = this.showTranslatingStatus.bind(this);
      this.removeTranslatingStatus = this.removeTranslatingStatus.bind(this);
      this.resetState = this.resetState.bind(this);
      GM_addStyle(`
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    .processing-spinner {
        width: 30px;
        height: 30px;
        border: 3px solid rgba(255,255,255,0.3);
        border-radius: 50%;
        border-top-color: white;
        animation: spin 1s ease-in-out infinite;
        margin: 0 auto 10px auto;
    }
    .processing-message {
        margin-bottom: 10px;
        font-size: 14px;
    }
    .processing-progress {
        font-size: 12px;
        opacity: 0.8;
    }
`);
      // Gán các listeners
      this.settingsShortcutListener = this.handleSettingsShortcut;
      this.translationShortcutListener = this.handleTranslationShortcuts;
      this.mouseupButtonListener = this.handleTextSelection;
      this.selectionButtonListener = this.handleTextSelection;
      // Khởi tạo các trạng thái UI
      this.translationButtonEnabled = true;
      this.translationTapEnabled = true;
      this.mediaElement = null;
      this.container = null;
      // Setup event listeners sau khi mọi thứ đã được khởi tạo
      this.setupEventListeners();
      // Setup page translation
      if (document.readyState === "complete") {
        if (
          this.translator.userSettings.settings.pageTranslation.autoTranslate
        ) {
          this.page.checkAndTranslate();
        }
        if (
          this.translator.userSettings.settings.pageTranslation
            .showInitialButton
        ) {
          this.setupQuickTranslateButton();
        }
      } else {
        window.addEventListener("load", () => {
          if (
            this.translator.userSettings.settings.pageTranslation.autoTranslate
          ) {
            this.page.checkAndTranslate();
          }
          if (
            this.translator.userSettings.settings.pageTranslation
              .showInitialButton
          ) {
            this.setupQuickTranslateButton();
          }
        });
      }
    }
    createTranslationDiv(translatedText, originalText) {
      const div = document.createElement("div");
      div.classList.add("translation-div");
      const displayOptions =
        this.translator.userSettings.settings.displayOptions;
      Object.assign(div.style, {
        ...CONFIG.STYLES.translation,
        fontSize: displayOptions.fontSize,
      });
      if (displayOptions.showOriginalText && originalText) {
        div.innerHTML = `
        <div style="margin-bottom: 8px; color: #666;">Gốc: ${originalText}</div>
        <div>${translatedText}</div>
      `;
      } else {
        div.textContent = `${translatedText}`;
      }
      return div;
    }
    createCloseButton() {
      const button = document.createElement("span");
      button.textContent = "x";
      Object.assign(button.style, {
        position: "absolute",
        top: "0px" /* Đẩy lên trên một chút */,
        right: "0px" /* Đẩy sang phải một chút */,
        cursor: "pointer",
        color: "black",
        fontSize: "14px",
        fontWeight: "bold",
        padding: "4px 8px" /* Tăng kích thước */,
        lineHeight: "14px",
      });
      button.onclick = () => button.parentElement.remove();
      return button;
    }
    showTranslationBelow(targetElement, translatedText) {
      const selection = window.getSelection();
      const lastSelectedNode = selection.focusNode;
      let lastSelectedParagraph = lastSelectedNode.parentElement;
      while (lastSelectedParagraph && lastSelectedParagraph.tagName !== "P") {
        lastSelectedParagraph = lastSelectedParagraph.parentElement;
      }
      if (!lastSelectedParagraph) {
        lastSelectedParagraph = targetElement;
      }
      if (
        lastSelectedParagraph.nextElementSibling?.classList.contains(
          "translation-div",
        )
      ) {
        return;
      }
      const translationDiv = this.createTranslationDiv(translatedText);
      translationDiv.appendChild(this.createCloseButton());
      lastSelectedParagraph.parentNode.appendChild(translationDiv);
      translationDiv.style.cssText = `
        display: block; /* Giữ cho phần dịch không bị kéo dài hết chiều ngang */
        max-width: fit-content;; /* Giới hạn chiều rộng */
        width: auto; /* Để nó co giãn theo nội dung */
        min-width: 150px;
        background: rgba(242, 240, 235, 0.6);
        color: black;
        padding: 8px 20px 8px 8px; /* Tăng padding bên phải để tránh nút x đè lên chữ */
        border-radius: 8px;
        font-size: 16px;
        margin-top: 5px;
        position: relative;
        z-index: 2147483646;
        border: 1px solid rgba(242, 240, 235, 0.2);
        white-space: normal; /* Cho phép xuống dòng nếu quá dài */
        overflow-wrap: break-word; /* Ngắt từ nếu quá dài */
      `;
    }
    displayPopup(translatedText, originalText, title = "Bản dịch") {
      this.removeTranslateButton();
      const theme = CONFIG.THEME[CONFIG.THEME.mode];
      const displayOptions =
        this.translator.userSettings.settings.displayOptions;
      const popup = document.createElement("div");
      popup.classList.add("draggable");
      const dragHandleBackground =
        theme.mode === "dark" ? "#1a1a1a" : "#2c3e50";
      const popupStyle = {
        ...CONFIG.STYLES.popup,
        backgroundColor: theme.background,
        borderColor: theme.border,
        color: theme.text,
        minWidth: displayOptions.minPopupWidth,
        maxWidth: displayOptions.maxPopupWidth,
        fontSize: displayOptions.fontSize,
        padding: "0",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      };
      Object.assign(popup.style, popupStyle);
      const dragHandle = document.createElement("div");
      Object.assign(dragHandle.style, {
        ...CONFIG.STYLES.dragHandle,
        backgroundColor: dragHandleBackground,
        borderColor: "transparent",
        color: "#ffffff",
        padding: "12px 15px",
        borderTopLeftRadius: "15px",
        borderTopRightRadius: "15px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
      });
      const titleSpan = document.createElement("span");
      titleSpan.textContent = title;
      Object.assign(titleSpan.style, {
        fontWeight: "bold",
        color: "#ffffff",
        fontSize: "15px",
      });
      const closeButton = document.createElement("span");
      closeButton.innerHTML = "×";
      Object.assign(closeButton.style, {
        cursor: "pointer",
        fontSize: "22px",
        color: "#ffffff",
        padding: "0 10px",
        opacity: "0.8",
        transition: "all 0.2s ease",
        fontWeight: "bold",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "30px",
        height: "30px",
        borderRadius: "50%",
      });
      closeButton.onmouseover = () => {
        Object.assign(closeButton.style, {
          opacity: "1",
          backgroundColor: "#ff4444",
        });
      };
      closeButton.onmouseout = () => {
        Object.assign(closeButton.style, {
          opacity: "0.8",
          backgroundColor: "transparent",
        });
      };
      closeButton.onclick = () => popup.remove();
      dragHandle.appendChild(titleSpan);
      dragHandle.appendChild(closeButton);
      const contentContainer = document.createElement("div");
      Object.assign(contentContainer.style, {
        padding: "15px 20px",
        maxHeight: "70vh",
        overflowY: "auto",
        overflowX: "hidden",
      });
      const scrollbarStyle = document.createElement("style");
      scrollbarStyle.textContent = `
    .translator-content::-webkit-scrollbar {
      width: 8px;
    }
    .translator-content::-webkit-scrollbar-track {
      background: ${theme.background === "#222" ? "#333" : "#f1f1f1"};
      border-radius: 4px;
    }
    .translator-content::-webkit-scrollbar-thumb {
      background: ${theme.background === "#222" ? "#666" : "#888"};
      border-radius: 4px;
    }
    .translator-content::-webkit-scrollbar-thumb:hover {
      background: ${theme.background === "#222" ? "#888" : "#555"};
    }
  `;
      document.head.appendChild(scrollbarStyle);
      contentContainer.classList.add("translator-content");
      const cleanedText = translatedText.replace(/(\*\*)(.*?)\1/g, "<b>$2</b>");
      const textContainer = document.createElement("div");
      Object.assign(textContainer.style, {
        display: "flex",
        flexDirection: "column",
        gap: "15px",
      });
      if (displayOptions.showOriginalText && originalText) {
        const originalContainer = document.createElement("div");
        Object.assign(originalContainer.style, {
          color: theme.content,
          padding: "10px 15px",
          backgroundColor: `${theme.background === "#222" ? "#333" : "#f5f5f5"
            }`,
          borderRadius: "8px",
          border: `1px solid ${theme.border}`,
          wordBreak: "break-word",
        });
        originalContainer.innerHTML = `
      <div style="font-weight: 500; margin-bottom: 5px; color: ${theme.title};">Văn bản gốc:</div>
      <div style="line-height: 1.5;">${originalText}</div>
    `;
        textContainer.appendChild(originalContainer);
      }
      const translationContainer = document.createElement("div");
      Object.assign(translationContainer.style, {
        color: theme.content,
        padding: "10px 15px",
        backgroundColor: `${theme.background === "#222" ? "#333" : "#f5f5f5"}`,
        borderRadius: "8px",
        border: `1px solid ${theme.border}`,
        wordBreak: "break-word",
      });
      translationContainer.innerHTML = `
    <div style="font-weight: 500; margin-bottom: 5px; color: ${theme.title
        };">Bản dịch:</div>
    <div style="line-height: 1.5;">${this.formatTranslation(cleanedText)}</div>
  `;
      textContainer.appendChild(translationContainer);
      contentContainer.appendChild(textContainer);
      popup.appendChild(dragHandle);
      popup.appendChild(contentContainer);
      Object.assign(popup.style, {
        ...popupStyle,
        maxHeight: "85vh",
        display: "flex",
        flexDirection: "column",
      });
      this.makeDraggable(popup, dragHandle);
      document.body.appendChild(popup);
    }
    makeDraggable(element, handle) {
      let pos1 = 0,
        pos2 = 0,
        pos3 = 0,
        pos4 = 0;
      handle.onmousedown = dragMouseDown;
      function dragMouseDown(e) {
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
      }
      function elementDrag(e) {
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        element.style.top = element.offsetTop - pos2 + "px";
        element.style.left = element.offsetLeft - pos1 + "px";
      }
      function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
      }
    }
    formatTranslation(text) {
      return text
        .split("<br>")
        .map((line) => {
          if (line.startsWith("<b>KEYWORD</b>:")) {
            return `<h4 style="margin-bottom: 5px;">${line}</h4>`;
          }
          return `<p style="margin-left: 20px; margin-bottom: 10px; white-space: pre-wrap; word-wrap: break-word; text-align: justify;">${line}</p>`;
        })
        .join("");
    }
    handleTextSelection = debounce(() => {
      if (this.isTranslating) return;
      if (this.ignoreNextSelectionChange || this.isTranslating) {
        this.ignoreNextSelectionChange = false;
        return;
      }
      if (!this.translationButtonEnabled) return;
      const selection = window.getSelection();
      if (!selection) return;
      const selectedText = selection.toString().trim();
      if (!selectedText || !selection.rangeCount) {
        this.removeTranslateButton();
        return;
      }
      if (!this.currentTranslateButton) {
        this.createTranslateButton(selection);
      }
    }, 100);
    createTranslateButton(selection) {
      if (!selection || selection.rangeCount === 0) return;
      if (this.currentTranslateButton) {
        this.currentTranslateButton.remove();
      }
      const theme = CONFIG.THEME[CONFIG.THEME.mode];
      const button = document.createElement("button");
      button.textContent = "Dịch";
      Object.assign(button.style, {
        ...CONFIG.STYLES.button,
        backgroundColor: theme.button.translate.background,
        color: theme.button.translate.text,
      });
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      button.style.top = `${rect.bottom + 20}px`;
      button.style.left = `${rect.left}px`;
      document.body.appendChild(button);
      this.currentTranslateButton = button;
      this.setupClickHandlers(selection);
    }
    handleTranslateButtonClick = async (selection, translateType) => {
      console.log("Starting translation process...");
      try {
        const selectedText = selection.toString().trim();
        console.log("Selected text:", selectedText);
        if (!selectedText) {
          console.log("No text selected");
          return;
        }
        const targetElement = selection.anchorNode?.parentElement;
        if (!targetElement) {
          console.log("No target element found");
          return;
        }
        this.removeTranslateButton();
        console.log("Showing loading animation...");
        this.showTranslatingStatus();
        console.log("Starting translation with type:", translateType);
        if (!this.translator) {
          throw new Error("Translator instance not found");
        }
        switch (translateType) {
          case "quick":
            await this.translator.translate(selectedText, targetElement);
            break;
          case "popup":
            await this.translator.translate(
              selectedText,
              targetElement,
              false,
              true,
            );
            break;
          case "advanced":
            await this.translator.translate(selectedText, targetElement, true);
            break;
          default:
            console.log("Unknown translation type:", translateType);
        }
      } catch (error) {
        console.error("Translation error:", error);
      } finally {
        if (this.isDouble) {
          const newSelection = window.getSelection();
          if (newSelection.toString().trim()) {
            this.resetState();
            this.handleTextSelection(newSelection);
          }
        } else {
          this.resetState();
          return;
        }
      }
    };
    debug(message) {
      console.log(`[UIManager] ${message}`);
    }
    showTranslatingStatus() {
      this.debug("Showing translating status");
      if (!document.getElementById("translator-animation-style")) {
        const style = document.createElement("style");
        style.id = "translator-animation-style";
        style.textContent = `
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .center-translate-status {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 15px 25px;
            border-radius: 8px;
            z-index: 2147483647;
            display: flex;
            align-items: center;
            gap: 12px;
            font-family: Arial, sans-serif;
            font-size: 14px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          }
          .spinner {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top-color: #ddd;
            animation: spin 1s ease-in-out infinite;
          }
        `;
        document.head.appendChild(style);
      }
      this.removeTranslatingStatus();
      const status = document.createElement("div");
      status.className = "center-translate-status";
      status.innerHTML = `
      <div class="spinner"></div>
      <span>Đang dịch...</span>
    `;
      document.body.appendChild(status);
      this.translatingStatus = status;
      this.debug("Translation status shown");
    }
    setupClickHandlers(selection) {
      this.pressTimer = null;
      this.isLongPress = false;
      this.isDown = false;
      this.isDouble = false;
      this.lastTime = 0;
      this.count = 0;
      this.timer = 0;
      const handleStart = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.ignoreNextSelectionChange = true;
        this.isDown = true;
        this.isLongPress = false;
        const currentTime = Date.now();
        if (currentTime - this.lastTime < 400) {
          this.count++;
          clearTimeout(this.pressTimer);
          clearTimeout(this.timer);
        } else {
          this.count = 1;
        }
        this.lastTime = currentTime;
        this.pressTimer = setTimeout(() => {
          if (!this.isDown) return;
          this.isLongPress = true;
          this.count = 0;
          const holdType =
            this.translator.userSettings.settings.clickOptions.hold
              .translateType;
          this.handleTranslateButtonClick(selection, holdType);
        }, 500);
      };
      const handleEnd = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!this.isDown) return;
        clearTimeout(this.pressTimer);
        if (this.isLongPress) return;
        if (this.count === 1) {
          clearTimeout(this.timer);
          this.timer = setTimeout(() => {
            if (this.count !== 1) return;
            const singleClickType =
              this.translator.userSettings.settings.clickOptions.singleClick
                .translateType;
            this.handleTranslateButtonClick(selection, singleClickType);
          }, 400);
        } else if (this.count >= 2) {
          this.isDouble = true;
          const doubleClickType =
            this.translator.userSettings.settings.clickOptions.doubleClick
              .translateType;
          this.handleTranslateButtonClick(selection, doubleClickType);
        }
        this.isDown = false;
      };
      // PC Events
      this.currentTranslateButton.addEventListener("mousedown", handleStart);
      this.currentTranslateButton.addEventListener("mouseup", handleEnd);
      this.currentTranslateButton.addEventListener("mouseleave", () => {
        if (this.translateType) {
          this.resetState();
        }
      });
      // Mobile Events
      this.currentTranslateButton.addEventListener("touchstart", handleStart);
      this.currentTranslateButton.addEventListener("touchend", handleEnd);
      this.currentTranslateButton.addEventListener("touchcancel", () => {
        if (this.translateType) {
          this.resetState();
        }
      });
    }
    setupDocumentTapHandler() {
      let touchCount = 0;
      let touchTimer = null;
      let isProcessingTouch = false;
      const handleTouchStart = async (e) => {
        if (this.isTranslating) return;
        const touchOptions = this.translator.userSettings.settings.touchOptions;
        if (!touchOptions?.enabled) return;
        const target = e.target;
        if (
          target.closest(".translation-div") ||
          target.closest(".draggable")
        ) {
          return;
        }
        if (touchTimer) {
          clearTimeout(touchTimer);
        }
        touchCount = e.touches.length;
        touchTimer = setTimeout(async () => {
          if (isProcessingTouch) return;
          switch (touchCount) {
            case 2:
              const twoFingersType = touchOptions.twoFingers?.translateType;
              if (twoFingersType) {
                const selection = window.getSelection();
                const selectedText = selection?.toString().trim();
                if (selectedText) {
                  e.preventDefault();
                  await this.handleTranslateButtonClick(
                    selection,
                    twoFingersType,
                  );
                }
              }
              break;
            case 3:
              const threeFingersType = touchOptions.threeFingers?.translateType;
              if (threeFingersType) {
                const selection = window.getSelection();
                const selectedText = selection?.toString().trim();
                if (selectedText) {
                  e.preventDefault();
                  await this.handleTranslateButtonClick(
                    selection,
                    threeFingersType,
                  );
                }
              }
              break;
            case 4:
              e.preventDefault();
              const settingsUI =
                this.translator.userSettings.createSettingsUI();
              document.body.appendChild(settingsUI);
              break;
            case 5:
              e.preventDefault();
              isProcessingTouch = true;
              this.toggleTranslatorTools();
              setTimeout(() => {
                isProcessingTouch = false;
              }, 350);
              break;
          }
          touchCount = 0;
          touchTimer = null;
        }, touchOptions.sensitivity || 100);
      };
      const handleTouch = () => {
        if (touchTimer) {
          clearTimeout(touchTimer);
          touchTimer = null;
        }
        touchCount = 0;
      };
      document.addEventListener("touchstart", handleTouchStart.bind(this), {
        passive: false,
      });
      document.addEventListener("touchend", handleTouch.bind(this));
      document.addEventListener("touchcancel", handleTouch.bind(this));
    }
    toggleTranslatorTools() {
      if (this.isTogglingTools) return;

      this.isTogglingTools = true;
      try {
        const currentState = localStorage.getItem("translatorToolsEnabled") === "true";
        const newState = !currentState;
        localStorage.setItem("translatorToolsEnabled", newState.toString());
        const settings = this.translator.userSettings.settings;
        settings.translatorToolsEnabled.enabled = newState;
        this.translator.userSettings.saveSettings();
        this.removeToolsListeners();
        this.removeToolsContainer();
        this.removeAllProcessingIndicators();
        this.resetState();
        const overlays = document.querySelectorAll(".translator-overlay");
        overlays.forEach((overlay) => overlay.remove());
        if (newState) {
          this.setupTranslatorTools();
        }
        this.showNotification(
          newState ? "Đã bật Translator Tools" : "Đã tắt Translator Tools"
        );
      } finally {
        setTimeout(() => {
          this.isTogglingTools = false;
        }, 350);
      }
    }
    removeToolsListeners() {
      document.removeEventListener("mouseover", this.handleImageHover);
      document.removeEventListener("mouseout", this.handleImageLeave);
      document.removeEventListener("click", this.handleImageClick);
      document.removeEventListener("click", this.handleClickOutside);
      if (this.webMediaListeners) {
        Object.values(this.webMediaListeners).forEach((listener) => {
          if (typeof listener === "function") {
            document.removeEventListener("click", listener);
            document.removeEventListener("mouseover", listener);
            document.removeEventListener("mouseout", listener);
          }
        });
        this.webMediaListeners = null;
      }
    }
    removeToolsContainer() {
      const container = document.querySelector(".translator-tools-container");
      if (container) {
        const ocrInput = container.querySelector("#translator-ocr-input");
        const mediaInput = container.querySelector("#translator-media-input");
        if (ocrInput)
          ocrInput.removeEventListener("change", this.handleOCRInput);
        if (mediaInput)
          mediaInput.removeEventListener("change", this.handleMediaInput);
        const mainButton = container.querySelector(".translator-tools-button");
        if (mainButton) {
          mainButton.removeEventListener("click", this.handleButtonClick);
        }
        const menuItems = container.querySelectorAll(".translator-tools-item");
        menuItems.forEach((item) => {
          if (item.handler) {
            item.removeEventListener("click", item.handler);
          }
        });
        container.remove();
      }
    }
    async handlePageTranslation() {
      if (!this.translator.userSettings.settings.pageTranslation.enabled) {
        this.showNotification("Tính năng dịch trang đang bị tắt", "warning");
        return;
      }
      try {
        this.showTranslatingStatus();
        const result = await this.page.translatePage();
        if (result.success) {
          const toolsContainer = document.querySelector(
            ".translator-tools-container",
          );
          if (toolsContainer) {
            const menuItem = toolsContainer.querySelector(
              '[data-type="pageTranslate"]',
            );
            if (menuItem) {
              const itemText = menuItem.querySelector(".item-text");
              if (itemText) {
                itemText.textContent = this.page.isTranslated
                  ? "Văn bản gốc"
                  : "Dịch trang";
              }
            }
          }
          const floatingButton = document.querySelector(
            ".page-translate-button",
          );
          if (floatingButton) {
            floatingButton.innerHTML = this.page.isTranslated
              ? "📄 Văn bản gốc"
              : "📄 Dịch trang";
          }
          this.showNotification(result.message, "success");
        } else {
          this.showNotification(result.message, "warning");
        }
      } catch (error) {
        this.showNotification(error.message, "error");
      } finally {
        this.removeTranslatingStatus();
      }
    }
    setupQuickTranslateButton() {
      if (!this.translator.userSettings.settings.pageTranslation.enabled) {
        return;
      }
      const style = document.createElement("style");
      style.textContent = `
    .page-translate-button {
        position: fixed;
        bottom: 20px;
        left: 20px;
        z-index: 2147483646;
        padding: 8px 16px;
        background-color: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        transition: all 0.3s ease;
    }
    .page-translate-button:hover {
        background-color: #45a049;
        transform: translateY(-2px);
    }
  `;
      document.head.appendChild(style);
      const button = document.createElement("button");
      button.className = "page-translate-button";
      button.innerHTML = this.page.isTranslated
        ? "📄 Văn bản gốc"
        : "📄 Dịch trang";
      button.onclick = async () => {
        try {
          this.showTranslatingStatus();
          const result = await this.page.translatePage();
          if (result.success) {
            this.showNotification(result.message, "success");
            const toolsContainer = document.querySelector(
              ".translator-tools-container",
            );
            if (toolsContainer) {
              const menuItem = toolsContainer.querySelector(
                '.translator-tools-item[data-type="pageTranslate"]',
              );
              if (menuItem) {
                menuItem.querySelector(".item-text").textContent = this.page
                  .isTranslated
                  ? "Văn bản gốc"
                  : "Dịch trang";
              }
            }
          } else {
            this.showNotification(result.message, "warning");
          }
        } catch (error) {
          this.showNotification(error.message, "error");
        } finally {
          this.removeTranslatingStatus();
        }
      };
      document.body.appendChild(button);
      setTimeout(() => {
        if (button && button.parentNode) {
          button.parentNode.removeChild(button);
        }
        if (style && style.parentNode) {
          style.parentNode.removeChild(style);
        }
      }, 10000);
      const pageShortcut =
        this.translator.userSettings.settings.shortcuts.pageTranslate;
      document.addEventListener("keydown", (e) => {
        if (
          (e.altKey || e.metaKey) &&
          e.key.toLowerCase() === pageShortcut.key.toLowerCase()
        ) {
          e.preventDefault();
          this.handlePageTranslation();
        }
      });
    }
    setupTranslatorTools() {
      const isEnabled =
        localStorage.getItem("translatorToolsEnabled") === "true";
      this.removeToolsListeners();
      this.removeToolsContainer();
      if (!isEnabled) return;
      if (document.querySelector(".translator-tools-container")) {
        return;
      }
      const container = document.createElement("div");
      container.className = "translator-tools-container";
      this.handleOCRInput = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          this.showTranslatingStatus();
          const result = await this.ocr.processImage(file);
          this.displayPopup(result, null, "OCR Result");
        } catch (error) {
          this.showNotification(error.message);
        } finally {
          e.target.value = "";
          this.removeTranslatingStatus();
        }
      };
      this.handleMediaInput = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          this.showTranslatingStatus();
          await this.media.processMediaFile(file);
        } catch (error) {
          this.showNotification(error.message);
        } finally {
          e.target.value = "";
          this.removeTranslatingStatus();
        }
      };
      const ocrInput = document.createElement("input");
      ocrInput.type = "file";
      ocrInput.accept = "image/*";
      ocrInput.style.display = "none";
      ocrInput.id = "translator-ocr-input";
      ocrInput.addEventListener("change", this.handleOCRInput);
      const mediaInput = document.createElement("input");
      mediaInput.type = "file";
      mediaInput.accept = "audio/*, video/*";
      mediaInput.style.display = "none";
      mediaInput.id = "translator-media-input";
      mediaInput.addEventListener("change", this.handleMediaInput);
      const mainButton = document.createElement("button");
      mainButton.className = "translator-tools-button";
      mainButton.innerHTML = `
        <span class="tools-icon">🌐</span>
        <span class="tools-text">Tools Dịch</span>
    `;
      const dropdown = document.createElement("div");
      dropdown.className = "translator-tools-dropdown";
      const menuItems = [];
      const settings = this.translator.userSettings.settings;
      if (settings.pageTranslation?.enabled) {
        menuItems.push({
          icon: "📄",
          text: this.page.isTranslated ? "Văn bản gốc" : "Dịch trang",
          "data-type": "pageTranslate",
          handler: async () => {
            try {
              dropdown.style.display = "none";
              this.showTranslatingStatus();
              const result = await this.page.translatePage();
              if (result.success) {
                const menuItem = dropdown.querySelector(
                  '[data-type="pageTranslate"]',
                );
                if (menuItem) {
                  const itemText = menuItem.querySelector(".item-text");
                  if (itemText) {
                    itemText.textContent = this.page.isTranslated
                      ? "Văn bản gốc"
                      : "Dịch trang";
                  }
                }
                this.showNotification(result.message, "success");
              } else {
                this.showNotification(result.message, "warning");
              }
            } catch (error) {
              console.error("Page translation error:", error);
              this.showNotification(error.message, "error");
            } finally {
              this.removeTranslatingStatus();
            }
          },
        });
      }
      if (settings.ocrOptions?.enabled) {
        menuItems.push(
          {
            icon: "📷",
            text: "Dịch Ảnh",
            handler: () => ocrInput.click(),
          },
          {
            icon: "📸",
            text: "Dịch Màn hình",
            handler: async () => {
              try {
                dropdown.style.display = "none";
                await new Promise((resolve) => setTimeout(resolve, 100));
                console.log("Starting screen translation...");
                this.showTranslatingStatus();
                const screenshot = await this.ocr.captureScreen();
                if (!screenshot) {
                  throw new Error("Không thể tạo ảnh chụp màn hình");
                }
                const result = await this.ocr.processImage(screenshot);
                if (!result) {
                  throw new Error("Không thể xử lý ảnh chụp màn hình");
                }
                this.displayPopup(result, null, "OCR Màn hình");
              } catch (error) {
                console.error("Screen translation error:", error);
                this.showNotification(error.message, "error");
              } finally {
                this.removeTranslatingStatus();
              }
            },
          },
          {
            icon: "🖼️",
            text: "Dịch Ảnh Web",
            handler: () => {
              dropdown.style.display = "none";
              this.startWebImageOCR();
            },
          },
        );
      }
      if (settings.mediaOptions?.enabled) {
        menuItems.push({
          icon: "🎵",
          text: "Dịch Media",
          handler: () => mediaInput.click(),
        });
      }
      menuItems.push({
        icon: "📄",
        text: "Dịch File HTML",
        handler: () => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = ".html,.htm";
          input.style.display = "none";

          input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
              this.showTranslatingStatus();
              const content = await this.readFileContent(file);
              const translatedHTML = await this.page.translateHTML(content);

              // Tạo và tải file đã dịch
              const blob = new Blob([translatedHTML], { type: "text/html" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `translated_${file.name}`;
              a.click();
              URL.revokeObjectURL(url);

              this.showNotification("Dịch file HTML thành công", "success");
            } catch (error) {
              console.error("Lỗi dịch file HTML:", error);
              this.showNotification(error.message, "error");
            } finally {
              this.removeTranslatingStatus();
              input.value = "";
            }
          };

          input.click();
        },
      });
      menuItems.push({
        icon: "📑",
        text: "Dịch File PDF",
        handler: () => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = ".pdf";
          input.style.display = "none";

          input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
              this.showLoadingStatus("Đang xử lý PDF...");
              const translatedBlob = await this.page.translatePDF(file);

              // Tải file đã dịch
              const url = URL.createObjectURL(translatedBlob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `translated_${file.name.replace(".pdf", ".html")}`;
              a.click();
              URL.revokeObjectURL(url);

              this.showNotification("Dịch PDF thành công", "success");
            } catch (error) {
              console.error("Lỗi dịch PDF:", error);
              this.showNotification(error.message, "error");
            } finally {
              this.removeLoadingStatus();
              input.value = "";
            }
          };

          input.click();
        },
      });
      menuItems.forEach((item) => {
        const menuItem = document.createElement("div");
        menuItem.className = "translator-tools-item";
        if (item["data-type"]) {
          menuItem.setAttribute("data-type", item["data-type"]);
        }
        menuItem.innerHTML = `
    <span class="item-icon">${item.icon}</span>
    <span class="item-text">${item.text}</span>
  `;
        menuItem.handler = item.handler;
        menuItem.addEventListener("click", item.handler);
        dropdown.appendChild(menuItem);
      });
      this.handleButtonClick = (e) => {
        e.stopPropagation();
        dropdown.style.display =
          dropdown.style.display === "none" ? "block" : "none";
      };
      mainButton.addEventListener("click", this.handleButtonClick);
      this.handleClickOutside = () => {
        dropdown.style.display = "none";
      };
      document.addEventListener("click", this.handleClickOutside);
      container.appendChild(mainButton);
      container.appendChild(dropdown);
      container.appendChild(ocrInput);
      container.appendChild(mediaInput);
      document.body.appendChild(container);
      GM_addStyle(`
  .translator-tools-container {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 2147483646;
    font-family: Arial, sans-serif;
  }
  .translator-tools-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    border: none;
    border-radius: 10px;
    background: #4a90e2;
    color: white;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    font-size: 15px;
  }
  .translator-tools-button:hover {
    transform: translateY(-2px);
    background: #357abd;
  }
  .translator-tools-button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  .translator-tools-dropdown {
    display: none;
    position: absolute;
    bottom: 100%;
    right: 0;
    margin-bottom: 10px;
    background: white;
    border-radius: 10px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    padding: 5px;
    min-width: 200px;
  }
  .translator-tools-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 15px;
    cursor: pointer;
    transition: all 0.2s ease;
    border-radius: 8px;
    color: #333;
  }
  .translator-tools-item:hover {
    background: #f5f5f5;
  }
  .item-icon {
    font-size: 18px;
  }
  .item-text {
    font-size: 14px;
  }
  .translator-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.3);
    z-index: 2147483645;
    cursor: crosshair;
  }
  .translator-guide {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.8);
    color: white;
    padding: 10px 20px;
    border-radius: 5px;
    font-size: 14px;
    z-index: 2147483646;
  }
  .translator-cancel {
    position: fixed;
    top: 20px;
    right: 20px;
    background: #ff4444;
    color: white;
    border: none;
    border-radius: 50%;
    width: 30px;
    height: 30px;
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2147483646;
    transition: all 0.3s ease;
  }
  .translator-cancel:hover {
    background: #ff0000;
    transform: scale(1.1);
  }
  .translator-processing-indicator {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.8);
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 14px;
    z-index: 2147483646;
  }
  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    .translator-tools-dropdown {
      background: #333;
    }
    .translator-tools-item {
      color: #fff;
    }
    .translator-tools-item:hover {
      background: #444;
    }
    .translator-guide {
      background: rgba(0,0,0,0.9);
    }
  }
  /* Animation */
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .translator-tools-container {
    animation: fadeIn 0.3s ease;
  }
  .translator-tools-dropdown {
    animation: fadeIn 0.2s ease;
  }
  .translator-tools-container.hidden,
  .translator-notification.hidden,
  .center-translate-status.hidden {
    visibility: hidden !important;
  }
  .translator-media-highlight {
    outline: 3px solid #4a90e2 !important;
    cursor: pointer !important;
  }
  .translator-media-processing {
    position: relative;
  }
  .translator-media-processing::after {
    content: 'Đang xử lý...';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0,0,0,0.8);
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 14px;
  }
`);
    }
    showProcessingStatus(message) {
      this.removeProcessingStatus();
      const status = document.createElement("div");
      status.className = "processing-status";
      status.innerHTML = `
            <div class="processing-spinner"></div>
            <div class="processing-message">${message}</div>
            <div class="processing-progress">0%</div>
        `;
      Object.assign(status.style, {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        background: "rgba(0, 0, 0, 0.8)",
        color: "white",
        padding: "20px",
        borderRadius: "10px",
        zIndex: "2147483647",
        textAlign: "center",
        minWidth: "200px",
      });
      document.body.appendChild(status);
      this.processingStatus = status;
    }

    updateProcessingStatus(message, progress) {
      if (this.processingStatus) {
        const messageEl = this.processingStatus.querySelector(
          ".processing-message",
        );
        const progressEl = this.processingStatus.querySelector(
          ".processing-progress",
        );
        if (messageEl) messageEl.textContent = message;
        if (progressEl) progressEl.textContent = `${progress}%`;
      }
    }

    removeProcessingStatus() {
      if (this.processingStatus) {
        this.processingStatus.remove();
        this.processingStatus = null;
      }
    }
    readFileContent(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error("Không thể đọc file"));
        reader.readAsText(file);
      });
    }

    showLoadingStatus(message) {
      // Tạo loading indicator
      const loading = document.createElement("div");
      loading.id = "pdf-loading-status";
      loading.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 20px;
            border-radius: 10px;
            z-index: 9999;
        `;
      loading.innerHTML = `
            <div style="text-align: center;">
                <div class="spinner"></div>
                <div>${message}</div>
            </div>
        `;
      document.body.appendChild(loading);
    }

    removeLoadingStatus() {
      const loading = document.getElementById("pdf-loading-status");
      if (loading) loading.remove();
    }

    updateProgress(message, percent) {
      const loading = document.getElementById("pdf-loading-status");
      if (loading) {
        loading.innerHTML = `
                <div style="text-align: center;">
                    <div class="spinner"></div>
                    <div>${message}</div>
                    <div>${percent}%</div>
                </div>
            `;
      }
    }
    getTranslatableNodes(element) {
      const excludeSelectors = [
        "script",
        "style",
        "noscript",
        "iframe",
        ".translator-tools-container",
        ".translator-notification",
        ".center-translate-status",
        ".page-translate-button",
      ];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
        acceptNode: function(node) {
          if (
            excludeSelectors.some((selector) =>
              node.parentElement?.matches?.(selector),
            )
          ) {
            return NodeFilter.FILTER_REJECT;
          }
          return node.textContent.trim()
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        },
      });
      const nodes = [];
      let node;
      while ((node = walker.nextNode())) {
        nodes.push(node);
      }
      return nodes;
    }
    groupTextNodes(nodes, maxChunkSize = 1000) {
      const chunks = [];
      let currentChunk = { nodes: [], size: 0 };
      for (let node of nodes) {
        const textLength = node.textContent.length;
        if (currentChunk.size + textLength > maxChunkSize) {
          if (currentChunk.nodes.length > 0) {
            chunks.push(currentChunk);
          }
          currentChunk = { nodes: [node], size: textLength };
        } else {
          currentChunk.nodes.push(node);
          currentChunk.size += textLength;
        }
      }
      if (currentChunk.nodes.length > 0) {
        chunks.push(currentChunk);
      }
      return chunks;
    }
    handleImageHover = (e) => {
      if (e.target.tagName === "IMG") {
        e.target.style.outline = "3px solid #4a90e2";
      }
    };
    handleImageLeave = (e) => {
      if (e.target.tagName === "IMG") {
        e.target.style.outline = "";
      }
    };
    handleImageClick = async (e) => {
      if (e.target.tagName === "IMG") {
        try {
          this.showTranslatingStatus();
          const img = e.target;
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          const blob = await new Promise((resolve) => {
            canvas.toBlob(resolve, "image/png");
          });
          const file = new File([blob], "web-image.png", { type: "image/png" });
          const result = await this.ocr.processImage(file);
          this.displayPopup(result, null, "OCR Web Image");
          this.removeToolsListeners();
        } catch (error) {
          this.showNotification(error.message);
        } finally {
          this.removeTranslatingStatus();
        }
      }
    };
    startWebImageOCR() {
      console.log("Starting web image OCR");
      const style = document.createElement("style");
      style.textContent = `
    .translator-overlay {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 100% !important;
      background: rgba(0,0,0,0.3) !important;
      z-index: 2147483646 !important;
      pointer-events: none !important;
    }
    .translator-guide {
      position: fixed !important;
      top: 20px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      background: rgba(0,0,0,0.8) !important;
      color: white !important;
      padding: 10px 20px !important;
      border-radius: 5px !important;
      font-size: 14px !important;
      z-index: 2147483647 !important;
      pointer-events: none !important;
    }
    .translator-cancel {
      position: fixed !important;
      top: 20px !important;
      right: 20px !important;
      background: #ff4444 !important;
      color: white !important;
      border: none !important;
      border-radius: 50% !important;
      width: 30px !important;
      height: 30px !important;
      font-size: 16px !important;
      cursor: pointer !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      z-index: 2147483647 !important;
      pointer-events: auto !important;
    }
    img {
      pointer-events: auto !important;
    }
    img.translator-image-highlight {
      outline: 3px solid #4a90e2 !important;
      cursor: pointer !important;
      position: relative !important;
      z-index: 2147483646 !important;
    }
  `;
      document.head.appendChild(style);
      const overlay = document.createElement("div");
      overlay.className = "translator-overlay";
      const guide = document.createElement("div");
      guide.className = "translator-guide";
      guide.textContent = "Click vào ảnh để OCR";
      const cancelBtn = document.createElement("button");
      cancelBtn.className = "translator-cancel";
      cancelBtn.textContent = "✕";
      document.body.appendChild(overlay);
      document.body.appendChild(guide);
      document.body.appendChild(cancelBtn);
      const handleHover = (e) => {
        if (e.target.tagName === "IMG") {
          e.target.classList.add("translator-image-highlight");
        }
      };
      const handleLeave = (e) => {
        if (e.target.tagName === "IMG") {
          e.target.classList.remove("translator-image-highlight");
        }
      };
      const handleClick = async (e) => {
        if (e.target.tagName === "IMG") {
          e.preventDefault();
          e.stopPropagation();
          try {
            this.showTranslatingStatus();
            const canvas = document.createElement("canvas");
            canvas.width = e.target.naturalWidth;
            canvas.height = e.target.naturalHeight;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(e.target, 0, 0);
            const blob = await new Promise((resolve) =>
              canvas.toBlob(resolve, "image/png"),
            );
            const file = new File([blob], "web-image.png", {
              type: "image/png",
            });
            const result = await this.ocr.processImage(file);
            this.displayPopup(result, null, "OCR Web Image");
            this.removeWebImageListeners();
          } catch (error) {
            console.error("OCR error:", error);
            this.showNotification(error.message, "error");
          } finally {
            this.removeTranslatingStatus();
          }
        }
      };
      document.addEventListener("mouseover", handleHover, true);
      document.addEventListener("mouseout", handleLeave, true);
      document.addEventListener("click", handleClick, true);
      cancelBtn.addEventListener("click", () => {
        this.removeWebImageListeners();
      });
      this.webImageListeners = {
        hover: handleHover,
        leave: handleLeave,
        click: handleClick,
        overlay,
        guide,
        cancelBtn,
        style,
      };
    }
    startWebMediaTranslation() {
      console.log("Starting web media translation");
      const style = document.createElement("style");
      style.textContent = `
    .translator-overlay {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 100% !important;
      background: rgba(0,0,0,0.3) !important;
      z-index: 2147483646 !important;
      pointer-events: none !important;
    }
    .translator-guide {
      position: fixed !important;
      top: 20px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      background: rgba(0,0,0,0.8) !important;
      color: white !important;
      padding: 10px 20px !important;
      border-radius: 5px !important;
      font-size: 14px !important;
      z-index: 2147483647 !important;
      pointer-events: none !important;
    }
    .translator-cancel {
      position: fixed !important;
      top: 20px !important;
      right: 20px !important;
      background: #ff4444 !important;
      color: white !important;
      border: none !important;
      border-radius: 50% !important;
      width: 30px !important;
      height: 30px !important;
      font-size: 16px !important;
      cursor: pointer !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      z-index: 2147483647 !important;
      pointer-events: auto !important;
    }
    audio, video {
      pointer-events: auto !important;
    }
    .translator-media-highlight {
      outline: 3px solid #4a90e2 !important;
      cursor: pointer !important;
      position: relative !important;
      z-index: 2147483646 !important;
    }
  `;
      document.head.appendChild(style);
      const overlay = document.createElement("div");
      overlay.className = "translator-overlay";
      const guide = document.createElement("div");
      guide.className = "translator-guide";
      guide.textContent = "Click vào audio/video để dịch";
      const cancelBtn = document.createElement("button");
      cancelBtn.className = "translator-cancel";
      cancelBtn.textContent = "✕";
      document.body.appendChild(overlay);
      document.body.appendChild(guide);
      document.body.appendChild(cancelBtn);
      const handleHover = (e) => {
        const mediaElement = findMediaElement(e.target);
        if (mediaElement) {
          mediaElement.classList.add("translator-media-highlight");
        }
      };
      const handleLeave = (e) => {
        const mediaElement = findMediaElement(e.target);
        if (mediaElement) {
          mediaElement.classList.remove("translator-media-highlight");
        }
      };
      const handleClick = async (e) => {
        const mediaElement = findMediaElement(e.target);
        if (mediaElement) {
          e.preventDefault();
          e.stopPropagation();
          if (!mediaElement.paused) {
            mediaElement.pause();
          }
          showMediaContextMenu(e, mediaElement);
        }
      };
      const findMediaElement = (target) => {
        if (target.tagName === "AUDIO" || target.tagName === "VIDEO") {
          return target;
        }
        const containers = [
          ".audio-player",
          ".video-player",
          ".mejs-container",
          ".jp-audio",
          ".jp-video",
          ".plyr",
          ".video-js",
          ".jwplayer",
          '[class*="player"]',
          '[class*="audio"]',
          '[class*="video"]',
        ];
        for (const selector of containers) {
          const container = target.closest(selector);
          if (container) {
            const media = container.querySelector("audio, video");
            if (media) return media;
          }
        }
        const controlSelectors = [
          "button",
          '[class*="play"]',
          '[class*="pause"]',
          '[class*="control"]',
          '[role="button"]',
        ];
        for (const selector of controlSelectors) {
          if (target.matches(selector)) {
            const container = target.closest(
              '[class*="player"],[class*="audio"],[class*="video"]',
            );
            if (container) {
              const media = container.querySelector("audio, video");
              if (media) return media;
            }
          }
        }
        return null;
      };
      const showMediaContextMenu = (e, mediaElement) => {
        const contextMenu = document.createElement("div");
        Object.assign(contextMenu.style, {
          position: "fixed",
          left: `${e.clientX}px`,
          top: `${e.clientY}px`,
          background: "white",
          border: "1px solid #ccc",
          borderRadius: "5px",
          padding: "5px",
          boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
          zIndex: "2147483647",
        });
        const options = [
          {
            text: "Dịch file",
            handler: async () => {
              try {
                contextMenu.remove();
                await this.handleMediaFile(mediaElement);
              } catch (error) {
                this.showNotification(error.message, "error");
              }
            },
          },
        ];
        options.forEach((option) => {
          const div = document.createElement("div");
          Object.assign(div.style, {
            padding: "8px 15px",
            cursor: "pointer",
            borderRadius: "3px",
            whiteSpace: "nowrap",
          });
          div.onmouseover = () => (div.style.backgroundColor = "#f5f5f5");
          div.onmouseout = () => (div.style.backgroundColor = "transparent");
          div.onclick = option.handler;
          div.textContent = option.text;
          contextMenu.appendChild(div);
        });
        document.body.appendChild(contextMenu);
        const closeMenu = (e) => {
          if (!contextMenu.contains(e.target)) {
            contextMenu.remove();
            document.removeEventListener("click", closeMenu);
          }
        };
        setTimeout(() => document.addEventListener("click", closeMenu), 0);
      };
      document.addEventListener("mouseover", handleHover, true);
      document.addEventListener("mouseout", handleLeave, true);
      document.addEventListener("click", handleClick, true);
      cancelBtn.addEventListener("click", () => {
        this.removeWebMediaListeners();
      });
      this.webMediaListeners = {
        hover: handleHover,
        leave: handleLeave,
        click: handleClick,
        overlay,
        guide,
        cancelBtn,
        style,
      };
    }
    async handleAudioFile(mediaElement) {
      try {
        const blob = await fetch(mediaElement.src).then((r) => r.blob());
        const base64Audio = await this.blobToBase64(blob);
        const mediaSettings =
          this.translator.userSettings.settings.mediaOptions;
        const requestBody = {
          contents: [
            {
              parts: [
                {
                  audio: {
                    data: base64Audio,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: mediaSettings.temperature,
            topP: mediaSettings.topP,
            topK: mediaSettings.topK,
            maxOutputTokens: 2048,
          },
        };
        const response = await this.translator.api.request(
          requestBody,
          "gemini-2.0-flash-lite",
        );
        if (response) {
          this.displayTranslation(response);
        }
      } catch (error) {
        console.error("Error processing audio file:", error);
        this.showNotification("Lỗi khi xử lý file audio: " + error.message);
      }
    }
    async blobToBase64(blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result.split(",")[1];
          resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
    async handleMediaFile(mediaElement) {
      try {
        await this.handleAudioFile(mediaElement);
      } catch (error) {
        console.error("Media handling error:", error);
        this.showNotification(error.message, "error");
      }
    }
    getBrowserContextMenuSize() {
      const browser = navigator.userAgent;
      const sizes = {
        firefox: {
          width: 270,
          height: 340,
          itemHeight: 34,
        },
        chrome: {
          width: 250,
          height: 320,
          itemHeight: 32,
        },
        safari: {
          width: 240,
          height: 300,
          itemHeight: 30,
        },
        edge: {
          width: 260,
          height: 330,
          itemHeight: 33,
        },
      };
      let size;
      if (browser.includes("Firefox")) {
        size = sizes.firefox;
      } else if (browser.includes("Safari") && !browser.includes("Chrome")) {
        size = sizes.safari;
      } else if (browser.includes("Edge")) {
        size = sizes.edge;
      } else {
        size = sizes.chrome;
      }
      const dpi = window.devicePixelRatio || 1;
      return {
        width: Math.round(size.width * dpi),
        height: Math.round(size.height * dpi),
        itemHeight: Math.round(size.itemHeight * dpi),
      };
    }
    setupContextMenu() {
      if (!this.translator.userSettings.settings.contextMenu) return;
      document.addEventListener("contextmenu", (e) => {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        if (selectedText) {
          const oldMenus = document.querySelectorAll(
            ".translator-context-menu",
          );
          oldMenus.forEach((menu) => menu.remove());
          const contextMenu = document.createElement("div");
          contextMenu.className = "translator-context-menu";
          const menuItems = [
            { text: "Dịch nhanh", action: "quick" },
            { text: "Dịch popup", action: "popup" },
            { text: "Dịch nâng cao", action: "advanced" },
          ];
          const range = selection.getRangeAt(0).cloneRange();
          menuItems.forEach((item) => {
            const menuItem = document.createElement("div");
            menuItem.className = "translator-context-menu-item";
            menuItem.textContent = item.text;
            menuItem.onclick = (e) => {
              e.preventDefault();
              e.stopPropagation();
              const newSelection = window.getSelection();
              newSelection.removeAllRanges();
              newSelection.addRange(range);
              this.handleTranslateButtonClick(newSelection, item.action);
              contextMenu.remove();
            };
            contextMenu.appendChild(menuItem);
          });
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;
          const menuWidth = 150;
          const menuHeight = menuItems.length * 40;
          const browserMenu = this.getBrowserContextMenuSize();
          const browserMenuWidth = browserMenu.width;
          const browserMenuHeight = browserMenu.height;
          const spaceWidth = browserMenuWidth + menuWidth;
          const spaceHeight = browserMenuHeight + menuHeight;
          const remainingWidth = viewportWidth - e.clientX;
          const remainingHeight = viewportHeight - e.clientY;
          const rightEdge = viewportWidth - menuWidth;
          const bottomEdge = viewportHeight - menuHeight;
          const browserMenuWidthEdge = viewportWidth - browserMenuWidth;
          const browserMenuHeightEdge = viewportHeight - browserMenuHeight;
          let left, top;
          if (e.clientX < menuWidth && e.clientY < menuHeight) {
            left = e.clientX + browserMenuWidth;
            top = e.clientY;
          } else if (
            e.clientX > browserMenuWidthEdge &&
            e.clientY < browserMenuHeight
          ) {
            left = e.clientX - spaceWidth + remainingWidth;
            top = e.clientY;
          } else if (
            e.clientX > browserMenuWidthEdge &&
            e.clientY > viewportHeight - browserMenuHeight
          ) {
            left = e.clientX - spaceWidth + remainingWidth;
            top = e.clientY - menuHeight;
          } else if (
            e.clientX < menuWidth &&
            e.clientY > viewportHeight - browserMenuHeight
          ) {
            left = e.clientX + browserMenuWidth;
            top = e.clientY - spaceHeight;
          } else if (e.clientY < menuHeight) {
            left = e.clientX - menuWidth;
            top = e.clientY;
          } else if (e.clientX > browserMenuWidthEdge) {
            left = e.clientX - spaceWidth + remainingWidth;
            top = e.clientY;
          } else if (e.clientY > browserMenuHeightEdge - menuHeight / 2) {
            left = e.clientX - menuWidth;
            top = e.clientY - menuHeight;
          } else {
            left = e.clientX;
            top = e.clientY - menuHeight;
          }
          left = Math.max(5, Math.min(left, rightEdge - 5));
          top = Math.max(5, Math.min(top, bottomEdge - 5));
          contextMenu.style.left = `${left}px`;
          contextMenu.style.top = `${top}px`;
          document.body.appendChild(contextMenu);
          const closeMenu = (e) => {
            if (!contextMenu.contains(e.target)) {
              contextMenu.remove();
              document.removeEventListener("click", closeMenu);
            }
          };
          document.addEventListener("click", closeMenu);
          const handleScroll = () => {
            contextMenu.remove();
            window.removeEventListener("scroll", handleScroll);
          };
          window.addEventListener("scroll", handleScroll);
        }
      });
      GM_addStyle(`
        .translator-context-menu {
          position: fixed;
          background: ${CONFIG.THEME[CONFIG.THEME.mode].background};
          border: 1px solid ${CONFIG.THEME[CONFIG.THEME.mode].border};
          border-radius: 8px;
          padding: 5px 0;
          min-width: 150px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          z-index: 9999;
          font-family: Arial, sans-serif;
          font-size: 14px;
          opacity: 0;
          transform: scale(0.95);
          transition: all 0.1s ease-out;
          animation: menuAppear 0.15s ease-out forwards;
        }
        @keyframes menuAppear {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .translator-context-menu-item {
          padding: 8px 15px;
          cursor: pointer;
          color: ${CONFIG.THEME[CONFIG.THEME.mode].text};
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 8px;
          white-space: nowrap;
        }
        .translator-context-menu-item:hover {
          background: ${CONFIG.THEME[CONFIG.THEME.mode].button.translate.background
        };
          color: ${CONFIG.THEME[CONFIG.THEME.mode].button.translate.text};
        }
        .translator-context-menu-item:active {
          transform: scale(0.98);
        }
      `);
    }
    removeWebMediaListeners() {
      if (this.webMediaListeners) {
        document.removeEventListener(
          "mouseover",
          this.webMediaListeners.hover,
          true,
        );
        document.removeEventListener(
          "mouseout",
          this.webMediaListeners.leave,
          true,
        );
        document.removeEventListener(
          "click",
          this.webMediaListeners.click,
          true,
        );
        this.webMediaListeners.overlay?.remove();
        this.webMediaListeners.guide?.remove();
        this.webMediaListeners.cancelBtn?.remove();
        this.webMediaListeners.style?.remove();
        document
          .querySelectorAll(".translator-media-highlight")
          .forEach((el) => {
            el.classList.remove("translator-media-highlight");
          });
        this.webMediaListeners = null;
      }
    }
    removeWebImageListeners() {
      if (this.webImageListeners) {
        document.removeEventListener(
          "mouseover",
          this.webImageListeners.hover,
          true,
        );
        document.removeEventListener(
          "mouseout",
          this.webImageListeners.leave,
          true,
        );
        document.removeEventListener(
          "click",
          this.webImageListeners.click,
          true,
        );
        this.webImageListeners.overlay?.remove();
        this.webImageListeners.guide?.remove();
        this.webImageListeners.cancelBtn?.remove();
        this.webImageListeners.style?.remove();
        document
          .querySelectorAll(".translator-image-highlight")
          .forEach((el) => {
            el.classList.remove("translator-image-highlight");
          });
        this.webImageListeners = null;
      }
    }
    handleSettingsShortcut(e) {
      if (!this.translator.userSettings.settings.shortcuts?.settingsEnabled)
        return;
      if ((e.altKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        const settingsUI = this.translator.userSettings.createSettingsUI();
        document.body.appendChild(settingsUI);
      }
    }
    async handleTranslationShortcuts(e) {
      if (!this.translator.userSettings.settings.shortcuts?.enabled) return;
      const selection = window.getSelection();
      const selectedText = selection?.toString().trim();
      if (!selectedText || this.isTranslating) return;
      const targetElement = selection.anchorNode?.parentElement;
      if (!targetElement) return;
      const shortcuts = this.translator.userSettings.settings.shortcuts;
      if (e.altKey || e.metaKey) {
        let translateType = null;
        if (e.key.toLowerCase() === shortcuts.pageTranslate.key.toLowerCase()) {
          e.preventDefault();
          await this.handlePageTranslation();
          return;
        } else if (e.key === shortcuts.quickTranslate.key) {
          e.preventDefault();
          translateType = "quick";
        } else if (e.key === shortcuts.popupTranslate.key) {
          e.preventDefault();
          translateType = "popup";
        } else if (e.key === shortcuts.advancedTranslate.key) {
          e.preventDefault();
          translateType = "advanced";
        }
        if (translateType) {
          await this.handleTranslateButtonClick(selection, translateType);
        }
      }
    }
    updateSettingsListener(enabled) {
      if (enabled) {
        document.addEventListener("keydown", this.settingsShortcutListener);
      } else {
        document.removeEventListener("keydown", this.settingsShortcutListener);
      }
    }
    updateSettingsTranslationListeners(enabled) {
      if (enabled) {
        document.addEventListener("keydown", this.translationShortcutListener);
      } else {
        document.removeEventListener(
          "keydown",
          this.translationShortcutListener,
        );
      }
    }
    updateSelectionListeners(enabled) {
      if (enabled) {
        document.addEventListener("mouseup", this.mouseupButtonListener);
        document.addEventListener(
          "selectionchange",
          this.selectionButtonListener,
        );
      } else {
        document.removeEventListener("mouseup", this.mouseupButtonListener);
        document.removeEventListener(
          "selectionchange",
          this.selectionButtonListener,
        );
      }
    }
    updateTapListeners(enabled) {
      if (enabled) this.setupDocumentTapHandler();
    }
    setupEventListeners() {
      const pageTranslation =
        this.translator.userSettings.settings.pageTranslation;
      const ocrOptions = this.translator.userSettings.settings.ocrOptions;
      const mediaOptions = this.translator.userSettings.settings.mediaOptions;
      const shortcuts = this.translator.userSettings.settings.shortcuts;
      const clickOptions = this.translator.userSettings.settings.clickOptions;
      const touchOptions = this.translator.userSettings.settings.touchOptions;
      if (this.translator.userSettings.settings.contextMenu) {
        this.setupContextMenu();
      }
      if (shortcuts?.settingsEnabled) {
        this.updateSettingsListener(true);
      }
      if (shortcuts?.enabled) {
        this.updateSettingsTranslationListeners(true);
      }
      if (clickOptions?.enabled) {
        this.updateSelectionListeners(true);
        this.translationButtonEnabled = true;
      }
      if (touchOptions?.enabled) {
        this.updateTapListeners(true);
        this.translationTapEnabled = true;
      }
      if (
        pageTranslation?.enabled ||
        ocrOptions?.enabled ||
        mediaOptions?.enabled
      ) {
        const isEnabled =
          localStorage.getItem("translatorToolsEnabled") === "true";
        if (isEnabled) {
          this.setupTranslatorTools();
        }
      }
      document.addEventListener("settingsChanged", (e) => {
        const newSettings = e.detail;
        this.updateSettingsListener(newSettings.shortcuts?.settingsEnabled);
        this.updateSettingsTranslationListeners(newSettings.shortcuts?.enabled);
        if (newSettings.clickOptions?.enabled !== undefined) {
          this.translationButtonEnabled = newSettings.clickOptions.enabled;
          this.updateSelectionListeners(newSettings.clickOptions.enabled);
          if (!newSettings.clickOptions.enabled) {
            this.removeTranslateButton();
          }
        }
        if (newSettings.touchOptions?.enabled !== undefined) {
          this.translationTapEnabled = newSettings.touchOptions.enabled;
          this.updateTapListeners(newSettings.touchOptions.enabled);
          if (!newSettings.touchOptions.enabled) {
            this.removeTranslateButton();
          }
        }
        this.cache = new TranslationCache(
          newSettings.cacheOptions.text.maxSize,
          newSettings.cacheOptions.text.expirationTime,
        );
        this.cache.clear();
        if (this.ocr?.imageCache) {
          this.ocr.imageCache.clear();
        }
        const apiConfig = {
          providers: CONFIG.API.providers,
          currentProvider: newSettings.apiProvider,
          apiKey: newSettings.apiKey,
          maxRetries: CONFIG.API.maxRetries,
          retryDelay: CONFIG.API.retryDelay,
        };
        this.api = new APIManager(apiConfig);
        if (
          pageTranslation?.enabled ||
          ocrOptions?.enabled ||
          mediaOptions?.enabled
        ) {
          const isEnabled =
            localStorage.getItem("translatorToolsEnabled") === "true";
          if (isEnabled) {
            this.setupTranslatorTools();
          }
        }
        this.removeToolsListeners();
        this.removeToolsContainer();
        this.setupTranslatorTools();
      });
    }
    showNotification(message, type = "info") {
      const notification = document.createElement("div");
      notification.className = "translator-notification";
      const colors = {
        info: "#4a90e2",
        success: "#28a745",
        warning: "#ffc107",
        error: "#dc3545",
      };
      const backgroundColor = colors[type] || colors.info;
      const textColor = type === "warning" ? "#000" : "#fff";
      Object.assign(notification.style, {
        position: "fixed",
        top: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        backgroundColor,
        color: textColor,
        padding: "10px 20px",
        borderRadius: "5px",
        zIndex: "2147483647",
        animation: "fadeInOut 2s ease",
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
      });
      notification.textContent = message;
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 2000);
    }
    resetState() {
      if (this.pressTimer) clearTimeout(this.pressTimer);
      if (this.timer) clearTimeout(this.timer);
      this.isLongPress = false;
      this.lastTime = 0;
      this.count = 0;
      this.isDown = false;
      this.isTranslating = false;
      this.ignoreNextSelectionChange = false;
      this.removeTranslateButton();
      this.removeTranslatingStatus();
    }
    removeTranslateButton() {
      if (this.currentTranslateButton) {
        this.currentTranslateButton.remove();
        this.currentTranslateButton = null;
      }
    }
    removeTranslatingStatus() {
      if (this.translatingStatus) {
        this.translatingStatus.remove();
        this.translatingStatus = null;
      }
    }
    removeAllProcessingIndicators() {
      const indicators = document.querySelectorAll(
        ".translator-processing-indicator",
      );
      indicators.forEach((indicator) => {
        if (indicator && indicator.parentNode) {
          indicator.parentNode.removeChild(indicator);
        }
      });
    }
  }
  class Translator {
    constructor() {
      window.translator = this;
      this.userSettings = new UserSettings(this);
      const apiConfig = {
        ...CONFIG.API,
        currentProvider: this.userSettings.getSetting("apiProvider"),
        apiKey: this.userSettings.getSetting("apiKey"),
      };
      this.api = new APIManager(apiConfig, () => this.userSettings.settings);
      this.ocr = new OCRManager(this);
      this.ui = new UIManager(this);
      this.cache = new TranslationCache(
        this.userSettings.settings.cacheOptions.text.maxSize,
        this.userSettings.settings.cacheOptions.text.expirationTime,
      );
      this.page = new PageTranslator(this);
      this.ui.setupEventListeners();
      this.cache.optimizeStorage();
      this.autoCorrectEnabled = true;
    }

    async translate(
      text,
      targetElement,
      isAdvanced = false,
      displaySimple = false,
    ) {
      if (!text) return null;

      try {
        const prompt = this.createPrompt(text, isAdvanced);
        let translatedText;

        const cacheEnabled =
          this.userSettings.settings.cacheOptions.text.enabled;
        if (cacheEnabled) {
          translatedText = this.cache.get(text, isAdvanced);
        }

        if (!translatedText) {
          translatedText = await this.api.request(prompt);
          if (cacheEnabled && translatedText) {
            this.cache.set(text, translatedText, isAdvanced);
          }
        }

        // Nếu có targetElement và không phải là dịch PDF, hiển thị kết quả
        if (
          translatedText &&
          targetElement &&
          !targetElement.isPDFTranslation
        ) {
          if (isAdvanced || displaySimple) {
            this.ui.displayPopup(translatedText, text);
          } else {
            this.ui.showTranslationBelow(targetElement, translatedText);
          }
        }

        return translatedText; // Trả về kết quả dịch
      } catch (error) {
        console.error("Translation error:", error);
        if (targetElement && !targetElement.isPDFTranslation) {
          this.handleError(error, targetElement);
        }
        throw error;
      }
    }
    async translateLongText(text, maxChunkSize = 1000) {
      const chunks = this.splitIntoChunks(text, maxChunkSize);
      const translations = await Promise.all(
        chunks.map((chunk) => this.translate(chunk)),
      );
      return this.smartMerge(translations);
    }

    splitIntoChunks(text, maxChunkSize) {
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
      const chunks = [];
      let currentChunk = "";

      for (const sentence of sentences) {
        if ((currentChunk + sentence).length > maxChunkSize && currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = "";
        }
        currentChunk += sentence + " ";
      }

      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }

      return chunks;
    }

    smartMerge(translations) {
      return translations.reduce((merged, current, index) => {
        if (index === 0) return current;

        const lastChar = merged.slice(-1);
        const firstChar = current.charAt(0);

        if (".!?".includes(lastChar)) {
          return `${merged} ${current}`;
        }

        return merged + current;
      }, "");
    }

    async autoCorrect(translation) {
      const prompt = `Please check and correct any grammar or context issues in this Vietnamese translation: "${translation}"`;

      try {
        const corrected = await this.api.request(prompt);
        return corrected.trim();
      } catch (error) {
        console.error("Auto-correction failed:", error);
        return translation;
      }
    }
    createPrompt(text, isAdvanced) {
      return isAdvanced
        ? `Dịch và phân tích từ khóa: "${text}"`
        : `Cho bạn đoạn văn bản: "${text}".
                   Hãy dịch đoạn văn bản đó thành Tiếng Việt (Vietnamese) với các điều kiện sau:
                   - Tuân thủ chặt chẽ bối cảnh và sắc thái ban đầu.
                   - Sự lưu loát tự nhiên như người bản xứ.
                   - Không có thêm giải thích/diễn giải.
                   - Bảo toàn thuật ngữ 1:1 cho các thuật ngữ/danh từ riêng.
                   Chỉ in ra bản dịch mà không có dấu ngoặc kép.`;
    }
    showSettingsUI() {
      const settingsUI = this.userSettings.createSettingsUI();
      document.body.appendChild(settingsUI);
    }
    handleError(error, targetElement) {
      console.error("Translation failed:", error);
      const message = error.message.includes("Rate limit")
        ? "Vui lòng chờ giữa các lần dịch"
        : error.message.includes("Gemini API")
          ? "Lỗi Gemini: " + error.message
          : error.message.includes("API Key")
            ? "Lỗi xác thực API"
            : "Lỗi dịch thuật: " + error.message;
      this.ui.showTranslationBelow(targetElement, message);
    }
  }
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
  GM_registerMenuCommand("Cài đặt Translator AI", () => {
    const translator = window.translator;
    if (translator) {
      const settingsUI = translator.userSettings.createSettingsUI();
      document.body.appendChild(settingsUI);
    }
  });
  const translator = new Translator();
})();
