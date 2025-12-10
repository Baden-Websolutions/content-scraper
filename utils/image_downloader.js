/**
 * Image Downloader Utility
 * 
 * Downloads and processes images from scraped content
 * Handles image optimization and local storage
 * 
 * @module utils/image_downloader
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

class ImageDownloader {
  constructor(config = {}) {
    this.outputDir = config.outputDir || './output/images';
    this.maxSize = config.maxSize || 10 * 1024 * 1024; // 10MB default
    this.timeout = config.timeout || 30000;
    this.downloadedImages = new Map();
  }

  /**
   * Download a single image
   */
  async downloadImage(imageUrl, customName = null) {
    return new Promise((resolve, reject) => {
      try {
        const url = new URL(imageUrl);
        const protocol = url.protocol === 'https:' ? https : http;
        
        // Generate filename
        const fileName = customName || this.generateFileName(imageUrl);
        const filePath = path.join(this.outputDir, fileName);

        // Check if already downloaded
        if (this.downloadedImages.has(imageUrl)) {
          resolve({
            url: imageUrl,
            localPath: this.downloadedImages.get(imageUrl),
            cached: true
          });
          return;
        }

        // Ensure output directory exists
        if (!fs.existsSync(this.outputDir)) {
          fs.mkdirSync(this.outputDir, { recursive: true });
        }

        const file = fs.createWriteStream(filePath);
        let downloadedSize = 0;

        const request = protocol.get(imageUrl, {
          timeout: this.timeout,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; ContentScraper/1.0)'
          }
        }, (response) => {
          // Check status code
          if (response.statusCode !== 200) {
            file.close();
            fs.unlinkSync(filePath);
            reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
            return;
          }

          // Check content length
          const contentLength = parseInt(response.headers['content-length'], 10);
          if (contentLength && contentLength > this.maxSize) {
            file.close();
            fs.unlinkSync(filePath);
            reject(new Error(`Image too large: ${contentLength} bytes`));
            return;
          }

          response.pipe(file);

          response.on('data', (chunk) => {
            downloadedSize += chunk.length;
            if (downloadedSize > this.maxSize) {
              request.destroy();
              file.close();
              fs.unlinkSync(filePath);
              reject(new Error('Image size exceeded maximum'));
            }
          });

          file.on('finish', () => {
            file.close();
            this.downloadedImages.set(imageUrl, filePath);
            resolve({
              url: imageUrl,
              localPath: filePath,
              size: downloadedSize,
              cached: false
            });
          });
        });

        request.on('error', (err) => {
          file.close();
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          reject(err);
        });

        request.on('timeout', () => {
          request.destroy();
          file.close();
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          reject(new Error('Download timeout'));
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate filename from URL
   */
  generateFileName(imageUrl) {
    try {
      const url = new URL(imageUrl);
      const pathname = url.pathname;
      const fileName = path.basename(pathname);
      
      // If no extension, add .jpg as default
      if (!path.extname(fileName)) {
        return `${fileName}.jpg`;
      }
      
      return fileName;
    } catch {
      // Fallback: generate hash-based name
      const hash = this.simpleHash(imageUrl);
      return `image_${hash}.jpg`;
    }
  }

  /**
   * Simple hash function for generating filenames
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
   * Download all images from pages
   */
  async downloadAllImages(pages, onProgress = null) {
    console.log(`[ImageDownloader] Starting download of images from ${pages.length} pages...`);
    
    const allImages = [];
    const results = {
      success: [],
      failed: [],
      total: 0
    };

    // Collect all unique images
    pages.forEach(page => {
      if (page.images && Array.isArray(page.images)) {
        page.images.forEach(img => {
          if (img.src && !allImages.find(i => i.src === img.src)) {
            allImages.push(img);
          }
        });
      }
    });

    results.total = allImages.length;
    console.log(`[ImageDownloader] Found ${allImages.length} unique images`);

    // Download images sequentially
    for (let i = 0; i < allImages.length; i++) {
      const image = allImages[i];
      
      try {
        if (onProgress) {
          onProgress({
            current: i + 1,
            total: allImages.length,
            url: image.src
          });
        }

        const result = await this.downloadImage(image.src);
        results.success.push({
          ...image,
          ...result
        });

        console.log(`[ImageDownloader] Downloaded (${i + 1}/${allImages.length}): ${image.src}`);

        // Small delay between downloads
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        results.failed.push({
          ...image,
          error: error.message
        });
        console.error(`[ImageDownloader] Failed (${i + 1}/${allImages.length}): ${image.src} - ${error.message}`);
      }
    }

    console.log(`[ImageDownloader] Download complete: ${results.success.length} success, ${results.failed.length} failed`);
    return results;
  }

  /**
   * Update page data with local image paths
   */
  updatePagesWithLocalPaths(pages) {
    return pages.map(page => {
      if (page.images && Array.isArray(page.images)) {
        page.images = page.images.map(img => {
          if (this.downloadedImages.has(img.src)) {
            return {
              ...img,
              localPath: this.downloadedImages.get(img.src)
            };
          }
          return img;
        });
      }
      return page;
    });
  }

  /**
   * Generate image manifest
   */
  generateManifest(outputPath) {
    const manifest = {
      total_images: this.downloadedImages.size,
      images: Array.from(this.downloadedImages.entries()).map(([url, localPath]) => ({
        url,
        localPath,
        fileName: path.basename(localPath)
      })),
      generated_at: new Date().toISOString()
    };

    fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2), 'utf-8');
    console.log(`[ImageDownloader] Manifest saved: ${outputPath}`);
    
    return manifest;
  }
}

module.exports = { ImageDownloader };
