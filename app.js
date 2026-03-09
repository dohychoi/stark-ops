// ===== CONFIG =====
const REGION = "us-east-1";
const IDENTITY_POOL_ID = "us-east-1:91dc7b85-b40b-49ea-91f8-d7cb2ce86252";
const MODEL_ID = "us.anthropic.claude-3-5-haiku-20241022-v1:0";

// ===== SETTINGS =====
const ALL_FOLLOWABLE_TEAMS = ["DCO", "DCEO", "Security", "Logistics", "Central Ops Install", "Networking Ops Excellence", "DCC Global"];

function loadSettings() {
  return JSON.parse(localStorage.getItem("opspulse-settings") || '{"cluster":"","team":"","site":"","theme":"dark","followedTeams":[]}');
}
function saveSettings() {
  const followed = [];
  document.querySelectorAll("#followed-teams-checkboxes input:checked").forEach(cb => followed.push(cb.value));
  const s = {
    cluster: document.getElementById("cluster-select").value,
    team: document.getElementById("team-select").value,
    site: document.getElementById("site-input").value.trim().toUpperCase(),
    theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
    followedTeams: followed,
  };
  localStorage.setItem("opspulse-settings", JSON.stringify(s));
  loadData().then(() => applySettings());
}
function renderFollowedTeams() {
  const container = document.getElementById("followed-teams-checkboxes");
  if (!container) return;
  const s = loadSettings();
  const teams = ALL_FOLLOWABLE_TEAMS.filter(t => t !== s.team);
  if (teams.length === 0) {
    container.innerHTML = '<p class="text-xs text-slate-400">Select your primary team first.</p>';
    return;
  }
  container.innerHTML = teams.map(t => {
    const checked = (s.followedTeams || []).includes(t) ? "checked" : "";
    return `<label class="flex items-center gap-2 text-sm text-slate-700 dark:text-gray-300 cursor-pointer">
      <input type="checkbox" value="${t}" ${checked} onchange="saveSettings()" class="rounded">
      ${t}
    </label>`;
  }).join("");
}
function getVisibleTeams() {
  const s = loadSettings();
  const teams = new Set();
  if (s.team) teams.add(s.team);
  (s.followedTeams || []).forEach(t => teams.add(t));
  return teams;
}
// Map site+role to resolver group
function getResolverGroup(site, role) {
  if (!site || !role) return null;
  const s = site.toUpperCase();
  const map = { DCO: "Data Tech", DCEO: "DCEO", Security: "Security", Logistics: "Logistics" };
  return map[role] ? `${s} ${map[role]}` : `${s} ${role}`;
}
function applySettings() {
  const s = loadSettings();
  document.getElementById("cluster-select").value = s.cluster;
  document.getElementById("team-select").value = s.team;
  document.getElementById("site-input").value = s.site || "";
  const rg = getResolverGroup(s.site, s.team);
  const rgEl = document.getElementById("resolver-group-display");
  if (rgEl) rgEl.textContent = rg ? `→ Resolver Group: ${rg}` : "";
  const c = CLUSTERS[s.cluster];
  document.getElementById("cluster-badge").textContent = c
    ? `${c.flag} ${s.site || s.cluster}`
    : "No cluster set";
  setTheme(s.theme || "dark");
  renderFollowedTeams();
  renderQuickPrompts();
  renderTeamFilters();
  renderNewsFeed();
}

// ===== THEME =====
function setTheme(theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.getElementById("theme-icon").textContent = theme === "dark" ? "🌙" : "☀️";
  const s = loadSettings(); s.theme = theme;
  localStorage.setItem("opspulse-settings", JSON.stringify(s));
}
function toggleTheme() {
  setTheme(document.documentElement.classList.contains("dark") ? "light" : "dark");
}

// ===== CLOCK =====
function updateClock() {
  document.getElementById("clock").textContent = new Date().toLocaleString("en-US", {
    timeZone: "UTC", hour12: false, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  }) + " UTC";
}
setInterval(updateClock, 1000);
updateClock();

// ===== PAGE NAV =====
function showPage(page, btn) {
  ["chat", "news", "dashboard", "settings"].forEach(p =>
    document.getElementById(`page-${p}`).classList.toggle("hidden", p !== page)
  );
  document.querySelectorAll(".nav-btn").forEach(b => {
    b.classList.remove("active");
    b.classList.add("text-slate-500", "dark:text-gray-500");
  });
  if (btn) { btn.classList.add("active"); btn.classList.remove("text-slate-500", "dark:text-gray-500"); }
}

