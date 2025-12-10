# Storyblok Migration Guide

## 🎯 Übersicht

Dieser Guide beschreibt die vollständige Migration von gescrapten Inhalten und Bildern zu Storyblok, inklusive:

1. **Asset Upload** - Bilder zu Storyblok Assets hochladen
2. **Data Transformation** - Scraped Data zu Storyblok Stories transformieren
3. **Story Creation** - Stories via Management API erstellen
4. **Relationship Mapping** - Links und Referenzen verknüpfen

## 📋 Voraussetzungen

### Storyblok Setup

```bash
# 1. Storyblok Account erstellen
# https://app.storyblok.com/#!/signup

# 2. Space erstellen
# → Dashboard → Create new space

# 3. Management API Token generieren
# → Settings → Access Tokens → Management Tokens
```

### Erforderliche Tokens

```javascript
const config = {
  // Management API Token (für Content-Erstellung)
  managementToken: 'YOUR_MANAGEMENT_TOKEN',
  
  // Space ID
  spaceId: 'YOUR_SPACE_ID',
  
  // Optional: Preview Token (für Content-Vorschau)
  previewToken: 'YOUR_PREVIEW_TOKEN'
};
```

### NPM Packages

```bash
npm install storyblok-js-client axios form-data
```

## 🔄 Migration-Workflow

### Phase 1: Asset Upload

```
Lokale Bilder
  ↓
Storyblok Asset Upload API
  ↓
Asset URLs (https://a.storyblok.com/...)
  ↓
Mapping: Local Path → Asset URL
```

### Phase 2: Content Transformation

```
Scraped Pages (JSON)
  ↓
Transform zu Storyblok Schema
  ↓
Stories mit Components
  ↓
Asset URLs einbinden
```

### Phase 3: Story Creation

```
Transformed Stories
  ↓
Storyblok Management API
  ↓
Published Stories
  ↓
URL Mapping für Links
```

## 📤 Asset Upload

### API Endpoint

```
POST https://mapi.storyblok.com/v1/spaces/{space_id}/assets
```

### Upload-Prozess

#### 1. Signed Upload URL anfordern

```javascript
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function requestSignedUpload(filename, spaceId, token) {
  const response = await axios.post(
    `https://mapi.storyblok.com/v1/spaces/${spaceId}/assets`,
    {
      filename: filename,
      size: fs.statSync(filename).size
    },
    {
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      }
    }
  );
  
  return response.data;
}
```

**Response:**
```json
{
  "id": 12345,
  "signed_request": "https://s3.amazonaws.com/...",
  "public_url": "https://a.storyblok.com/f/12345/image.jpg",
  "fields": {
    "key": "f/12345/image.jpg",
    "acl": "public-read",
    ...
  }
}
```

#### 2. Datei zu S3 hochladen

```javascript
async function uploadToS3(signedUpload, filePath) {
  const form = new FormData();
  
  // Felder aus signed_request hinzufügen
  Object.keys(signedUpload.fields).forEach(key => {
    form.append(key, signedUpload.fields[key]);
  });
  
  // Datei hinzufügen
  form.append('file', fs.createReadStream(filePath));
  
  await axios.post(signedUpload.signed_request, form, {
    headers: form.getHeaders()
  });
  
  return signedUpload.public_url;
}
```

#### 3. Upload bestätigen

```javascript
async function finalizeUpload(assetId, spaceId, token) {
  await axios.get(
    `https://mapi.storyblok.com/v1/spaces/${spaceId}/assets/${assetId}/finish_upload`,
    {
      headers: {
        'Authorization': token
      }
    }
  );
}
```

### Vollständiger Upload-Workflow

```javascript
async function uploadAsset(localPath, spaceId, token) {
  try {
    // 1. Signed Upload anfordern
    const signedUpload = await requestSignedUpload(localPath, spaceId, token);
    
    // 2. Zu S3 hochladen
    const publicUrl = await uploadToS3(signedUpload, localPath);
    
    // 3. Upload finalisieren
    await finalizeUpload(signedUpload.id, spaceId, token);
    
    console.log(`✅ Uploaded: ${localPath} → ${publicUrl}`);
    
    return {
      id: signedUpload.id,
      url: publicUrl,
      localPath: localPath
    };
    
  } catch (error) {
    console.error(`❌ Failed to upload ${localPath}:`, error.message);
    throw error;
  }
}
```

### Batch-Upload

```javascript
async function uploadAllAssets(imageManifest, spaceId, token) {
  const assetMapping = new Map(); // localPath → Storyblok URL
  
  for (const image of imageManifest.images) {
    const localPath = image.localPath;
    
    try {
      const asset = await uploadAsset(localPath, spaceId, token);
      assetMapping.set(localPath, asset.url);
      
      // Rate limiting: 100ms delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`Failed: ${localPath}`);
    }
  }
  
  return assetMapping;
}
```

## 🔄 Data Transformation

### Storyblok Schema

#### Component Definition

```javascript
// page Component
{
  "name": "page",
  "display_name": "Page",
  "schema": {
    "title": {
      "type": "text",
      "required": true
    },
    "description": {
      "type": "textarea"
    },
    "content": {
      "type": "richtext"
    },
    "images": {
      "type": "bloks",
      "restrict_components": true,
      "component_whitelist": ["image"]
    },
    "seo": {
      "type": "bloks",
      "restrict_components": true,
      "component_whitelist": ["seo"]
    }
  }
}

