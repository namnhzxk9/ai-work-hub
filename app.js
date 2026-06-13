const toolsContainer = document.getElementById("toolsContainer");
const searchInput = document.getElementById("searchInput");
const departmentFilter = document.getElementById("departmentFilter");
const platformFilter = document.getElementById("platformFilter");
const levelFilter = document.getElementById("levelFilter");
const departmentTabs = document.getElementById("departmentTabs");
const platformTabs = document.getElementById("platformTabs");
const shortcutContainer = document.getElementById("shortcutContainer");

let activeDepartment = "all";
let activePlatform = "all";
let currentBuilderPrompt = null;
let builtPromptText = "";

const departments = ["all", ...Array.from(new Set(TOOLS.map(item => item.department)))];
const platforms = ["all", "ChatGPT", "NotebookLM", "Gemini"];

function initDepartmentFilter() {
  if (!departmentFilter) return;

  departmentFilter.innerHTML = `<option value="all">Tất cả phòng ban</option>`;

  departments.forEach(dep => {
    if (dep !== "all") {
      const option = document.createElement("option");
      option.value = dep;
      option.textContent = dep;
      departmentFilter.appendChild(option);
    }
  });
}

function initTabs() {
  if (!departmentTabs || !platformTabs) return;

  departmentTabs.innerHTML = "";
  departments.forEach(dep => {
    const btn = document.createElement("button");
    btn.className = "tab" + (dep === activeDepartment ? " active" : "");
    btn.textContent = dep === "all" ? "Tất cả" : dep;
    btn.onclick = () => {
      activeDepartment = dep;
      if (departmentFilter) departmentFilter.value = dep;
      renderAll();
    };
    departmentTabs.appendChild(btn);
  });

  platformTabs.innerHTML = "";
  platforms.forEach(platform => {
    const btn = document.createElement("button");
    btn.className = "tab platform-tab " + platform + (platform === activePlatform ? " active" : "");
    btn.textContent = platform === "all" ? "Tất cả AI" : platform;
    btn.onclick = () => {
      activePlatform = platform;
      if (platformFilter) platformFilter.value = platform;
      renderAll();
    };
    platformTabs.appendChild(btn);
  });
}

function normalize(text) {
  return String(text || "").toLowerCase();
}

function promptMatches(prompt, keyword, platform, level) {
  const promptText = `${prompt.title || ""} ${prompt.use || ""} ${prompt.level || ""} ${prompt.prompt || ""} ${prompt.notebooklm_prompt || ""} ${prompt.gemini_prompt || ""}`;
  const matchKeyword = normalize(promptText).includes(keyword);
  const matchPlatform = platform === "all" || (prompt.platforms || []).includes(platform);
  const matchLevel = level === "all" || prompt.level === level;

  return matchKeyword && matchPlatform && matchLevel;
}

function toolMatches(tool, keyword, department, platform, level) {
  const toolText = `${tool.department || ""} ${tool.tool || ""} ${tool.description || ""}`;
  const matchingPrompts = (tool.prompts || []).filter(p => promptMatches(p, keyword, platform, level));
  const matchToolKeyword = normalize(toolText).includes(keyword);
  const matchDepartment = department === "all" || tool.department === department;
  const matchPlatform =
    platform === "all" ||
    (tool.platforms || []).includes(platform) ||
    matchingPrompts.length > 0;

  if (!matchDepartment || !matchPlatform) return false;

  if (keyword === "") {
    return matchingPrompts.length > 0 || level === "all";
  }

  return matchToolKeyword || matchingPrompts.length > 0;
}

function getFilteredPrompts(tool, keyword, platform, level) {
  return (tool.prompts || []).filter(p => promptMatches(p, keyword, platform, level));
}

