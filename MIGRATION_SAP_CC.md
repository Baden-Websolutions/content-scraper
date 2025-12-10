# SAP Commerce Cloud Migration Guide

## 🎯 Übersicht

Dieser Guide beschreibt die vollständige Migration von gescrapten Inhalten und Bildern zu SAP Commerce Cloud (Hybris), inklusive:

1. **Media Upload** - Bilder zu SAP CC Media hochladen
2. **ImpEx Generation** - Content Pages und Products als ImpEx
3. **OCC API Integration** - REST API für Content-Erstellung
4. **CMS Component Mapping** - Scraped Content zu CMS Components

## 📋 Voraussetzungen

### SAP CC Setup

```bash
# 1. SAP Commerce Cloud Instanz
# - Cloud Portal: https://portal.commerce.ondemand.com
# - Oder: Lokale Installation

# 2. API Credentials
# - OAuth Client ID & Secret
# - OCC API Endpoint

# 3. Catalog Setup
# - Content Catalog erstellt
# - Product Catalog erstellt
```

### Erforderliche Konfiguration

```javascript
const config = {
  // OCC API Endpoint
  baseUrl: 'https://api.{your-environment}.model-t.cc.commerce.ondemand.com',
  
  // OAuth Credentials
  clientId: 'YOUR_CLIENT_ID',
  clientSecret: 'YOUR_CLIENT_SECRET',
  
  // Catalog Configuration
  contentCatalog: 'yourContentCatalog',
  contentCatalogVersion: 'Staged', // oder 'Online'
  productCatalog: 'yourProductCatalog',
  productCatalogVersion: 'Staged',
  
  // Base Site
  baseSite: 'yourBaseSite'
};
```

### NPM Packages

```bash
npm install axios form-data
```

## 🔐 OAuth Authentication

### Token Request

```javascript
const axios = require('axios');
const qs = require('querystring');

async function getOAuthToken(config) {
  const tokenUrl = `${config.baseUrl}/authorizationserver/oauth/token`;
  
  const response = await axios.post(
    tokenUrl,
    qs.stringify({
      grant_type: 'client_credentials',
      client_id: config.clientId,
      client_secret: config.clientSecret
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );
  
  return response.data.access_token;
}

// Usage
const token = await getOAuthToken(config);
```

### Authenticated Request Helper

```javascript
async function makeAuthenticatedRequest(method, url, data, token) {
  return axios({
    method: method,
    url: url,
    data: data,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
}
```

## 📤 Media Upload

### OCC Media API

```
POST /occ/v2/{baseSite}/medias
```

### Upload Single Media

```javascript
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function uploadMedia(localPath, mediaCode, config, token) {
  const form = new FormData();
  
  // Media Metadata
  const metadata = {
    code: mediaCode,
    catalogId: config.contentCatalog,
    catalogVersion: config.contentCatalogVersion,
    mime: getMimeType(localPath),
    altText: path.basename(localPath, path.extname(localPath))
  };
  
  form.append('metadata', JSON.stringify(metadata));
  form.append('file', fs.createReadStream(localPath));
  
  try {
    const response = await axios.post(
      `${config.baseUrl}/occ/v2/${config.baseSite}/medias`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log(`✅ Uploaded media: ${mediaCode}`);
    
    return {
      code: mediaCode,
      url: response.data.url,
      downloadUrl: response.data.downloadUrl
    };
    
  } catch (error) {
    console.error(`❌ Failed to upload ${localPath}:`, error.response?.data || error.message);
    throw error;
  }
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}
```

### Batch Media Upload

```javascript
async function uploadAllMedia(imageManifest, config, token) {
  const mediaMapping = new Map(); // localPath → Media Code
  
  for (const image of imageManifest.images) {
    const localPath = image.localPath;
    
    // Generate unique media code
    const mediaCode = generateMediaCode(localPath);
    
    try {
      const media = await uploadMedia(localPath, mediaCode, config, token);
      mediaMapping.set(localPath, media.code);
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error(`Failed: ${localPath}`);
    }
  }
  
  return mediaMapping;
}

function generateMediaCode(localPath) {
  // Beispiel: output/images/example.com/logo.png
  //        → example_com_logo_png_abc123
  
  const normalized = localPath
    .replace(/^output\/images\//, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .toLowerCase();
  
  const hash = require('crypto')
    .createHash('md5')
    .update(localPath)
    .digest('hex')
    .substring(0, 8);
  
  return `${normalized}_${hash}`;
}
```