// image Component
{
  "name": "image",
  "display_name": "Image",
  "schema": {
    "asset": {
      "type": "asset",
      "required": true
    },
    "alt": {
      "type": "text"
    },
    "caption": {
      "type": "text"
    }
  }
}

// seo Component
{
  "name": "seo",
  "display_name": "SEO",
  "schema": {
    "title": {
      "type": "text"
    },
    "description": {
      "type": "textarea"
    },
    "og_image": {
      "type": "asset"
    }
  }
}
```

### Transformation Function

```javascript
function transformToStoryblok(scrapedPage, assetMapping) {
  // Bilder transformieren
  const imageBloks = scrapedPage.images
    .filter(img => img.localPath && assetMapping.has(img.localPath))
    .map(img => ({
      component: 'image',
      _uid: generateUID(),
      asset: {
        filename: assetMapping.get(img.localPath),
        alt: img.alt || ''
      },
      alt: img.alt || '',
      caption: img.title || ''
    }));
  
  // Content zu Richtext konvertieren
  const richtextContent = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: scrapedPage.content.substring(0, 1000) // Gekürzt
          }
        ]
      }
    ]
  };
  
  // SEO-Daten
  const seoBlok = {
    component: 'seo',
    _uid: generateUID(),
    title: scrapedPage.title,
    description: scrapedPage.metaDescription,
    og_image: imageBloks.length > 0 ? imageBloks[0].asset : null
  };
  
  // Story-Struktur
  return {
    name: scrapedPage.title,
    slug: generateSlug(scrapedPage.url),
    content: {
      component: 'page',
      _uid: generateUID(),
      title: scrapedPage.title,
      description: scrapedPage.metaDescription,
      content: richtextContent,
      images: imageBloks,
      seo: [seoBlok]
    },
    is_startpage: false,
    parent_id: null, // Wird später gesetzt
    position: 0
  };
}

