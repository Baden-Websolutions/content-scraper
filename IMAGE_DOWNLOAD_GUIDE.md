# Image Download Guide

## 🎯 Übersicht

Der **Enhanced Image Downloader** bietet intelligentes Bild-Management mit folgenden Kernfunktionen:

### ✅ Hauptfeatures

1. **Duplikat-Vermeidung via MD5-Hash**
   - Jedes Bild wird per Content-Hash identifiziert
   - Keine Datei wird doppelt heruntergeladen
   - Spart Speicherplatz und Bandbreite

2. **Ordnerstruktur-Beibehaltung**
   - Originale Pfadstruktur vom Quellserver wird erhalten
   - Ermöglicht einfache Migration und Umzug
   - Persistente URL-Struktur

3. **JSON-Integration**
   - Lokale Pfade in allen Output-Dateien
   - Hash-Tracking für Duplikat-Erkennung
   - Umfassendes Image-Manifest

## 📁 Ordnerstruktur

### Beispiel: lenzingpro.com

```
output/
├── images/
│   ├── lenzingpro.com/
│   │   └── [originale Struktur]
│   ├── api.cqgm99dz6h-lenzingag1-p1-public.model-t.cc.commerce.ondemand.com/
│   │   └── medias/
│   │       ├── logo-lenzing-responsive.svg
│   │       ├── contact-sales.svg
│   │       └── ...
│   └── lenzingprodexporter.blob.core.windows.net/
│       └── exporter/
│           ├── 478903_Hybris_515Wx515H.jpg
│           └── ...
└── lenzingpro_with_images_*.json
```

### Vorteile

✅ **Persistenz**: Pfade bleiben bei Migration gültig  
✅ **Übersichtlichkeit**: Klare Zuordnung zur Quelle  
✅ **Kompatibilität**: Einfacher Import in CMS/CDN  

## 🔧 Verwendung

### Option 1: Vollständiger Scraper mit Bildern

```javascript
const { ContentScraperWithImages } = require('./core/scraper_with_images');

const scraper = new ContentScraperWithImages({
  baseUrl: 'https://lenzingpro.com',
  maxPages: 100,
  downloadImages: true,  // Bilder herunterladen
  outputDir: './output',
  onImageProgress: (data) => {
    console.log(`Image ${data.current}/${data.total}: ${data.url}`);
  }
});

const result = await scraper.scrapeWebsite();
await scraper.saveResults(result, './output/results.json');
```

### Option 2: Nur Bilder herunterladen

```javascript
const { EnhancedImageDownloader } = require('./utils/image_downloader_enhanced');

const downloader = new EnhancedImageDownloader({
  outputDir: './output/images',
  maxSize: 10 * 1024 * 1024  // 10 MB max
});

// Bilder von bereits gescrapten Seiten herunterladen
const pages = require('./output/scraped_pages.json');
const results = await downloader.downloadAllImages(pages, 'https://lenzingpro.com');

// Manifest generieren
downloader.generateManifest('./output/image_manifest.json');
```

## 📊 JSON-Struktur

### Bild-Objekt in Seiten-Daten

```json
{
  "src": "https://example.com/images/logo.png",
  "alt": "Company Logo",
  "title": "Logo",
  "width": "200",
  "height": "100",
  "pageUrl": "https://example.com",
  "localPath": "output/images/example.com/images/logo.png",
  "hash": "d0d798c8a3347a9039dc75000a3961aa",
  "duplicate": false
}
```

### Image Manifest

```json
{
  "generated_at": "2025-12-10T07:49:10.385Z",
  "base_output_dir": "output/images",
  "statistics": {
    "total_urls": 119,
    "unique_files": 119,
    "duplicates": 0,
    "failed": 0,
    "total_size_bytes": 18031324,
    "total_size_mb": "17.20"
  },
  "images": [
    {
      "url": "https://example.com/image.jpg",
      "localPath": "output/images/example.com/image.jpg",
      "hash": "abc123...",
      "duplicate": false,
      "originalFile": null,
      "fileName": "image.jpg",
      "directory": "output/images/example.com"
    }
  ],
  "hash_map": [
    {
      "hash": "abc123...",
      "localPath": "output/images/example.com/image.jpg",
      "fileName": "image.jpg"
    }
  ]
}
```

## 🚀 Test-Ergebnisse: lenzingpro.com

### Statistiken

```
Basis-URL:        https://lenzingpro.com
Seiten:           17
Bilder:           119 unique URLs
Heruntergeladen:  119 Dateien
Duplikate:        0
Fehler:           0
Gesamtgröße:      17,20 MB
Dauer:            ~35 Sekunden
```

### Ordner-Verteilung

- **api.cqgm99dz6h-lenzingag1-p1-public.model-t.cc.commerce.ondemand.com**: 113 Bilder
- **lenzingprodexporter.blob.core.windows.net**: 6 Bilder

## 🔍 Duplikat-Erkennung

### Wie funktioniert es?

