/**
 * Sitemap Generator Utility
 * 
 * Generates XML sitemaps from scraped content
 * Creates sitemap.xml files for SEO optimization
 * 
 * @module utils/sitemap_generator
 */

const fs = require('fs');
const path = require('path');

class SitemapGenerator {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || '';
    this.changefreq = config.changefreq || 'weekly';
    this.priority = config.priority || 0.5;
  }

  /**
   * Generate XML sitemap from pages
   */
  generate(pages) {
    const urls = pages.map(page => this.createUrlEntry(page));
    
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

    return xml;
  }

  /**
   * Create URL entry for sitemap
   */
  createUrlEntry(page) {
    const loc = this.baseUrl + (page.url === '/' ? '' : page.url);
    const lastmod = page.scrapedAt ? new Date(page.scrapedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const priority = this.calculatePriority(page);
    const changefreq = this.determineChangefreq(page);

    return `  <url>
    <loc>${this.escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
  }

  /**
   * Calculate priority based on page type
   */
  calculatePriority(page) {
    const priorityMap = {
      'homepage': 1.0,
      'category': 0.8,
      'product': 0.7,
      'news': 0.6,
      'about': 0.5,
      'contact': 0.5,
      'default': 0.5
    };

    return priorityMap[page.pageType] || this.priority;
  }

  /**
   * Determine change frequency based on page type
   */
  determineChangefreq(page) {
    const freqMap = {
      'homepage': 'daily',
      'news': 'daily',
      'product': 'weekly',
      'category': 'weekly',
      'about': 'monthly',
      'contact': 'monthly',
      'default': 'monthly'
    };

    return freqMap[page.pageType] || this.changefreq;
  }

  /**
   * Escape XML special characters
   */
  escapeXml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Save sitemap to file
   */
  saveToFile(pages, outputPath) {
    const xml = this.generate(pages);
    
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, xml, 'utf-8');
    console.log(`[SitemapGenerator] Sitemap saved: ${outputPath} (${pages.length} URLs)`);
    
    return outputPath;
  }

  /**
   * Generate sitemap index for multiple sitemaps
   */
  generateIndex(sitemaps) {
    const entries = sitemaps.map(sitemap => {
      const lastmod = new Date().toISOString().split('T')[0];
      return `  <sitemap>
    <loc>${this.escapeXml(sitemap.url)}</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</sitemapindex>`;
  }
}

module.exports = { SitemapGenerator };