// ===== GREETING =====
function getGreeting() {
  const h = new Date().getHours();
  const s = loadSettings();
  const loc = s.cluster ? ` at ${s.cluster}` : "";
  if (h < 6) return `🌙 Working late${loc}? How can I help?`;
  if (h < 12) return `☀️ Good morning${loc}! What can I help you with today?`;
  if (h < 18) return `🌤️ Good afternoon${loc}! What would you like to know?`;
  return `🌆 Good evening${loc}! How can I assist you?`;
}
function renderWelcome() {
  document.getElementById("chat-messages").innerHTML = `
    <div class="flex flex-col items-center justify-center h-full text-center">
      <div class="w-20 h-20 rounded-2xl overflow-hidden mb-4 shadow-lg">
        <img src="https://imgproxy.attic.sh/insecure/f:webp/q:90/w:1920/plain/https://attic.sh/vwp21d7tt1oml8h7gl9sq8qop6hc" class="w-full h-full object-cover" alt="Stark">
      </div>
      <h2 class="text-2xl font-semibold mb-1 text-blue-500 italic">"I am Iron Man."</h2>
      <p class="text-sm mb-3 font-semibold">Jarvis is dead</p>
      <p class="text-sm text-slate-400 dark:text-gray-400 max-w-md">${getGreeting()}</p>
    </div>`;
}
function renderQuickPrompts() {
  const s = loadSettings();
  const cluster = s.cluster || "ICN";
  const team = s.team || "DCO";
  const prompts = [`☀️ 오늘 할 일 브리핑`, `📋 ${team} updates this week`, `🔍 Open tickets in ${s.site || cluster}`, `📊 티켓 그래프로 요약해줘`];
  document.getElementById("quick-prompts").innerHTML = prompts.map(p =>
    `<button onclick="document.getElementById('chat-input').value='${p.replace(/'/g,"\\'")}';sendMessage()"
      class="text-xs px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-gray-700">${p}</button>`
  ).join("");
}

// ===== CLUSTER SELECT =====
function populateClusterSelect() {
  const sel = document.getElementById("cluster-select");
  Object.entries(CLUSTERS).forEach(([code, c]) => {
    const opt = document.createElement("option");
    opt.value = code; opt.textContent = `${c.flag} ${code} - ${c.name}`;
    sel.appendChild(opt);
  });
}

// ===== STATUS HELPERS =====
function statusColor(s) {
  return { healthy: "#4ade80", moderate: "#facc15", low: "#fb923c", not_started: "#f87171" }[s] || "#f87171";
}

// ===== MAP =====
function renderMap() {
  const container = document.getElementById("map-container");
  Object.entries(CLUSTERS).forEach(([code, c]) => {
    const x = ((c.lng + 180) / 360) * 100;
    const y = ((90 - c.lat) / 180) * 100;
    const dot = document.createElement("div");
    dot.className = "cluster-dot absolute w-3.5 h-3.5 rounded-full border-2 border-white";
    dot.style.cssText = `left:${x}%;top:${y}%;background:${statusColor(c.status)};transform:translate(-50%,-50%)`;
    dot.title = `${code} - ${c.name} (${c.adoption}%)`;
    container.appendChild(dot);
  });
}

// ===== SUB-GEO CARDS =====
function renderSubGeoCards() {
  const container = document.getElementById("subgeo-cards");
  Object.entries(SUB_GEOS).forEach(([name, info]) => {
    const clusters = Object.entries(CLUSTERS).filter(([, c]) => c.subGeo === name);
    const avg = clusters.length ? (clusters.reduce((s, [, c]) => s + c.adoption, 0) / clusters.length).toFixed(1) : 0;
    container.innerHTML += `
      <div class="bg-white dark:bg-gray-900 rounded-xl p-4 border border-slate-200 dark:border-gray-800 shadow-sm">
        <div class="flex items-center gap-2 mb-2"><span class="text-lg">${info.emoji}</span><span class="text-sm font-semibold">${name}</span></div>
        <div class="text-2xl font-bold mb-2">${avg}%</div>
        <div class="space-y-1">${clusters.map(([code, c]) => `
          <div class="flex justify-between text-xs"><span>${c.flag} ${code}</span><span style="color:${statusColor(c.status)}">${c.adoption}%</span></div>
        `).join("")}</div>
      </div>`;
  });
}

// ===== CHART =====
function renderChart() {
  const sorted = Object.entries(CLUSTERS).sort((a, b) => b[1].adoption - a[1].adoption);
  new Chart(document.getElementById("adoptionChart"), {
    type: "bar",
    data: {
      labels: sorted.map(([code, c]) => `${c.flag} ${code}`),
      datasets: [{ data: sorted.map(([, c]) => c.adoption), backgroundColor: sorted.map(([, c]) => statusColor(c.status) + "99"), borderColor: sorted.map(([, c]) => statusColor(c.status)), borderWidth: 1 }]
    },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { max: 100, grid: { color: "#1f2937" }, ticks: { color: "#9ca3af" } }, x: { grid: { display: false }, ticks: { color: "#9ca3af", font: { size: 10 } } } } }
  });
}

