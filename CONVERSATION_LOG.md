# Stark Ops Dashboard - Conversation Log

## Session 3 (2026-03-09)

### What was done
1. **ICN80AZ sync** — Fetched ICN80 Data Tech (8) + ICN57 Data Tech (4) = 12 tickets added
2. **ICN53AZ sync** — Fetched ICN53 (9) + ICN66 (8) + ICN69 (9) = 26 tickets added
3. **ICN54AZ sync** — Fetched ICN54 (25) + ICN65 (5) + ICN91 (5) + ICN92 (5) = 40 tickets added
4. **52AZ remaining** — Fetched remaining 41 tickets (PowerShelf ICN59, Network, Walkthrough, etc.)
5. **calcPriority() fix** — Removed unmanned site penalty. ICN57 priority follows IBU naturally (BP_4 + sev5 = low)
6. **MF (Media Fix) category** — Added as separate category in `categorizeTicket()`
7. **categorizeTicket() expanded** — Added: Media Fix, SDO Diagnostic, S3 Drive Replacement, Boot Repair, HWMON Repair, ID Project, Site Walkthrough, Rack Delivery, ACME Update

### Current state
- **Total tickets**: 215 across all ICN AZs
- **Git**: v4.0, commit `4fff9aa`
- **All 4 AZs covered**: ICN52AZ, ICN53AZ, ICN54AZ, ICN80AZ

### Site breakdown
```
ICN59: 27 (mostly PowerShelf)
ICN54: 25
ICN63: 16
ICN71: 14
ICN56: 13
ICN52: 9
ICN53: 9
ICN69: 9
ICN80: 8
ICN66: 8
ICN81: 7
ICN91: 5
ICN65: 5
ICN92: 5
ICN57: 4
```

### AZ → Site → DCO mapping
```
ICN52AZ: ICN51→ICN52, ICN52→ICN52, ICN56→ICN56, ICN59→ICN59, ICN63→ICN63, ICN71→ICN71
ICN53AZ: ICN53→ICN53, ICN66→ICN66, ICN69→ICN69
ICN54AZ: ICN54→ICN54, ICN65→ICN65, ICN91→ICN91, ICN92→ICN92
ICN80AZ: ICN57→ICN80, ICN80→ICN80, ICN81→ICN81
UNMANNED: ICN50, ICN55, ICN58, ICN400, ICN401
```

### Priority system (calcPriority)
- Base score: 100
- sev5: +30
- MF (Media Fix): +40
- SDO: +60
- RPO_1: -60, RPO_2: -45, RPO_3: -30
- BP_1: +0, BP_2: +8, BP_3: +16, BP_4: +24
- CBP vetting: -5
- Compliance/Drills: +300
- Age bonus: up to -14

### Key decisions
- ICN57 is NOT penalized for being unmanned — priority follows IBU naturally
- MF = Media Fix, separate category (not "Machine Flagged")
- Compliance Reminders have `excludeFromBriefing: true`
- Ticket links always use `t.corp.amazon.com/SHORT_ID`

### TODO for next session
1. Per-AZ data files (data/ICN53AZ-DCO.json etc.) — currently all data in one file
2. Settings page: add ICN53AZ, ICN54AZ site options
3. Verify Malt IBU order matches our calcPriority for each AZ
4. Email sync — real emails per user
5. Hackathon presentation prep
6. Consider S3 + CloudFront for data hosting (GitHub Pages has 10-min cache)

### Infrastructure
- GitHub: https://github.com/dohychoi/stark-ops.git
- GitHub Pages: https://dohychoi.github.io/stark-ops/
- Cognito: us-east-1:91dc7b85-b40b-49ea-91f8-d7cb2ce86252
- AWS Account: 047824595493
