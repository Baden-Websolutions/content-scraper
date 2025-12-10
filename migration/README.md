# Migration Tools

## 🎯 Übersicht

Dieses Verzeichnis enthält Tools zur Migration von gescrapten Inhalten zu:

1. **Storyblok** - Headless CMS
2. **SAP Commerce Cloud** - E-Commerce Platform

## 📦 Enthaltene Dateien

```
migration/
├── README.md                    # Diese Datei
├── transformers.js              # Data Transformation Utilities
├── migrate_to_storyblok.js      # Storyblok Migration Script
└── migrate_to_sap_cc.js         # SAP CC Migration Script
```

## 🚀 Quick Start

### Storyblok Migration

```bash
# Installation
npm install storyblok-js-client axios form-data

# Migration ausführen
node migration/migrate_to_storyblok.js \
  --data output/lenzingpro_with_images_*.json \
  --manifest output/lenzingpro_with_images_*_image_manifest.json \
  --space YOUR_SPACE_ID \
  --token YOUR_MANAGEMENT_TOKEN
```

### SAP Commerce Cloud Migration

```bash
# Installation
npm install axios form-data

# ImpEx Mode
node migration/migrate_to_sap_cc.js \
  --data output/lenzingpro_with_images_*.json \
  --manifest output/lenzingpro_with_images_*_image_manifest.json \
  --mode impex \
  --catalog yourContentCatalog \
  --version Staged

# API Mode
node migration/migrate_to_sap_cc.js \
  --data output/lenzingpro_with_images_*.json \
  --manifest output/lenzingpro_with_images_*_image_manifest.json \
  --mode api \
  --url https://api.your-env.model-t.cc.commerce.ondemand.com \
  --client-id YOUR_CLIENT_ID \
  --client-secret YOUR_CLIENT_SECRET \
  --catalog yourContentCatalog \
  --version Staged \
  --site yourBaseSite
```

## 📚 Detaillierte Dokumentation

### Storyblok

Siehe: [MIGRATION_STORYBLOK.md](../MIGRATION_STORYBLOK.md)

**Wichtigste Features:**
- Asset Upload zu Storyblok
- Story Creation via Management API
- Internal Link Mapping
- Richtext Content Transformation

**Workflow:**
1. Assets hochladen → Storyblok URLs
2. Stories erstellen mit Asset-Referenzen
3. Interne Links aktualisieren
4. Mapping speichern

### SAP Commerce Cloud

Siehe: [MIGRATION_SAP_CC.md](../MIGRATION_SAP_CC.md)

**Wichtigste Features:**
- Media Upload via OCC API
- ImpEx Generation für Bulk-Import
- Content Page Creation via API
- CMS Component Mapping

**Workflow (ImpEx):**
1. Media hochladen → Media Codes
2. ImpEx-Datei generieren
3. Manueller Import via HAC
4. Verifizierung in Backoffice

**Workflow (API):**
1. Media hochladen → Media Codes
2. Pages via OCC API erstellen
3. Components via OCC API erstellen
4. Automatische Verifizierung

## 🔧 Transformers

### Verwendung

```javascript
const {
  transformToStoryblok,
  transformToSAPCCPage,
  transformToSAPCCComponents
} = require('./migration/transformers');

// Storyblok
const assetMapping = new Map([
  ['output/images/logo.png', 'https://a.storyblok.com/f/12345/logo.png']
]);

const story = transformToStoryblok(scrapedPage, assetMapping);

// SAP CC
const mediaMapping = new Map([
  ['output/images/logo.png', 'logo_png_abc123']
]);

const page = transformToSAPCCPage(scrapedPage);
const components = transformToSAPCCComponents(scrapedPage, mediaMapping);
```

### Verfügbare Funktionen

#### Generators
- `generateUID()` - Storyblok Component UID
- `generateSlug(url)` - URL zu Slug
- `generatePageUid(url)` - SAP CC Page UID
- `generateProductCode(url)` - SAP CC Product Code
- `generateMediaCode(localPath)` - SAP CC Media Code

#### Escapers
- `escapeCsv(str)` - CSV-Escaping
- `escapeHtml(str)` - HTML-Escaping

#### Transformers
- `transformToStoryblok(page, assetMapping)` - Page → Storyblok Story
- `transformToSAPCCPage(page)` - Page → SAP CC Page
- `transformToSAPCCComponents(page, mediaMapping)` - Page → SAP CC Components
- `transformToSAPCCProduct(page, mediaMapping)` - Page → SAP CC Product

## 📊 Output

### Storyblok

