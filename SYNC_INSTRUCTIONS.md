# Stark Ops - Sync Instructions for Kiro

When user says "sync 해줘" or "sync", run this sequence:

## Step 1: Fetch all AZ tickets
Run 4 TT API calls in parallel:

```
ICN52AZ: assignedGroup=["ICN52 Data Tech","ICN56 Data Tech","ICN59 Data Tech","ICN63 Data Tech","ICN71 Data Tech","ICN81 Data Tech"]
ICN53AZ: assignedGroup=["ICN53 Data Tech","ICN66 Data Tech","ICN69 Data Tech"]
ICN54AZ: assignedGroup=["ICN54 Data Tech","ICN65 Data Tech","ICN91 Data Tech","ICN92 Data Tech"]
ICN80AZ: assignedGroup=["ICN80 Data Tech","ICN57 Data Tech"]
```

All with: status=["Assigned","Researching","Work In Progress","Pending"], rows=100,
responseFields=["id","title","aliases","extensions.tt.status","extensions.tt.impact","createDate"]

## Step 2: Transform & merge into data.json
For each ticket:
- id = ticket.id
- shortId = ticket.aliases[0].id
- title = ticket.title
- status = ticket.extensions.tt.status
- date = ticket.createDate.substring(0,10)
- cluster = extract ICNxx from title
- excludeFromBriefing = true if title contains "Drill" or "Compliance"

## Step 3: Write files & push
- Update data.json TICKET_UPDATES + lastSync
- Copy to data/ICN81-DCO.json, data/ICN52-DCO.json
- git add -A && git commit -m "sync: $(date)" && git push