function renderTools() {
  clearShortcutView(false);

  const keyword = searchInput ? normalize(searchInput.value.trim()) : "";
  const department = activeDepartment;
  const platform = activePlatform;
  const level = levelFilter ? levelFilter.value : "all";

  const filtered = TOOLS.filter(tool => toolMatches(tool, keyword, department, platform, level));

  if (!toolsContainer) return;

  toolsContainer.innerHTML = "";

  if (filtered.length === 0) {
    toolsContainer.innerHTML = `<div class="empty">Không tìm thấy tool/prompt phù hợp.</div>`;
    return;
  }

  filtered.forEach((tool, toolIndex) => {
    const card = document.createElement("article");
    card.className = "tool-card";

    const visiblePrompts = getFilteredPrompts(tool, keyword, platform, level);
    const toolPlatformBadges = (tool.platforms || [])
      .map(p => `<span class="badge platform ${escapeAttr(p)}">${escapeHtml(p)}</span>`)
      .join("");

    const promptItems = visiblePrompts.map((prompt, promptIndex) => {
      const safeId = `p-${toolIndex}-${promptIndex}-${Math.random().toString(36).slice(2)}`;
      const platformBadges = (prompt.platforms || [])
        .map(p => `<span class="badge platform ${escapeAttr(p)}">${escapeHtml(p)}</span>`)
        .join("");

      const defaultPrompt = prompt.prompt || "";
      const notebookPrompt = prompt.notebooklm_prompt || defaultPrompt;
      const geminiPrompt = prompt.gemini_prompt || defaultPrompt;
      const chatGeminiPrompt = defaultPrompt;

      let buttons = "";

      if ((prompt.platforms || []).includes("ChatGPT") || (prompt.platforms || []).includes("Gemini")) {
        buttons += `
          <button class="copy-btn ChatGPT" onclick="copyTextById('${safeId}-chatgemini')">Copy ChatGPT/Gemini</button>
          <textarea id="${safeId}-chatgemini" hidden>${escapeHtml(chatGeminiPrompt)}</textarea>
        `;
      } else {
        buttons += `
          <textarea id="${safeId}-chatgemini" hidden>${escapeHtml(chatGeminiPrompt)}</textarea>
        `;
      }

      if ((prompt.platforms || []).includes("NotebookLM")) {
        buttons += `
          <button class="copy-btn NotebookLM" onclick="copyTextById('${safeId}-notebooklm')">Copy NotebookLM</button>
          <textarea id="${safeId}-notebooklm" hidden>${escapeHtml(notebookPrompt)}</textarea>
        `;
      } else {
        buttons += `
          <textarea id="${safeId}-notebooklm" hidden>${escapeHtml(notebookPrompt)}</textarea>
        `;
      }

      if (tool.department !== "Tool Tricks") {
        const guideJson = JSON.stringify(prompt.input_guide || {});
        buttons += `
          <button class="builder-btn" onclick="openBuilderById('${safeId}-chatgemini', '${safeId}-notebooklm', '${safeId}-guide', '${escapeAttr(prompt.title)}', '${escapeAttr(prompt.use)}')">Prompt Builder</button>
          <textarea id="${safeId}-guide" hidden>${escapeHtml(guideJson)}</textarea>
        `;
      }

      const favoriteSaved = isFavoriteSaved(prompt.title, chatGeminiPrompt);
      const favClass = favoriteSaved ? "favorite-btn saved" : "favorite-btn";
      const favText = favoriteSaved ? "Đã lưu" : "Lưu";

      buttons += `
        <button id="${safeId}-fav-btn" class="${favClass}" onclick="toggleFavorite('${safeId}-fav-title', '${safeId}-fav-use', '${safeId}-chatgemini', '${safeId}-notebooklm', '${safeId}-fav-btn')">${favText}</button>
        <textarea id="${safeId}-fav-title" hidden>${escapeHtml(prompt.title)}</textarea>
        <textarea id="${safeId}-fav-use" hidden>${escapeHtml(prompt.use)}</textarea>
      `;

      let shownPrompt = chatGeminiPrompt;
      if (activePlatform === "NotebookLM") shownPrompt = notebookPrompt;
      if (activePlatform === "Gemini") shownPrompt = geminiPrompt;

      return `
        <div class="prompt-item">
          <button class="prompt-title" onclick="togglePrompt('${safeId}')">
            <span>${escapeHtml(prompt.title)}</span>
            <span>▾</span>
          </button>
          <div id="${safeId}" class="prompt-body">
            <div class="badge-row">
              <span class="badge level">${escapeHtml(prompt.level || "Chuẩn")}</span>
              ${platformBadges}
            </div>
            <p class="prompt-meta"><strong>Dùng khi:</strong> ${escapeHtml(prompt.use)}</p>
            <div class="prompt-box">${escapeHtml(shownPrompt)}</div>
            <div class="actions">${buttons}</div>
          </div>
        </div>
      `;
    }).join("");

    card.innerHTML = `
      <div class="tool-header">
        <div class="badge-row">
          <span class="badge">${escapeHtml(tool.department)}</span>
          ${toolPlatformBadges}
        </div>
        <h3>${escapeHtml(tool.tool)}</h3>
        <p>${escapeHtml(tool.description)}</p>
      </div>
      <div class="prompt-list">
        ${promptItems || "<p class='prompt-meta'>Không có prompt phù hợp với bộ lọc hiện tại.</p>"}
      </div>
    `;

    toolsContainer.appendChild(card);
  });
}