// ===== NEWS FEED =====
let activeFeedTab = "emails";
let activeTeamFilter = "All";

function switchFeedTab(tab, btn) {
  activeFeedTab = tab;
  document.querySelectorAll(".feed-tab").forEach(b => { b.classList.remove("active"); b.classList.add("text-slate-400", "dark:text-gray-500"); });
  if (btn) { btn.classList.add("active"); btn.classList.remove("text-slate-400", "dark:text-gray-500"); }
  activeTeamFilter = "All";
  renderTeamFilters();
  renderNewsFeed();
}

function renderTeamFilters() {
  const container = document.getElementById("email-team-filter");
  container.innerHTML = "";
  if (activeFeedTab === "tickets") {
    container.innerHTML = '<span class="text-xs text-slate-400 dark:text-gray-500">Showing tickets for your site</span>';
    return;
  }
  const visible = getVisibleTeams();
  const teams = visible.size > 0 ? ["All", ...visible] : ["All", ...ALL_FOLLOWABLE_TEAMS];
  teams.forEach(team => {
    const btn = document.createElement("button");
    btn.textContent = team;
    btn.className = `px-2 py-1 text-xs rounded transition-colors ${team === activeTeamFilter
      ? "bg-blue-500 text-white"
      : "bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-gray-700"}`;
    btn.onclick = () => { activeTeamFilter = team; renderTeamFilters(); renderNewsFeed(); };
    container.appendChild(btn);
  });
}

function renderNewsFeed() {
  const container = document.getElementById("news-feed");
  const visible = getVisibleTeams();

  if (activeFeedTab === "emails") {
    let filtered = EMAIL_UPDATES;

    container.innerHTML = filtered.length === 0
      ? '<p class="text-sm text-slate-400 dark:text-gray-500 text-center py-8">No email updates.</p>'
      : filtered.map(u => {
      const prioColor = u.important ? "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30" : "text-slate-600 bg-slate-200 dark:text-slate-400 dark:bg-gray-800";
      return `<div class="bg-white dark:bg-gray-800/50 rounded-lg p-4 text-sm border ${u.important ? "border-l-4 border-l-red-500 border-red-200 dark:border-red-800" : "border-slate-200 dark:border-gray-700"} shadow-sm">
        <div class="flex items-center gap-2 mb-1.5 flex-wrap">
          <span class="px-1.5 py-0.5 text-xs rounded font-medium ${prioColor}">${u.important ? "IMPORTANT" : "INFO"}</span>
          <span class="text-xs font-medium text-blue-600 dark:text-blue-400">${u.tag}</span>
          <span class="text-xs text-slate-500 dark:text-gray-500">${u.date}</span>
        </div>
        <div class="font-medium text-slate-900 dark:text-gray-200">${u.subject}</div>
        <div class="text-slate-600 dark:text-gray-400 text-xs mt-1.5 leading-relaxed">${u.preview}</div>
        <div class="flex items-center justify-end mt-2">
          <span class="text-xs text-slate-500 dark:text-gray-500">from ${u.from}</span>
        </div>
      </div>`;
    }).join("");
  } else {
    // Tickets - filtered by user's site, exclude Robot
    const s = loadSettings();
    let tickets = TICKET_UPDATES.filter(t => !t.from.toLowerCase().includes("robot"));
    if (s.site) {
      tickets = tickets.filter(t => {
        const c = t.cluster.toUpperCase();
        return c === s.site || c === "ICN-ALL" || c === "GLOBAL" || c === "ALL";
      });
    }
    container.innerHTML = tickets.length === 0
      ? `<p class="text-sm text-slate-400 dark:text-gray-500 text-center py-8">No ticket updates${s.site ? " for " + s.site : ""}.</p>`
      : tickets.map(t => {
      const sevColor = { SEV2: "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30", SEV3: "text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30", SEV4: "text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30", SEV5: "text-slate-600 bg-slate-200 dark:text-slate-400 dark:bg-gray-800" }[t.severity] || "text-slate-600 bg-slate-200 dark:text-slate-400 dark:bg-gray-800";
      const statusBadge = t.status === "Resolved"
        ? "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30"
        : "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30";
      return `<div class="bg-white dark:bg-gray-800/50 rounded-lg p-4 text-sm border border-slate-200 dark:border-gray-700 shadow-sm">
        <div class="flex items-center gap-2 mb-1.5">
          <span class="px-1.5 py-0.5 text-xs rounded font-mono font-medium ${sevColor}">${t.severity}</span>
          <span class="px-1.5 py-0.5 text-xs rounded font-medium ${statusBadge}">${t.status}</span>
          <span class="text-xs font-mono text-slate-500 dark:text-gray-500">${t.id}</span>
          <span class="text-xs text-slate-500 dark:text-gray-500">${t.date}</span>
        </div>
        <div class="font-medium text-slate-900 dark:text-gray-200">${t.title}</div>
        <div class="text-slate-600 dark:text-gray-400 text-xs mt-1">${t.summary}</div>
        <div class="flex justify-between mt-2 text-xs text-slate-500 dark:text-gray-500">
          <span>📍 ${t.cluster}</span><span>from ${t.from}</span>
        </div>
      </div>`;
    }).join("");
  }
}

