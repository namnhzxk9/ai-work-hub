const toolsContainer = document.getElementById("toolsContainer");
const searchInput = document.getElementById("searchInput");
const departmentFilter = document.getElementById("departmentFilter");
const platformFilter = document.getElementById("platformFilter");
const levelFilter = document.getElementById("levelFilter");
const departmentTabs = document.getElementById("departmentTabs");
const platformTabs = document.getElementById("platformTabs");
const shortcutContainer = document.getElementById("shortcutContainer");
const resultSummary = document.getElementById("resultSummary");

let activeDepartment = "all";
let activePlatform = "all";
let currentBuilderPrompt = null;
let builtPromptText = "";
let currentBuilderStep = 1;
let currentDetailPrompt = null;
let workflowReturnName = "";
let TOOLS = [];
let departments = ["all"];
const promptRegistry = new Map();

const platforms = ["all", "ChatGPT", "NotebookLM", "Gemini"];

function slugify(text) {
  return String(text || "prompt").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function getPromptId(tool, prompt) {
  return slugify(`${tool.department}-${tool.tool}-${prompt.title}`);
}

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
  const visiblePromptCount = filtered.reduce((total, tool) => total + getFilteredPrompts(tool, keyword, platform, level).length, 0);

  if (resultSummary) {
    resultSummary.textContent = `${filtered.length} bộ công cụ · ${visiblePromptCount} prompt phù hợp`;
  }

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
      const promptKey = getPromptId(tool, prompt);
      const safeId = `p-${promptKey}`;
      promptRegistry.set(promptKey, { ...prompt, tool: tool.tool, department: tool.department, id: promptKey });
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
          <button class="copy-btn ChatGPT" onclick="copyTextById('${safeId}-chatgemini', '${promptKey}')">Copy ChatGPT/Gemini</button>
          <textarea id="${safeId}-chatgemini" data-prompt-key="${promptKey}" hidden>${escapeHtml(chatGeminiPrompt)}</textarea>
        `;
      } else {
        buttons += `
          <textarea id="${safeId}-chatgemini" data-prompt-key="${promptKey}" hidden>${escapeHtml(chatGeminiPrompt)}</textarea>
        `;
      }

      if ((prompt.platforms || []).includes("NotebookLM")) {
        buttons += `
          <button class="copy-btn NotebookLM" onclick="copyTextById('${safeId}-notebooklm', '${promptKey}')">Copy NotebookLM</button>
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
        <button class="detail-btn" onclick="openPromptDetail('${promptKey}')">Xem & chỉnh sửa</button>
        <button id="${safeId}-fav-btn" class="${favClass}" onclick="toggleFavorite('${safeId}-fav-title', '${safeId}-fav-use', '${safeId}-chatgemini', '${safeId}-notebooklm', '${safeId}-fav-btn')">${favText}</button>
        <textarea id="${safeId}-fav-title" hidden>${escapeHtml(prompt.title)}</textarea>
        <textarea id="${safeId}-fav-use" hidden>${escapeHtml(prompt.use)}</textarea>
      `;

      let shownPrompt = chatGeminiPrompt;
      if (activePlatform === "NotebookLM") shownPrompt = notebookPrompt;
      if (activePlatform === "Gemini") shownPrompt = geminiPrompt;

      return `
        <div class="prompt-item">
          <button class="prompt-title" onclick="togglePrompt('${safeId}')" aria-expanded="false" aria-controls="${safeId}">
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
        <div class="tool-topline"><span class="tool-glyph">${String(toolIndex + 1).padStart(2, "0")}</span><span class="prompt-total">${visiblePrompts.length} prompt <b>↗</b></span></div>
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
  if (el) {
    el.classList.toggle("open");
    const trigger = el.previousElementSibling;
    if (trigger) trigger.setAttribute("aria-expanded", String(el.classList.contains("open")));
  }
}

function openPromptDetail(promptKey, updateHash = true) {
  const prompt = promptRegistry.get(promptKey);
  if (!prompt) return;
  currentDetailPrompt = prompt;
  document.getElementById("detailTitle").textContent = prompt.title;
  document.getElementById("detailUse").textContent = prompt.use || "";
  document.getElementById("detailBadges").innerHTML = `<span class="badge">${escapeHtml(prompt.department)}</span><span class="badge level">${escapeHtml(prompt.level || "Chuẩn")}</span>${(prompt.platforms || []).map(p => `<span class="badge platform ${escapeAttr(p)}">${escapeHtml(p)}</span>`).join("")}`;
  const platform = document.getElementById("detailPlatform");
  platform.value = (prompt.platforms || []).includes("ChatGPT") || !(prompt.platforms || []).includes("NotebookLM") ? "ChatGPT" : "NotebookLM";
  platform.querySelector('option[value="NotebookLM"]').disabled = !(prompt.platforms || []).includes("NotebookLM");
  changeDetailPlatform();
  updateDetailUsage();
  renderCurrentRating();
  document.getElementById("detailWorkflowBack")?.classList.toggle("hidden-action", !workflowReturnName);
  document.getElementById("promptDetailModal").classList.remove("hidden");
  document.body.classList.add("modal-open");
  if (updateHash) history.replaceState(null, "", `${location.pathname}${location.search}#prompt=${encodeURIComponent(promptKey)}`);
}

function closePromptDetail(clearHash = true) {
  document.getElementById("promptDetailModal")?.classList.add("hidden");
  document.body.classList.remove("modal-open");
  if (clearHash && location.hash.startsWith("#prompt=")) history.replaceState(null, "", `${location.pathname}${location.search}`);
  workflowReturnName = "";
}

function getCurrentDetailText() {
  if (!currentDetailPrompt) return "";
  return document.getElementById("detailPlatform")?.value === "NotebookLM"
    ? (currentDetailPrompt.notebooklm_prompt || currentDetailPrompt.prompt || "")
    : (currentDetailPrompt.prompt || currentDetailPrompt.gemini_prompt || "");
}

function changeDetailPlatform() {
  const editor = document.getElementById("detailEditor");
  if (editor) editor.value = getCurrentDetailText();
}

function resetDetailPrompt() {
  changeDetailPlatform();
  showToast("Đã khôi phục nội dung gốc");
}

function copyDetailPrompt() {
  if (!currentDetailPrompt) return;
  copyText(document.getElementById("detailEditor")?.value || "");
  recordPromptUsage(currentDetailPrompt.id);
  saveRecentItem(currentDetailPrompt.title, document.getElementById("detailEditor")?.value || "");
  updateDetailUsage();
}

