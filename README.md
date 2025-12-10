# Content Scraper

Universal web content scraper optimized for **Nuxt.js**, **Storyblok CMS**, and **SAP Commerce Cloud** with live tracking UI.

## 🚀 Features

### Core Capabilities
- **Intelligent Web Scraping**: Puppeteer-based crawler with Cheerio parsing
- **Content Enhancement**: Automatic metadata extraction and content structuring
- **Multi-Format Export**: JSON, Storyblok Stories, Nuxt.js Components, SAP CC ImpEx, XML Sitemap
- **Image Management**: Automatic image download and asset organization
- **Live Tracking**: Real-time progress monitoring via WebSocket
- **Web UI**: Beautiful control panel for managing scraping jobs

### Target Platforms
- **Nuxt.js**: Generate ready-to-use Vue components with Composition API
- **Storyblok**: Create story files with proper component structure
- **SAP Commerce Cloud**: Export content pages, products, and ImpEx files

## 📦 Installation

```bash
# Navigate to the content_scraper directory
cd content_scraper

# Install dependencies
npm install
```

## 🎯 Usage

### Option 1: Web UI (Recommended)

Start the web server with live tracking interface:

```bash
npm run server
```

Then open `http://localhost:3000` in your browser.

**Features:**
- Interactive configuration form
- Real-time progress tracking
- Live log streaming
- Job history management
- Visual statistics dashboard

### Option 2: Command Line Interface

Run the interactive CLI:

```bash
npm start
```

Or with arguments:

```bash
node cli.js --url https://lenzingpro.com --max-pages 100 --output ./my-output
```

**CLI Options:**
- `--url <url>`: Base URL to scrape (required)
- `--max-pages <n>`: Maximum pages to scrape (default: 50)
- `--delay <ms>`: Delay between requests (default: 1000)
- `--output <dir>`: Output directory (default: ./output)
- `--help`: Show help message

### Option 3: Programmatic API

```javascript
const { scrapeAndExport } = require('./content_scraper');

async function run() {
  const result = await scrapeAndExport({
    baseUrl: 'https://lenzingpro.com',
    maxPages: 50,
    delay: 1000,
    outputDir: './output',
    formats: ['json', 'storyblok', 'nuxt', 'sap-cc', 'sitemap'],
    downloadImages: true,
    onProgress: (progress) => {
      console.log(`Progress: ${progress.current}/${progress.total}`);
    }
  });

  console.log('Scraping complete!');
  console.log(`Pages scraped: ${result.statistics.totalPages}`);
  console.log(`Total words: ${result.statistics.totalWords}`);
}

run();
```

## 📂 Project Structure

```
content_scraper/
├── core/                      # Core scraping modules
│   ├── scraper.js            # Main scraper with Puppeteer
│   ├── enhancer.js           # Content enhancement and structuring
│   ├── storyblok_mapper.js   # Storyblok story generator
│   ├── nuxt_generator.js     # Nuxt.js component generator
│   └── sap_cc_adapter.js     # SAP Commerce Cloud adapter
├── utils/                     # Utility modules
│   ├── sitemap_generator.js  # XML sitemap generator
│   └── image_downloader.js   # Image download manager
├── public/                    # Web UI assets
│   └── index.html            # Control panel interface
├── output/                    # Default output directory
├── config/                    # Configuration files
├── index.js                   # Main entry point
├── cli.js                     # CLI interface
├── server.js                  # Web server with WebSocket
├── package.json              # Dependencies and scripts
└── README.md                 # This file
```

## 🔧 Configuration

### Scraper Configuration

```javascript
{
  baseUrl: 'https://lenzingpro.com',     // Target website URL
  maxPages: 50,                       // Maximum pages to scrape
  delay: 1000,                        // Delay between requests (ms)
  headless: true,                     // Run browser in headless mode
  timeout: 30000,                     // Page load timeout (ms)
  userAgent: 'ContentScraper/1.0'     // Custom user agent
}
```

### Export Formats

- **json**: Raw and enhanced data in JSON format
- **storyblok**: Storyblok story files (`.story.json`)
- **nuxt**: Nuxt.js Vue components (`.vue`)
- **sap-cc**: SAP Commerce Cloud content pages and ImpEx
- **sitemap**: XML sitemap for SEO

## 📊 Output Structure

```
output/
├── raw_data.json              # Raw scraped data
├── enhanced_data.json         # Enhanced with metadata
├── sitemap.xml               # XML sitemap
├── nuxt-routes.json          # Nuxt.js routes configuration
├── storyblok/                # Storyblok stories
│   ├── home.story.json
│   ├── about.story.json
│   └── stories.json          # Index file
├── nuxt-components/          # Nuxt.js components
│   ├── home.vue
│   └── about.vue
├── sap-commerce/             # SAP CC exports
│   ├── content_pages.json
│   ├── products.json
│   ├── categories.json
│   └── import.impex
└── images/                   # Downloaded images
    ├── image1.jpg
    ├── image2.png
    └── manifest.json
```