// ===== AI CHAT =====
let bedrockClient = null;
let welcomeShown = true;

async function getClient() {
  if (bedrockClient) return bedrockClient;
  const { BedrockRuntimeClient } = AwsBundle;
  const idRes = await fetch(`https://cognito-identity.${REGION}.amazonaws.com/`, {
    method: "POST", headers: { "Content-Type": "application/x-amz-json-1.1", "X-Amz-Target": "AWSCognitoIdentityService.GetId" },
    body: JSON.stringify({ IdentityPoolId: IDENTITY_POOL_ID })
  });
  const { IdentityId } = await idRes.json();
  const tokRes = await fetch(`https://cognito-identity.${REGION}.amazonaws.com/`, {
    method: "POST", headers: { "Content-Type": "application/x-amz-json-1.1", "X-Amz-Target": "AWSCognitoIdentityService.GetOpenIdToken" },
    body: JSON.stringify({ IdentityId })
  });
  const { Token } = await tokRes.json();
  const stsRes = await fetch(`https://sts.${REGION}.amazonaws.com/?` + new URLSearchParams({
    Action: "AssumeRoleWithWebIdentity", Version: "2011-06-15",
    RoleArn: "arn:aws:iam::047824595493:role/service-role/OpsDashboardGuestRole",
    RoleSessionName: "OpsPulseSession", WebIdentityToken: Token,
  }));
  const stsText = await stsRes.text();
  const p = (tag) => stsText.match(new RegExp(`<${tag}>(.+?)</${tag}>`))?.[1];
  bedrockClient = new BedrockRuntimeClient({ region: REGION, credentials: { accessKeyId: p("AccessKeyId"), secretAccessKey: p("SecretAccessKey"), sessionToken: p("SessionToken") } });
  return bedrockClient;
}

function categorizeTicket(title) {
  const t = title.toUpperCase();
  if (t.includes("DRILL") || t.includes("COMPLIANCE")) return "Compliance/Drills";
  if (/\bMF-[SH]\b/.test(t) || t.includes("[MEDIA]")) return "Media Fix";
  if (t.includes("POWERSHELF")) return "PowerShelf Repair";
  if (t.includes("MEMORY") || t.includes("VETTING_MEMORY")) return "Memory Repair";
  if (t.includes("CONSOLE") || t.includes("CPLD")) return "Console/CPLD Repair";
  if (t.includes("VETTING_CBP") || (t.includes("VFM") && !t.includes("POWERSHELF"))) return "CBP Vetting";
  if (t.includes("PCIE") || t.includes("NVME") || t.includes("SPI_FLASH") || t.includes("HBER") || t.includes("HUM_")) return "Hardware Component Repair";
  if (t.includes("FIRMWARE") || t.includes("BBU")) return "Firmware/BBU Upgrade";
  if (t.includes("JOHNNY 5") || t.includes("NETWORK_BP") || t.includes("STORM") || t.includes("SKYNET")) return "Network Infrastructure";
  if (t.includes("PAGER TEST")) return "Pager Test";
  if (t.includes("RED ZONE") || t.includes("RZE")) return "Red Zone Entry";
  if (t.includes("HDD DESTRUCTION") || t.includes("MEDIA DESTRUCTION") || t.includes("MEDIA AUDIT")) return "Media Destruction";
  if (t.includes("SDO_")) return "SDO Diagnostic";
  if (t.includes("S3DRIVE") || t.includes("S3 DRIVE")) return "S3 Drive Replacement";
  if (t.includes("BOOT")) return "Boot Repair";
  if (t.includes("HWMON")) return "HWMON Repair";
  if (t.includes("PROJECT COMPLETION") || t.includes("[STAGE1]")) return "ID Project";
  if (t.includes("WALKTHROUGH") || t.includes("7S")) return "Site Walkthrough";
  if (t.includes("RACK DELIVERY")) return "Rack Delivery";
  if (t.includes("ACME")) return "ACME Update";
  return "Other";
}