1. **Download**: Bild wird heruntergeladen
2. **Hash**: MD5-Hash des Inhalts wird berechnet
3. **Prüfung**: Hash wird mit bereits heruntergeladenen Bildern verglichen
4. **Aktion**:
   - **Neu**: Bild wird gespeichert, Hash registriert
   - **Duplikat**: Verweis auf existierende Datei, kein erneuter Download

### Beispiel

```javascript
// Erste URL
https://example.com/image1.jpg → Download → Hash: abc123
// Zweite URL (gleicher Inhalt)
https://example.com/copy/image1.jpg → Duplikat erkannt → Verweis auf erste Datei
```

### Vorteile

✅ **Speicherplatz**: Nur einzigartige Bilder werden gespeichert  
✅ **Geschwindigkeit**: Duplikate werden sofort erkannt  
✅ **Bandbreite**: Keine redundanten Downloads  

## 📝 Migration & Umzug

### Schritt 1: Bilder herunterladen

```bash
node test_lenzingpro_with_images.js
```

### Schritt 2: Ordnerstruktur prüfen

```bash
cd output/images
tree -L 3
```

### Schritt 3: Bilder in CMS/CDN importieren

Die Ordnerstruktur kann 1:1 übernommen werden:

```bash
# Beispiel: Upload zu CDN
aws s3 sync output/images/ s3://my-cdn-bucket/images/ --recursive
```

### Schritt 4: JSON-Pfade anpassen (optional)

```javascript
// Pfade in JSON von lokal zu CDN ändern
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('output/results.json'));

data.scrapedPages.forEach(page => {
  page.images.forEach(img => {
    if (img.localPath) {
      // output/images/example.com/logo.png
      // → https://cdn.example.com/images/example.com/logo.png
      img.cdnPath = img.localPath.replace(
        'output/images/',
        'https://cdn.example.com/images/'
      );
    }
  });
});

fs.writeFileSync('output/results_with_cdn.json', JSON.stringify(data, null, 2));
```

## ⚙️ Konfiguration

### Basis-Optionen

```javascript
{
  outputDir: './output/images',     // Basis-Ausgabeverzeichnis
  maxSize: 10 * 1024 * 1024,       // Max. Dateigröße (10 MB)
  timeout: 30000                    // Download-Timeout (30s)
}
```

### Scraper-Integration

```javascript
{
  downloadImages: true,             // Bilder herunterladen
  outputDir: './output',            // Basis-Verzeichnis
  maxImageSize: 10 * 1024 * 1024,  // Max. Bildgröße
  imageTimeout: 30000,              // Bild-Download-Timeout
  onImageProgress: (data) => {      // Progress-Callback
    console.log(`${data.current}/${data.total}`);
  }
}
```

## 🐛 Fehlerbehandlung

### Häufige Fehler

#### 1. HTTP 403/404

```
✗ Failed: https://example.com/missing.jpg - HTTP 404
```

**Lösung**: Bild existiert nicht oder ist nicht zugänglich

#### 2. Timeout

```
✗ Failed: https://slow-server.com/image.jpg - Download timeout
```

**Lösung**: `timeout` erhöhen oder Server-Performance prüfen

#### 3. Zu groß

```
✗ Failed: https://example.com/huge.jpg - Image too large: 15728640 bytes
```

**Lösung**: `maxSize` erhöhen

### Fehler-Statistiken

Alle Fehler werden im Ergebnis-Objekt gesammelt:

```json
{
  "imageResults": {
    "failed": [
      {
        "url": "https://example.com/error.jpg",
        "error": "HTTP 404"
      }
    ]
  }
}
```

## 📈 Performance

### Optimierungen

- **Sequenzieller Download**: Vermeidet Server-Überlastung
- **Delay zwischen Downloads**: 100ms Standard
- **In-Memory-Hash-Berechnung**: Schnelle Duplikat-Erkennung
- **Streaming-Download**: Speicher-effizient

### Benchmark: lenzingpro.com

```
119 Bilder / 17,20 MB
Dauer: ~35 Sekunden
Durchschnitt: 3,4 Bilder/Sekunde
Bandbreite: ~500 KB/s
```

## 🔐 Sicherheit

### Best Practices

1. **Validierung**: Nur Bilder von vertrauenswürdigen Domains
2. **Größenlimit**: `maxSize` setzen (Standard: 10 MB)
3. **Timeout**: Verhindert hängende Downloads
4. **User-Agent**: Identifiziert den Scraper

### Beispiel-Konfiguration

```javascript
{
  maxSize: 5 * 1024 * 1024,  // 5 MB max
  timeout: 15000,             // 15s timeout
  allowedDomains: [           // Optional: Domain-Whitelist
    'example.com',
    'cdn.example.com'
  ]
}
```

## 📚 Weitere Ressourcen

- **Test-Script**: `test_lenzingpro_with_images.js`
- **Scraper-Modul**: `core/scraper_with_images.js`
- **Downloader-Modul**: `utils/image_downloader_enhanced.js`
- **Beispiel-Manifest**: `output/*_image_manifest.json`

---

**Version**: 1.1.0  
**Datum**: 10. Dezember 2025  
**Status**: ✅ Produktionsreif
