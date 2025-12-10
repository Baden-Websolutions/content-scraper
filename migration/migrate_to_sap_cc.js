/**
 * SAP Commerce Cloud Migration Script
 * 
 * Migrates scraped content and images to SAP CC
 * 
 * Usage:
 *   # ImpEx Mode
 *   node migration/migrate_to_sap_cc.js \
 *     --data output/lenzingpro_with_images_*.json \
 *     --manifest output/lenzingpro_with_images_*_image_manifest.json \
 *     --mode impex \
 *     --catalog yourContentCatalog \
 *     --version Staged
 *   
 *   # API Mode
 *   node migration/migrate_to_sap_cc.js \
 *     --data output/lenzingpro_with_images_*.json \
 *     --manifest output/lenzingpro_with_images_*_image_manifest.json \
 *     --mode api \
 *     --url https://api.your-env.model-t.cc.commerce.ondemand.com \
 *     --client-id YOUR_CLIENT_ID \
 *     --client-secret YOUR_CLIENT_SECRET \
 *     --catalog yourContentCatalog \
 *     --version Staged \
 *     --site yourBaseSite
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const qs = require('querystring');
const {
  generatePageUid,
  generateMediaCode,
  escapeCsv,
  escapeHtml,
  transformToSAPCCPage,
  transformToSAPCCComponents,
  transformToSAPCCProduct
} = require('./transformers');

class SAPCCMigration {
  constructor(config) {
    this.config = config;
    this.token = null;
    
    this.stats = {
      media: { total: 0, uploaded: 0, failed: 0 },
      pages: { total: 0, created: 0, failed: 0 },
      components: { total: 0, created: 0, failed: 0 }
    };
  }
  
  /**
   * Get OAuth token
   */
  async authenticate() {
    const tokenUrl = `${this.config.baseUrl}/authorizationserver/oauth/token`;
    
    const response = await axios.post(
      tokenUrl,
      qs.stringify({
        grant_type: 'client_credentials',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    this.token = response.data.access_token;
    console.log('✅ Authenticated with SAP CC\n');
  }
  
  /**
   * Upload media via OCC API
   */
  async uploadMedia(localPath, mediaCode) {
    this.stats.media.total++;
    
    try {
      console.log(`📤 Uploading media: ${mediaCode}`);
      
      const form = new FormData();
      
      const metadata = {
        code: mediaCode,
        catalogId: this.config.contentCatalog,
        catalogVersion: this.config.contentCatalogVersion,
        mime: this.getMimeType(localPath),
        altText: path.basename(localPath, path.extname(localPath))
      };
      
      form.append('metadata', JSON.stringify(metadata));
      form.append('file', fs.createReadStream(localPath));
      
      const response = await axios.post(
        `${this.config.baseUrl}/occ/v2/${this.config.baseSite}/medias`,
        form,
        {
          headers: {
            ...form.getHeaders(),
            'Authorization': `Bearer ${this.token}`
          }
        }
      );
      
      this.stats.media.uploaded++;
      console.log(`✅ Uploaded: ${mediaCode}`);
      
      return {
        code: mediaCode,
        url: response.data.url
      };
      
    } catch (error) {
      this.stats.media.failed++;
      console.error(`❌ Failed: ${mediaCode} - ${error.response?.data?.errors?.[0]?.message || error.message}`);
      throw error;
    }
  }
  
  /**
   * Get MIME type from file extension
   */
  getMimeType(filePath) {
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
  
  /**
   * Upload all media
   */
  async uploadAllMedia(imageManifest) {
    console.log('\n=== Phase 1: Uploading Media ===\n');
    
    const mediaMapping = new Map(); // localPath → Media Code
    
    for (const image of imageManifest.images) {
      const mediaCode = generateMediaCode(image.localPath);
      
      try {
        const media = await this.uploadMedia(image.localPath, mediaCode);
        mediaMapping.set(image.localPath, media.code);
        
        // Rate limiting: 200ms delay
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`Skipping: ${image.localPath}`);
      }
    }
    
    console.log(`\n✅ Uploaded ${this.stats.media.uploaded}/${this.stats.media.total} media files`);
    console.log(`❌ Failed: ${this.stats.media.failed}\n`);
    
    return mediaMapping;
  }
  
  /**
   * Generate Content Page ImpEx
   */
  generateContentPageImpEx(scrapedPage, mediaMapping) {
    const pageUid = generatePageUid(scrapedPage.url);
    const slotUid = `${pageUid}-MainSlot`;
    const componentRefs = [];
    
    let impex = `# Content Page: ${scrapedPage.title}\n`;
    impex += `$contentCV=catalogVersion(catalog(id[default='${this.config.contentCatalog}']),version[default='${this.config.contentCatalogVersion}'])[unique=true]\n\n`;
    
    // Page
    impex += `INSERT_UPDATE ContentPage;$contentCV[unique=true];uid[unique=true];name;masterTemplate(uid,$contentCV);label;defaultPage;approvalStatus(code);homepage\n`;
    impex += `;;${pageUid};${escapeCsv(scrapedPage.title)};ContentPage1Template;${pageUid};true;approved;false\n\n`;
    
    // Paragraph Component
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
  
  /**
   * Generate complete ImpEx file
   */
  generateCompleteImpEx(scrapedPages, mediaMapping) {
    let impex = `# SAP Commerce Cloud ImpEx\n`;
    impex += `# Generated: ${new Date().toISOString()}\n`;
    impex += `# Source: Content Scraper\n\n`;
    
    impex += `# ========================================\n`;
    impex += `# Content Pages\n`;
    impex += `# ========================================\n\n`;
    
    scrapedPages.forEach(page => {
      impex += this.generateContentPageImpEx(page, mediaMapping);
      impex += `\n`;
    });
    
    return impex;
  }
  
  /**
   * Create content page via OCC API
   */
  async createContentPage(pageData) {
    this.stats.pages.total++;
    
    try {
      console.log(`📝 Creating page: ${pageData.name}`);
      
      const payload = {
        uid: pageData.uid,
        name: pageData.name,
        typeCode: 'ContentPage',
        catalogVersion: {
          catalog: {
            id: this.config.contentCatalog
          },
          version: this.config.contentCatalogVersion
        },
        label: pageData.label,
        defaultPage: true,
        approvalStatus: 'APPROVED',
        masterTemplate: {
          uid: 'ContentPage1Template'
        }
      };
      
      const response = await axios.post(
        `${this.config.baseUrl}/occ/v2/${this.config.baseSite}/cms/pages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      this.stats.pages.created++;
      console.log(`✅ Created page: ${pageData.name}`);
      
      return response.data;
      
    } catch (error) {
      this.stats.pages.failed++;
      console.error(`❌ Failed: ${pageData.name} - ${error.response?.data?.errors?.[0]?.message || error.message}`);
      throw error;
    }
  }
  
  /**
   * Create CMS component via OCC API
   */
  async createCMSComponent(componentData) {
    this.stats.components.total++;
    
    try {
      const payload = {
        uid: componentData.uid,
        name: componentData.name,
        typeCode: componentData.typeCode,
        catalogVersion: {
          catalog: {
            id: this.config.contentCatalog
          },
          version: this.config.contentCatalogVersion
        },
        ...componentData.properties
      };
      
      await axios.post(
        `${this.config.baseUrl}/occ/v2/${this.config.baseSite}/cms/components`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      this.stats.components.created++;
      
    } catch (error) {
      this.stats.components.failed++;
      throw error;
    }
  }
  
  /**
   * Print statistics
   */
  printStats() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Statistics');
    console.log('='.repeat(60));
    console.log(`Media:`);
    console.log(`  Total: ${this.stats.media.total}`);
    console.log(`  Uploaded: ${this.stats.media.uploaded}`);
    console.log(`  Failed: ${this.stats.media.failed}`);
    console.log(`\nPages:`);
    console.log(`  Total: ${this.stats.pages.total}`);
    console.log(`  Created: ${this.stats.pages.created}`);
    console.log(`  Failed: ${this.stats.pages.failed}`);
    console.log(`\nComponents:`);
    console.log(`  Total: ${this.stats.components.total}`);
    console.log(`  Created: ${this.stats.components.created}`);
    console.log(`  Failed: ${this.stats.components.failed}`);
    console.log('='.repeat(60) + '\n');
  }
  
  /**
   * Migrate via ImpEx
   */
  async migrateViaImpEx(scrapedData, imageManifest) {
    console.log('=== Migration Mode: ImpEx ===\n');
    
    // Authenticate
    await this.authenticate();
    
    // Upload media
    const mediaMapping = await this.uploadAllMedia(imageManifest);
    
    // Generate ImpEx
    console.log('\n=== Phase 2: Generating ImpEx ===\n');
    const impex = this.generateCompleteImpEx(scrapedData.scrapedPages, mediaMapping);
    
    // Save ImpEx file
    const impexPath = 'sap_cc_migration.impex';
    fs.writeFileSync(impexPath, impex);
    console.log(`✅ ImpEx saved to: ${impexPath}\n`);
    
    // Print statistics
    this.printStats();
    
    console.log('✨ Migration complete!');
    console.log('📋 Next steps:');
    console.log('  1. Review the ImpEx file');
    console.log('  2. Import via HAC (Hybris Administration Console)');
    console.log('  3. Navigate to: https://your-backoffice-url/hac/console/impex/import');
    console.log('  4. Upload and execute the ImpEx file');
    console.log('  5. Verify content in Backoffice\n');
    
    return {
      mediaMapping: Array.from(mediaMapping.entries()),
      impexPath: impexPath
    };
  }
  
  /**
   * Migrate via OCC API
   */
  async migrateViaAPI(scrapedData, imageManifest) {
    console.log('=== Migration Mode: OCC API ===\n');
    
    // Authenticate
    await this.authenticate();
    
    // Upload media
    const mediaMapping = await this.uploadAllMedia(imageManifest);
    
    // Create pages and components
    console.log('\n=== Phase 2: Creating Content Pages ===\n');
    
    const createdPages = [];
    
    for (const page of scrapedData.scrapedPages) {
      try {
        // Transform
        const pageData = transformToSAPCCPage(page);
        const components = transformToSAPCCComponents(page, mediaMapping);
        
        // Create page
        const createdPage = await this.createContentPage(pageData);
        
        // Create components
        for (const component of components) {
          await this.createCMSComponent(component);
        }
        
        createdPages.push(createdPage);
        
        // Rate limiting: 500ms delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`Skipping: ${page.url}`);
      }
    }
    
    // Print statistics
    this.printStats();
    
    console.log('✨ Migration complete!\n');
    
    return {
      mediaMapping: Array.from(mediaMapping.entries()),
      createdPages: createdPages
    };
  }
  
  /**
   * Main migration function
   */
  async migrate(scrapedDataPath, imageManifestPath, mode = 'impex') {
    console.log('🚀 Starting SAP Commerce Cloud migration...\n');
    console.log(`Mode: ${mode.toUpperCase()}`);
    console.log(`Data: ${scrapedDataPath}`);
    console.log(`Manifest: ${imageManifestPath}\n`);
    
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
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  
  const mode = getArg(args, '--mode') || 'impex';
  
  const config = {
    baseUrl: getArg(args, '--url'),
    clientId: getArg(args, '--client-id'),
    clientSecret: getArg(args, '--client-secret'),
    contentCatalog: getArg(args, '--catalog'),
    contentCatalogVersion: getArg(args, '--version') || 'Staged',
    baseSite: getArg(args, '--site')
  };
  
  const dataPath = getArg(args, '--data');
  const manifestPath = getArg(args, '--manifest');
  
  if (!dataPath || !manifestPath || !config.contentCatalog) {
    console.error('Usage: node migrate_to_sap_cc.js \\');
    console.error('  --data <path> \\');
    console.error('  --manifest <path> \\');
    console.error('  --mode <impex|api> \\');
    console.error('  --catalog <catalog_id> \\');
    console.error('  [--version <catalog_version>] \\');
    console.error('  # For API mode:');
    console.error('  --url <base_url> \\');
    console.error('  --client-id <client_id> \\');
    console.error('  --client-secret <client_secret> \\');
    console.error('  --site <base_site>');
    process.exit(1);
  }
  
  if (mode === 'api' && (!config.baseUrl || !config.clientId || !config.clientSecret || !config.baseSite)) {
    console.error('❌ API mode requires: --url, --client-id, --client-secret, --site');
    process.exit(1);
  }
  
  const migration = new SAPCCMigration(config);
  
  migration.migrate(dataPath, manifestPath, mode)
    .then(() => {
      console.log('✅ Done!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

function getArg(args, name) {
  const index = args.indexOf(name);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
}

module.exports = { SAPCCMigration };
