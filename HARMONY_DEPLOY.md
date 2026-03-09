# Harmony Deployment Guide for Stark Ops

## One-time Setup (from your local machine or dev desktop)

```bash
# 1. Authenticate
mwinit

# 2. Install Harmony CLI
curl https://console.harmony.a2z.com/setup | bash

# 3. Create the Harmony app
cd /path/to/ops-dashboard/harmony-app
harmony create stark-ops
# Follow prompts — choose "vanilla" template, or skip template

# 4. Deploy to Beta
harmony deploy --stage beta

# 5. Deploy to Prod
harmony deploy --stage prod
```

## After deployment
Your app will be at: `https://console.harmony.a2z.com/stark-ops`

## Updating
```bash
cd harmony-app
harmony deploy --stage prod
```

## Re-enable GitHub Pages
If you ever want to restore GitHub Pages:
```bash
cd /workspace/ops-dashboard
cp index.html.bak index.html
git add -A && git commit -m "Re-enable GitHub Pages" && git push
```
