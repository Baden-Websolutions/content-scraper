/**
 * Test Script: Scrape lenzingpro.com with Enhanced Image Download
 * 
 * Features:
 * - Max 100 pages
 * - Navigation-based crawling
 * - Enhanced image download with duplicate prevention
 * - Folder structure preservation
 * - JSON integration with local paths
 */

const { ContentScraperWithImages } = require('./core/scraper_with_images');
const path = require('path');

async function main() {
  console.log('🚀 Starting lenzingpro.com scraper test with image download...\n');
  console.log('Configuration:');
  console.log('  - Base URL: https://lenzingpro.com');
  console.log('  - Max Pages: 100');
  console.log('  - Download Images: Yes (with duplicate prevention)');
  console.log('  - Folder Structure: Preserved from source');
  console.log('  - Navigation-based crawling: Yes\n');

  const scraper = new ContentScraperWithImages({
    baseUrl: 'https://lenzingpro.com',
    maxPages: 100,
    delay: 1000,
    headless: true,
    downloadImages: true,
    outputDir: './output',
    onProgress: (data) => {
      console.log(`📄 Progress: ${data.current}/${data.total} | Level ${data.level} | ${data.url}`);
    },
    onPageComplete: (pageData) => {
      console.log(`✅ Completed: ${pageData.title} (${pageData.links.length} links, ${pageData.images.length} images)`);
    },
    onError: (error) => {
      console.error(`❌ Error: ${error.url} - ${error.error}`);
    },
    onImageProgress: (data) => {
      console.log(`🖼️  Image: ${data.current}/${data.total} | ${data.url}`);
    }
  });

  try {
    const startTime = Date.now();
    
    const result = await scraper.scrapeWebsite();
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(60));
    console.log('📊 Scraping Complete!');
    console.log('='.repeat(60));
    console.log(`Total Pages: ${result.statistics.totalPages}`);
    console.log(`Failed Pages: ${result.statistics.failedPages}`);
    console.log(`Total Words: ${result.statistics.totalWords.toLocaleString()}`);
    console.log(`Duration: ${duration}s`);
    
    if (result.statistics.images) {
      console.log('\n📸 Image Statistics:');
      console.log(`  Total URLs: ${result.statistics.images.total}`);
      console.log(`  Downloaded: ${result.statistics.images.downloaded}`);
      console.log(`  Duplicates: ${result.statistics.images.duplicates}`);
      console.log(`  Failed: ${result.statistics.images.failed}`);
      console.log(`  Total Size: ${result.statistics.images.totalSizeMB} MB`);
    }

    console.log('\nCrawler Statistics:');
    console.log(JSON.stringify(result.statistics.crawlerStats, null, 2));

    // Save results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = path.join(__dirname, 'output', `lenzingpro_with_images_${timestamp}.json`);
    
    await scraper.saveResults(result, outputPath);

    // Create summary
    const summary = {
      baseUrl: result.baseUrl,
      scrapedAt: result.scrapedAt,
      statistics: result.statistics,
      pages: result.scrapedPages.map(p => ({
        url: p.url,
        title: p.title,
        level: p.level,
        linksCount: p.links.length,
        imagesCount: p.images.length,
        imagesWithLocalPath: p.images.filter(img => img.localPath).length,
        contentLength: p.contentLength
      })),
      imageExamples: result.scrapedPages
        .flatMap(p => p.images)
        .filter(img => img.localPath)
        .slice(0, 10)
        .map(img => ({
          originalUrl: img.src,
          localPath: img.localPath,
          hash: img.hash,
          duplicate: img.duplicate || false
        }))
    };

    const summaryPath = path.join(__dirname, 'output', `lenzingpro_summary_with_images_${timestamp}.json`);
    const fs = require('fs');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`📋 Summary saved to: ${summaryPath}`);

    console.log('\n✨ Test completed successfully!');
    console.log('\n📁 Output Structure:');
    console.log('  output/');
    console.log('  ├── lenzingpro_with_images_*.json (Full results with local paths)');
    console.log('  ├── lenzingpro_summary_with_images_*.json (Summary)');
    console.log('  ├── lenzingpro_with_images_*_image_manifest.json (Image manifest)');
    console.log('  └── images/');
    console.log('      └── lenzingpro.com/');
    console.log('          └── [original folder structure preserved]');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
