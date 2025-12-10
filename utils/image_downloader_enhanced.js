/**
 * Enhanced Image Downloader
 * 
 * Features:
 * - Duplicate prevention via content hash (MD5)
 * - Preserves original folder structure from source server
 * - JSON integration with local paths
 * - Migration-friendly structure
 * 
 * @module utils/image_downloader_enhanced
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const { URL } = require('url');

class EnhancedImageDownloader {
  constructor(config = {}) {
    this.baseOutputDir = config.outputDir || './output/images';
    this.maxSize = config.maxSize || 10 * 1024 * 1024; // 10MB default
    this.timeout = config.timeout || 30000;
    
    // Track downloaded images by content hash (prevents duplicates)
    this.hashToPath = new Map(); // hash -> local path
    this.urlToHash = new Map();  // url -> hash
    this.urlToPath = new Map();  // url -> local path
    
    // Statistics
    this.stats = {
      total: 0,
      downloaded: 0,
      duplicates: 0,
      failed: 0,
      totalSize: 0
    };
  }

  /**
   * Calculate MD5 hash of file content
   */
  calculateHash(buffer) {
    return crypto.createHash('md5').update(buffer).digest('hex');
  }

  /**
   * Preserve original folder structure from URL
   * Example: https://example.com/assets/images/logo.png
   *       -> output/images/example.com/assets/images/logo.png
   */
  getLocalPathFromUrl(imageUrl, baseUrl) {
    try {
      const url = new URL(imageUrl);
      const baseUrlObj = new URL(baseUrl);
      
      // Use hostname + pathname to preserve structure
      const hostname = url.hostname;
      const pathname = url.pathname;
      
      // Remove leading slash from pathname
      const cleanPath = pathname.startsWith('/') ? pathname.slice(1) : pathname;
      
      // Combine: baseOutputDir/hostname/path/to/image.jpg
      const localPath = path.join(this.baseOutputDir, hostname, cleanPath);
      
      return localPath;
    } catch (error) {
      // Fallback: use hash-based name
      const hash = this.simpleHash(imageUrl);
      return path.join(this.baseOutputDir, 'fallback', `image_${hash}.jpg`);
    }
  }

  /**
   * Simple hash for fallback filenames
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Download image with duplicate detection
   */
  async downloadImage(imageUrl, baseUrl) {
    this.stats.total++;

    return new Promise((resolve, reject) => {
      try {
        // Check if URL already processed
        if (this.urlToPath.has(imageUrl)) {
          this.stats.duplicates++;
          resolve({
            url: imageUrl,
            localPath: this.urlToPath.get(imageUrl),
            hash: this.urlToHash.get(imageUrl),
            duplicate: true,
            cached: true
          });
          return;
        }

        const url = new URL(imageUrl);
        const protocol = url.protocol === 'https:' ? https : http;
        
        // Get local path preserving folder structure
        const localPath = this.getLocalPathFromUrl(imageUrl, baseUrl);
        const localDir = path.dirname(localPath);

        // Ensure directory exists
        if (!fs.existsSync(localDir)) {
          fs.mkdirSync(localDir, { recursive: true });
        }

        let downloadedData = Buffer.alloc(0);
        let downloadedSize = 0;

        const request = protocol.get(imageUrl, {
          timeout: this.timeout,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; ContentScraper/1.0)',
            'Accept': 'image/*'
          }
        }, (response) => {
          // Check status code
          if (response.statusCode !== 200) {
            reject(new Error(`HTTP ${response.statusCode}`));
            return;
          }

          // Check content length
          const contentLength = parseInt(response.headers['content-length'], 10);
          if (contentLength && contentLength > this.maxSize) {
            request.destroy();
            reject(new Error(`Image too large: ${contentLength} bytes`));
            return;
          }

          // Collect data in memory for hash calculation
          response.on('data', (chunk) => {
            downloadedSize += chunk.length;
            
            if (downloadedSize > this.maxSize) {
              request.destroy();
              reject(new Error('Image size exceeded maximum'));
              return;
            }
            
            downloadedData = Buffer.concat([downloadedData, chunk]);
          });

          response.on('end', () => {
            try {
              // Calculate hash of downloaded content
              const hash = this.calculateHash(downloadedData);

              // Check if this content already exists
              if (this.hashToPath.has(hash)) {
                // Duplicate content! Use existing file
                const existingPath = this.hashToPath.get(hash);
                
                this.urlToHash.set(imageUrl, hash);
                this.urlToPath.set(imageUrl, existingPath);
                this.stats.duplicates++;

                resolve({
                  url: imageUrl,
                  localPath: existingPath,
                  hash: hash,
                  duplicate: true,
                  duplicateOf: existingPath,
                  size: downloadedSize
                });
                return;
              }

              // New unique image - save to disk
              fs.writeFileSync(localPath, downloadedData);

              // Register in tracking maps
              this.hashToPath.set(hash, localPath);
              this.urlToHash.set(imageUrl, hash);
              this.urlToPath.set(imageUrl, localPath);
              
              this.stats.downloaded++;
              this.stats.totalSize += downloadedSize;

              resolve({
                url: imageUrl,
                localPath: localPath,
                hash: hash,
                duplicate: false,
                size: downloadedSize
              });

            } catch (error) {
              reject(error);
            }
          });
        });

        request.on('error', (err) => {
          this.stats.failed++;
          reject(err);
        });

        request.on('timeout', () => {
          request.destroy();
          this.stats.failed++;
          reject(new Error('Download timeout'));
        });

      } catch (error) {
        this.stats.failed++;
        reject(error);
      }
    });
  }

  /**
   * Download all images from scraped pages
   */
  async downloadAllImages(pages, baseUrl, onProgress = null) {
    console.log(`\n[ImageDownloader] Starting enhanced image download...`);
    console.log(`[ImageDownloader] Base URL: ${baseUrl}`);
    console.log(`[ImageDownloader] Output directory: ${this.baseOutputDir}`);
    
    const results = {
      success: [],
      failed: [],
      duplicates: [],
      statistics: {}
    };

    // Collect all unique image URLs
    const uniqueImageUrls = new Set();
    pages.forEach(page => {
      if (page.images && Array.isArray(page.images)) {
        page.images.forEach(img => {
          if (img.src) {
            uniqueImageUrls.add(img.src);
          }
        });
      }
    });

    const totalImages = uniqueImageUrls.size;
    console.log(`[ImageDownloader] Found ${totalImages} unique image URLs\n`);

    let current = 0;
    for (const imageUrl of uniqueImageUrls) {
      current++;
      
      try {
        if (onProgress) {
          onProgress({
            current,
            total: totalImages,
            url: imageUrl
          });
        }

        const result = await this.downloadImage(imageUrl, baseUrl);
        
        if (result.duplicate) {
          results.duplicates.push(result);
          console.log(`✓ [${current}/${totalImages}] Duplicate: ${imageUrl} → ${result.duplicateOf || result.localPath}`);
        } else {
          results.success.push(result);
          console.log(`✓ [${current}/${totalImages}] Downloaded: ${imageUrl} → ${result.localPath}`);
        }

        // Small delay between downloads
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        results.failed.push({
          url: imageUrl,
          error: error.message
        });
        console.error(`✗ [${current}/${totalImages}] Failed: ${imageUrl} - ${error.message}`);
      }
    }

    // Generate statistics
    results.statistics = {
      total: this.stats.total,
      downloaded: this.stats.downloaded,
      duplicates: this.stats.duplicates,
      failed: this.stats.failed,
      totalSize: this.stats.totalSize,
      totalSizeMB: (this.stats.totalSize / (1024 * 1024)).toFixed(2)
    };

    console.log(`\n[ImageDownloader] Download complete!`);
    console.log(`  Total URLs: ${results.statistics.total}`);
    console.log(`  Downloaded: ${results.statistics.downloaded}`);
    console.log(`  Duplicates: ${results.statistics.duplicates}`);
    console.log(`  Failed: ${results.statistics.failed}`);
    console.log(`  Total Size: ${results.statistics.totalSizeMB} MB\n`);

    return results;
  }

  /**
   * Update page data with local image paths
   */
  updatePagesWithLocalPaths(pages) {
    return pages.map(page => {
      if (page.images && Array.isArray(page.images)) {
        page.images = page.images.map(img => {
          if (this.urlToPath.has(img.src)) {
            return {
              ...img,
              localPath: this.urlToPath.get(img.src),
              hash: this.urlToHash.get(img.src),
              duplicate: this.hashToPath.get(this.urlToHash.get(img.src)) !== this.urlToPath.get(img.src)
            };
          }
          return img;
        });
      }
      return page;
    });
  }

  /**
   * Generate comprehensive manifest for migration
   */
  generateManifest(outputPath) {
    const manifest = {
      generated_at: new Date().toISOString(),
      base_output_dir: this.baseOutputDir,
      statistics: {
        total_urls: this.stats.total,
        unique_files: this.stats.downloaded,
        duplicates: this.stats.duplicates,
        failed: this.stats.failed,
        total_size_bytes: this.stats.totalSize,
        total_size_mb: (this.stats.totalSize / (1024 * 1024)).toFixed(2)
      },
      images: Array.from(this.urlToPath.entries()).map(([url, localPath]) => {
        const hash = this.urlToHash.get(url);
        const isDuplicate = this.hashToPath.get(hash) !== localPath;
        
        return {
          url,
          localPath,
          hash,
          duplicate: isDuplicate,
          originalFile: isDuplicate ? this.hashToPath.get(hash) : null,
          fileName: path.basename(localPath),
          directory: path.dirname(localPath)
        };
      }),
      hash_map: Array.from(this.hashToPath.entries()).map(([hash, localPath]) => ({
        hash,
        localPath,
        fileName: path.basename(localPath)
      }))
    };

    fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2), 'utf-8');
    console.log(`[ImageDownloader] Manifest saved: ${outputPath}`);
    
    return manifest;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      totalSizeMB: (this.stats.totalSize / (1024 * 1024)).toFixed(2)
    };
  }
}

module.exports = { EnhancedImageDownloader };
