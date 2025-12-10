/**
 * Storyblok Migration Script
 * 
 * Migrates scraped content and images to Storyblok
 * 
 * Usage:
 *   node migration/migrate_to_storyblok.js \
 *     --data output/lenzingpro_with_images_*.json \
 *     --manifest output/lenzingpro_with_images_*_image_manifest.json \
 *     --space YOUR_SPACE_ID \
 *     --token YOUR_MANAGEMENT_TOKEN
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { transformToStoryblok } = require('./transformers');

class StoryblokMigration {
  constructor(config) {
    this.spaceId = config.spaceId;
    this.token = config.token;
    this.baseUrl = 'https://mapi.storyblok.com/v1';
    
    this.stats = {
      assets: { total: 0, uploaded: 0, failed: 0 },
      stories: { total: 0, created: 0, failed: 0 },
      links: { total: 0, updated: 0 }
    };
  }
  
  /**
   * Request signed upload URL
   */
  async requestSignedUpload(filePath) {
    const filename = path.basename(filePath);
    const size = fs.statSync(filePath).size;
    
    const response = await axios.post(
      `${this.baseUrl}/spaces/${this.spaceId}/assets`,
      { filename, size },
      {
        headers: {
          'Authorization': this.token,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data;
  }
  
  /**
   * Upload file to S3
   */
  async uploadToS3(signedUpload, filePath) {
    const form = new FormData();
    
    // Add fields from signed request
    Object.keys(signedUpload.fields).forEach(key => {
      form.append(key, signedUpload.fields[key]);
    });
    
    // Add file
    form.append('file', fs.createReadStream(filePath));
    
    await axios.post(signedUpload.signed_request, form, {
      headers: form.getHeaders()
    });
    
    return signedUpload.public_url;
  }
  
  /**
   * Finalize upload
   */
  async finalizeUpload(assetId) {
    await axios.get(
      `${this.baseUrl}/spaces/${this.spaceId}/assets/${assetId}/finish_upload`,
      {
        headers: {
          'Authorization': this.token
        }
      }
    );
  }
  
  /**
   * Upload single asset
   */
  async uploadAsset(localPath) {
    this.stats.assets.total++;
    
    try {
      console.log(`📤 Uploading: ${localPath}`);
      
      // 1. Request signed upload
      const signedUpload = await this.requestSignedUpload(localPath);
      
      // 2. Upload to S3
      const publicUrl = await this.uploadToS3(signedUpload, localPath);
      
      // 3. Finalize
      await this.finalizeUpload(signedUpload.id);
      
      this.stats.assets.uploaded++;
      console.log(`✅ Uploaded: ${publicUrl}`);
      
      return {
        id: signedUpload.id,
        url: publicUrl,
        localPath: localPath
      };
      
    } catch (error) {
      this.stats.assets.failed++;
      console.error(`❌ Failed: ${localPath} - ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Upload all assets
   */
  async uploadAllAssets(imageManifest) {
    console.log('\n=== Phase 1: Uploading Assets ===\n');
    
    const assetMapping = new Map(); // localPath → Storyblok URL
    
    for (const image of imageManifest.images) {
      try {
        const asset = await this.uploadAsset(image.localPath);
        assetMapping.set(image.localPath, asset.url);
        
        // Rate limiting: 100ms delay
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`Skipping: ${image.localPath}`);
      }
    }
    
    console.log(`\n✅ Uploaded ${this.stats.assets.uploaded}/${this.stats.assets.total} assets`);
    console.log(`❌ Failed: ${this.stats.assets.failed}\n`);
    
    return assetMapping;
  }
  
  /**
   * Create story
   */
  async createStory(storyData, publish = true) {
    this.stats.stories.total++;
    
    try {
      console.log(`📝 Creating story: ${storyData.name}`);
      
      const response = await axios.post(
        `${this.baseUrl}/spaces/${this.spaceId}/stories`,
        {
          story: storyData,
          publish: publish ? 1 : 0
        },
        {
          headers: {
            'Authorization': this.token,
            'Content-Type': 'application/json'
          }
        }
      );
      
      this.stats.stories.created++;
      console.log(`✅ Created: ${storyData.name} (ID: ${response.data.story.id})`);
      
      return response.data.story;
      
    } catch (error) {
      this.stats.stories.failed++;
      console.error(`❌ Failed: ${storyData.name} - ${error.response?.data?.error || error.message}`);
      throw error;
    }
  }
  
  /**
   * Create all stories
   */
  async createAllStories(scrapedPages, assetMapping, publish = true) {
    console.log('\n=== Phase 2: Creating Stories ===\n');
    
    const createdStories = [];
    const urlToStoryId = new Map();
    
    for (const page of scrapedPages) {
      try {
        // Transform
        const storyData = transformToStoryblok(page, assetMapping);
        
        // Create
        const story = await this.createStory(storyData, publish);
        
        createdStories.push(story);
        urlToStoryId.set(page.url, story.uuid);
        
        // Rate limiting: 200ms delay
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`Skipping: ${page.url}`);
      }
    }
    
    console.log(`\n✅ Created ${this.stats.stories.created}/${this.stats.stories.total} stories`);
    console.log(`❌ Failed: ${this.stats.stories.failed}\n`);
    
    return { createdStories, urlToStoryId };
  }
  
  /**
   * Update internal links
   */
  async updateInternalLinks(stories, urlToStoryId) {
    console.log('\n=== Phase 3: Updating Internal Links ===\n');
    
    for (const story of stories) {
      try {
        let updated = false;
        const content = story.content;
        
        // Traverse richtext and update links
        if (content.content && content.content.type === 'doc') {
          this.traverseRichtext(content.content, (node) => {
            if (node.type === 'link' && node.attrs?.href) {
              const targetUuid = urlToStoryId.get(node.attrs.href);
              
              if (targetUuid) {
                node.attrs.linktype = 'story';
                node.attrs.uuid = targetUuid;
                delete node.attrs.href;
                updated = true;
                this.stats.links.total++;
              }
            }
          });
        }
        
        if (updated) {
          // Update story
          await axios.put(
            `${this.baseUrl}/spaces/${this.spaceId}/stories/${story.id}`,
            {
              story: {
                content: content
              },
              publish: 1
            },
            {
              headers: {
                'Authorization': this.token,
                'Content-Type': 'application/json'
              }
            }
          );
          
          this.stats.links.updated++;
          console.log(`✅ Updated links in: ${story.name}`);
        }
        
      } catch (error) {
        console.error(`❌ Failed to update links in: ${story.name}`);
      }
    }
    
    console.log(`\n✅ Updated ${this.stats.links.updated} stories with internal links\n`);
  }
  
  /**
   * Traverse richtext nodes
   */
  traverseRichtext(node, callback) {
    callback(node);
    
    if (node.content && Array.isArray(node.content)) {
      node.content.forEach(child => this.traverseRichtext(child, callback));
    }
  }
  
  /**
   * Print statistics
   */
  printStats() {
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
    console.log('='.repeat(60) + '\n');
  }
  
  /**
   * Main migration function
   */
  async migrate(scrapedDataPath, imageManifestPath, options = {}) {
    console.log('🚀 Starting Storyblok migration...\n');
    console.log(`Space ID: ${this.spaceId}`);
    console.log(`Data: ${scrapedDataPath}`);
    console.log(`Manifest: ${imageManifestPath}\n`);
    
    // Load data
    const scrapedData = JSON.parse(fs.readFileSync(scrapedDataPath));
    const imageManifest = JSON.parse(fs.readFileSync(imageManifestPath));
    
    console.log(`📄 Loaded ${scrapedData.scrapedPages.length} pages`);
    console.log(`🖼️  Loaded ${imageManifest.images.length} images`);
    
    // Upload assets
    const assetMapping = await this.uploadAllAssets(imageManifest);
    
    // Create stories
    const { createdStories, urlToStoryId } = await this.createAllStories(
      scrapedData.scrapedPages,
      assetMapping,
      options.publish !== false
    );
    
    // Update internal links
    if (options.updateLinks !== false) {
      await this.updateInternalLinks(createdStories, urlToStoryId);
    }
    
    // Print statistics
    this.printStats();
    
    // Save mapping
    const mapping = {
      generated_at: new Date().toISOString(),
      space_id: this.spaceId,
      assets: Array.from(assetMapping.entries()).map(([local, url]) => ({
        localPath: local,
        storyblokUrl: url
      })),
      stories: Array.from(urlToStoryId.entries()).map(([url, uuid]) => ({
        originalUrl: url,
        storyUuid: uuid
      }))
    };
    
    const mappingPath = 'storyblok_migration_mapping.json';
    fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));
    
    console.log(`✨ Migration complete!`);
    console.log(`📋 Mapping saved to: ${mappingPath}\n`);
    
    return mapping;
  }
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  
  const config = {
    spaceId: getArg(args, '--space'),
    token: getArg(args, '--token')
  };
  
  const dataPath = getArg(args, '--data');
  const manifestPath = getArg(args, '--manifest');
  const publish = !args.includes('--draft');
  const updateLinks = !args.includes('--no-links');
  
  if (!config.spaceId || !config.token || !dataPath || !manifestPath) {
    console.error('Usage: node migrate_to_storyblok.js \\');
    console.error('  --data <path> \\');
    console.error('  --manifest <path> \\');
    console.error('  --space <space_id> \\');
    console.error('  --token <management_token> \\');
    console.error('  [--draft] \\');
    console.error('  [--no-links]');
    process.exit(1);
  }
  
  const migration = new StoryblokMigration(config);
  
  migration.migrate(dataPath, manifestPath, { publish, updateLinks })
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

module.exports = { StoryblokMigration };
