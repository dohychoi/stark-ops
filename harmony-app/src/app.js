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
  // Quick action buttons
  document.querySelectorAll(".quick-btn").forEach(btn => {
    btn.addEventListener("click", () => runQuickAction(btn.dataset.action));
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
  el.innerHTML = '<div class="welcome"><img src="avatar.webp" alt="Stark" class="welcome-avatar"><p>"I am Iron Man."</p><p class="mt-8">☀️ What can I help you with today?</p></div>';
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

  // Extract ```chart blocks before any escaping
  const charts = [];
  let clean = String(text).replace(/```chart\s*([\s\S]*?)```/g, function(_, json) {
    charts.push(json.trim());
    return "%%CHART_" + (charts.length - 1) + "%%";
  });
  // Escape HTML and convert newlines
  clean = clean.split('\n').map(function(line) {
    return line.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }).join('<br>');
  // Restore chart markers
  for (var ci = 0; ci < charts.length; ci++) {
    clean = clean.replace("%%CHART_" + ci + "%%", '<div class="chart-slot" data-idx="' + ci + '"></div>');
  }

  div.innerHTML = '<div class="msg-text">' + clean + '</div>';
  el.appendChild(div);

  // Render charts
  div.querySelectorAll(".chart-slot").forEach(function(ph) {
    try {
      var cfg = JSON.parse(charts[ph.dataset.idx]);
      var wrap = document.createElement("div");
      wrap.className = "chart-wrap";
      if (cfg.title) { var t = document.createElement("div"); t.className = "chart-title"; t.textContent = cfg.title; wrap.appendChild(t); }
      var canvas = document.createElement("canvas");
      canvas.width = 300; canvas.height = 200;
      wrap.appendChild(canvas);
      ph.replaceWith(wrap);
      new Chart(canvas, { type: cfg.type || "bar", data: { labels: cfg.labels, datasets: [{ data: cfg.data, backgroundColor: ["#e74c3c","#3498db","#2ecc71","#f39c12","#9b59b6","#1abc9c","#e67e22","#34495e","#e91e63","#00bcd4"] }] }, options: { responsive: false, plugins: { legend: { display: cfg.type === "doughnut" || cfg.type === "pie" } } } });
    } catch(e) { ph.textContent = "[Chart error]"; }
  });

  el.scrollTop = el.scrollHeight;
}

function runQuickAction(action) {
  var s = loadSettings();
  var site = s.site || "ICN81";
  var team = s.team || "DCO";
  var mySites = new Set();
  Object.entries(SITE_DCO).forEach(function(e) { if (e[1].toUpperCase() === site.toUpperCase()) mySites.add(e[0].toUpperCase()); });
  if (mySites.size === 0) mySites.add(site.toUpperCase());

  var openTickets = TICKET_UPDATES.filter(function(t) {
    return ["Open","Pending","Assigned","Work In Progress","Researching"].includes(t.status);
  });
  openTickets.forEach(function(t) { t._priority = calcPriority(t); });
  openTickets.sort(function(a, b) { return a._priority - b._priority; });

  if (action === "briefing") {
    addMessageToDOM("user", "☀️ What to do today");
    var cats = {};
    openTickets.forEach(function(t) { var c = categorizeTicket(t.title); cats[c] = (cats[c]||0)+1; });
    var highEmails = EMAIL_UPDATES.filter(function(e) { return e.important; });

    var msg = "☀️ " + site + " " + team + " — Today's Briefing\n\n";
    msg += "━━━ 🎫 Open Tickets (" + openTickets.length + ") ━━━\n";
    Object.entries(cats).sort(function(a,b){return b[1]-a[1]}).forEach(function(e) { msg += "  • " + e[0] + ": " + e[1] + "\n"; });
    msg += "\n📋 Priority Order:\n";
    openTickets.slice(0, 10).forEach(function(t, i) {
      var linkId = t.shortId || (t.id && t.id.includes("-") ? t.id.split("-").pop() : t.id);
      msg += "  " + (i+1) + ". [" + t.severity + "] " + (t.title||"").substring(0,60) + "\n     → t.corp.amazon.com/" + linkId + "\n";
    });
    if (highEmails.length > 0) {
      msg += "\n━━━ 🚨 Priority Emails (" + highEmails.length + ") ━━━\n";
      highEmails.forEach(function(e) { msg += "  • " + e.subject + "\n    " + (e.preview||"").substring(0,80) + "\n"; });
    }
    var catE = Object.entries(cats).sort(function(a,b){return b[1]-a[1]});
    if (catE.length > 0) {
      msg += "\n```chart\n" + JSON.stringify({type:"doughnut",title:"Ticket Categories",labels:catE.map(function(e){return e[0]}),data:catE.map(function(e){return e[1]})}) + "\n```";
    }
    addMessageToDOM("assistant", msg);
  }

  else if (action === "tickets") {
    addMessageToDOM("user", "🎫 Open my tickets");
    var cats2 = {}, statuses = {};
    openTickets.forEach(function(t) { var c = categorizeTicket(t.title); cats2[c] = (cats2[c]||0)+1; statuses[t.status] = (statuses[t.status]||0)+1; });
    var msg2 = "🎫 " + site + " Open Tickets — Malt Priority Order\n\n";
    msg2 += "Total: " + openTickets.length + " | " + Object.entries(statuses).map(function(e){return e[0]+": "+e[1]}).join(", ") + "\n\n";
    openTickets.forEach(function(t, i) {
      var linkId = t.shortId || (t.id && t.id.includes("-") ? t.id.split("-").pop() : t.id);
      var cat = categorizeTicket(t.title);
      msg2 += (i+1) + ". [" + t.severity + "] " + cat + "\n   " + (t.title||"").substring(0,65) + "\n   Status: " + t.status + " | Age: " + t.age + "d → t.corp.amazon.com/" + linkId + "\n\n";
    });
    var catE2 = Object.entries(cats2).sort(function(a,b){return b[1]-a[1]});
    msg2 += "```chart\n" + JSON.stringify({type:"doughnut",title:"By Category",labels:catE2.map(function(e){return e[0]}),data:catE2.map(function(e){return e[1]})}) + "\n```";
    msg2 += "\n```chart\n" + JSON.stringify({type:"bar",title:"By Status",labels:Object.keys(statuses),data:Object.values(statuses)}) + "\n```";
    addMessageToDOM("assistant", msg2);
  }

  else if (action === "emails") {
    addMessageToDOM("user", "📬 Summarize my emails");
    var important = EMAIL_UPDATES.filter(function(e) { return e.important; });
    var other = EMAIL_UPDATES.filter(function(e) { return !e.important; });
    var msg3 = "📬 Email Summary (" + EMAIL_UPDATES.length + " total)\n\n";
    if (important.length > 0) {
      msg3 += "━━━ 🚨 High Priority (" + important.length + ") ━━━\n";
      important.forEach(function(e) {
        msg3 += "\n📌 " + e.subject + "\n   From: " + e.from + " | " + e.date + "\n   " + (e.preview||"") + "\n";
      });
    }
    if (other.length > 0) {
      msg3 += "\n━━━ 📧 Other (" + other.length + ") ━━━\n";
      other.forEach(function(e) {
        msg3 += "\n• [" + (e.tag||"") + "] " + e.subject + "\n  From: " + e.from + " | " + (e.preview||"").substring(0,80) + "\n";
      });
    }
    addMessageToDOM("assistant", msg3);
  }

  else if (action === "global") {
    addMessageToDOM("user", "🌏 Global update");
    var globalTags = ["Central Ops","DCC","Global","Networking","Install","DCEO"];
    var globalEmails = EMAIL_UPDATES.filter(function(e) { return globalTags.some(function(tag) { return (e.tag||"").includes(tag) || (e.from||"").includes(tag.toLowerCase()) || (e.subject||"").toUpperCase().includes(tag.toUpperCase()); }); });
    var otherGlobal = EMAIL_UPDATES.filter(function(e) { return !globalEmails.includes(e); });
    var msg4 = "🌏 Global Team Updates\n\n";
    if (globalEmails.length > 0) {
      globalEmails.forEach(function(e) {
        msg4 += "📌 [" + (e.tag||"General") + "] " + e.subject + "\n   From: " + e.from + " | " + e.date + "\n   " + (e.preview||"") + "\n\n";
      });
    } else {
      msg4 += "No global team updates found in current emails.\n\n";
    }
    msg4 += "━━━ 🌏 Cluster Status ━━━\n";
    Object.entries(CLUSTERS).forEach(function(e) {
      var c = e[1];
      msg4 += c.flag + " " + e[0] + " (" + c.name + "): " + c.adoption + "% adoption — " + c.status + "\n";
    });
    addMessageToDOM("assistant", msg4);
  }

  conversationHistory.push({ role: "user", content: action });
  conversationHistory.push({ role: "assistant", content: "[quick action: " + action + "]" });
  saveCurrentChat();
}

async function sendMessage() {
  const input = document.getElementById("chat-input");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  addMessageToDOM("user", text);
  conversationHistory.push({ role: "user", content: text });

  const lower = text.toLowerCase();
  const isBriefing = /브리핑|briefing|오늘.*할|daily|today|할일|해야.*할/.test(lower);
  const wantsChart = /그래프|차트|graph|chart|시각|visual/.test(lower);
  const aboutTickets = /티켓|ticket|break.?fix|TT|tt/.test(lower);
  const wantsEmail = /이메일|email|메일|outlook/.test(lower);
  const wantsStatus = /상태|status|현황|overview/.test(lower);

  // === Daily Briefing (local) ===
  if (isBriefing) {
    var s = loadSettings();
    var site = s.site || "ICN81";
    var team = s.team || "DCO";
    var mySites = new Set();
    Object.entries(SITE_DCO).forEach(function(e) { if (e[1].toUpperCase() === site.toUpperCase()) mySites.add(e[0].toUpperCase()); });
    if (mySites.size === 0) mySites.add(site.toUpperCase());

    var openTickets = TICKET_UPDATES.filter(function(t) {
      return ["Open","Pending","Assigned","Work In Progress","Researching"].includes(t.status) && mySites.has((t.cluster || "").toUpperCase());
    });
    openTickets.forEach(function(t) { t._priority = calcPriority(t); });
    openTickets.sort(function(a, b) { return a._priority - b._priority; });
    var cats = {};
    openTickets.forEach(function(t) { var c = categorizeTicket(t.title); cats[c] = (cats[c]||0)+1; });

    var highEmails = EMAIL_UPDATES.filter(function(e) { return e.important; });
    var lowEmails = EMAIL_UPDATES.filter(function(e) { return !e.important; });

    var briefing = "☀️ " + site + " " + team + " Daily Briefing\n\n";
    briefing += "🎫 Open 티켓 (" + openTickets.length + "건)\n";
    Object.entries(cats).sort(function(a,b) { return b[1]-a[1]; }).forEach(function(e) { briefing += "  • " + e[0] + ": " + e[1] + "건\n"; });
    briefing += "\n";
    openTickets.forEach(function(t, i) {
      var linkId = t.shortId || (t.id && t.id.includes("-") ? t.id.split("-").pop() : t.id);
      briefing += "  📌 " + (i+1) + ". " + (t.title||"").substring(0,65) + "\n     → https://t.corp.amazon.com/" + linkId + "\n";
    });
    briefing += "\n🚨 Important email (" + highEmails.length + "건)\n";
    highEmails.forEach(function(e) { briefing += "  • [" + e.tag + "] " + e.subject + "\n    From: " + e.from + " | " + (e.preview||"").substring(0,80) + "\n"; });
    briefing += "\n📬 기타 업데이트 (" + lowEmails.length + "건)\n";
    lowEmails.forEach(function(e) { briefing += "  • [" + e.tag + "] " + e.subject + "\n"; });

    var catEntries = Object.entries(cats).sort(function(a,b) { return b[1]-a[1]; });
    if (catEntries.length > 0) {
      briefing += "\n```chart\n" + JSON.stringify({type:"doughnut",title:"Open 티켓 유형",labels:catEntries.map(function(e){return e[0]}),data:catEntries.map(function(e){return e[1]})}) + "\n```";
    }
    addMessageToDOM("assistant", briefing);
    conversationHistory.push({ role: "assistant", content: briefing });
    saveCurrentChat();
    return;
  }

  // === Ticket chart request (local) ===
  if (wantsChart && aboutTickets) {
    var cats2 = {}, statuses = {};
    TICKET_UPDATES.forEach(function(t) { var c = categorizeTicket(t.title); cats2[c] = (cats2[c]||0)+1; statuses[t.status] = (statuses[t.status]||0)+1; });
    var catE = Object.entries(cats2).sort(function(a,b) { return b[1]-a[1]; });
    var statE = Object.entries(statuses);
    var s2 = loadSettings();
    var summary = "📊 " + (s2.site||"ICN81") + " 티켓 분석 (총 " + TICKET_UPDATES.length + "건)\n\n";
    summary += "■ 상태별: " + statE.map(function(e) { return e[0]+": "+e[1]+"건"; }).join(" | ") + "\n\n";
    summary += "■ 유형별 Top 5:\n";
    catE.slice(0,5).forEach(function(e) { summary += "  • " + e[0] + ": " + e[1] + "건\n"; });
    summary += "\n```chart\n" + JSON.stringify({type:"doughnut",title:"티켓 유형별 분포",labels:catE.map(function(e){return e[0]}),data:catE.map(function(e){return e[1]})}) + "\n```";
    summary += "\n```chart\n" + JSON.stringify({type:"bar",title:"티켓 상태",labels:statE.map(function(e){return e[0]}),data:statE.map(function(e){return e[1]})}) + "\n```";
    addMessageToDOM("assistant", summary);
    conversationHistory.push({ role: "assistant", content: summary });
    saveCurrentChat();
    return;
  }

  // === Email summary (local) ===
  if (wantsEmail) {
    var emailMsg = "📬 Outlook 이메일 업데이트 (" + EMAIL_UPDATES.length + "건)\n\n";
    EMAIL_UPDATES.forEach(function(e) {
      emailMsg += (e.important ? "🚨" : "📧") + " [" + e.tag + "] " + e.subject + "\n   From: " + e.from + " | " + e.date + "\n   " + (e.preview||"").substring(0,100) + "\n\n";
    });
    addMessageToDOM("assistant", emailMsg);
    conversationHistory.push({ role: "assistant", content: emailMsg });
    saveCurrentChat();
    return;
  }

  // === Status overview (local) ===
  if (wantsStatus) {
    var s3 = loadSettings();
    var statusMsg = "📊 " + (s3.site||"APMEA") + " 현황 Overview\n\n";
    var openT = TICKET_UPDATES.filter(function(t) { return ["Open","Pending","Assigned","Work In Progress","Researching"].includes(t.status); });
    statusMsg += "🎫 티켓: 총 " + TICKET_UPDATES.length + "건 (Open: " + openT.length + "건)\n";
    var sevCounts = {};
    TICKET_UPDATES.forEach(function(t) { sevCounts[t.severity] = (sevCounts[t.severity]||0)+1; });
    Object.entries(sevCounts).sort().forEach(function(e) { statusMsg += "  • " + e[0] + ": " + e[1] + "건\n"; });
    statusMsg += "\n🌏 클러스터: " + Object.keys(CLUSTERS).length + "개\n";
    Object.entries(CLUSTERS).forEach(function(e) { statusMsg += "  • " + e[0] + " (" + e[1].name + "): " + e[1].adoption + "% adoption, " + e[1].status + "\n"; });
    statusMsg += "\n📬 이메일: " + EMAIL_UPDATES.length + "건 (중요: " + EMAIL_UPDATES.filter(function(e){return e.important}).length + "건)\n";
    addMessageToDOM("assistant", statusMsg);
    conversationHistory.push({ role: "assistant", content: statusMsg });
    saveCurrentChat();
    return;
  }

  // === AI (Bedrock) ===
  const sysPrompt = buildSystemPrompt();
  const messages = [{ role: "user", content: sysPrompt + "\n\nUser: " + text }];
  if (conversationHistory.length > 2) {
    const recent = conversationHistory.slice(-6);
    messages[0].content = sysPrompt + "\n\nConversation:\n" + recent.map(function(m) { return m.role + ": " + m.content; }).join("\n");
  }

  try {
    if (typeof AwsBundle === "undefined") {
      addMessageToDOM("assistant", "⚠️ AWS SDK not loaded. AI responses unavailable.");
      conversationHistory.push({ role: "assistant", content: "SDK not available" });
      saveCurrentChat();
      return;
    }

    var credProvider = AwsBundle.fromCognitoIdentityPool({
      identityPoolId: "us-east-1:91dc7b85-b40b-49ea-91f8-d7cb2ce86252",
      clientConfig: { region: "us-east-1" }
    });

    var bedrock = new AwsBundle.BedrockRuntimeClient({
      region: "us-east-1",
      credentials: credProvider
    });

    var resp = await bedrock.send(new AwsBundle.InvokeModelCommand({
      modelId: "anthropic.claude-3-haiku-20240307-v1:0",
      contentType: "application/json",
      body: JSON.stringify({ anthropic_version: "bedrock-2023-05-31", max_tokens: 2048, messages: messages })
    }));

    var result = JSON.parse(new TextDecoder().decode(resp.body));
    var reply = result.content && result.content[0] ? result.content[0].text : "No response";
    addMessageToDOM("assistant", reply);
    conversationHistory.push({ role: "assistant", content: reply });
  } catch(e) {
    console.error("Bedrock error:", e);
    addMessageToDOM("assistant", "Error connecting to AI: " + (e.message || e) + "\n\nYour question: " + text);
    conversationHistory.push({ role: "assistant", content: "error" });
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
  prompt += "\nWhen user asks for a graph, chart, or visual summary, include a JSON code block like this:\n```chart\n{\"type\":\"bar\",\"title\":\"Example\",\"labels\":[\"A\",\"B\"],\"data\":[10,20]}\n```\nSupported chart types: bar, doughnut, pie. Always include a text summary alongside the chart.\n";
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
    if (EMAIL_UPDATES.length === 0) { container.innerHTML = '<p class="text-sm text-muted">No email updates.</p>'; return; }
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
    if (tickets.length === 0) { container.innerHTML = '<p class="text-sm text-muted">No open tickets.</p>'; return; }
    tickets.slice(0, 50).forEach(t => {
      const div = document.createElement("div");
      div.className = "feed-item";
      const cat = categorizeTicket(t.title);
      const shortId = t.id?.includes("-") ? t.id.split("-").pop() : t.id;
      div.innerHTML = '<div class="feed-title">' + escHtml(t.title) + '</div>' +
        '<div class="feed-meta"><span class="tag">' + t.severity + '</span> <span class="tag">' + cat + '</span> ' + (t.assignedGroup || '') + ' · ' + t.age + 'd old · ' +
        '<a href="https://t.corp.amazon.com/' + shortId + '" target="_blank" class="text-blue">' + shortId + '</a></div>';
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
        '<div class="flex justify-between text-xs"><span>' + c.flag + ' ' + code + '</span><span class="adoption-pct">' + c.adoption + '%</span></div>'
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
  el.innerHTML = statCard("Total Clusters", cl, "") + statCard("Avg Adoption", avg + "%", "stat-blue") + statCard("High Performers", high, "stat-green") + statCard("Not Started", notStarted, "stat-amber");
}

function statCard(label, value, cls) {
  return '<div class="card stat-card"><div class="label">' + label + '</div><div class="value ' + cls + '">' + value + '</div></div>';
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
  var d = window.STARK_DATA;
  if (!d) { console.error("STARK_DATA not found"); return; }
  CLUSTERS = d.CLUSTERS || {};
  EMAIL_UPDATES = d.EMAIL_UPDATES || [];
  TICKET_UPDATES = d.TICKET_UPDATES || [];
  GLOBAL_TEAMS = d.GLOBAL_TEAMS || {};
  SUB_GEOS = d.SUB_GEOS || {};
  SITE_DCO = d.SITE_DCO || {};
  AZ_MAP = d.AZ_MAP || {};
  UNMANNED_SITES = d.UNMANNED_SITES || [];
  console.log("Data loaded: Tickets=" + TICKET_UPDATES.length + " Emails=" + EMAIL_UPDATES.length + " Clusters=" + Object.keys(CLUSTERS).length);
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

// Data is loaded from data.js (STARK_DATA global)