## 🎨 Storyblok Integration

The scraper generates Storyblok-compatible story files with the following structure:

```json
{
  "story": {
    "name": "Page Title",
    "slug": "page-slug",
    "content": {
      "_uid": "unique-id",
      "component": "page",
      "body": [
        {
          "_uid": "block-id",
          "component": "hero",
          "title": "Hero Title",
          "background_image": { "filename": "..." }
        },
        {
          "_uid": "block-id",
          "component": "rich_text_section",
          "content": "..."
        }
      ]
    }
  }
}
```

## ⚡ Nuxt.js Integration

Generated Vue components use **Composition API** and include:

- Responsive layouts
- SEO meta tags
- Image galleries
- Related links sections
- Structured content sections

Example usage in Nuxt.js:

```javascript
// nuxt.config.ts
export default defineNuxtConfig({
  // ... other config
})

// pages/[slug].vue
<template>
  <component :is="pageComponent" />
</template>

<script setup>
const route = useRoute()
const pageComponent = defineAsyncComponent(() => 
  import(`~/components/scraped/${route.params.slug}.vue`)
)
</script>
```

## 🏢 SAP Commerce Cloud Integration

The scraper generates:

1. **Content Pages**: JSON format with slots and components
2. **Products**: Product catalog entries
3. **Categories**: Category structure
4. **ImpEx**: Ready-to-import ImpEx file

Import to SAP CC:

```bash
# Via HAC (Hybris Administration Console)
1. Navigate to Console > ImpEx Import
2. Upload the generated import.impex file
3. Execute import

# Via command line
ant importimpex -Dimpexfile=output/sap-commerce/import.impex
```

## 🔍 Advanced Features

### Live Progress Tracking

The web UI provides real-time updates via WebSocket:

- Current page being scraped
- Progress percentage
- Live log stream
- Statistics dashboard

### Image Download

Automatically downloads and organizes images:

```javascript
{
  downloadImages: true,
  imageConfig: {
    maxSize: 10 * 1024 * 1024,  // 10MB max
    timeout: 30000               // 30s timeout
  }
}
```

### Content Enhancement

Automatically adds:

- SEO metadata
- Reading time calculation
- Content excerpts
- Structured sections
- Asset organization
- Link categorization

## 🛠️ Development

### Adding Custom Exporters

Create a new module in `core/`:

```javascript
// core/custom_exporter.js
class CustomExporter {
  constructor(config = {}) {
    this.config = config;
  }

  export(pages) {
    // Your export logic
    return exportedData;
  }
}

module.exports = { CustomExporter };
```

### Extending the Scraper

```javascript
const { ContentScraper } = require('./core/scraper');

class CustomScraper extends ContentScraper {
  async scrapePage(url) {
    const data = await super.scrapePage(url);
    // Add custom logic
    return data;
  }
}
```

## 📝 Examples

### Example 1: Scrape and Export to Storyblok

```javascript
const { scrapeAndExport } = require('./content_scraper');

await scrapeAndExport({
  baseUrl: 'https://myblog.com',
  maxPages: 100,
  formats: ['storyblok'],
  outputDir: './storyblok-export'
});
```

### Example 2: Generate Nuxt.js Site

```javascript
const { ContentScraper, NuxtGenerator } = require('./content_scraper');

const scraper = new ContentScraper({
  baseUrl: 'https://mysite.com',
  maxPages: 50
});

const result = await scraper.scrapeWebsite();

const generator = new NuxtGenerator({
  componentStyle: 'composition'
});

generator.generateAll(result.scrapedPages, './nuxt-site/components');
```

### Example 3: SAP Commerce Cloud Migration

```javascript
const { scrapeAndExport } = require('./content_scraper');

await scrapeAndExport({
  baseUrl: 'https://oldsite.com',
  maxPages: 500,
  formats: ['sap-cc'],
  outputDir: './sap-migration'
});

// Import the generated ImpEx file to SAP CC
```

## 🐛 Troubleshooting

### Puppeteer Installation Issues

```bash
# Install Chromium dependencies (Ubuntu/Debian)
sudo apt-get install -y \
  chromium-browser \
  libx11-xcb1 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxi6 \
  libxtst6 \
  libnss3 \
  libcups2 \
  libxss1 \
  libxrandr2 \
  libasound2 \
  libatk1.0-0 \
  libgtk-3-0
```

### Memory Issues

For large sites, increase Node.js memory:

```bash
node --max-old-space-size=4096 cli.js --url https://lenzingpro.com
```

### Rate Limiting

Increase delay between requests:

```bash
node cli.js --url https://lenzingpro.com --delay 2000
```

## 📄 License

MIT License - see LICENSE file for details

## 👥 Author

**Baden Websolutions**

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For issues and questions, please open an issue on GitHub.

---

**Built with ❤️ for modern web development**
