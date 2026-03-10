/* Stark Ops v5.5 — Harmony CSP Compatible (zero inline JS) */

// ===== GLOBALS =====
let CLUSTERS = {}, SUB_GEOS = {}, EMAIL_UPDATES = [], TICKET_UPDATES = [], GLOBAL_TEAMS = {};
let SITE_DCO = {}, AZ_MAP = {}, UNMANNED_SITES = [];
let currentChatId = null, chatSessions = [], chartRendered = false;
let activeFeedTab = "emails", activeTeamFilter = "All";
let conversationHistory = [];

// ===== INIT =====
document.addEventListener("DOMContentLoaded", async () => {
  loadTheme();
  loadChatSessions();
  renderChatHistory();
  updateHeaderTime();
  setInterval(updateHeaderTime, 60000);
  await loadData();
  applySettings();
  bindEvents();
  newChat();
});

// ===== EVENT BINDING (no inline handlers) =====
function bindEvents() {
  // Nav buttons
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => showPage(btn.dataset.page, btn));
  });
  // New chat
  document.getElementById("btn-new-chat").addEventListener("click", newChat);
  // Send message
  document.getElementById("btn-send").addEventListener("click", sendMessage);
  document.getElementById("chat-input").addEventListener("keydown", e => {
    if (e.key === "Enter") sendMessage();
  });
  // Feed tabs
  document.querySelectorAll(".feed-tab").forEach(btn => {
    btn.addEventListener("click", () => switchFeedTab(btn.dataset.tab, btn));
  });
  // Save settings
  document.getElementById("btn-save-settings").addEventListener("click", saveSettings);
  // Theme buttons
  document.querySelectorAll(".theme-btn").forEach(btn => {
    btn.addEventListener("click", () => setTheme(btn.dataset.theme));
  });
}

// ===== PAGES =====
function showPage(page, btn) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById("page-" + page).classList.add("active");
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");

  if (page === "dashboard" && !chartRendered && Object.keys(CLUSTERS).length > 0) {
    renderDashboardStats();
    renderMap();
    renderSubGeoCards();
    setTimeout(() => { renderChart(); chartRendered = true; }, 100);
  }
  if (page === "news") { renderTeamFilters(); renderNewsFeed(); }
  if (page === "settings") renderSettingsForm();
}

// ===== CHAT SESSIONS =====
function loadChatSessions() {
  try { chatSessions = JSON.parse(localStorage.getItem("starkChatSessions") || "[]"); } catch(e) { chatSessions = []; }
}
function saveChatSessions() { localStorage.setItem("starkChatSessions", JSON.stringify(chatSessions)); }

function newChat() {
  saveCurrentChat();
  currentChatId = "chat_" + Date.now();
  conversationHistory = [];
  const el = document.getElementById("chat-messages");
  el.innerHTML = '<div class="welcome"><h2>🧤 Stark</h2><p>"I am Iron Man."</p><p style="margin-top:8px">☀️ What can I help you with today?</p></div>';
  document.getElementById("chat-input").value = "";
  renderChatHistory();
}

function saveCurrentChat() {
  if (!currentChatId) return;
  const msgs = document.getElementById("chat-messages");
  const msgEls = msgs.querySelectorAll(".msg");
  if (msgEls.length === 0) return;
  const messages = Array.from(msgEls).map(m => ({
    role: m.classList.contains("user") ? "user" : "assistant",
    text: m.querySelector(".msg-text")?.textContent || m.textContent
  }));
  const existing = chatSessions.find(s => s.id === currentChatId);
  if (existing) { existing.messages = messages; existing.date = Date.now(); }
  else {
    const title = messages[0]?.text?.substring(0, 40) || "New Chat";
    chatSessions.unshift({ id: currentChatId, title, messages, date: Date.now() });
  }
  saveChatSessions();
}

function loadChat(id) {
  saveCurrentChat();
  const session = chatSessions.find(s => s.id === id);
  if (!session) return;
  currentChatId = id;
  conversationHistory = [];
  const el = document.getElementById("chat-messages");
  el.innerHTML = "";
  session.messages.forEach(m => {
    conversationHistory.push({ role: m.role, content: m.text });
    addMessageToDOM(m.role, m.text);
  });
  renderChatHistory();
}

function deleteChat(id) {
  chatSessions = chatSessions.filter(s => s.id !== id);
  saveChatSessions();
  if (currentChatId === id) newChat();
  renderChatHistory();
}