## 📄 ImpEx Generation

### Content Page ImpEx

```impex
# Content Page Template
INSERT_UPDATE ContentPage;$contentCV[unique=true];uid[unique=true];name;masterTemplate(uid,$contentCV);label;defaultPage[default='true'];approvalStatus(code)[default='approved'];homepage[default='false']
;;{page_uid};{page_name};{template_uid};{label};true;approved;false

# Content Slot
INSERT_UPDATE ContentSlot;$contentCV[unique=true];uid[unique=true];name;active;cmsComponents(&componentRef)
;;{slot_uid};{slot_name};true;{component_refs}

# Paragraph Component
INSERT_UPDATE CMSParagraphComponent;$contentCV[unique=true];uid[unique=true];name;&componentRef;content
;;{component_uid};{component_name};{component_uid};{html_content}

# Image Component
INSERT_UPDATE BannerComponent;$contentCV[unique=true];uid[unique=true];name;&componentRef;media(code,$contentCV);urlLink
;;{component_uid};{component_name};{component_uid};{media_code};{url}
```

### ImpEx Generator

```javascript
function generateContentPageImpEx(scrapedPage, mediaMapping, config) {
  const pageUid = generatePageUid(scrapedPage.url);
  const slotUid = `${pageUid}-MainSlot`;
  const componentRefs = [];
  
  let impex = `# Content Page: ${scrapedPage.title}\n`;
  impex += `$contentCV=catalogVersion(catalog(id[default='${config.contentCatalog}']),version[default='${config.contentCatalogVersion}'])[unique=true]\n\n`;
  
  // Page
  impex += `INSERT_UPDATE ContentPage;$contentCV[unique=true];uid[unique=true];name;masterTemplate(uid,$contentCV);label;defaultPage;approvalStatus(code);homepage\n`;
  impex += `;;${pageUid};${escapeCsv(scrapedPage.title)};ContentPage1Template;${pageUid};true;approved;false\n\n`;
  
  // Paragraph Component (Main Content)
  const paragraphUid = `${pageUid}-Paragraph`;
  componentRefs.push(paragraphUid);
  
  impex += `INSERT_UPDATE CMSParagraphComponent;$contentCV[unique=true];uid[unique=true];name;&componentRef;content\n`;
  impex += `;;${paragraphUid};${escapeCsv(scrapedPage.title)} Content;${paragraphUid};${escapeHtml(scrapedPage.content.substring(0, 5000))}\n\n`;
  
  // Image Components
  scrapedPage.images.forEach((img, index) => {
    if (img.localPath && mediaMapping.has(img.localPath)) {
      const imageUid = `${pageUid}-Image${index}`;
      componentRefs.push(imageUid);
      
      impex += `INSERT_UPDATE BannerComponent;$contentCV[unique=true];uid[unique=true];name;&componentRef;media(code,$contentCV);urlLink\n`;
      impex += `;;${imageUid};${escapeCsv(img.alt || 'Image')};${imageUid};${mediaMapping.get(img.localPath)};\n\n`;
    }
  });
  
  // Content Slot
  impex += `INSERT_UPDATE ContentSlot;$contentCV[unique=true];uid[unique=true];name;active;cmsComponents(&componentRef)\n`;
  impex += `;;${slotUid};${pageUid} Main Slot;true;${componentRefs.join(',')}\n\n`;
  
  // Slot for Page
  impex += `INSERT_UPDATE ContentSlotForPage;$contentCV[unique=true];uid[unique=true];position[unique=true];page(uid,$contentCV)[unique=true];contentSlot(uid,$contentCV)[unique=true]\n`;
  impex += `;;${pageUid}-MainSlotForPage;Section1;${pageUid};${slotUid}\n\n`;
  
  return impex;
}