function updateDetailUsage() {
  if (!currentDetailPrompt) return;
  const data = getUsageMap()[currentDetailPrompt.id];
  const el = document.getElementById("detailUsage");
  if (el) el.textContent = data ? `Đã dùng ${data.count} lần trên thiết bị này` : "Chưa sử dụng trên thiết bị này";
}

function shareCurrentPrompt() {
  if (!currentDetailPrompt) return;
  const url = `${location.origin}${location.pathname}${location.search}#prompt=${encodeURIComponent(currentDetailPrompt.id)}`;
  copyText(url);
  showToast("Đã sao chép liên kết trực tiếp");
}

function openBuilderFromDetail() {
  if (!currentDetailPrompt) return;
  const prompt = currentDetailPrompt;
  closePromptDetail(false);
  openBuilderWithPrompt({ title: prompt.title, use: prompt.use, chatGemini: prompt.prompt || prompt.gemini_prompt || "", notebook: prompt.notebooklm_prompt || prompt.prompt || "", inputGuide: prompt.input_guide || null });
}

function copyTextById(id, promptKey = "") {
  const el = document.getElementById(id);
  if (!el) return;

  copyText(el.value);
  saveRecentFromTextarea(id);
  recordPromptUsage(promptKey || el.dataset.promptKey || "unknown");
}

function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast("Đã sao chép prompt vào clipboard");
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

  showToast("Đã sao chép prompt vào clipboard");
}

let toastTimer;
function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function getUsageMap() {
  try { return JSON.parse(localStorage.getItem("ai_work_hub_usage") || "{}"); } catch { return {}; }
}

function recordPromptUsage(promptKey) {
  const usage = getUsageMap();
  usage[promptKey] = { count: (usage[promptKey]?.count || 0) + 1, lastUsed: new Date().toISOString() };
  localStorage.setItem("ai_work_hub_usage", JSON.stringify(usage));
  updateUsageOverview();
}

function updateUsageOverview() {
  const total = Object.values(getUsageMap()).reduce((sum, item) => sum + (item.count || 0), 0);
  const el = document.getElementById("usageCount");
  if (el) el.textContent = String(total).padStart(2, "0");
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

  openBuilderWithPrompt({
    title,
    use,
    chatGemini: chatEl ? chatEl.value : "",
    notebook: noteEl ? noteEl.value : "",
    inputGuide
  });
}

function openBuilderWithPrompt(promptData) {
  currentBuilderPrompt = promptData;

  const builderSubtitle = document.getElementById("builderSubtitle");
  const builderProject = document.getElementById("builderProject");
  const builderClient = document.getElementById("builderClient");
  const builderGoalType = document.getElementById("builderGoalType");
  const builderGoalDetail = document.getElementById("builderGoalDetail");
  const builderOutput = document.getElementById("builderOutput");
  const builderInput = document.getElementById("builderInput");
  const builderOutputBox = document.getElementById("builderOutputBox");
  const builderModal = document.getElementById("builderModal");

  if (builderSubtitle) builderSubtitle.textContent = `${promptData.title} · ${promptData.use || ""}`;
  if (builderProject) builderProject.value = "";
  if (builderClient) builderClient.value = "";
  if (builderGoalType) builderGoalType.value = suggestGoalType(promptData.title);
  if (builderGoalDetail) builderGoalDetail.value = "";
  if (builderOutput) builderOutput.value = suggestOutputFormat(promptData.title);
  if (builderInput) builderInput.value = "";
  if (builderOutputBox) builderOutputBox.textContent = "Prompt đã tạo sẽ hiển thị tại đây.";

  updateBuilderHints();
  builtPromptText = "";
  currentBuilderStep = 1;
  renderBuilderStep();

  if (builderModal) {
    builderModal.classList.remove("hidden");
    document.body.classList.add("modal-open");
  }
}

function closeBuilder() {
  const builderModal = document.getElementById("builderModal");
  if (builderModal) builderModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

function changeBuilderStep(direction) {
  if (direction > 0 && currentBuilderStep === 1) {
    const project = document.getElementById("builderProject")?.value.trim();
    const goal = document.getElementById("builderGoalDetail")?.value.trim();
    if (!project && !goal) { showToast("Hãy nhập tên dự án hoặc mục tiêu sử dụng"); return; }
  }
  if (direction > 0 && currentBuilderStep === 3) generateBuiltPrompt();
  currentBuilderStep = Math.max(1, Math.min(4, currentBuilderStep + direction));
  renderBuilderStep();
}

function renderBuilderStep() {
  document.querySelectorAll("[data-builder-step]").forEach(el => el.classList.toggle("active", Number(el.dataset.builderStep) === currentBuilderStep));
  document.querySelectorAll("[data-step-dot]").forEach(el => {
    const step = Number(el.dataset.stepDot);
    el.classList.toggle("active", step === currentBuilderStep);
    el.classList.toggle("done", step < currentBuilderStep);
  });
  const back = document.getElementById("builderBack");
  const next = document.getElementById("builderNext");
  const copy = document.getElementById("builderCopy");
  if (back) back.style.visibility = currentBuilderStep === 1 ? "hidden" : "visible";
  if (next) next.classList.toggle("hidden-action", currentBuilderStep === 4);
  if (copy) copy.classList.toggle("hidden-action", currentBuilderStep !== 4);
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
  renderPromptQuality({ project, client, goal, input, output, detail });
}

function renderPromptQuality(values) {
  const checks = [
    [Boolean(values.project), "Có dự án/gói việc"],
    [Boolean(values.goal), "Có mục tiêu rõ ràng"],
    [Boolean(values.input && values.input.length >= 80), "Dữ liệu đầu vào đủ chi tiết"],
    [Boolean(values.output), "Đã chọn định dạng đầu ra"],
    [Boolean(values.detail), "Đã chọn mức độ phân tích"]
  ];
  const score = checks.filter(([ok]) => ok).length * 20;
  const el = document.getElementById("builderQuality");
  if (!el) return;
  el.innerHTML = `<div class="score-head"><strong>Chất lượng prompt: ${score}/100</strong><span>${score >= 80 ? "Sẵn sàng sử dụng" : "Nên bổ sung dữ liệu"}</span></div><div class="score-track"><i style="width:${score}%"></i></div><div class="score-checks">${checks.map(([ok, label]) => `<span class="${ok ? "ok" : "missing"}">${ok ? "✓" : "○"} ${label}</span>`).join("")}</div>`;
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

function saveRecentItem(title, text) {
  const items = getStore("ai_work_hub_recent");
  setStore("ai_work_hub_recent", [{ title, text, time: new Date().toLocaleString("vi-VN") }, ...items.filter(i => i.text !== text)].slice(0, 12));
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
    showToast("Đã thêm vào danh sách yêu thích");
  }
}

function resetFilters() {
  activeDepartment = "all";
  activePlatform = "all";
  if (searchInput) searchInput.value = "";
  if (departmentFilter) departmentFilter.value = "all";
  if (platformFilter) platformFilter.value = "all";
  if (levelFilter) levelFilter.value = "all";
  renderAll();
  showToast("Đã xóa toàn bộ bộ lọc");
}

function initWorkspaceOverview() {
  const promptTotal = TOOLS.reduce((total, tool) => total + (tool.prompts || []).length, 0);
  const uniqueDepartments = new Set(TOOLS.map(tool => tool.department)).size;
  const values = { toolCount: TOOLS.length, promptCount: promptTotal, departmentCount: uniqueDepartments };
  Object.entries(values).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value).padStart(2, "0");
  });
}