function renameChat(id) {
  const session = chatSessions.find(s => s.id === id);
  if (!session) return;
  const name = prompt("Chat name:", session.title);
  if (name && name.trim()) { session.title = name.trim(); saveChatSessions(); renderChatHistory(); }
}

function renderChatHistory() {
  const list = document.getElementById("chat-history-list");
  list.innerHTML = "";
  chatSessions.slice(0, 30).forEach(s => {
    const div = document.createElement("div");
    div.className = "chat-item" + (s.id === currentChatId ? " active" : "");
    const d = new Date(s.date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
    div.innerHTML = '<span class="title">' + escHtml(s.title) + '</span><span class="date">' + d + '</span><span class="actions"><button data-action="rename" title="Rename">✏️</button><button data-action="delete" title="Delete">×</button></span>';
    div.addEventListener("click", e => {
      const action = e.target.dataset?.action;
      if (action === "delete") { e.stopPropagation(); deleteChat(s.id); }
      else if (action === "rename") { e.stopPropagation(); renameChat(s.id); }
      else loadChat(s.id);
    });
    list.appendChild(div);
  });
}

// ===== MESSAGES =====
function addMessageToDOM(role, text) {
  const el = document.getElementById("chat-messages");
  const welcome = el.querySelector(".welcome");
  if (welcome) welcome.remove();
  const div = document.createElement("div");
  div.className = "msg " + role;
  div.innerHTML = '<div class="msg-text">' + escHtml(text) + '</div>';
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

async function sendMessage() {
  const input = document.getElementById("chat-input");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  addMessageToDOM("user", text);
  conversationHistory.push({ role: "user", content: text });

  // Build system prompt
  const sysPrompt = buildSystemPrompt();
  const messages = [{ role: "user", content: sysPrompt + "\n\nUser: " + text }];
  if (conversationHistory.length > 2) {
    const recent = conversationHistory.slice(-6);
    messages[0].content = sysPrompt + "\n\nConversation:\n" + recent.map(m => m.role + ": " + m.content).join("\n");
  }

  try {
    const { CognitoIdentityClient } = window.AWS_SDK?.CognitoIdentity || {};
    const { BedrockRuntimeClient, InvokeModelCommand } = window.AWS_SDK?.BedrockRuntime || {};

    if (!CognitoIdentityClient || !BedrockRuntimeClient) {
      addMessageToDOM("assistant", "⚠️ AWS SDK not loaded. AI responses unavailable in this build.");
      conversationHistory.push({ role: "assistant", content: "SDK not available" });
      saveCurrentChat();
      return;
    }

    const cognito = new CognitoIdentityClient({ region: "us-east-1" });
    const creds = await cognito.config.credentialDefaultProvider({ region: "us-east-1" })();
    const bedrock = new BedrockRuntimeClient({ region: "us-east-1", credentials: creds });

    const resp = await bedrock.send(new InvokeModelCommand({
      modelId: "us.anthropic.claude-3-5-haiku-20241022-v1:0",
      contentType: "application/json",
      body: JSON.stringify({ anthropic_version: "bedrock-2023-05-31", max_tokens: 2048, messages })
    }));

    const result = JSON.parse(new TextDecoder().decode(resp.body));
    const reply = result.content?.[0]?.text || "No response";
    addMessageToDOM("assistant", reply);
    conversationHistory.push({ role: "assistant", content: reply });
  } catch(e) {
    addMessageToDOM("assistant", "I'm running in demo mode. AI backend requires AWS Cognito credentials.\n\nYour question: " + text);
    conversationHistory.push({ role: "assistant", content: "demo mode" });
  }
  saveCurrentChat();
}

function buildSystemPrompt() {
  const s = loadSettings();
  let prompt = "You are Stark, an AI operations assistant for APMEA data center operations. You help DCO engineers with ticket prioritization, daily briefings, and operational questions.\n";
  if (TICKET_UPDATES.length > 0) {
    const site = s.site || "";
    const tickets = site ? TICKET_UPDATES.filter(t => t.title?.includes(site) || t.assignedGroup?.includes(site)) : TICKET_UPDATES.slice(0, 20);
    prompt += "\nOpen tickets (" + tickets.length + "):\n";
    tickets.slice(0, 15).forEach(t => {
      prompt += "- [" + t.severity + "] " + t.title + " (status: " + t.status + ", age: " + t.age + "d)\n";
    });
  }
  if (EMAIL_UPDATES.length > 0) {
    prompt += "\nRecent emails:\n";
    EMAIL_UPDATES.slice(0, 5).forEach(e => { prompt += "- " + e.subject + " (from: " + e.from + ")\n"; });
  }
  Object.entries(CLUSTERS).forEach(([code, c]) => {
    prompt += code + " (" + c.name + "): adoption=" + c.adoption + "%, status=" + c.status + "\n";
  });
  return prompt;
}

// ===== NEWS FEED =====
function switchFeedTab(tab, btn) {
  activeFeedTab = tab;
  document.querySelectorAll(".feed-tab").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  activeTeamFilter = "All";
  renderTeamFilters();
  renderNewsFeed();
}

function renderTeamFilters() {
  const container = document.getElementById("email-team-filter");
  container.innerHTML = "";
  if (activeFeedTab !== "tickets") return;
  const teams = ["All", ...new Set(TICKET_UPDATES.map(t => t.assignedGroup || "Unknown").filter(Boolean))];
  teams.forEach(t => {
    const btn = document.createElement("button");
    btn.className = "filter-btn" + (t === activeTeamFilter ? " active" : "");
    btn.textContent = t;
    btn.addEventListener("click", () => { activeTeamFilter = t; renderTeamFilters(); renderNewsFeed(); });
    container.appendChild(btn);
  });
}

function renderNewsFeed() {
  const container = document.getElementById("news-feed");
  container.innerHTML = "";
  if (activeFeedTab === "emails") {
    if (EMAIL_UPDATES.length === 0) { container.innerHTML = '<p class="text-sm" style="color:var(--text3)">No email updates.</p>'; return; }
    EMAIL_UPDATES.forEach(e => {
      const div = document.createElement("div");
      div.className = "feed-item";
      div.innerHTML = '<div class="feed-title">' + escHtml(e.subject) + '</div>' +
        '<div class="feed-meta">' + escHtml(e.from) + ' · ' + e.date + ' <span class="tag' + (e.important ? ' important' : '') + '">' + (e.tag || '') + '</span></div>' +
        '<div class="feed-preview">' + escHtml(e.preview || '') + '</div>';
      container.appendChild(div);
    });
  } else {
    let tickets = TICKET_UPDATES.filter(t => !["Resolved","Closed"].includes(t.status));
    if (activeTeamFilter !== "All") tickets = tickets.filter(t => t.assignedGroup === activeTeamFilter);
    tickets.sort((a, b) => calcPriority(a) - calcPriority(b));
    if (tickets.length === 0) { container.innerHTML = '<p class="text-sm" style="color:var(--text3)">No open tickets.</p>'; return; }
    tickets.slice(0, 50).forEach(t => {
      const div = document.createElement("div");
      div.className = "feed-item";
      const cat = categorizeTicket(t.title);
      const shortId = t.id?.includes("-") ? t.id.split("-").pop() : t.id;
      div.innerHTML = '<div class="feed-title">' + escHtml(t.title) + '</div>' +
        '<div class="feed-meta"><span class="tag">' + t.severity + '</span> <span class="tag">' + cat + '</span> ' + (t.assignedGroup || '') + ' · ' + t.age + 'd old · ' +
        '<a href="https://t.corp.amazon.com/' + shortId + '" target="_blank" style="color:var(--blue)">' + shortId + '</a></div>';
      container.appendChild(div);
    });
  }
}

// ===== PRIORITY & CATEGORIZE =====
function calcPriority(t) {
  let score = 100;
  const title = (t.title || "").toLowerCase();
  const sev = (t.severity || "").toLowerCase();
  const bp = title.match(/bp[_\s-]?(\d)/i);
  const rpo = title.match(/rpo[_\s-]?(\d)/i);
  if (!bp && !rpo && !title.includes("compliance") && !title.includes("drill")) score += 80;
  if (sev.includes("5") || sev === "sev5") score += 50;
  if (title.includes("mf-s") || title.includes("mf-h") || title.includes("media fix")) score += 40;
  if (title.includes("sdo")) score += 60;
  if (rpo) { const n = parseInt(rpo[1]); if (n===1) score-=60; else if(n===2) score-=45; else if(n===3) score-=30; }
  if (bp) { const n = parseInt(bp[1]); score += (n-1)*8; }
  if (title.includes("cbp")) score -= 5;
  if (title.includes("compliance") || title.includes("drill")) score += 300;
  score += Math.min((t.age||0)*0.3, 5);
  return score;
}

function categorizeTicket(title) {
  if (!title) return "General";
  const t = title.toLowerCase();
  if (t.includes("mf-s") || t.includes("mf-h") || t.includes("media fix")) return "Media Fix";
  if (t.includes("sdo")) return "SDO Diagnostic";
  if (t.includes("s3 drive") || t.includes("drive replacement")) return "S3 Drive Replacement";
  if (t.includes("boot repair") || t.includes("boot issue")) return "Boot Repair";
  if (t.includes("hwmon")) return "HWMON Repair";
  if (t.includes("id project")) return "ID Project";
  if (t.includes("walkthrough") || t.includes("site walk")) return "Site Walkthrough";
  if (t.includes("rack delivery")) return "Rack Delivery";
  if (t.includes("acme")) return "ACME Update";
  if (t.includes("cbp")) return "CBP Vetting";
  if (t.includes("powershelf")) return "PowerShelf Repair";
  if (t.includes("memory") || t.includes("dimm")) return "Memory Repair";
  if (t.includes("network") || t.includes("fiber") || t.includes("optic")) return "Network Infrastructure";
  if (t.includes("compliance") || t.includes("drill")) return "Compliance";
  return "General";
}

// ===== MAP =====
function renderMap() {
  const container = document.getElementById("map-container");
  Object.entries(CLUSTERS).forEach(([code, c]) => {
    const x = ((c.lng + 180) / 360) * 100;
    const y = ((90 - c.lat) / 180) * 100;
    const dot = document.createElement("div");
    dot.className = "cluster-dot" + (code === "ICN" ? " large" : "");
    dot.style.cssText = "left:" + x + "%;top:" + y + "%;background:" + statusColor(c.status);
    dot.title = c.flag + " " + code + " - " + c.name + " (" + c.adoption + "%)";
    const label = document.createElement("div");
    label.className = "cluster-label";
    label.style.cssText = "left:" + x + "%;top:" + (y+1.5) + "%";
    label.textContent = code;
    container.appendChild(dot);
    container.appendChild(label);
  });
}

// ===== SUBGEO CARDS =====
function renderSubGeoCards() {
  const container = document.getElementById("subgeo-cards");
  container.innerHTML = "";
  Object.entries(SUB_GEOS).forEach(([name, info]) => {
    const clusters = Object.entries(CLUSTERS).filter(([, c]) => c.subGeo === name);
    const avg = clusters.length ? (clusters.reduce((s, [, c]) => s + c.adoption, 0) / clusters.length).toFixed(1) : 0;
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = '<div class="flex items-center gap-2 mb-2"><span class="text-lg">' + info.emoji + '</span><span class="text-sm font-semibold">' + name + '</span></div>' +
      '<div class="text-2xl font-bold mb-2">' + avg + '%</div>' +
      '<div class="space-y-2">' + clusters.map(([code, c]) =>
        '<div class="flex justify-between text-xs"><span>' + c.flag + ' ' + code + '</span><span style="color:' + statusColor(c.status) + '">' + c.adoption + '%</span></div>'
      ).join("") + '</div>';
    container.appendChild(div);
  });
}

// ===== CHART =====
function renderChart() {
  const canvas = document.getElementById("adoptionChart");
  if (!canvas) return;
  const sorted = Object.entries(CLUSTERS).sort((a, b) => b[1].adoption - a[1].adoption);
  new Chart(canvas, {
    type: "bar",
    data: {
      labels: sorted.map(([code, c]) => c.flag + " " + code),
      datasets: [{ label: "Adoption %", data: sorted.map(([, c]) => c.adoption), backgroundColor: sorted.map(([, c]) => statusColor(c.status) + "99"), borderColor: sorted.map(([, c]) => statusColor(c.status)), borderWidth: 1 }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, title: { display: true, text: "AI Adoption by Cluster", color: "#9ca3af" } }, scales: { y: { max: 100, grid: { color: "#1f2937" }, ticks: { color: "#9ca3af", callback: v => v + "%" } }, x: { grid: { display: false }, ticks: { color: "#9ca3af", font: { size: 10 } } } } }
  });
}

function renderDashboardStats() {
  const el = document.getElementById("dashboard-stats");
  const cl = Object.keys(CLUSTERS).length;
  const high = Object.values(CLUSTERS).filter(c => c.adoption >= 60).length;
  const avg = cl ? (Object.values(CLUSTERS).reduce((s, c) => s + c.adoption, 0) / cl).toFixed(1) : 0;
  const notStarted = Object.values(CLUSTERS).filter(c => c.adoption === 0).length;
  el.innerHTML = statCard("Total Clusters", cl, "") + statCard("Avg Adoption", avg + "%", "color:var(--blue)") + statCard("High Performers", high, "color:var(--green)") + statCard("Not Started", notStarted, "color:var(--amber)");
}

function statCard(label, value, style) {
  return '<div class="card stat-card"><div class="label">' + label + '</div><div class="value" style="' + style + '">' + value + '</div></div>';
}

// ===== SETTINGS =====
function loadSettings() {
  try { return JSON.parse(localStorage.getItem("starkSettings") || "{}"); } catch(e) { return {}; }
}

function saveSettings() {
  const s = {
    cluster: document.getElementById("setting-cluster").value,
    site: document.getElementById("setting-site").value,
    team: document.getElementById("setting-team").value
  };
  localStorage.setItem("starkSettings", JSON.stringify(s));
  applySettings();
  alert("Settings saved!");
}

function applySettings() {
  const s = loadSettings();
  const hc = document.getElementById("header-cluster");
  if (hc) hc.textContent = s.site || s.cluster || "No cluster set";
}

function renderSettingsForm() {
  const s = loadSettings();
  const sel = document.getElementById("setting-cluster");
  if (sel.options.length <= 1) {
    Object.entries(CLUSTERS).forEach(([code, c]) => {
      const opt = document.createElement("option");
      opt.value = code; opt.textContent = c.flag + " " + code + " - " + c.name;
      sel.appendChild(opt);
    });
  }
  sel.value = s.cluster || "";
  document.getElementById("setting-site").value = s.site || "";
  document.getElementById("setting-team").value = s.team || "DCO";

  // Followed teams
  const teams = ["DCO","DCEO","Security","Logistics","Central Ops","Install","Networking","Ops Excellence","DCC","Global"];
  const followed = s.followedTeams || ["DCO"];
  const container = document.getElementById("followed-teams");
  container.innerHTML = "";
  teams.forEach(t => {
    const btn = document.createElement("button");
    btn.className = "team-chip" + (followed.includes(t) ? " active" : "");
    btn.textContent = t;
    btn.addEventListener("click", () => { btn.classList.toggle("active"); });
    container.appendChild(btn);
  });
}

function setTheme(theme) {
  document.body.className = theme === "light" ? "light" : "";
  localStorage.setItem("starkTheme", theme);
  document.querySelectorAll(".theme-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.theme === theme);
  });
}

function loadTheme() {
  const theme = localStorage.getItem("starkTheme") || "dark";
  document.body.className = theme === "light" ? "light" : "";
}

// ===== DATA =====
async function loadData() {
  try {
    const s = loadSettings();
    const site = (s.site || "ICN81").toUpperCase();
    const role = s.team || "DCO";
    const cb = "?_=" + Date.now();
    let res = await fetch("data/" + site + "-" + role + ".json" + cb);
    if (!res.ok) res = await fetch("data.json" + cb);
    const d = await res.json();
    CLUSTERS = d.CLUSTERS || {};
    EMAIL_UPDATES = d.EMAIL_UPDATES || [];
    TICKET_UPDATES = d.TICKET_UPDATES || [];
    GLOBAL_TEAMS = d.GLOBAL_TEAMS || {};
    SUB_GEOS = d.SUB_GEOS || {};
    SITE_DCO = d.SITE_DCO || {};
    AZ_MAP = d.AZ_MAP || {};
    UNMANNED_SITES = d.UNMANNED_SITES || [];
  } catch(e) {
    console.error("Failed to load data:", e);
  }
}

// ===== UTILS =====
function statusColor(status) {
  if (status === "healthy" || status === "high") return "#22c55e";
  if (status === "warning" || status === "medium") return "#f59e0b";
  if (status === "critical" || status === "low") return "#ef4444";
  return "#6b7280";
}

function escHtml(s) {
  if (!s) return "";
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function updateHeaderTime() {
  const el = document.getElementById("header-time");
  if (el) el.textContent = new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" });
}

// Auto-refresh data every 5 minutes
setInterval(async () => { await loadData(); }, 300000);