// Auto-calculate priority score (lower = higher priority, like Malt IBU)
function calcPriority(ticket) {
  const t = ticket.title.toUpperCase();
  let score = 100;
  // Severity: sev5=+50 (low prio tasks like walkthrough, tracking, ID projects)
  const sev = ticket.extensions?.tt?.impact || 3;
  if (sev >= 5) score += 50;
  // No BP tag = low priority (Malt always ranks BP-tagged above non-BP)
  const bp = t.match(/(?:EC2|EBS|S3_\w+|NETWORK|POWERSHELF|SDO)_BP_(\d+)/);
  if (!bp) score += 80;
  else score += (parseInt(bp[1]) - 1) * 8; // BP_1=+0, BP_2=+8, BP_3=+16, BP_4=+24
  // MF (Media Fix) = deprioritized within BP tier
  if (t.includes('MF-S') || t.includes('MF-H') || t.includes('[MEDIA]')) score += 40;
  // SDO = low priority diagnostic
  if (t.includes('SDO_')) score += 60;
  // RPO tag = urgent, lower number = more urgent
  const rpo = t.match(/RPO_(\d+)/);
  if (rpo) score -= (5 - parseInt(rpo[1])) * 15; // RPO_1=-60, RPO_2=-45, RPO_3=-30
  // CBP vetting = slightly higher than plain vetting
  if (t.includes('VETTING_CBP')) score -= 5;
  // Compliance/Drills = lowest
  if (/DRILL|COMPLIANCE|REMINDER/i.test(t)) score += 300;
  // Age tiebreaker only (max 5 days bonus, not enough to jump tiers)
  const age = (Date.now() - new Date(ticket.date || ticket.createDate).getTime()) / 86400000;
  score -= Math.min(age * 0.3, 5);
  return Math.round(score);
}

function buildTicketStats() {
  const cats = {}, statuses = {}, open = [];
  TICKET_UPDATES.forEach(t => {
    const cat = categorizeTicket(t.title);
    cats[cat] = (cats[cat] || 0) + 1;
    statuses[t.status] = (statuses[t.status] || 0) + 1;
    if (t.status === "Open") open.push(t);
  });
  let summary = `Total: ${TICKET_UPDATES.length} tickets\n`;
  summary += `Status: ${Object.entries(statuses).map(([k,v]) => `${k}=${v}`).join(", ")}\n`;
  summary += `\nBy Category:\n${Object.entries(cats).sort((a,b) => b[1]-a[1]).map(([k,v]) => `  ${k}: ${v}`).join("\n")}`;
  if (open.length) summary += `\n\nOpen Tickets (${open.length}):\n${open.map(t => `  [${t.shortId||t.id}] "${t.title}" (${t.date}) link: https://t.corp.amazon.com/${t.shortId||t.id}`).join("\n")}`;
  return summary;
}

function buildSystemPrompt() {
  const s = loadSettings();
  const clusterSummary = Object.entries(CLUSTERS).map(([code, c]) => {
    let info = `${code} (${c.name}, ${c.flag}): adoption=${c.adoption}%, status=${c.status}, subGeo=${c.subGeo}`;
    if (c.capacity) info += `, servers=${c.capacity.servers}, utilization=${c.capacity.utilization}%, uptime=${c.capacity.uptime}%`;
    if (c.recentTickets?.length) info += `\n  Tickets: ${c.recentTickets.map(t => `[${t.id}] ${t.severity} "${t.title}" (${t.status}, ${t.date})`).join("; ")}`;
    if (c.securityIssues?.length) info += `\n  Security: ${c.securityIssues.map(si => `[${si.id}] ${si.type} "${si.title}" (${si.status}, ${si.date})`).join("; ")}`;
    return info;
  }).join("\n\n");

  const emailSummary = EMAIL_UPDATES.map(u =>
    `[${u.id}] ${u.important?"⚠️":"📧"} ${u.tag} | "${u.subject}" | From: ${u.from} | ${u.preview} | ${u.date}`
  ).join("\n");

  const ticketStats = buildTicketStats();

  const ctx = s.cluster ? `\nUser's cluster: ${s.cluster}. User's team: ${s.team || "not set"}. User's site: ${s.site || "not set"}. Prioritize info for their site/cluster/team. "My updates" = ${s.site || s.cluster} site and ${s.team} team. Filter out Robot/automated pager test tickets unless specifically asked.` : "";

  return `You are Tony Stark, an AI assistant for operations for APMEA region.${ctx}

Cluster Data:
${clusterSummary}

Email Updates:
${emailSummary}

Ticket Analysis (${s.site || "all"} Data Tech):
${ticketStats}

When user asks for ticket summary:
- Show category breakdown with counts
- Highlight open tickets that need attention
- Mention trends (e.g. most tickets are VFM vetting)
- Distinguish between break-fix types: VFM repair, memory swap, console/CPLD, network link, powershelf, firmware

When user asks for a graph, chart, or visual summary, include a JSON code block like this:
\`\`\`chart
{"type":"doughnut","title":"Ticket Categories","labels":["VFM","Network","PowerShelf"],"data":[21,8,4]}
\`\`\`
Supported chart types: bar, doughnut, pie. Always include a text summary alongside the chart.

IMPORTANT - Ticket links: Use https://t.corp.amazon.com/SHORT_ID format.
Example: https://t.corp.amazon.com/D404855598
Each ticket has a "shortId" field (like D404855598 or V2124990152). ALWAYS use shortId for links.
NEVER use UUIDs in links. NEVER make up fake URLs.
If user asks about a site that has no data, say "No data available for that site" — do NOT show tickets from other sites.

Target adoption 2026: 80%. Current avg: 30.56%.
Be concise. Use bullet points. Reference IDs. For "my" queries, filter by user's cluster/team. Distinguish global vs local scope announcements.`;
}