function initTheme() {
  const toggle = document.getElementById("themeToggle");
  const savedTheme = localStorage.getItem("ai_work_hub_theme");
  if (savedTheme === "dark") document.body.classList.add("dark");
  if (!toggle) return;
  toggle.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    localStorage.setItem("ai_work_hub_theme", document.body.classList.contains("dark") ? "dark" : "light");
  });
}

function showFavorites() {
  const items = getStore("ai_work_hub_favorites");
  renderShortcut("⭐ Prompt yêu thích", items, true);
}

function showRecent() {
  const items = getStore("ai_work_hub_recent");
  renderShortcut("🕘 Prompt đã copy gần đây", items, false);
}

function showUsageStats() {
  if (!shortcutContainer) return;
  const usage = getUsageMap();
  const rows = [...promptRegistry.values()].map(prompt => ({ ...prompt, ...(usage[prompt.id] || { count: 0 }) })).filter(item => item.count > 0).sort((a, b) => b.count - a.count);
  const total = rows.reduce((sum, item) => sum + item.count, 0);
  shortcutContainer.classList.remove("hidden");
  shortcutContainer.innerHTML = `<div class="stats-head"><div><div class="eyebrow">LOCAL ANALYTICS</div><h3>Thống kê sử dụng trên thiết bị</h3></div><strong>${total}<small> lượt sao chép</small></strong></div>${rows.length ? `<div class="usage-list">${rows.slice(0, 10).map((item, index) => `<button onclick="openPromptDetail('${item.id}')"><span>${index + 1}</span><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.department)}</small></div><b>${item.count}</b></button>`).join("")}</div>` : `<p class="prompt-meta">Chưa có dữ liệu. Thống kê sẽ xuất hiện sau khi cậu chủ sao chép prompt.</p>`}<p class="privacy-note">Dữ liệu này chỉ lưu trong trình duyệt hiện tại, không được gửi ra ngoài.</p>`;
  shortcutContainer.scrollIntoView({ behavior: "smooth", block: "start" });
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

document.addEventListener("keydown", event => {
  if (event.key === "Escape") { closeBuilder(); closePromptDetail(); closeOsModal(); closeCommandPalette(); }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); document.getElementById("commandPalette")?.classList.contains("hidden") ? openCommandPalette() : closeCommandPalette(); return; }
  if (event.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
    event.preventDefault();
    searchInput?.focus();
  }
});

document.getElementById("builderModal")?.addEventListener("click", event => {
  if (event.target.id === "builderModal") closeBuilder();
});

document.getElementById("promptDetailModal")?.addEventListener("click", event => {
  if (event.target.id === "promptDetailModal") closePromptDetail();
});

document.getElementById("osModal")?.addEventListener("click", event => { if (event.target.id === "osModal") closeOsModal(); });
document.getElementById("commandPalette")?.addEventListener("click", event => { if (event.target.id === "commandPalette") closeCommandPalette(); });
document.getElementById("paletteInput")?.addEventListener("input", event => renderPaletteResults(event.target.value));
document.getElementById("paletteInput")?.addEventListener("keydown", event => {
  const buttons=[...document.querySelectorAll("#paletteResults button")];
  if(event.key==="ArrowDown"||event.key==="ArrowUp"){event.preventDefault();paletteSelection=Math.max(0,Math.min(buttons.length-1,paletteSelection+(event.key==="ArrowDown"?1:-1)));buttons.forEach((button,index)=>button.classList.toggle("selected",index===paletteSelection));buttons[paletteSelection]?.scrollIntoView({block:"nearest"});}
  if(event.key==="Enter"){event.preventDefault();runPaletteSelection();}
});
document.getElementById("paletteResults")?.addEventListener("click", event => { const button=event.target.closest("button[data-action]");if(button){closeCommandPalette();new Function(button.dataset.action)();} });