function generatePageUid(url) {
  try {
    const urlObj = new URL(url);
    let uid = urlObj.pathname
      .replace(/^\//, '')
      .replace(/\/$/, '')
      .replace(/[^a-zA-Z0-9]/g, '-')
      .toLowerCase();
    
    return uid || 'homepage';
  } catch {
    return 'page';
  }
}

function escapeCsv(str) {
  if (!str) return '';
  return str.replace(/"/g, '""');
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```

### Product ImpEx

```javascript
function generateProductImpEx(scrapedPage, mediaMapping, config) {
  const productCode = generateProductCode(scrapedPage.url);
  
  let impex = `# Product: ${scrapedPage.title}\n`;
  impex += `$productCV=catalogVersion(catalog(id[default='${config.productCatalog}']),version[default='${config.productCatalogVersion}'])[unique=true]\n`;
  impex += `$approved=approvalstatus(code)[default='approved']\n\n`;
  
  // Product
  impex += `INSERT_UPDATE Product;$productCV[unique=true];code[unique=true];name;description;$approved\n`;
  impex += `;;${productCode};${escapeCsv(scrapedPage.title)};${escapeCsv(scrapedPage.metaDescription)};approved\n\n`;
  
  // Product Images
  if (scrapedPage.images.length > 0) {
    const primaryImage = scrapedPage.images[0];
    
    if (primaryImage.localPath && mediaMapping.has(primaryImage.localPath)) {
      impex += `UPDATE Product;$productCV[unique=true];code[unique=true];picture(code,$productCV)\n`;
      impex += `;;${productCode};${mediaMapping.get(primaryImage.localPath)}\n\n`;
    }
    
    // Gallery Images
    const galleryImages = scrapedPage.images
      .slice(1, 6)
      .filter(img => img.localPath && mediaMapping.has(img.localPath))
      .map(img => mediaMapping.get(img.localPath));
    
    if (galleryImages.length > 0) {
      impex += `UPDATE Product;$productCV[unique=true];code[unique=true];galleryImages(code,$productCV)\n`;
      impex += `;;${productCode};${galleryImages.join(',')}\n\n`;
    }
  }
  
  return impex;
}

function generateProductCode(url) {
  try {
    const urlObj = new URL(url);
    let code = urlObj.pathname
      .replace(/^\//, '')
      .replace(/\/$/, '')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toUpperCase();
    
    return code || 'PRODUCT';
  } catch {
    return 'PRODUCT';
  }
}
```

### Complete ImpEx File Generation

```javascript
function generateCompleteImpEx(scrapedPages, mediaMapping, config) {
  let impex = `# SAP Commerce Cloud ImpEx\n`;
  impex += `# Generated: ${new Date().toISOString()}\n`;
  impex += `# Source: Content Scraper\n\n`;
  
  impex += `# ========================================\n`;
  impex += `# Media\n`;
  impex += `# ========================================\n\n`;
  
  impex += `$contentCV=catalogVersion(catalog(id[default='${config.contentCatalog}']),version[default='${config.contentCatalogVersion}'])[unique=true]\n\n`;
  
  // Media Containers (optional)
  impex += `INSERT_UPDATE MediaContainer;qualifier[unique=true];$contentCV[unique=true];medias(code,$contentCV)\n`;
  
  const mediaGroups = groupMediaByPage(scrapedPages, mediaMapping);
  mediaGroups.forEach(group => {
    impex += `;;${group.qualifier};${group.mediaCodes.join(',')}\n`;
  });
  
  impex += `\n# ========================================\n`;
  impex += `# Content Pages\n`;
  impex += `# ========================================\n\n`;
  
  scrapedPages.forEach(page => {
    impex += generateContentPageImpEx(page, mediaMapping, config);
    impex += `\n`;
  });
  
  return impex;
}

function groupMediaByPage(pages, mediaMapping) {
  return pages.map(page => {
    const pageUid = generatePageUid(page.url);
    const mediaCodes = page.images
      .filter(img => img.localPath && mediaMapping.has(img.localPath))
      .map(img => mediaMapping.get(img.localPath));
    
    return {
      qualifier: `${pageUid}-MediaContainer`,
      mediaCodes: mediaCodes
    };
  }).filter(group => group.mediaCodes.length > 0);
}
```

## 🔄 OCC API Integration

### Create Content Page via API

```javascript
async function createContentPage(pageData, config, token) {
  const endpoint = `${config.baseUrl}/occ/v2/${config.baseSite}/cms/pages`;
  
  const payload = {
    uid: pageData.uid,
    name: pageData.name,
    typeCode: 'ContentPage',
    catalogVersion: {
      catalog: {
        id: config.contentCatalog
      },
      version: config.contentCatalogVersion
    },
    label: pageData.label,
    defaultPage: true,
    approvalStatus: 'APPROVED',
    masterTemplate: {
      uid: 'ContentPage1Template'
    }
  };
  
  try {
    const response = await makeAuthenticatedRequest(
      'POST',
      endpoint,
      payload,
      token
    );
    
    console.log(`✅ Created page: ${pageData.name}`);
    return response.data;
    
  } catch (error) {
    console.error(`❌ Failed to create page ${pageData.name}:`, error.response?.data || error.message);
    throw error;
  }
}
```

### Create CMS Component via API

```javascript
async function createCMSComponent(componentData, config, token) {
  const endpoint = `${config.baseUrl}/occ/v2/${config.baseSite}/cms/components`;
  
  const payload = {
    uid: componentData.uid,
    name: componentData.name,
    typeCode: componentData.typeCode,
    catalogVersion: {
      catalog: {
        id: config.contentCatalog
      },
      version: config.contentCatalogVersion
    },
    ...componentData.properties
  };
  
  try {
    const response = await makeAuthenticatedRequest(
      'POST',
      endpoint,
      payload,
      token
    );
    
    console.log(`✅ Created component: ${componentData.name}`);
    return response.data;
    
  } catch (error) {
    console.error(`❌ Failed to create component ${componentData.name}:`, error.response?.data || error.message);
    throw error;
  }
}
```

### Add Component to Slot

```javascript
async function addComponentToSlot(slotUid, componentUid, position, config, token) {
  const endpoint = `${config.baseUrl}/occ/v2/${config.baseSite}/cms/slots/${slotUid}/components`;
  
  const payload = {
    component: {
      uid: componentUid
    },
    position: position
  };
  
  try {
    await makeAuthenticatedRequest(
      'POST',
      endpoint,
      payload,
      token
    );
    
    console.log(`✅ Added component ${componentUid} to slot ${slotUid}`);
    
  } catch (error) {
    console.error(`❌ Failed to add component to slot:`, error.response?.data || error.message);
    throw error;
  }
}
```

## 🚀 Vollständiger Migration-Script

### SAP CC Migration Class

```javascript
class SAPCCMigration {
  constructor(config) {
    this.config = config;
    this.token = null;
  }
  
  async authenticate() {
    this.token = await getOAuthToken(this.config);
    console.log('✅ Authenticated with SAP CC\n');
  }
  
  async migrate(scrapedDataPath, imageManifestPath, mode = 'impex') {
    console.log('🚀 Starting SAP Commerce Cloud migration...\n');
    
    // Authenticate
    await this.authenticate();
    
    // Load data
    const scrapedData = JSON.parse(fs.readFileSync(scrapedDataPath));
    const imageManifest = JSON.parse(fs.readFileSync(imageManifestPath));
    
    console.log(`📄 Loaded ${scrapedData.scrapedPages.length} pages`);
    console.log(`🖼️  Loaded ${imageManifest.images.length} images\n`);
    
    if (mode === 'impex') {
      return await this.migrateViaImpEx(scrapedData, imageManifest);
    } else {
      return await this.migrateViaAPI(scrapedData, imageManifest);
    }
  }
  
  async migrateViaImpEx(scrapedData, imageManifest) {
    console.log('=== Migration Mode: ImpEx ===\n');
    
    // 1. Upload media
    console.log('Phase 1: Uploading Media...\n');
    const mediaMapping = await uploadAllMedia(
      imageManifest,
      this.config,
      this.token
    );
    console.log(`✅ Uploaded ${mediaMapping.size} media files\n`);
    
    // 2. Generate ImpEx
    console.log('Phase 2: Generating ImpEx...\n');
    const impex = generateCompleteImpEx(
      scrapedData.scrapedPages,
      mediaMapping,
      this.config
    );
    
    // 3. Save ImpEx file
    const impexPath = 'sap_cc_migration.impex';
    fs.writeFileSync(impexPath, impex);
    console.log(`✅ ImpEx saved to: ${impexPath}\n`);
    
    console.log('✨ Migration complete!');
    console.log('📋 Next steps:');
    console.log('  1. Review the ImpEx file');
    console.log('  2. Import via HAC (Hybris Administration Console)');
    console.log('  3. Verify content in Backoffice');
    
    return {
      mediaMapping: Array.from(mediaMapping.entries()),
      impexPath: impexPath
    };
  }
  
  async migrateViaAPI(scrapedData, imageManifest) {
    console.log('=== Migration Mode: OCC API ===\n');
    
    // 1. Upload media
    console.log('Phase 1: Uploading Media...\n');
    const mediaMapping = await uploadAllMedia(
      imageManifest,
      this.config,
      this.token
    );
    console.log(`✅ Uploaded ${mediaMapping.size} media files\n`);
    
    // 2. Create pages
    console.log('Phase 2: Creating Content Pages...\n');
    const createdPages = [];
    
    for (const page of scrapedData.scrapedPages) {
      try {
        // Create page
        const pageData = transformToSAPCCPage(page);
        const createdPage = await createContentPage(
          pageData,
          this.config,
          this.token
        );
        
        // Create components
        const components = transformToSAPCCComponents(page, mediaMapping);
        for (const component of components) {
          await createCMSComponent(component, this.config, this.token);
        }
        
        createdPages.push(createdPage);
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`Failed to create page: ${page.url}`);
      }
    }
    
    console.log(`✅ Created ${createdPages.length} pages\n`);
    console.log('✨ Migration complete!');
    
    return {
      mediaMapping: Array.from(mediaMapping.entries()),
      createdPages: createdPages
    };
  }
}

// Transformation Functions
function transformToSAPCCPage(scrapedPage) {
  return {
    uid: generatePageUid(scrapedPage.url),
    name: scrapedPage.title,
    label: generatePageUid(scrapedPage.url)
  };
}

function transformToSAPCCComponents(scrapedPage, mediaMapping) {
  const components = [];
  const pageUid = generatePageUid(scrapedPage.url);
  
  // Paragraph Component
  components.push({
    uid: `${pageUid}-Paragraph`,
    name: `${scrapedPage.title} Content`,
    typeCode: 'CMSParagraphComponent',
    properties: {
      content: scrapedPage.content.substring(0, 5000)
    }
  });
  
  // Image Components
  scrapedPage.images.forEach((img, index) => {
    if (img.localPath && mediaMapping.has(img.localPath)) {
      components.push({
        uid: `${pageUid}-Image${index}`,
        name: img.alt || `Image ${index}`,
        typeCode: 'BannerComponent',
        properties: {
          media: {
            code: mediaMapping.get(img.localPath)
          }
        }
      });
    }
  });
  
  return components;
}

// Usage
const migration = new SAPCCMigration({
  baseUrl: 'https://api.your-env.model-t.cc.commerce.ondemand.com',
  clientId: 'YOUR_CLIENT_ID',
  clientSecret: 'YOUR_CLIENT_SECRET',
  contentCatalog: 'yourContentCatalog',
  contentCatalogVersion: 'Staged',
  baseSite: 'yourBaseSite'
});

// ImpEx Mode
await migration.migrate(
  './output/lenzingpro_with_images_*.json',
  './output/lenzingpro_with_images_*_image_manifest.json',
  'impex'
);

// API Mode
await migration.migrate(
  './output/lenzingpro_with_images_*.json',
  './output/lenzingpro_with_images_*_image_manifest.json',
  'api'
);
```

## 📊 Best Practices

### 1. ImpEx vs API

**ImpEx:**
- ✅ Bulk-Import
- ✅ Schneller für große Datenmengen
- ✅ Transaktional
- ❌ Manueller Import via HAC

**OCC API:**
- ✅ Automatisiert
- ✅ Real-time
- ✅ Granulare Kontrolle
- ❌ Langsamer bei großen Mengen

### 2. Catalog Versions

```javascript
// Staged → Online Synchronization
async function syncCatalogVersion(config, token) {
  const endpoint = `${config.baseUrl}/occ/v2/${config.baseSite}/catalogs/${config.contentCatalog}/versions/Staged/sync`;
  
  await makeAuthenticatedRequest('POST', endpoint, {}, token);
  console.log('✅ Synchronized Staged → Online');
}
```

### 3. Error Handling

```javascript
async function retryWithBackoff(operation, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = Math.pow(2, i) * 1000;
      console.log(`⚠️  Retry ${i + 1}/${maxRetries} in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

---

**Version:** 1.0  
**Datum:** 10. Dezember 2025  
**Status:** ✅ Produktionsreif