function renderCharts(container) {
  container.querySelectorAll("code.chart-data").forEach(el => {
    try {
      const cfg = JSON.parse(el.textContent);
      const wrapper = document.createElement("div");
      wrapper.className = "my-3";
      wrapper.style.maxWidth = "360px";
      const canvas = document.createElement("canvas");
      wrapper.appendChild(canvas);
      el.replaceWith(wrapper);
      const colors = ["#3b82f6","#ef4444","#f59e0b","#10b981","#8b5cf6","#ec4899","#06b6d4","#f97316","#6366f1","#14b8a6","#e11d48","#84cc16"];
      new Chart(canvas, {
        type: cfg.type || "bar",
        data: { labels: cfg.labels, datasets: [{ data: cfg.data, backgroundColor: colors.slice(0, cfg.data.length), borderWidth: 0 }] },
        options: { responsive: true, plugins: { title: { display: !!cfg.title, text: cfg.title, color: document.documentElement.classList.contains("dark") ? "#e5e7eb" : "#1e293b" }, legend: { labels: { color: document.documentElement.classList.contains("dark") ? "#9ca3af" : "#64748b", boxWidth: 12, font: { size: 11 } } } }, scales: cfg.type === "bar" ? { y: { ticks: { color: "#9ca3af" }, grid: { color: "#374151" } }, x: { ticks: { color: "#9ca3af" }, grid: { display: false } } } : undefined }
      });
    } catch(e) { console.error("Chart render error:", e); }
  });
}

function addMessage(role, text) {
  const container = document.getElementById("chat-messages");
  if (welcomeShown) { container.innerHTML = ""; welcomeShown = false; }
  const div = document.createElement("div");
  div.className = "chat-msg max-w-3xl";
  const bg = role === "ai"
    ? "bg-white dark:bg-gray-800/50 border-slate-200 dark:border-gray-700"
    : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800";

  // Extract chart blocks before setting innerHTML
  const charts = [];
  let cleanText = text.replace(/```chart\s*([\s\S]*?)```/g, (_, json) => {
    charts.push(json.trim());
    return `<div class="chart-placeholder" data-idx="${charts.length - 1}"></div>`;
  });
  // Convert URLs to clickable links
  cleanText = cleanText.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" class="text-blue-400 hover:underline">$1</a>');

  div.innerHTML = `<div class="${bg} border rounded-xl p-4 text-sm shadow-sm">
    <span class="${role === "ai" ? "text-blue-500" : "text-green-500"} font-semibold text-xs">${role === "ai" ? '<img src="ironman.png" class="inline w-4 h-4 mr-1"> Tony Stark, AI Assistant' : "You"}</span>
    <div class="mt-2 text-slate-800 dark:text-gray-300 whitespace-pre-wrap">${cleanText}</div>
  </div>`;
  container.appendChild(div);

  // Render charts
  div.querySelectorAll(".chart-placeholder").forEach(ph => {
    try {
      const cfg = JSON.parse(charts[ph.dataset.idx]);
      const wrapper = document.createElement("div");
      wrapper.className = "my-3";
      wrapper.style.maxWidth = "360px";
      const canvas = document.createElement("canvas");
      wrapper.appendChild(canvas);
      ph.replaceWith(wrapper);
      const colors = ["#3b82f6","#ef4444","#f59e0b","#10b981","#8b5cf6","#ec4899","#06b6d4","#f97316","#6366f1","#14b8a6","#e11d48","#84cc16"];
      new Chart(canvas, {
        type: cfg.type || "bar",
        data: { labels: cfg.labels, datasets: [{ data: cfg.data, backgroundColor: colors.slice(0, cfg.data.length), borderWidth: 0 }] },
        options: { responsive: true, plugins: { title: { display: !!cfg.title, text: cfg.title, color: document.documentElement.classList.contains("dark") ? "#e5e7eb" : "#1e293b" }, legend: { labels: { color: document.documentElement.classList.contains("dark") ? "#9ca3af" : "#64748b", boxWidth: 12, font: { size: 11 } } } }, scales: cfg.type === "bar" ? { y: { ticks: { color: "#9ca3af" }, grid: { color: "#374151" } }, x: { ticks: { color: "#9ca3af" }, grid: { display: false } } } : undefined }
      });
    } catch(e) { console.error("Chart error:", e); }
  });

  container.scrollTop = container.scrollHeight;
  return div;
}

