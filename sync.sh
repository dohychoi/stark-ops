#!/bin/bash
# Stark Ops - Data Sync Script
# Fetches latest tickets and emails via Kiro MCP, updates data.json
# Usage: ./sync.sh [site] [resolver-group]
#   e.g. ./sync.sh ICN81 "ICN81 Data Tech"

SITE="${1:-ICN81}"
GROUP="${2:-$SITE Data Tech}"
DIR="$(cd "$(dirname "$0")" && pwd)"
DATA="$DIR/data.json"
BACKUP="$DIR/data.backup.json"

echo "🔄 Stark Ops Sync"
echo "   Site: $SITE"
echo "   Resolver Group: $GROUP"
echo "   Data file: $DATA"
echo ""

# Backup current data
cp "$DATA" "$BACKUP" 2>/dev/null && echo "📦 Backed up current data.json"

echo ""
echo "=== SYNC INSTRUCTIONS ==="
echo ""
echo "This script prepares the sync. Run these in Kiro chat:"
echo ""
echo "1️⃣  TICKETS - Paste this in Kiro:"
echo "   Search tickets for resolver group \"$GROUP\" with status Open,Pending,Assigned"
echo "   and save results to $DATA"
echo ""
echo "2️⃣  EMAILS - Paste this in Kiro:"
echo "   Read my latest 20 inbox emails and categorize them for $SITE ops dashboard"
echo ""
echo "3️⃣  After Kiro updates data.json, run:"
echo "   cd $DIR && git add data.json && git commit -m 'sync: $(date +%Y-%m-%d)' && git push"
echo ""
echo "=== OR USE AUTO-SYNC (below) ==="
echo ""

# Auto-sync: Node script that reads current data.json and merges new data
cat > /tmp/stark-sync.js << 'SYNCSCRIPT'
// This script is called by Kiro after fetching ticket data
// Usage: node /tmp/stark-sync.js <data.json path> <new-tickets.json>
const fs = require('fs');
const dataPath = process.argv[2] || '/workspace/ops-dashboard/data.json';
const newPath = process.argv[3];

if (!newPath) {
  console.log('Usage: node stark-sync.js <data.json> <new-tickets.json>');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const newTickets = JSON.parse(fs.readFileSync(newPath, 'utf8'));

// Merge: update existing, add new
const existing = new Map(data.TICKET_UPDATES.map(t => [t.id, t]));
newTickets.forEach(t => existing.set(t.id, { ...existing.get(t.id), ...t }));
data.TICKET_UPDATES = [...existing.values()];

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
console.log(`✅ Synced: ${data.TICKET_UPDATES.length} total tickets`);
SYNCSCRIPT

echo "📝 Auto-sync helper created at /tmp/stark-sync.js"
echo ""
echo "🚀 Ready! Open Kiro and start syncing."