async function initializeApp() {
  try {
    const response = await fetch(`data.json?v=4.0.0`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    TOOLS = await response.json();
    const customPrompts = getStore("ai_work_hub_custom_prompts");
    if (customPrompts.length) TOOLS.unshift({ department:"Cá nhân", tool:"Prompt cá nhân", description:"Các prompt tùy chỉnh được lưu trên thiết bị này.", platforms:["ChatGPT","Gemini"], prompts:customPrompts });
    departments = ["all", ...Array.from(new Set(TOOLS.map(item => item.department)))];
    initDepartmentFilter();
    initWorkspaceOverview();
    updateUsageOverview();
    initTheme();
    renderAll();
    const deepLink = location.hash.match(/^#prompt=(.+)$/);
    if (deepLink) openPromptDetail(decodeURIComponent(deepLink[1]), false);
  } catch (error) {
    toolsContainer.innerHTML = `<div class="empty"><strong>Không thể tải thư viện prompt.</strong><br>Hãy mở website qua GitHub Pages hoặc một máy chủ web cục bộ, không mở trực tiếp bằng file.</div>`;
    if (resultSummary) resultSummary.textContent = "Lỗi tải dữ liệu";
    console.error("AI Work Hub data loading failed", error);
  }
}

function initNeuralNetwork() {
  const canvas = document.getElementById("neuralNetwork");
  const hero = canvas?.closest(".hero");
  if (!canvas || !hero) return;

  const ctx = canvas.getContext("2d");
  let reduceMotion = getMotionMode() === "off" || (getMotionMode() === "auto" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  let width = 0;
  let height = 0;
  let nodes = [];
  let links = [];
  let packets = [];
  let frame = 0;
  let running = true;
  let mouse = { x: -1000, y: -1000 };

  function buildNetwork() {
    const rect = hero.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = width < 760 ? 25 : Math.min(64, Math.round(width / 24));
    nodes = Array.from({ length: count }, (_, index) => ({
      x: Math.random() * width,
      y: 40 + Math.random() * (height - 80),
      vx: (Math.random() - .5) * .11,
      vy: (Math.random() - .5) * .09,
      radius: index % 11 === 0 ? 2.4 : .8 + Math.random() * 1.1,
      energy: Math.random(),
      phase: Math.random() * Math.PI * 2
    }));

    links = [];
    const maxDistance = width < 760 ? 135 : 190;
    nodes.forEach((node, i) => nodes.slice(i + 1).forEach((other, offset) => {
      const j = i + offset + 1;
      const distance = Math.hypot(node.x - other.x, node.y - other.y);
      if (distance < maxDistance && links.filter(link => link.a === i || link.b === i).length < 4) {
        links.push({ a: i, b: j, distance, pulse: Math.random() * Math.PI * 2 });
      }
    }));

    const packetCount = width < 760 ? 7 : 15;
    packets = Array.from({ length: packetCount }, (_, index) => createPacket(index / packetCount));
  }

  function createPacket(progress = Math.random()) {
    const linkIndex = Math.floor(Math.random() * Math.max(links.length, 1));
    return { linkIndex, progress, speed: .0012 + Math.random() * .0024, size: 1.2 + Math.random() * 1.4, hue: Math.random() > .35 ? "violet" : "cyan" };
  }

  function draw(time = 0) {
    ctx.clearRect(0, 0, width, height);

    nodes.forEach(node => {
      if (!reduceMotion) {
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < -20 || node.x > width + 20) node.vx *= -1;
        if (node.y < 10 || node.y > height - 10) node.vy *= -1;
        const mouseDistance = Math.hypot(node.x - mouse.x, node.y - mouse.y);
        if (mouseDistance < 150) {
          node.x += (node.x - mouse.x) * .002;
          node.y += (node.y - mouse.y) * .002;
        }
      }
    });

    links.forEach(link => {
      const a = nodes[link.a];
      const b = nodes[link.b];
      if (!a || !b) return;
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const alpha = Math.max(0, 1 - distance / 220) * .22;
      const gradient = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      gradient.addColorStop(0, `rgba(112,87,245,${alpha * (.55 + a.energy * .4)})`);
      gradient.addColorStop(.5, `rgba(81,155,232,${alpha})`);
      gradient.addColorStop(1, `rgba(78,214,217,${alpha * (.55 + b.energy * .4)})`);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = .65;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    });

    nodes.forEach(node => {
      const glow = .55 + Math.sin(time * .001 + node.phase) * .25;
      ctx.shadowBlur = node.radius > 2 ? 18 : 8;
      ctx.shadowColor = node.energy > .55 ? "#8c74ff" : "#49cbd8";
      ctx.fillStyle = node.energy > .55 ? `rgba(158,137,255,${glow})` : `rgba(86,211,220,${glow * .8})`;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    packets.forEach((packet, index) => {
      const link = links[packet.linkIndex];
      if (!link) return;
      const a = nodes[link.a];
      const b = nodes[link.b];
      packet.progress += reduceMotion ? 0 : packet.speed;
      if (packet.progress >= 1) packets[index] = createPacket(0);
      const x = a.x + (b.x - a.x) * packet.progress;
      const y = a.y + (b.y - a.y) * packet.progress;
      const color = packet.hue === "violet" ? "#c2b7ff" : "#8ef7f2";
      ctx.shadowBlur = 14;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, packet.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  }

  function animate(time) {
    draw(time);
    if (!reduceMotion && running) frame = requestAnimationFrame(animate);
  }

  hero.addEventListener("pointermove", event => {
    const rect = hero.getBoundingClientRect();
    mouse = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  });
  hero.addEventListener("pointerleave", () => { mouse = { x: -1000, y: -1000 }; });
  new ResizeObserver(() => { cancelAnimationFrame(frame); buildNetwork(); animate(performance.now()); }).observe(hero);
  new IntersectionObserver(entries => {
    running = entries[0].isIntersecting;
    cancelAnimationFrame(frame);
    if (running && !reduceMotion) frame = requestAnimationFrame(animate);
  }, { threshold: .05 }).observe(hero);

  window.addEventListener("motionmodechange", () => {
    reduceMotion = getMotionMode() === "off" || (getMotionMode() === "auto" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    cancelAnimationFrame(frame);
    draw(performance.now());
    if (!reduceMotion && running) frame = requestAnimationFrame(animate);
  });

  buildNetwork();
  animate(performance.now());
}

function getMotionMode() {
  return localStorage.getItem("ai_work_hub_motion") || "auto";
}

function renderMotionMode() {
  const button = document.getElementById("motionToggle");
  if (!button) return;
  const mode = getMotionMode();
  const labels = { auto: "Auto", on: "On", off: "Off" };
  button.innerHTML = `<span>${mode === "off" ? "○" : "◉"}</span> Motion: ${labels[mode]}`;
  button.classList.toggle("active", mode === "on");
}

function cycleMotionMode() {
  const modes = ["auto", "on", "off"];
  const next = modes[(modes.indexOf(getMotionMode()) + 1) % modes.length];
  localStorage.setItem("ai_work_hub_motion", next);
  renderMotionMode();
  window.dispatchEvent(new Event("motionmodechange"));
  showToast(`Chuyển động: ${next === "on" ? "Luôn bật" : next === "off" ? "Tắt" : "Theo hệ thống"}`);
}

function openOsModal(title, subtitle, html, eyebrow = "AI WORK OS") {
  document.getElementById("osModalTitle").textContent = title;
  document.getElementById("osModalSubtitle").textContent = subtitle || "";
  document.getElementById("osModalEyebrow").textContent = eyebrow;
  document.getElementById("osModalBody").innerHTML = html;
  document.getElementById("osModal").classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeOsModal() {
  document.getElementById("osModal")?.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

function openTaskRouter() {
  openOsModal("AI Task Router", "Mô tả việc cần làm. Hệ thống sẽ chọn workflow, công cụ AI và prompt phù hợp nhất.", `
    <div class="router-shell">
      <div class="router-input"><label>Bạn muốn hoàn thành việc gì?</label><textarea id="routerQuery" rows="5" placeholder="Ví dụ: Tôi vừa nhận hồ sơ mời thầu nhà máy, cần tìm rủi ro và báo cáo lãnh đạo trước chiều mai."></textarea><div class="router-options"><select id="routerUrgency"><option value="normal">Tiêu chuẩn</option><option value="fast">Cần kết quả nhanh</option><option value="deep">Phân tích chuyên sâu</option></select><button class="builder-btn" onclick="runTaskRouter()">Phân tích nhiệm vụ ✦</button></div></div>
      <div id="routerResults" class="router-results"><div class="router-empty"><span>✦</span><strong>Task intelligence đang chờ</strong><p>Nhập mục tiêu bằng ngôn ngữ tự nhiên để bắt đầu.</p></div></div>
    </div>`, "INTENT → WORKFLOW");
  setTimeout(() => document.getElementById("routerQuery")?.focus(), 50);
}

function runTaskRouter() {
  const query = document.getElementById("routerQuery")?.value.trim() || "";
  const urgency = document.getElementById("routerUrgency")?.value || "normal";
  if (query.length < 12) { showToast("Hãy mô tả nhiệm vụ chi tiết hơn"); return; }
  const words = normalize(query).split(/\s+/).filter(word => word.length > 2);
  const signals = [
    { name: "Đấu thầu", terms: ["thầu", "hồ sơ", "rfq", "rfp", "báo giá", "go", "no-go"] },
    { name: "Thiết kế", terms: ["thiết kế", "kỹ thuật", "pccc", "cáp", "điện", "bản vẽ", "spec"] },
    { name: "Báo cáo", terms: ["báo cáo", "lãnh đạo", "tóm tắt", "executive", "tuần"] },
    { name: "Rủi ro", terms: ["rủi ro", "risk", "phản biện", "bảo vệ", "quyết định"] },
    { name: "Email", terms: ["email", "khách hàng", "nhắc", "phản hồi", "gửi"] }
  ];
  const intent = signals.map(group => ({ ...group, score: group.terms.filter(term => normalize(query).includes(term)).length })).sort((a,b) => b.score - a.score)[0];
  const ranked = [...promptRegistry.values()].map(prompt => {
    const haystack = normalize(`${prompt.title} ${prompt.use} ${prompt.department} ${prompt.tool || ""}`);
    let score = words.reduce((sum, word) => sum + (haystack.includes(word) ? 2 : 0), 0);
    if (intent?.score && haystack.includes(normalize(intent.name))) score += 5;
    if (urgency === "fast" && prompt.level === "Nhanh") score += 3;
    if (urgency === "deep" && prompt.level === "Chuyên sâu") score += 3;
    return { prompt, score };
  }).sort((a,b) => b.score - a.score).slice(0, 4);
  const sourceHeavy = /tài liệu|nguồn|hồ sơ|file|pdf|upload/i.test(query);
  const platform = sourceHeavy ? "NotebookLM + ChatGPT" : "ChatGPT / Gemini";
  document.getElementById("routerResults").innerHTML = `
    <div class="router-decision"><div><small>NHẬN DIỆN Ý ĐỊNH</small><strong>${escapeHtml(intent?.score ? intent.name : "Công việc tổng hợp")}</strong></div><div><small>CÔNG CỤ KHUYẾN NGHỊ</small><strong>${platform}</strong></div><div><small>CHẾ ĐỘ</small><strong>${urgency === "deep" ? "Chuyên sâu" : urgency === "fast" ? "Tốc độ" : "Tiêu chuẩn"}</strong></div></div>
    <div class="router-warning"><b>Trước khi bắt đầu:</b> Chuẩn bị bối cảnh, dữ liệu chính, deadline và người nhận đầu ra. Nếu dùng tài liệu nội bộ, hãy kiểm tra chính sách bảo mật.</div>
    <h4>Prompt phù hợp nhất</h4><div class="router-cards">${ranked.map(({prompt},index) => `<button onclick="openRoutedPrompt('${prompt.id}')"><span>0${index+1}</span><div><b>${escapeHtml(prompt.title)}</b><small>${escapeHtml(prompt.department)} · ${escapeHtml(prompt.level || "Chuẩn")}</small></div><i>→</i></button>`).join("")}</div>
    <div class="router-next"><button class="text-btn" onclick="openWorkflowCenter('${escapeAttr(intent?.name || "")}' )">Tạo workflow nhiều bước</button><button class="builder-btn" onclick="saveRouterAsProject()">Lưu thành dự án</button></div>`;
  sessionStorage.setItem("ai_work_hub_last_task", JSON.stringify({ query, intent: intent?.name || "Tổng hợp", promptIds: ranked.map(item => item.prompt.id) }));
}

function openRoutedPrompt(id) {
  closeOsModal();
  openPromptDetail(id);
}

function saveRouterAsProject() {
  const task = JSON.parse(sessionStorage.getItem("ai_work_hub_last_task") || "null");
  if (!task) return;
  const projects = getStore("ai_work_hub_projects");
  projects.unshift({ id: `prj-${Date.now()}`, name: task.query.slice(0, 60), client: "", status: "Đang thực hiện", createdAt: new Date().toISOString(), notes: task.query, promptIds: task.promptIds || [] });
  setStore("ai_work_hub_projects", projects.slice(0, 30));
  showToast("Đã tạo Project Workspace từ nhiệm vụ");
  openWorkspace();
}

function openWorkspace(selectedId = "") {
  const projects = getStore("ai_work_hub_projects");
  const selected = projects.find(project => project.id === selectedId) || projects[0];
  openOsModal("Project Workspace", "Tổ chức prompt, ghi chú và workflow theo từng dự án trên thiết bị này.", `
    <div class="workspace-layout"><aside class="project-list"><button class="new-project-btn" onclick="showProjectForm()">＋ Dự án mới</button><div id="projectItems">${projects.length ? projects.map(project => `<button class="${selected?.id === project.id ? "active" : ""}" onclick="openWorkspace('${project.id}')"><span>${escapeHtml(project.name.slice(0,2).toUpperCase())}</span><div><b>${escapeHtml(project.name)}</b><small>${escapeHtml(project.status || "Đang thực hiện")}</small></div></button>`).join("") : `<p>Chưa có dự án.</p>`}</div></aside><section id="projectDetail" class="project-detail">${selected ? renderProjectDetail(selected) : renderProjectForm()}</section></div>`, "LOCAL-FIRST PROJECTS");
}

function renderProjectForm() {
  return `<div class="project-form"><div class="workspace-empty-icon">▦</div><h3>Tạo Project Workspace</h3><p>Gom prompt, workflow và quyết định vào cùng một không gian.</p><label>Tên dự án<input id="projectName" placeholder="Ví dụ: Kyocera CMOS"/></label><label>Khách hàng / đối tác<input id="projectClient" placeholder="Tên khách hàng"/></label><label>Mục tiêu<textarea id="projectNotes" rows="4" placeholder="Mục tiêu, deadline, đầu ra cần hoàn thành..."></textarea></label><button class="builder-btn" onclick="createProject()">Tạo workspace</button></div>`;
}

function showProjectForm() { document.getElementById("projectDetail").innerHTML = renderProjectForm(); }

function createProject() {
  const name = document.getElementById("projectName")?.value.trim();
  if (!name) { showToast("Hãy nhập tên dự án"); return; }
  const projects = getStore("ai_work_hub_projects");
  const project = { id:`prj-${Date.now()}`, name, client:document.getElementById("projectClient")?.value.trim() || "", notes:document.getElementById("projectNotes")?.value.trim() || "", status:"Đang thực hiện", createdAt:new Date().toISOString(), promptIds:[] };
  projects.unshift(project); setStore("ai_work_hub_projects", projects); openWorkspace(project.id); showToast("Đã tạo project workspace");
}

function pinCurrentPromptToProject() {
  if (!currentDetailPrompt) return;
  const projects = getStore("ai_work_hub_projects");
  if (!projects.length) { closePromptDetail(false); openWorkspace(); showToast("Hãy tạo project trước khi ghim prompt"); return; }
  const options = projects.map(project => `<button class="project-pick" onclick="confirmPinPrompt('${project.id}')"><span>${escapeHtml(project.name.slice(0,2).toUpperCase())}</span><div><b>${escapeHtml(project.name)}</b><small>${escapeHtml(project.client||"Dự án nội bộ")}</small></div><i>＋</i></button>`).join("");
  const promptId = currentDetailPrompt.id;
  sessionStorage.setItem("ai_work_hub_pin_prompt", promptId);
  closePromptDetail(false);
  openOsModal("Ghim prompt vào project","Chọn không gian làm việc sẽ sử dụng prompt này.",`<div class="project-picker">${options}</div>`,`PROMPT → PROJECT`);
}

function confirmPinPrompt(projectId) {
  const promptId = sessionStorage.getItem("ai_work_hub_pin_prompt");
  const projects = getStore("ai_work_hub_projects"); const project=projects.find(item=>item.id===projectId); if(!project||!promptId)return;
  project.promptIds=[...new Set([...(project.promptIds||[]),promptId])]; setStore("ai_work_hub_projects",projects); showToast("Đã ghim prompt vào project"); openWorkspace(projectId);
}

function renderProjectDetail(project) {
  const prompts = (project.promptIds || []).map(id => promptRegistry.get(id)).filter(Boolean);
  return `<div class="project-hero"><div><span>${escapeHtml(project.status)}</span><h3>${escapeHtml(project.name)}</h3><p>${escapeHtml(project.client || "Dự án nội bộ")}</p></div><div class="project-actions"><button class="text-btn" onclick="exportProject('${project.id}')">Xuất project ↓</button><button class="danger-btn" onclick="requestDeleteProject('${project.id}')">Xóa project</button></div></div><div class="project-grid"><div><small>MỤC TIÊU & GHI CHÚ</small><p>${escapeHtml(project.notes || "Chưa có ghi chú.")}</p></div><div><small>PROMPT ĐÃ GHIM</small><strong>${prompts.length}</strong></div><div><small>NGÀY TẠO</small><strong>${new Date(project.createdAt).toLocaleDateString("vi-VN")}</strong></div></div><h4>Prompt trong dự án</h4><div class="project-prompts">${prompts.length ? prompts.map(prompt => `<button onclick="openRoutedPrompt('${prompt.id}')"><span>✦</span><div><b>${escapeHtml(prompt.title)}</b><small>${escapeHtml(prompt.department)}</small></div><i>→</i></button>`).join("") : `<p>Chưa có prompt. Mở một prompt và chọn ghim vào dự án.</p>`}</div><div class="smart-next">${renderSmartRecommendations()}</div>`;
}

function renderSmartRecommendations() {
  const usage = getUsageMap();
  const used = Object.entries(usage).sort((a,b) => (b[1].count||0)-(a[1].count||0));
  const top = used[0] ? promptRegistry.get(used[0][0]) : null;
  const suggestions = [...promptRegistry.values()].filter(prompt => !usage[prompt.id] && (!top || prompt.department === top.department)).slice(0,3);
  return `<small>SMART NEXT</small><h4>Có thể bạn cần tiếp theo</h4><div>${suggestions.map(prompt => `<button onclick="openRoutedPrompt('${prompt.id}')">${escapeHtml(prompt.title)} <b>→</b></button>`).join("") || `<p>Hãy sử dụng thêm prompt để nhận gợi ý cá nhân hóa.</p>`}</div>`;
}

function exportProject(id) {
  const project = getStore("ai_work_hub_projects").find(item => item.id === id); if (!project) return;
  downloadFile(`${slugify(project.name)}.json`, JSON.stringify(project,null,2), "application/json");
}

function requestDeleteProject(id) {
  const project = getStore("ai_work_hub_projects").find(item => item.id === id);
  if (!project) return;
  openOsModal("Xóa project?", "Hành động này chỉ ảnh hưởng dữ liệu lưu trên trình duyệt hiện tại.", `<div class="delete-confirm"><div class="delete-icon">!</div><h3>${escapeHtml(project.name)}</h3><p>Project, danh sách prompt đã ghim và ghi chú bên trong sẽ bị xóa. Thao tác này không thể hoàn tác.</p><div><button class="text-btn" onclick="openWorkspace('${project.id}')">Hủy</button><button class="danger-btn solid" onclick="deleteProject('${project.id}')">Xác nhận xóa</button></div></div>`, "CONFIRM DESTRUCTIVE ACTION");
}

function deleteProject(id) {
  const projects = getStore("ai_work_hub_projects").filter(item => item.id !== id);
  setStore("ai_work_hub_projects", projects);
  showToast("Đã xóa project khỏi thiết bị");
  openWorkspace(projects[0]?.id || "");
}

const WORKFLOW_DEFINITIONS = {
  "Đấu thầu": ["Tóm tắt scope / volume / deadline","Tách yêu cầu kỹ thuật / thương mại","Bảng missing information","Đánh giá Go / No-go / Conditional Go","Risk register gói thầu"],
  "Thiết kế": ["Tóm tắt yêu cầu thiết kế","Checklist đầu vào thiết kế","Phân tích phương án kỹ thuật","Review rủi ro thiết kế"],
  "Báo cáo": ["Tóm tắt thông tin gửi lãnh đạo","Executive summary","Báo cáo rủi ro","Lập action list sau họp"],
  "Rủi ro": ["Fact / Assumption / Risk","Giả sử phương án thất bại","Xác định decision gate","Workflow 3 bước: bảo vệ / phản biện / trọng tài"]
};

function openWorkflowCenter(preferred = "") {
  const names = Object.keys(WORKFLOW_DEFINITIONS); const active = names.includes(preferred) ? preferred : "Đấu thầu";
  const state = getStore("ai_work_hub_workflow_state");
  openOsModal("Workflow Center", "Kết nối nhiều prompt thành một quy trình công việc có thứ tự và trạng thái.", `<div class="workflow-nav"><button class="back-btn" onclick="closeOsModal()">← Về Work OS</button><span>Chọn nhóm quy trình và đánh dấu từng bước khi hoàn thành.</span></div><div class="workflow-tabs">${names.map(name => `<button data-workflow-tab="${name}" class="${name===active?"active":""}" onclick="renderWorkflow('${name}')">${name}</button>`).join("")}</div><div id="workflowCanvas"></div>`, "MULTI-STEP AUTOMATION");
  renderWorkflow(active, state);
}

function renderWorkflow(name, state = getStore("ai_work_hub_workflow_state")) {
  const titles = WORKFLOW_DEFINITIONS[name] || WORKFLOW_DEFINITIONS["Đấu thầu"];
  const completed = state.find(item => item.name === name)?.completed || [];
  const steps = titles.map(title => [...promptRegistry.values()].find(prompt => normalize(prompt.title).includes(normalize(title))) || [...promptRegistry.values()].find(prompt => normalize(prompt.title).includes(normalize(title.split(" ").slice(0,2).join(" "))))).filter(Boolean);
  document.querySelectorAll("[data-workflow-tab]").forEach(button => button.classList.toggle("active", button.dataset.workflowTab === name));
  document.getElementById("workflowCanvas").innerHTML = `<div class="workflow-head"><div><small>WORKFLOW</small><h3>${name}</h3></div><span>${completed.length}/${steps.length} hoàn thành</span></div><div class="workflow-steps">${steps.map((prompt,index) => `<div class="${completed.includes(index)?"done":""}"><button class="step-check" onclick="toggleWorkflowStep('${name}',${index})">${completed.includes(index)?"✓":index+1}</button><button class="step-main" onclick="openWorkflowPrompt('${prompt.id}','${name}')"><small>${escapeHtml(prompt.department)} · ${escapeHtml(prompt.level||"Chuẩn")}</small><b>${escapeHtml(prompt.title)}</b><span>${escapeHtml(prompt.use||"")}</span></button><i>→</i></div>`).join("")}</div><div class="workflow-footer"><button class="text-btn" onclick="closeOsModal()">← Đóng workflow</button><small>Nhấn số thứ tự để đánh dấu hoàn thành · Nhấn nội dung để mở prompt</small></div>`;
}

function openWorkflowPrompt(promptId, workflowName) {
  workflowReturnName = workflowName;
  closeOsModal();
  openPromptDetail(promptId);
}

function returnToWorkflowCenter() {
  const name = workflowReturnName;
  closePromptDetail(false);
  workflowReturnName = "";
  openWorkflowCenter(name);
}

function toggleWorkflowStep(name,index) {
  const state = getStore("ai_work_hub_workflow_state"); let item = state.find(entry => entry.name===name);
  if (!item) { item={name,completed:[]}; state.push(item); }
  item.completed = item.completed.includes(index) ? item.completed.filter(i=>i!==index) : [...item.completed,index];
  setStore("ai_work_hub_workflow_state",state); renderWorkflow(name,state);
}

let paletteSelection = 0;
function openCommandPalette() {
  document.getElementById("commandPalette").classList.remove("hidden"); document.body.classList.add("modal-open");
  const input=document.getElementById("paletteInput"); input.value=""; renderPaletteResults(""); setTimeout(()=>input.focus(),30);
}
function closeCommandPalette(){document.getElementById("commandPalette")?.classList.add("hidden");document.body.classList.remove("modal-open");}
function getPaletteItems(query="") {
  const commands=[{title:"Mở AI Task Router",meta:"Command",action:"openTaskRouter()",icon:"✦"},{title:"Mở Project Workspace",meta:"Command",action:"openWorkspace()",icon:"▦"},{title:"Mở Workflow Center",meta:"Command",action:"openWorkflowCenter()",icon:"⌁"},{title:"Xem thống kê sử dụng",meta:"Command",action:"closeCommandPalette();showUsageStats();location.hash='library'",icon:"↗"},{title:"Quản trị nội dung",meta:"Command",action:"openAdminCenter()",icon:"⚙"}];
  const prompts=[...promptRegistry.values()].map(prompt=>({title:prompt.title,meta:`${prompt.department} · ${prompt.level||"Chuẩn"}`,action:`openRoutedPrompt('${prompt.id}')`,icon:"◇"}));
  return [...commands,...prompts].filter(item=>normalize(`${item.title} ${item.meta}`).includes(normalize(query))).slice(0,9);
}
function renderPaletteResults(query){const items=getPaletteItems(query);paletteSelection=0;document.getElementById("paletteResults").innerHTML=items.map((item,i)=>`<button class="${i===0?"selected":""}" data-action="${escapeAttr(item.action)}"><span>${item.icon}</span><div><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.meta)}</small></div><kbd>↵</kbd></button>`).join("")||`<p>Không tìm thấy lệnh hoặc prompt.</p>`;}
function runPaletteSelection(){const button=document.querySelectorAll("#paletteResults button")[paletteSelection];if(!button)return;closeCommandPalette();new Function(button.dataset.action)();}

function downloadFile(filename, content, type) { const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
function exportDetailPrompt() {
  if(!currentDetailPrompt)return; const text=document.getElementById("detailEditor")?.value||"";const format=document.getElementById("detailExportFormat")?.value||"markdown";const name=slugify(currentDetailPrompt.title);
  if(format==="markdown")downloadFile(`${name}.md`,`# ${currentDetailPrompt.title}\n\n${text}\n`,`text/markdown`);
  if(format==="word")downloadFile(`${name}.doc`,`<html><meta charset="utf-8"><body><h1>${escapeHtml(currentDetailPrompt.title)}</h1><pre style="white-space:pre-wrap;font-family:Arial">${escapeHtml(text)}</pre></body></html>`,`application/msword`);
  if(format==="csv")downloadFile(`${name}.csv`,`"Title","Department","Prompt"\n"${currentDetailPrompt.title.replaceAll('"','""')}","${currentDetailPrompt.department}","${text.replaceAll('"','""')}"`,`text/csv;charset=utf-8`);
  if(format==="json")downloadFile(`${name}.json`,JSON.stringify({title:currentDetailPrompt.title,department:currentDetailPrompt.department,prompt:text},null,2),`application/json`);
  if(format==="email"){openEmailComposer(currentDetailPrompt.title,text);return;}
  showToast(`Đã chuẩn bị bản xuất ${format.toUpperCase()}`);
}

function openEmailComposer(subject, body) {
  sessionStorage.setItem("ai_work_hub_email_draft", JSON.stringify({subject,body}));
  openOsModal("Soạn email từ prompt", "Xem trước, chỉnh sửa và sao chép nội dung trước khi mở ứng dụng email.", `<div class="email-composer"><div class="email-fields"><label>Người nhận<input id="emailTo" type="email" placeholder="name@company.com"/></label><label>Tiêu đề<input id="emailSubject" value="${escapeAttr(subject)}"/></label></div><label>Nội dung email<textarea id="emailBody" rows="16">${escapeHtml(body)}</textarea></label><div class="email-note"><span>i</span><p>Website không thể tự gửi email. Nút “Mở ứng dụng email” sử dụng phần mềm email mặc định trên máy; nếu chưa cấu hình, hãy dùng “Sao chép toàn bộ”.</p></div><div class="email-actions"><button class="text-btn" onclick="copyEmailDraft()">Sao chép toàn bộ</button><button class="text-btn" onclick="downloadEmailDraft()">Tải bản nháp .txt</button><button class="builder-btn" onclick="launchEmailClient()">Mở ứng dụng email →</button></div></div>`, "EMAIL COMPOSER");
}

function getEmailDraft() { return {to:document.getElementById("emailTo")?.value.trim()||"",subject:document.getElementById("emailSubject")?.value||"",body:document.getElementById("emailBody")?.value||""}; }
function copyEmailDraft(){const draft=getEmailDraft();copyText(`To: ${draft.to}\nSubject: ${draft.subject}\n\n${draft.body}`);}
function downloadEmailDraft(){const draft=getEmailDraft();downloadFile(`${slugify(draft.subject||"email-draft")}.txt`,`To: ${draft.to}\nSubject: ${draft.subject}\n\n${draft.body}`,"text/plain;charset=utf-8");showToast("Đã tải bản nháp email");}
function launchEmailClient(){const draft=getEmailDraft();location.href=`mailto:${encodeURIComponent(draft.to)}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;setTimeout(()=>showToast("Nếu không có cửa sổ email, hãy dùng nút Sao chép toàn bộ"),800);}

function rateCurrentPrompt(score){if(!currentDetailPrompt)return;const ratings=JSON.parse(localStorage.getItem("ai_work_hub_ratings")||"{}");ratings[currentDetailPrompt.id]=score;localStorage.setItem("ai_work_hub_ratings",JSON.stringify(ratings));renderCurrentRating();showToast(`Đã đánh giá ${score}/5`);}
function renderCurrentRating(){if(!currentDetailPrompt)return;const score=JSON.parse(localStorage.getItem("ai_work_hub_ratings")||"{}")[currentDetailPrompt.id];document.querySelectorAll(".rating-row button").forEach((button,index)=>button.classList.toggle("active",Boolean(score&&index<score)));const el=document.getElementById("detailRating");if(el)el.textContent=score?`${score}/5 · lưu trên thiết bị`:"";}

function openAdminCenter(){
  const custom=getStore("ai_work_hub_custom_prompts");
  openOsModal("Content Studio","Tạo prompt cá nhân, nhập/xuất dữ liệu và chuẩn bị đề xuất chia sẻ.",`<div class="admin-layout"><section class="admin-form"><h3>Tạo prompt tùy chỉnh</h3><div class="builder-grid"><label>Tiêu đề<input id="adminTitle" placeholder="Tên prompt"/></label><label>Nhóm nghiệp vụ<input id="adminDepartment" placeholder="Ví dụ: Đấu thầu"/></label></div><label class="full-label">Mục đích<input id="adminUse" placeholder="Dùng khi..."/></label><label class="full-label">Nội dung prompt<textarea id="adminPrompt" rows="8" placeholder="Vai trò, bối cảnh, nhiệm vụ, đầu ra..."></textarea></label><button class="builder-btn" onclick="saveCustomPrompt()">Lưu prompt vào thiết bị</button></section><section class="admin-tools"><h3>Kho cá nhân <span>${custom.length}</span></h3>${custom.map(item=>`<div><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.department)}</small></div>`).join("")||`<p>Chưa có prompt tùy chỉnh.</p>`}<hr><button class="text-btn" onclick="exportContentLibrary()">Xuất toàn bộ dữ liệu JSON</button><label class="import-btn">Nhập thư viện JSON<input type="file" accept="application/json" onchange="importContentLibrary(event)" hidden></label><p>Dữ liệu tùy chỉnh chỉ lưu trên thiết bị. Xuất JSON để gửi người quản trị hoặc sao lưu.</p></section></div>`,"CONTENT GOVERNANCE");
}
function saveCustomPrompt(){const title=document.getElementById("adminTitle")?.value.trim(),prompt=document.getElementById("adminPrompt")?.value.trim();if(!title||!prompt){showToast("Cần nhập tiêu đề và nội dung prompt");return;}const items=getStore("ai_work_hub_custom_prompts");items.unshift({title,department:document.getElementById("adminDepartment")?.value.trim()||"Cá nhân",use:document.getElementById("adminUse")?.value.trim()||"Prompt tùy chỉnh",level:"Chuẩn",platforms:["ChatGPT","Gemini"],prompt});setStore("ai_work_hub_custom_prompts",items);showToast("Đã lưu prompt tùy chỉnh");location.reload();}
function exportContentLibrary(){downloadFile("ai-work-hub-library.json",JSON.stringify({version:"4.0",exportedAt:new Date().toISOString(),customPrompts:getStore("ai_work_hub_custom_prompts"),ratings:JSON.parse(localStorage.getItem("ai_work_hub_ratings")||"{}")},null,2),"application/json");}
function importContentLibrary(event){const file=event.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const data=JSON.parse(reader.result);const prompts=Array.isArray(data)?data:data.customPrompts;if(!Array.isArray(prompts))throw new Error();setStore("ai_work_hub_custom_prompts",prompts);showToast("Nhập thư viện thành công");setTimeout(()=>location.reload(),500);}catch{showToast("Tệp JSON không đúng định dạng");}};reader.readAsText(file);}

renderMotionMode();

initNeuralNetwork();
initializeApp();