```json
{
  "generated_at": "2025-12-10T...",
  "space_id": "12345",
  "assets": [
    {
      "localPath": "output/images/logo.png",
      "storyblokUrl": "https://a.storyblok.com/f/12345/logo.png"
    }
  ],
  "stories": [
    {
      "originalUrl": "https://example.com/page",
      "storyUuid": "abc-123-def-456"
    }
  ]
}
```

**Datei:** `storyblok_migration_mapping.json`

### SAP Commerce Cloud (ImpEx)

```impex
# SAP Commerce Cloud ImpEx
# Generated: 2025-12-10T...

INSERT_UPDATE ContentPage;...
;;homepage;Homepage;...

INSERT_UPDATE CMSParagraphComponent;...
;;homepage-Paragraph;Homepage Content;...
```

**Datei:** `sap_cc_migration.impex`

### SAP Commerce Cloud (API)

```json
{
  "mediaMapping": [
    ["output/images/logo.png", "logo_png_abc123"]
  ],
  "createdPages": [
    {
      "uid": "homepage",
      "name": "Homepage",
      ...
    }
  ]
}
```

## 🔐 Credentials

### Storyblok

```bash
# Management Token generieren:
# 1. https://app.storyblok.com → Settings → Access Tokens
# 2. Management Tokens → Create Token
# 3. Permissions: Read & Write

export STORYBLOK_SPACE_ID="12345"
export STORYBLOK_TOKEN="your-management-token"
```

### SAP Commerce Cloud

```bash
# OAuth Credentials:
# 1. Cloud Portal → API Credentials
# 2. Oder: Backoffice → System → OAuth → OAuth Clients

export SAP_CC_URL="https://api.your-env.model-t.cc.commerce.ondemand.com"
export SAP_CC_CLIENT_ID="your-client-id"
export SAP_CC_CLIENT_SECRET="your-client-secret"
export SAP_CC_CATALOG="yourContentCatalog"
export SAP_CC_SITE="yourBaseSite"
```

## ⚠️ Best Practices

### Rate Limiting

Beide Scripts implementieren Rate Limiting:
- **Storyblok**: 100ms (Assets), 200ms (Stories)
- **SAP CC**: 200ms (Media), 500ms (Pages)

### Error Handling

Fehler werden geloggt, aber die Migration läuft weiter:

```
✅ Uploaded: logo.png
❌ Failed: broken-image.jpg - HTTP 404
✅ Uploaded: banner.jpg
```

### Batch Processing

Für große Datenmengen:

```javascript
// Nur erste 10 Seiten
const limitedPages = scrapedData.scrapedPages.slice(0, 10);
await migration.migrate(limitedPages, imageManifest);
```

### Dry Run

Storyblok unterstützt Draft-Modus:

```bash
node migration/migrate_to_storyblok.js \
  --data ... \
  --manifest ... \
  --space ... \
  --token ... \
  --draft  # Stories als Draft erstellen
```

## 🐛 Troubleshooting

### Storyblok

**Problem:** `401 Unauthorized`
```bash
# Lösung: Token prüfen
curl -H "Authorization: YOUR_TOKEN" \
  https://mapi.storyblok.com/v1/spaces/YOUR_SPACE_ID/stories
```

**Problem:** `Asset upload failed`
```bash
# Lösung: Dateigröße prüfen (max 5 MB)
ls -lh output/images/large-image.jpg
```

### SAP Commerce Cloud

**Problem:** `OAuth token expired`
```bash
# Lösung: Token wird automatisch erneuert
# Bei Problemen: Credentials prüfen
```

**Problem:** `Media already exists`
```bash
# Lösung: Media Code ist eindeutig basierend auf Pfad
# Bei Duplikaten: Alte Media löschen oder Code anpassen
```

## 📈 Performance

### Storyblok

**Beispiel: lenzingpro.com**
- 119 Assets: ~2 Minuten
- 17 Stories: ~1 Minute
- Total: ~3 Minuten

### SAP Commerce Cloud

**ImpEx Mode:**
- 119 Media: ~4 Minuten
- ImpEx Generation: <1 Sekunde
- HAC Import: ~1 Minute
- Total: ~5 Minuten

**API Mode:**
- 119 Media: ~4 Minuten
- 17 Pages + Components: ~2 Minuten
- Total: ~6 Minuten

## 🔄 Updates

### Version 1.0 (10. Dezember 2025)
- Initial Release
- Storyblok Migration
- SAP CC Migration (ImpEx + API)
- Data Transformers

---

**Weitere Informationen:**
- [Storyblok Migration Guide](../MIGRATION_STORYBLOK.md)
- [SAP CC Migration Guide](../MIGRATION_SAP_CC.md)
- [Image Download Guide](../IMAGE_DOWNLOAD_GUIDE.md)