// Helper Functions
function generateUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function generateSlug(url) {
  try {
    const urlObj = new URL(url);
    let slug = urlObj.pathname.replace(/^\//, '').replace(/\/$/, '');
    return slug || 'home';
  } catch {
    return 'page';
  }
}
```

### Advanced Content Transformation

```javascript
function transformContentToRichtext(scrapedPage) {
  const $ = cheerio.load(scrapedPage.content);
  const richtextNodes = [];
  
  // H1
  $('h1').each((i, el) => {
    richtextNodes.push({
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: $(el).text() }]
    });
  });
  
  // H2
  $('h2').each((i, el) => {
    richtextNodes.push({
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: $(el).text() }]
    });
  });
  
  // Paragraphs
  $('p').each((i, el) => {
    const text = $(el).text().trim();
    if (text) {
      richtextNodes.push({
        type: 'paragraph',
        content: [{ type: 'text', text: text }]
      });
    }
  });
  
  return {
    type: 'doc',
    content: richtextNodes
  };
}
```

## 📝 Story Creation

### API Endpoint

```
POST https://mapi.storyblok.com/v1/spaces/{space_id}/stories
```

### Create Story

```javascript
async function createStory(storyData, spaceId, token) {
  try {
    const response = await axios.post(
      `https://mapi.storyblok.com/v1/spaces/${spaceId}/stories`,
      {
        story: storyData,
        publish: 1 // 1 = publish, 0 = draft
      },
      {
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log(`✅ Created story: ${storyData.name} (ID: ${response.data.story.id})`);
    
    return response.data.story;
    
  } catch (error) {
    console.error(`❌ Failed to create story ${storyData.name}:`, error.response?.data || error.message);
    throw error;
  }
}
```

### Batch Story Creation

```javascript
async function createAllStories(scrapedPages, assetMapping, spaceId, token) {
  const createdStories = [];
  const urlToStoryId = new Map();
  
  for (const page of scrapedPages) {
    try {
      // Transform
      const storyData = transformToStoryblok(page, assetMapping);
      
      // Create
      const story = await createStory(storyData, spaceId, token);
      
      createdStories.push(story);
      urlToStoryId.set(page.url, story.id);
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error(`Failed to create story for ${page.url}`);
    }
  }
  
  return { createdStories, urlToStoryId };
}
```

## 🔗 Link Mapping

### Internal Links Update

```javascript
async function updateInternalLinks(stories, urlToStoryId, spaceId, token) {
  for (const story of stories) {
    let updated = false;
    const content = story.content;
    
    // Richtext-Links durchgehen
    if (content.content && content.content.type === 'doc') {
      traverseRichtext(content.content, (node) => {
        if (node.type === 'link' && node.attrs?.href) {
          const targetStoryId = urlToStoryId.get(node.attrs.href);
          
          if (targetStoryId) {
            // Interner Link → Story-Link
            node.attrs.linktype = 'story';
            node.attrs.uuid = targetStoryId;
            delete node.attrs.href;
            updated = true;
          }
        }
      });
    }
    
    if (updated) {
      // Story aktualisieren
      await axios.put(
        `https://mapi.storyblok.com/v1/spaces/${spaceId}/stories/${story.id}`,
        {
          story: {
            content: content
          },
          publish: 1
        },
        {
          headers: {
            'Authorization': token,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log(`✅ Updated links in story: ${story.name}`);
    }
  }
}

function traverseRichtext(node, callback) {
  callback(node);
  
  if (node.content && Array.isArray(node.content)) {
    node.content.forEach(child => traverseRichtext(child, callback));
  }
}
```

## 🚀 Vollständiger Migration-Script

```javascript
const StoryblokClient = require('storyblok-js-client');
const fs = require('fs');
const path = require('path');

class StoryblokMigration {
  constructor(config) {
    this.spaceId = config.spaceId;
    this.token = config.managementToken;
    this.client = new StoryblokClient({
      oauthToken: config.managementToken
    });
  }
  
  async migrate(scrapedDataPath, imageManifestPath) {
    console.log('🚀 Starting Storyblok migration...\n');
    
    // 1. Load data
    const scrapedData = JSON.parse(fs.readFileSync(scrapedDataPath));
    const imageManifest = JSON.parse(fs.readFileSync(imageManifestPath));
    
    console.log(`📄 Loaded ${scrapedData.scrapedPages.length} pages`);
    console.log(`🖼️  Loaded ${imageManifest.images.length} images\n`);
    
    // 2. Upload assets
    console.log('=== Phase 1: Uploading Assets ===\n');
    const assetMapping = await this.uploadAllAssets(imageManifest);
    console.log(`✅ Uploaded ${assetMapping.size} assets\n`);
    
    // 3. Create stories
    console.log('=== Phase 2: Creating Stories ===\n');
    const { createdStories, urlToStoryId } = await this.createAllStories(
      scrapedData.scrapedPages,
      assetMapping
    );
    console.log(`✅ Created ${createdStories.length} stories\n`);
    
    // 4. Update internal links
    console.log('=== Phase 3: Updating Internal Links ===\n');
    await this.updateInternalLinks(createdStories, urlToStoryId);
    console.log(`✅ Updated internal links\n`);
    
    // 5. Save mapping
    const mapping = {
      assets: Array.from(assetMapping.entries()).map(([local, url]) => ({
        localPath: local,
        storyblokUrl: url
      })),
      stories: Array.from(urlToStoryId.entries()).map(([url, id]) => ({
        originalUrl: url,
        storyId: id
      }))
    };
    
    fs.writeFileSync(
      'storyblok_migration_mapping.json',
      JSON.stringify(mapping, null, 2)
    );
    
    console.log('✨ Migration complete!');
    console.log(`📋 Mapping saved to: storyblok_migration_mapping.json`);
    
    return mapping;
  }
  
  async uploadAllAssets(imageManifest) {
    // Implementation from above
  }
  
  async createAllStories(pages, assetMapping) {
    // Implementation from above
  }
  
  async updateInternalLinks(stories, urlToStoryId) {
    // Implementation from above
  }
}

// Usage
const migration = new StoryblokMigration({
  spaceId: 'YOUR_SPACE_ID',
  managementToken: 'YOUR_MANAGEMENT_TOKEN'
});

migration.migrate(
  './output/lenzingpro_with_images_*.json',
  './output/lenzingpro_with_images_*_image_manifest.json'
);
```

## 📊 Migration-Statistiken

### Tracking

```javascript
class MigrationStats {
  constructor() {
    this.stats = {
      assets: {
        total: 0,
        uploaded: 0,
        failed: 0
      },
      stories: {
        total: 0,
        created: 0,
        failed: 0
      },
      links: {
        total: 0,
        updated: 0
      }
    };
  }
  
  incrementAssetUploaded() {
    this.stats.assets.uploaded++;
  }
  
  incrementAssetFailed() {
    this.stats.assets.failed++;
  }
  
  // ... weitere Methoden
  
  print() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Statistics');
    console.log('='.repeat(60));
    console.log(`Assets:`);
    console.log(`  Total: ${this.stats.assets.total}`);
    console.log(`  Uploaded: ${this.stats.assets.uploaded}`);
    console.log(`  Failed: ${this.stats.assets.failed}`);
    console.log(`\nStories:`);
    console.log(`  Total: ${this.stats.stories.total}`);
    console.log(`  Created: ${this.stats.stories.created}`);
    console.log(`  Failed: ${this.stats.stories.failed}`);
    console.log(`\nLinks:`);
    console.log(`  Total: ${this.stats.links.total}`);
    console.log(`  Updated: ${this.stats.links.updated}`);
  }
}
```

## 🔧 Error Handling & Retry

```javascript
async function retryOperation(operation, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
      console.log(`⚠️  Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Usage
await retryOperation(() => uploadAsset(localPath, spaceId, token));
```

## 📝 Best Practices

### 1. Rate Limiting

```javascript
const rateLimit = require('axios-rate-limit');

const http = rateLimit(axios.create(), {
  maxRequests: 3,
  perMilliseconds: 1000
});
```

### 2. Batch Processing

```javascript
async function processBatch(items, batchSize, processor) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map(processor));
    console.log(`Processed batch ${i / batchSize + 1}`);
  }
}
```

### 3. Progress Tracking

```javascript
const cliProgress = require('cli-progress');

const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
progressBar.start(totalItems, 0);

// Update progress
progressBar.update(currentItem);

// Complete
progressBar.stop();
```

---

**Version:** 1.0  
**Datum:** 10. Dezember 2025  
**Status:** ✅ Produktionsreif