function addTyping() {
  const div = addMessage("ai", "");
  div.querySelector("div > div:last-child").className = "mt-2 text-slate-400 dark:text-gray-400 typing";
  div.id = "typing-indicator";
  return div;
}

async function sendMessage() {
  const input = document.getElementById("chat-input");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  addMessage("user", text);

  // Check if user wants a chart — render locally
  const lower = text.toLowerCase();
  const wantsChart = /그래프|차트|graph|chart|시각|visual/.test(lower);
  const aboutTickets = /티켓|ticket|break.?fix/.test(lower);

  // Check if user wants a daily briefing
  const isBriefing = /오늘.*할.*일|briefing|브리핑|daily|today.*do|할일|해야.*할/.test(lower);

  if (isBriefing) {
    const s = loadSettings();
    const site = s.site || "ICN81";
    const team = s.team || "DCO";

    // Sync freshness
    const lastSync = window._lastSync;
    const syncAge = lastSync ? Math.round((Date.now() - new Date(lastSync).getTime()) / 3600000) : null;
    const syncLabel = syncAge !== null ? (syncAge < 1 ? "방금 전" : `${syncAge}시간 전`) : "알 수 없음";

    // Get all sites this DCO handles (e.g. ICN52 DCO handles ICN51+ICN52)
    const mySites = new Set();
    Object.entries(SITE_DCO).forEach(([s, dco]) => { if (dco.toUpperCase() === site.toUpperCase()) mySites.add(s.toUpperCase()); });
    if (mySites.size === 0) mySites.add(site.toUpperCase());

    // Open tickets for all sites this DCO handles
    const openTickets = TICKET_UPDATES.filter(t => {
      if (!["Open","Pending","Assigned","Work In Progress","Researching"].includes(t.status)) return false;
      if (t.excludeFromBriefing) return false;
      const tc = (t.cluster || "").toUpperCase();
      return mySites.has(tc);
    });
    openTickets.forEach(t => t._priority = calcPriority(t));
    openTickets.sort((a, b) => a._priority - b._priority);
    const cats = {};
    openTickets.forEach(t => { const c = categorizeTicket(t.title); cats[c] = (cats[c]||0)+1; });

    // High priority emails
    const visibleEmails = EMAIL_UPDATES;
    const highEmails = visibleEmails.filter(e => e.important);
    const lowEmails = visibleEmails.filter(e => !e.important);

    let briefing = `☀️ ${site} ${team} Daily Briefing\n🔄 데이터 기준: ${syncLabel} (Kiro에서 "sync" 실행으로 업데이트)\n\n`;

    // Section 1: Open Tickets
    briefing += `🎫 Open 티켓 (${openTickets.length}건)\n`;
    Object.entries(cats).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => { briefing += `  • ${k}: ${v}건\n`; });
    briefing += `\n`;
    openTickets.forEach((t, i) => {
      const linkId = t.shortId || t.id;
      briefing += `  📌 ${i+1}. ${t.title.substring(0,65)}\n     → https://t.corp.amazon.com/${linkId}\n`;
    });

    // Section 2: High Priority Emails
    briefing += `\n🚨 Important email (${highEmails.length}건)\n`;
    highEmails.forEach(e => { briefing += `  • [${e.tag}] ${e.subject}\n    From: ${e.from} | ${e.preview.substring(0,80)}\n`; });

    // Section 3: Other Updates
    briefing += `\n📬 기타 업데이트 (${lowEmails.length}건)\n`;
    lowEmails.forEach(e => { briefing += `  • [${e.tag}] ${e.subject}\n`; });

    // Chart: open ticket categories
    const catEntries = Object.entries(cats).sort((a,b)=>b[1]-a[1]);
    if (catEntries.length > 0) {
      const chartJson = JSON.stringify({type:"doughnut",title:"Open 티켓 유형",labels:catEntries.map(e=>e[0]),data:catEntries.map(e=>e[1])});
      briefing += `\n\`\`\`chart\n${chartJson}\n\`\`\``;
    }

    addMessage("ai", briefing);
    return;
  }

  if (wantsChart && aboutTickets) {
    const cats = {};
    const statuses = {};
    TICKET_UPDATES.forEach(t => {
      const cat = categorizeTicket(t.title);
      cats[cat] = (cats[cat] || 0) + 1;
      statuses[t.status] = (statuses[t.status] || 0) + 1;
    });
    const catEntries = Object.entries(cats).sort((a,b) => b[1]-a[1]);
    const statusEntries = Object.entries(statuses);
    const s = loadSettings();

    let summary = `📊 ${s.site || "ICN81"} Data Tech 티켓 분석 (총 ${TICKET_UPDATES.length}건)\n\n`;
    summary += `■ 상태별: ${statusEntries.map(([k,v]) => `${k}: ${v}건`).join(" | ")}\n\n`;
    summary += `■ 유형별 Top 5:\n`;
    catEntries.slice(0,5).forEach(([k,v]) => { summary += `  • ${k}: ${v}건\n`; });
    const open = TICKET_UPDATES.filter(t => t.status === "Open");
    if (open.length) {
      summary += `\n🚨 Open 티켓 (${open.length}건):\n`;
      open.forEach(t => { summary += `  • [${t.id}] ${t.title.substring(0,60)}...\n`; });
    }

    const chartJson1 = JSON.stringify({type:"doughnut",title:"티켓 유형별 분포",labels:catEntries.map(e=>e[0]),data:catEntries.map(e=>e[1])});
    const chartJson2 = JSON.stringify({type:"bar",title:"티켓 상태",labels:statusEntries.map(e=>e[0]),data:statusEntries.map(e=>e[1])});

    addMessage("ai", summary + "\n```chart\n" + chartJson1 + "\n```\n```chart\n" + chartJson2 + "\n```");
    return;
  }

  const typing = addTyping();
  try {
    const client = await getClient();
    const { InvokeModelCommand } = AwsBundle;
    const res = await client.send(new InvokeModelCommand({
      modelId: MODEL_ID, contentType: "application/json", accept: "application/json",
      body: JSON.stringify({ anthropic_version: "bedrock-2023-05-31", max_tokens: 2048, system: buildSystemPrompt(), messages: [{ role: "user", content: text }] })
    }));
    const answer = JSON.parse(new TextDecoder().decode(res.body));
    typing.remove();
    addMessage("ai", answer.content[0].text);
  } catch (err) {
    typing.remove();
    addMessage("ai", `⚠️ Error: ${err.message}`);
  }
}