function renderAll() {
  initTabs();
  renderTools();
}

function togglePrompt(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle("open");
}

function copyTextById(id) {
  const el = document.getElementById(id);
  if (!el) return;

  copyText(el.value);
  saveRecentFromTextarea(id);
}

function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      alert("Đã copy prompt.");
    }).catch(() => {
      fallbackCopyText(text);
    });
  } else {
    fallbackCopyText(text);
  }
}

function fallbackCopyText(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "-9999px";

  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);

  alert("Đã copy prompt.");
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
    .replaceAll("`", "&#096;");
}

function cleanBasePrompt(text) {
  let cleaned = String(text || "").trim();

  const inputMarkers = [
    "Nội dung đầu vào:",
    "Dữ liệu đầu vào:",
    "Thông tin đầu vào:",
    "Thông tin gói thầu:",
    "Thông tin dự án:",
    "Thông tin dự án/gói việc:",
    "Thông tin khách hàng:",
    "Thông tin cơ hội:",
    "Thông tin:",
    "Phương án:",
    "Các phương án:",
    "Danh sách phương án:",
    "Option:",
    "Options:",
    "Nội dung:",
    "Nội dung thô:",
    "Nội dung cần xử lý:",
    "Nội dung cần phân tích:",
    "Nội dung cần review:",
    "Nội dung cần tóm tắt:",
    "Dữ liệu:",
    "Dữ liệu phân tích:",
    "Dữ liệu cần xử lý:",
    "Dữ liệu cần review:",
    "Bảng dữ liệu:",
    "Danh sách câu hỏi:",
    "Câu hỏi:",
    "Thông tin cần xử lý:",
    "Thông tin cần phân tích:",
    "Thông tin cần review:",
    "Thông tin cần tóm tắt:",
    "Thông tin cần làm rõ:",
    "Thông tin đầu vào / nội dung cần xử lý:"
  ];

  let cutIndex = -1;

  inputMarkers.forEach(marker => {
    const idx = cleaned.lastIndexOf(marker);

    // Chỉ cắt nếu marker nằm ở phần sau prompt.
    // Tránh xoá nhầm các từ như "Thông tin khách hàng" trong phần cấu trúc đầu ra.
    if (idx !== -1 && idx > cleaned.length * 0.25) {
      if (cutIndex === -1 || idx < cutIndex) {
        cutIndex = idx;
      }
    }
  });

  if (cutIndex !== -1) {
    cleaned = cleaned.slice(0, cutIndex).trim();
  }

  cleaned = cleaned
    .replace(/$begin:math:display$dán nội dung vào đây$end:math:display$/gi, "")
    .replace(/$begin:math:display$dán dữ liệu đầu vào tại đây$end:math:display$/gi, "")
    .replace(/$begin:math:display$dán câu hỏi vào đây$end:math:display$/gi, "")
    .replace(/$begin:math:display$nhập nếu có$end:math:display$/gi, "")
    .replace(/$begin:math:display$nhập$end:math:display$/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned;
}

function openBuilderById(chatGeminiId, notebookId, guideId, title, use) {
  const chatEl = document.getElementById(chatGeminiId);
  const noteEl = document.getElementById(notebookId);
  const guideEl = document.getElementById(guideId);

  let inputGuide = null;
  try {
    inputGuide = guideEl ? JSON.parse(guideEl.value) : null;
  } catch {
    inputGuide = null;
  }

  currentBuilderPrompt = {
    title,
    use,
    chatGemini: chatEl ? chatEl.value : "",
    notebook: noteEl ? noteEl.value : "",
    inputGuide
  };

  const builderSubtitle = document.getElementById("builderSubtitle");
  const builderProject = document.getElementById("builderProject");
  const builderClient = document.getElementById("builderClient");
  const builderGoalType = document.getElementById("builderGoalType");
  const builderGoalDetail = document.getElementById("builderGoalDetail");
  const builderOutput = document.getElementById("builderOutput");
  const builderInput = document.getElementById("builderInput");
  const builderOutputBox = document.getElementById("builderOutputBox");
  const builderModal = document.getElementById("builderModal");

  if (builderSubtitle) builderSubtitle.textContent = `${title} · ${use}`;
  if (builderProject) builderProject.value = "";
  if (builderClient) builderClient.value = "";
  if (builderGoalType) builderGoalType.value = suggestGoalType(title);
  if (builderGoalDetail) builderGoalDetail.value = "";
  if (builderOutput) builderOutput.value = suggestOutputFormat(title);
  if (builderInput) builderInput.value = "";
  if (builderOutputBox) builderOutputBox.textContent = "Prompt đã tạo sẽ hiển thị tại đây.";

  updateBuilderHints();
  builtPromptText = "";

  if (builderModal) builderModal.classList.remove("hidden");
}

function closeBuilder() {
  const builderModal = document.getElementById("builderModal");
  if (builderModal) builderModal.classList.add("hidden");
}

function generateBuiltPrompt() {
  if (!currentBuilderPrompt) return;

  const project = document.getElementById("builderProject")?.value.trim() || "";
  const client = document.getElementById("builderClient")?.value.trim() || "";
  const goalType = document.getElementById("builderGoalType")?.value || "";
  const goalDetail = document.getElementById("builderGoalDetail")?.value.trim() || "";
  const goal = goalDetail ? `${goalType} - ${goalDetail}` : goalType;
  const output = document.getElementById("builderOutput")?.value || "Executive summary";
  const detail = document.getElementById("builderDetail")?.value || "Đầy đủ";
  const platform = document.getElementById("builderPlatform")?.value || "ChatGPT";
  const input = document.getElementById("builderInput")?.value.trim() || "";

  let basePrompt = platform === "NotebookLM"
    ? (currentBuilderPrompt.notebook || currentBuilderPrompt.chatGemini)
    : currentBuilderPrompt.chatGemini;

  basePrompt = cleanBasePrompt(basePrompt);

  const outputInstruction = getOutputInstruction(output);

  const contextBlock = `

BỐI CẢNH ÁP DỤNG:
- Tool/prompt: ${currentBuilderPrompt.title || ""}
- Tên dự án/gói việc: ${project || "[chưa nhập]"}
- Khách hàng/đối tác: ${client || "[chưa nhập]"}
- Mục tiêu sử dụng: ${goal || "[chưa nhập]"}
- Định dạng đầu ra mong muốn: ${output}
- Mức độ chi tiết: ${detail}

HƯỚNG DẪN ĐỊNH DẠNG ĐẦU RA:
${outputInstruction}

YÊU CẦU BẮT BUỘC:
- Bám sát dữ liệu đầu vào.
- Không tự suy diễn nếu thiếu dữ liệu.
- Nếu dữ liệu đầu vào quá ít hoặc thiếu thông tin trọng yếu, KHÔNG kết luận vội. Trước tiên hãy lập bảng thông tin còn thiếu và câu hỏi cần bổ sung.
- Phân biệt rõ Fact / Assumption / Risk nếu có phân tích.
- Đầu ra phải dùng được cho công việc nội bộ.

DỮ LIỆU ĐẦU VÀO:
${input || "[dán dữ liệu đầu vào tại đây]"}`;

  builtPromptText = basePrompt + contextBlock;

  const builderOutputBox = document.getElementById("builderOutputBox");
  if (builderOutputBox) builderOutputBox.textContent = builtPromptText;
}

function copyBuiltPrompt() {
  if (!builtPromptText) generateBuiltPrompt();
  if (builtPromptText) copyText(builtPromptText);
}

function getStore(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

function setStore(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function saveRecentFromTextarea(id) {
  const el = document.getElementById(id);
  if (!el) return;

  const text = el.value;
  const title = inferTitleFromPrompt(text);
  const items = getStore("ai_work_hub_recent");

  const next = [
    {
      title,
      text,
      time: new Date().toLocaleString("vi-VN")
    },
    ...items.filter(i => i.text !== text)
  ].slice(0, 12);

  setStore("ai_work_hub_recent", next);
}

function inferTitleFromPrompt(text) {
  const first = String(text || "")
    .split("\n")
    .find(line => line.trim().length > 0) || "Prompt";

  return first.slice(0, 80);
}

function isFavoriteSaved(title, chat) {
  const items = getStore("ai_work_hub_favorites");
  return items.some(i => i.title === title && i.chat === chat);
}

function toggleFavorite(titleId, useId, chatId, notebookId, buttonId) {
  const titleEl = document.getElementById(titleId);
  const useEl = document.getElementById(useId);
  const chatEl = document.getElementById(chatId);
  const noteEl = document.getElementById(notebookId);
  const btn = document.getElementById(buttonId);

  const title = titleEl ? titleEl.value : "Prompt yêu thích";
  const use = useEl ? useEl.value : "";
  const chat = chatEl ? chatEl.value : "";
  const notebook = noteEl ? noteEl.value : "";

  const items = getStore("ai_work_hub_favorites");
  const exists = items.some(i => i.title === title && i.chat === chat);

  const next = exists
    ? items.filter(i => !(i.title === title && i.chat === chat))
    : [
        {
          title,
          use,
          chat,
          notebook,
          time: new Date().toLocaleString("vi-VN")
        },
        ...items
      ].slice(0, 30);

  setStore("ai_work_hub_favorites", next);

  if (btn) {
    if (exists) {
      btn.classList.remove("saved");
      btn.textContent = "Lưu";
    } else {
      btn.classList.add("saved");
      btn.textContent = "Đã lưu";
    }
  }

  showFavorites();

  if (!exists) {
    alert("Đã lưu prompt vào danh sách yêu thích.");
  }
}

function showFavorites() {
  const items = getStore("ai_work_hub_favorites");
  renderShortcut("⭐ Prompt yêu thích", items, true);
}

function showRecent() {
  const items = getStore("ai_work_hub_recent");
  renderShortcut("🕘 Prompt đã copy gần đây", items, false);
}

function clearShortcutView(scroll = true) {
  if (!shortcutContainer) return;

  shortcutContainer.classList.add("hidden");
  shortcutContainer.innerHTML = "";

  if (scroll) {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }
}

function renderShortcut(title, items, isFavorite) {
  if (!shortcutContainer) return;

  shortcutContainer.classList.remove("hidden");

  if (!items.length) {
    shortcutContainer.innerHTML = `<h3>${escapeHtml(title)}</h3><p class="prompt-meta">Chưa có dữ liệu.</p>`;
    return;
  }

  const html = items.map((item, idx) => {
    const chatId = `shortcut-chat-${idx}`;
    const noteId = `shortcut-note-${idx}`;
    const chatText = item.chat || item.text || "";
    const noteText = item.notebook || item.text || "";

    return `
      <div class="shortcut-item">
        <h4>${escapeHtml(item.title || "Prompt")}</h4>
        <p class="prompt-meta">${escapeHtml(item.use || item.time || "")}</p>
        <div class="actions">
          <button class="copy-btn ChatGPT" onclick="copyTextById('${chatId}')">Copy ChatGPT/Gemini</button>
          ${noteText ? `<button class="copy-btn NotebookLM" onclick="copyTextById('${noteId}')">Copy NotebookLM</button>` : ""}
          ${isFavorite ? `<button class="favorite-btn" onclick="removeFavorite(${idx})">Bỏ lưu</button>` : ""}
        </div>
        <textarea id="${chatId}" hidden>${escapeHtml(chatText)}</textarea>
        <textarea id="${noteId}" hidden>${escapeHtml(noteText)}</textarea>
      </div>
    `;
  }).join("");

  shortcutContainer.innerHTML = `<h3>${escapeHtml(title)}</h3>${html}`;

  shortcutContainer.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function removeFavorite(index) {
  const items = getStore("ai_work_hub_favorites");
  items.splice(index, 1);
  setStore("ai_work_hub_favorites", items);

  showFavorites();
  renderTools();
}

function suggestGoalType(title) {
  const t = String(title || "").toLowerCase();

  if (t.includes("bảo vệ")) return "Bảo vệ phương án";
  if (t.includes("phản biện")) return "Phản biện phương án";
  if (t.includes("rủi ro") || t.includes("risk")) return "Phân tích rủi ro";
  if (t.includes("email")) return "Chuẩn bị email gửi khách hàng";
  if (t.includes("checklist")) return "Tạo checklist";
  if (t.includes("rfi") || t.includes("câu hỏi") || t.includes("làm rõ")) return "Tạo câu hỏi làm rõ / RFI";
  if (t.includes("action") || t.includes("biên bản")) return "Lập action list";
  if (t.includes("decision") || t.includes("gate") || t.includes("trọng tài")) return "Trình lãnh đạo ra quyết định";
  if (t.includes("tóm tắt") || t.includes("summary")) return "Tóm tắt để nắm nhanh thông tin";

  return "Báo cáo nội bộ";
}

function suggestOutputFormat(title) {
  const t = String(title || "").toLowerCase();

  if (t.includes("bảo vệ")) return "Technical defense memo";
  if (t.includes("phản biện")) return "Bảng phân tích";
  if (t.includes("trọng tài") || t.includes("decision") || t.includes("gate")) return "Decision memo";
  if (t.includes("risk")) return "Risk register";
  if (t.includes("email")) return "Email chuyên nghiệp";
  if (t.includes("checklist")) return "Checklist";
  if (t.includes("rfi") || t.includes("câu hỏi") || t.includes("làm rõ")) return "RFI / Danh sách câu hỏi làm rõ";
  if (t.includes("biên bản")) return "Biên bản họp";
  if (t.includes("action")) return "Action list";

  return "Executive summary";
}

function updateBuilderHints() {
  const hint = document.getElementById("builderHintBox");
  if (!hint) return;

  const hintData = currentBuilderPrompt?.inputGuide || {
    items: [
      "Nhập bối cảnh, dữ liệu chính, vấn đề cần xử lý, người nhận đầu ra và kết quả mong muốn.",
      "Không chỉ nhập tên việc.",
      "Nếu dữ liệu thiếu, AI sẽ hỏi lại trước khi kết luận."
    ],
    example: "Dán nội dung cần xử lý và nêu rõ muốn AI tóm tắt, phản biện, tạo checklist, tạo câu hỏi hay lập action.",
    placeholder: "Bối cảnh; dữ liệu chính; vấn đề cần xử lý; kết quả mong muốn..."
  };

  hint.innerHTML = `
    <strong>Gợi ý nhập dữ liệu:</strong>
    <ul>
      ${(hintData.items || []).map(item => `<li>${escapeHtml(item)}</li>`).join("")}
      <li><strong>Nguyên tắc:</strong> nếu thiếu dữ liệu trọng yếu, prompt sẽ yêu cầu AI hỏi lại trước khi kết luận.</li>
    </ul>
    <div class="prompt-meta"><strong>Ví dụ dữ liệu đầu vào:</strong><br>${escapeHtml(hintData.example || "")}</div>
  `;

  const inputBox = document.getElementById("builderInput");
  if (inputBox) {
    inputBox.placeholder = hintData.placeholder || "Dán dữ liệu đầu vào tại đây...";
  }
}

function getOutputInstruction(output) {
  const map = {
    "Bảng phân tích": "- Trả lời dạng bảng. Cột đề xuất: Hạng mục / Nhận định / Căn cứ / Rủi ro / Khuyến nghị.",
    "Executive summary": "- Trả lời ngắn gọn theo cấu trúc: Kết luận / Bản chất vấn đề / Ảnh hưởng / Rủi ro / Khuyến nghị.",
    "Technical defense memo": "- Viết dạng memo bảo vệ kỹ thuật. Cấu trúc: Kết luận kỹ thuật / Căn cứ lựa chọn / Kiểm tra chính / Rủi ro nếu chọn khác / Dữ liệu còn thiếu / Khuyến nghị.",
    "Decision memo": "- Viết dạng memo ra quyết định. Cấu trúc: Vấn đề / Option / Fact / Assumption / Risk / Decision gate / Khuyến nghị.",
    "Risk register": "- Trả lời dạng risk register. Cột: Risk / Cause / Impact / Probability / Severity / Mitigation / Owner / Deadline.",
    "Action list": "- Trả lời dạng action list. Cột: Việc cần làm / Owner / Deadline / Mức ưu tiên / Rủi ro nếu chậm.",
    "Email chuyên nghiệp": "- Viết thành email hoàn chỉnh. Có subject, lời mở, nội dung chính, yêu cầu hành động, deadline, lời kết.",
    "Checklist": "- Trả lời dạng checklist. Chia nhóm theo dữ liệu đầu vào / nội dung kiểm tra / tiêu chuẩn / rủi ro / điều kiện hoàn thành.",
    "RFI / Danh sách câu hỏi làm rõ": "- Trả lời dạng RFI. Cột: Nhóm vấn đề / Câu hỏi / Lý do hỏi / Ảnh hưởng nếu không trả lời / Mức ưu tiên.",
    "Biên bản họp": "- Trả lời dạng biên bản họp. Có nội dung chính, quyết định đã chốt, action list, vấn đề còn mở."
  };

  return map[output] || "- Trả lời rõ ràng, có cấu trúc, dùng được cho công việc nội bộ.";
}

function showReadme() {
  if (!shortcutContainer) return;

  shortcutContainer.classList.remove("hidden");

  shortcutContainer.innerHTML = `
    <h3>📘 Hướng dẫn sử dụng nhanh</h3>

    <div class="readme-grid">
      <div class="readme-card">
        <h4>1. Chọn đúng nhóm việc</h4>
        <ul>
          <li>Chọn phòng ban hoặc dùng ô tìm kiếm.</li>
          <li>Chọn công cụ AI phù hợp: ChatGPT/Gemini hoặc NotebookLM.</li>
          <li>NotebookLM dùng khi đã upload tài liệu nguồn.</li>
        </ul>
      </div>

      <div class="readme-card">
        <h4>2. Copy prompt nhanh</h4>
        <ul>
          <li>Mở prompt phù hợp.</li>
          <li>Bấm Copy ChatGPT/Gemini hoặc Copy NotebookLM.</li>
          <li>Dán vào công cụ AI đang dùng.</li>
        </ul>
      </div>

      <div class="readme-card">
        <h4>3. Dùng Prompt Builder</h4>
        <ul>
          <li>Dùng khi cần cá nhân hóa theo dự án/gói việc.</li>
          <li>Điền mục tiêu, định dạng đầu ra và dữ liệu đầu vào.</li>
          <li>Không chỉ nhập tên việc; cần có bối cảnh và số liệu chính.</li>
        </ul>
      </div>

      <div class="readme-card">
        <h4>4. Lưu và dùng lại</h4>
        <ul>
          <li>Bấm Lưu để đưa prompt vào danh sách yêu thích.</li>
          <li>Dùng Prompt đã copy gần đây để lấy lại prompt vừa dùng.</li>
          <li>Dữ liệu lưu trên trình duyệt hiện tại.</li>
        </ul>
      </div>

      <div class="readme-card">
        <h4>5. Nguyên tắc an toàn</h4>
        <ul>
          <li>Không đưa dữ liệu mật nếu chưa được phép.</li>
          <li>Không dùng kết quả AI như kết luận cuối nếu chưa kiểm tra.</li>
          <li>Người phụ trách chịu trách nhiệm soát lại nội dung.</li>
        </ul>
      </div>

      <div class="readme-card">
        <h4>6. Góp ý/cập nhật</h4>
        <ul>
          <li>Gửi góp ý, prompt mới hoặc lỗi cần sửa về:</li>
          <li><strong>namnh.ee@live.com</strong></li>
        </ul>
      </div>
    </div>

    <div class="readme-guide">
      <h3>🧭 Bảng hướng dẫn chọn nhanh</h3>
      <p class="prompt-meta">
        Dùng bảng này khi chưa rõ nên chọn <strong>Mục tiêu sử dụng</strong> và <strong>Định dạng đầu ra</strong> trong Prompt Builder.
      </p>
<div class="guide-note">
  <strong>Gợi ý:</strong>
  <ul>
    <li><strong>Mục tiêu sử dụng</strong> = bạn muốn AI làm việc gì.</li>
    <li><strong>Định dạng đầu ra</strong> = bạn muốn kết quả trình bày theo mẫu nào.</li>
    <li>Ví dụ: Muốn xin quyết định có theo gói thầu không → chọn <strong>“Trình lãnh đạo ra quyết định”</strong> + <strong>“Decision memo”</strong>.</li>
    <li>Ví dụ: Muốn hỏi khách hàng các điểm chưa rõ → chọn <strong>“Tạo câu hỏi làm rõ / RFI”</strong> + <strong>“RFI / Danh sách câu hỏi làm rõ”</strong>.</li>
  </ul>
</div>
      <div class="guide-table-wrap">
        <table class="guide-table">
          <thead>
            <tr>
              <th>Nhu cầu thực tế</th>
              <th>Mục tiêu sử dụng nên chọn</th>
              <th>Định dạng đầu ra nên chọn</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Muốn hiểu nhanh tài liệu/email/nội dung dài</td>
              <td>Tóm tắt để nắm nhanh thông tin</td>
              <td>Executive summary</td>
            </tr>
            <tr>
              <td>Muốn báo cáo ngắn cho sếp/nội bộ</td>
              <td>Báo cáo nội bộ</td>
              <td>Executive summary hoặc Bảng phân tích</td>
            </tr>
            <tr>
              <td>Muốn xin quyết định Go/No-go/Conditional Go</td>
              <td>Trình lãnh đạo ra quyết định</td>
              <td>Decision memo</td>
            </tr>
            <tr>
              <td>Muốn so sánh các phương án</td>
              <td>Trình lãnh đạo ra quyết định</td>
              <td>Decision memo hoặc Bảng phân tích</td>
            </tr>
            <tr>
              <td>Muốn soi rủi ro của gói thầu/dự án</td>
              <td>Phân tích rủi ro</td>
              <td>Risk register</td>
            </tr>
            <tr>
              <td>Muốn phản biện phương án của người khác</td>
              <td>Phản biện phương án</td>
              <td>Bảng phân tích</td>
            </tr>
            <tr>
              <td>Muốn bảo vệ phương án của mình</td>
              <td>Bảo vệ phương án</td>
              <td>Technical defense memo</td>
            </tr>
            <tr>
              <td>Muốn tạo danh sách câu hỏi gửi khách hàng/CĐT</td>
              <td>Tạo câu hỏi làm rõ / RFI</td>
              <td>RFI / Danh sách câu hỏi làm rõ</td>
            </tr>
            <tr>
              <td>Muốn soạn email gửi khách hàng/đối tác</td>
              <td>Chuẩn bị email gửi khách hàng</td>
              <td>Email chuyên nghiệp</td>
            </tr>
            <tr>
              <td>Muốn chia việc sau họp/sau phân tích</td>
              <td>Lập action list</td>
              <td>Action list</td>
            </tr>
            <tr>
              <td>Muốn kiểm tra đủ/thiếu trước khi làm</td>
              <td>Tạo checklist</td>
              <td>Checklist</td>
            </tr>
            <tr>
              <td>Muốn ghi lại nội dung họp</td>
              <td>Báo cáo nội bộ hoặc Lập action list</td>
              <td>Biên bản họp</td>
            </tr>
            <tr>
              <td>Không thuộc nhóm nào rõ ràng</td>
              <td>Khác</td>
              <td>Bảng phân tích hoặc Executive summary</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  shortcutContainer.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

if (searchInput) {
  searchInput.addEventListener("input", renderTools);
}

if (departmentFilter) {
  departmentFilter.addEventListener("change", () => {
    activeDepartment = departmentFilter.value;
    renderAll();
  });
}

if (platformFilter) {
  platformFilter.addEventListener("change", () => {
    activePlatform = platformFilter.value;
    renderAll();
  });
}

if (levelFilter) {
  levelFilter.addEventListener("change", renderTools);
}

initDepartmentFilter();
renderAll();
