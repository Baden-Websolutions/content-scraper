# Content Scraper - Technical Documentation

## Projektübersicht

Der **Content Scraper** ist ein universeller Web-Crawler für generische Anwendungsfälle. Er bietet vollständige Integration für **Nuxt.js**, **Storyblok CMS** und **SAP Commerce Cloud** mit einer modernen Web-UI und Live-Tracking-Funktionalität.

## Architektur

### Modulare Struktur

Das Projekt folgt einer modularen Architektur mit klarer Trennung der Verantwortlichkeiten:

**Core-Module** (`core/`): Kernfunktionalität für Scraping und Export
- `scraper.js`: Hauptscraper mit Puppeteer und Cheerio
- `enhancer.js`: Content-Anreicherung und Metadaten-Extraktion
- `storyblok_mapper.js`: Storyblok-Story-Generierung
- `nuxt_generator.js`: Nuxt.js-Vue-Komponenten-Generator
- `sap_cc_adapter.js`: SAP Commerce Cloud Adapter

**Utility-Module** (`utils/`): Hilfsfunktionen
- `sitemap_generator.js`: XML-Sitemap-Generierung
- `image_downloader.js`: Bild-Download und -Verwaltung

**Interfaces**: Verschiedene Zugriffsmöglichkeiten
- `cli.js`: Kommandozeilen-Interface
- `server.js`: Web-Server mit WebSocket
- `index.js`: Programmatische API

## Technische Details

### Scraping-Engine

Die Scraping-Engine basiert auf **Puppeteer** für Browser-Automatisierung und **Cheerio** für HTML-Parsing. Der Scraper verwendet einen Breadth-First-Search-Algorithmus zum Durchsuchen der Website.

**Hauptfunktionen:**
- Automatische Link-Erkennung und -Verfolgung
- Intelligente Content-Extraktion
- Bild- und Metadaten-Sammlung
- Fehlerbehandlung und Retry-Logik
- Konfigurierbare Verzögerung zwischen Requests

### Content Enhancement

Der Content Enhancer reichert die gescrapten Daten mit zusätzlichen Metadaten an:

- **SEO-Optimierung**: Titel, Beschreibungen, Keywords
- **Content-Strukturierung**: Automatische Erkennung von Abschnitten
- **Asset-Organisation**: Kategorisierung von Bildern (Hero, Gallery, Thumbnails)
- **Link-Kategorisierung**: Navigation vs. Content-Links
- **Lesezeit-Berechnung**: Basierend auf Wortanzahl

### Export-Formate

#### Storyblok

Generiert vollständige Story-Dateien mit Komponenten-Struktur:

```javascript
{
  story: {
    name: "Page Title",
    slug: "page-slug",
    content: {
      component: "page",
      body: [
        { component: "hero", ... },
        { component: "rich_text_section", ... }
      ]
    }
  }
}
```

#### Nuxt.js

Erstellt Vue-Komponenten mit Composition API:

- Responsive Layouts
- SEO Meta-Tags
- Bildergalerien
- Strukturierte Content-Bereiche

#### SAP Commerce Cloud

Generiert:
- Content Pages (JSON)
- Produkte und Kategorien
- ImpEx-Dateien für direkten Import

### Live-Tracking

Das Live-Tracking-System verwendet **WebSocket** für Echtzeit-Updates:

**Server-Side:**
- Express-Server mit WebSocket-Integration
- Job-Management und -Historie
- Broadcast-System für Updates

**Client-Side:**
- Automatische Reconnection
- Echtzeit-Fortschrittsanzeige
- Live-Log-Streaming
- Statistik-Dashboard

## Verwendung

### Web-UI (Empfohlen)

```bash
npm run server
# Öffne http://localhost:3000
```

Die Web-UI bietet:
- Interaktives Konfigurationsformular
- Echtzeit-Fortschrittsverfolgung
- Live-Log mit Zeitstempeln
- Job-Historie mit Status
- Visuelle Statistiken