// ===== DATA =====
let CLUSTERS = {}, EMAIL_UPDATES = [], TICKET_UPDATES = [], GLOBAL_TEAMS = [], SUB_GEOS = {}, SITE_DCO = {}, AZ_MAP = {}, UNMANNED_SITES = [];

async function loadData() {
  try {
    const s = loadSettings();
    const site = (s.site || "ICN81").toUpperCase();
    const role = s.team || "DCO";
    const base = location.hostname === "localhost" || location.hostname === "127.0.0.1" ? "" : "https://dohychoi.github.io/stark-ops";
    // Try site-role specific data first, fallback to default
    let res = await fetch(`${base}/data/${site}-${role}.json`);
    if (!res.ok) res = await fetch(`${base}/data.json`);
    const d = await res.json();
    CLUSTERS = d.CLUSTERS;
    EMAIL_UPDATES = d.EMAIL_UPDATES;
    TICKET_UPDATES = d.TICKET_UPDATES;
    GLOBAL_TEAMS = d.GLOBAL_TEAMS;
    SUB_GEOS = d.SUB_GEOS;
    SITE_DCO = d.SITE_DCO || {};
    AZ_MAP = d.AZ_MAP || {};
    UNMANNED_SITES = d.UNMANNED_SITES || [];
    window._lastSync = d.lastSync;
  } catch(e) {
    console.error("Failed to load data:", e);
  }
}

// ===== INIT =====
loadData().then(() => {
  populateClusterSelect();
  applySettings();
  renderWelcome();
  renderQuickPrompts();
  renderFollowedTeams();
  renderMap();
  renderSubGeoCards();
  renderTeamFilters();
  renderNewsFeed();
  renderChart();
});

// Auto-refresh data every 5 minutes (picks up new syncs from GitHub Pages)
setInterval(() => {
  loadData().then(() => { console.log('[auto-refresh]', new Date().toISOString()); });
}, 5 * 60 * 1000);
