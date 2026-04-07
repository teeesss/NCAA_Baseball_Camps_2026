# NCAA Baseball Camps 2026: Quickstart

## Getting Started

1. **Node.js**: Ensure Node.js (version 18+) is installed.
2. **Dependencies**: Run `npm install` in the project root.

## Regenerate HTML

After making changes to `camps_data.json`, regenerate the HTML:

```bash
npm run generate:html          # production (index.html, ~64KB dynamic shell)
npm run generate:dev           # dev test (index_dev.html, ~56KB shell)
npm run generate:backup        # fallback (index_1.html, ~5MB static bundle)
```

`index.html` and `index_dev.html` use dynamic rendering (fetch `camps_data.json` at runtime).
`index_1.html` is a static inline bundle kept as emergency fallback.
All are **generated, never hand-edited**.

## Local Preview

Open `index.html` in a browser, or run:

```bash
npx live-server
```

## Background Extraction

To run the automated background extraction monitor:

```bash
node smart_extract.js          # process incomplete records
node watchdog.js               # continuous loop with watchdog
```

## Quality Audit & Verification

```bash
npm run audit                  # run quality audit (quality_audit.js)
npm run auto-verify            # auto-verify URLs (auto_verify.js)
```

## Deployment

### Production

```bash
npm run deploy                 # deploy to /Baseball_Camps_2026/
```

### Staging (Dev)

```bash
npm run deploy:dev             # deploy to /Baseball_Camps_2026_dev/
```

### Full Pipeline

```bash
npm run full-update            # sync verifications → verify → audit → generate → deploy
```

- **Live URL**: [bmwseals.com/Baseball_Camps_2026/](https://bmwseals.com/Baseball_Camps_2026/)
- **Dev URL**: [bmwseals.com/Baseball_Camps_2026_dev/](https://bmwseals.com/Baseball_Camps_2026_dev/)

## Word Document

To regenerate the Word export:

```bash
npm run generate:word          # node src/utils/generate_word_doc.js
```

Produces `NCAA-Baseball-Camps-2026.docx` with a table of all 559 programs.