### CLI

```bash
# Interaktiver Modus
npm start

# Mit Argumenten
node cli.js --url https://lenzingpro.com --max-pages 100
```

### Programmatisch

```javascript
const { scrapeAndExport } = require('./content_scraper');

const result = await scrapeAndExport({
  baseUrl: 'https://lenzingpro.com',
  maxPages: 50,
  formats: ['json', 'storyblok', 'nuxt'],
  onProgress: (progress) => {
    console.log(`${progress.current}/${progress.total}`);
  }
});
```

## Konfiguration

### Scraper-Optionen

| Option | Typ | Standard | Beschreibung |
|--------|-----|----------|--------------|
| `baseUrl` | string | - | Basis-URL der Website (erforderlich) |
| `maxPages` | number | 50 | Maximale Anzahl zu scrapender Seiten |
| `delay` | number | 1000 | Verzögerung zwischen Requests (ms) |
| `headless` | boolean | true | Browser im Headless-Modus |
| `timeout` | number | 30000 | Timeout für Seitenladung (ms) |

### Export-Optionen

| Option | Typ | Standard | Beschreibung |
|--------|-----|----------|--------------|
| `formats` | array | ['json'] | Export-Formate |
| `outputDir` | string | './output' | Ausgabeverzeichnis |
| `downloadImages` | boolean | false | Bilder herunterladen |

## Best Practices

### Performance-Optimierung

**Für große Websites:**
- Erhöhe die Verzögerung zwischen Requests (`delay: 2000`)
- Begrenze die maximale Seitenanzahl (`maxPages: 100`)
- Verwende Headless-Modus (`headless: true`)

**Speicher-Management:**
```bash
node --max-old-space-size=4096 cli.js
```

### Rate Limiting

Respektiere die `robots.txt` der Zielwebsite und verwende angemessene Verzögerungen:

```javascript
{
  delay: 2000, // 2 Sekunden zwischen Requests
  maxPages: 50 // Begrenze die Anzahl
}
```

### Fehlerbehandlung

Der Scraper behandelt Fehler automatisch:
- Fehlgeschlagene Seiten werden protokolliert
- Scraping wird fortgesetzt
- Fehlerberichte in der Ausgabe

## Erweiterung

### Custom Exporter

```javascript
class CustomExporter {
  constructor(config = {}) {
    this.config = config;
  }

  export(pages) {
    // Deine Export-Logik
    return exportedData;
  }
}

module.exports = { CustomExporter };
```

### Custom Scraper

```javascript
const { ContentScraper } = require('./core/scraper');

class CustomScraper extends ContentScraper {
  async scrapePage(url) {
    const data = await super.scrapePage(url);
    // Füge benutzerdefinierte Logik hinzu
    return data;
  }
}
```

## Fehlerbehebung

### Puppeteer-Probleme

**Ubuntu/Debian:**
```bash
sudo apt-get install -y chromium-browser libx11-xcb1 libxcomposite1
```

**Headless-Modus deaktivieren für Debugging:**
```javascript
{ headless: false }
```

### WebSocket-Verbindungsprobleme

Stelle sicher, dass der Port nicht blockiert ist:
```bash
netstat -tuln | grep 3000
```

### Speicherprobleme

Für große Websites:
```bash
node --max-old-space-size=4096 server.js
```

## Architektur-Konzepte

**Kernfunktionalitäten:**
- Modulare Scraping-Architektur
- Content-Enhancement-Pipeline
- Storyblok-Mapping-Logik
- Bild-Extraktion
- Nuxt.js-Support
- SAP Commerce Cloud Integration
- Web-UI mit Live-Tracking

## Lizenz

MIT License - siehe LICENSE-Datei für Details.

## Support

Bei Fragen oder Problemen öffne bitte ein Issue auf GitHub.

---

**Version:** 1.0.0  
**Datum:** 10. Dezember 2025  
**Autor:** Baden Websolutions
