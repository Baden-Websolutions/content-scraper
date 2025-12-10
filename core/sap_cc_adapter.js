/**
 * SAP Commerce Cloud Adapter
 * 
 * Adapts scraped content for SAP Commerce Cloud (Hybris) integration
 * Generates product catalogs, categories, and content pages
 * 
 * @module core/sap_cc_adapter
 */

const fs = require('fs');
const path = require('path');

class SAPCCAdapter {
  constructor(config = {}) {
    this.config = config;
    this.catalogId = config.catalogId || 'default';
    this.catalogVersion = config.catalogVersion || 'Online';
    this.language = config.language || 'en';
  }

  /**
   * Map page to SAP CC content page format
   */
  mapToContentPage(page) {
    return {
      uid: this.generateUid(page.slug),
      name: page.title,
      title: page.enhanced?.seoTitle || page.title,
      catalogVersion: this.catalogVersion,
      pageType: this.mapPageType(page.pageType),
      template: this.determineTemplate(page.pageType),
      label: page.slug,
      homepage: page.pageType === 'homepage',
      content: {
        slots: this.buildContentSlots(page)
      },
      seo: {
        title: page.enhanced?.seoTitle || page.title,
        description: page.enhanced?.seoDescription || '',
        keywords: page.metadata?.keywords || ''
      },
      restrictions: [],
      approvalStatus: 'approved'
    };
  }

  /**
   * Generate UID for SAP CC
   */
  generateUid(slug) {
    return slug.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
  }

  /**
   * Map page type to SAP CC page type
   */
  mapPageType(pageType) {
    const typeMap = {
      'homepage': 'ContentPage',
      'product': 'ProductPage',
      'category': 'CategoryPage',
      'news': 'ContentPage',
      'about': 'ContentPage',
      'contact': 'ContentPage',
      'default': 'ContentPage'
    };
    
    return typeMap[pageType] || 'ContentPage';
  }

  /**
   * Determine template based on page type
   */
  determineTemplate(pageType) {
    const templateMap = {
      'homepage': 'LandingPage2Template',
      'product': 'ProductDetailsPageTemplate',
      'category': 'CategoryPageTemplate',
      'news': 'ContentPage1Template',
      'about': 'ContentPage1Template',
      'contact': 'ContactPageTemplate',
      'default': 'ContentPage1Template'
    };
    
    return templateMap[pageType] || 'ContentPage1Template';
  }

  /**
   * Build content slots for SAP CC
   */
  buildContentSlots(page) {
    const slots = [];

    // Hero slot
    if (page.enhanced?.assets?.hero) {
      slots.push({
        position: 'Section1',
        components: [{
          uid: `${this.generateUid(page.slug)}-hero`,
          typeCode: 'BannerComponent',
          name: 'Hero Banner',
          headline: page.enhanced.primaryHeading || page.title,
          content: page.enhanced.excerpt || '',
          media: {
            code: this.generateMediaCode(page.enhanced.assets.hero.src),
            url: page.enhanced.assets.hero.src,
            altText: page.enhanced.assets.hero.alt
          },
          urlLink: page.url
        }]
      });
    }

    // Main content slot
    if (page.content) {
      slots.push({
        position: 'Section2A',
        components: [{
          uid: `${this.generateUid(page.slug)}-content`,
          typeCode: 'CMSParagraphComponent',
          name: 'Main Content',
          content: this.formatContentForSAPCC(page)
        }]
      });
    }

    // Image gallery slot
    if (page.enhanced?.assets?.gallery && page.enhanced.assets.gallery.length > 0) {
      slots.push({
        position: 'Section3',
        components: [{
          uid: `${this.generateUid(page.slug)}-gallery`,
          typeCode: 'RotatingImagesComponent',
          name: 'Image Gallery',
          banners: page.enhanced.assets.gallery.map((img, index) => ({
            uid: `${this.generateUid(page.slug)}-img-${index}`,
            media: {
              code: this.generateMediaCode(img.src),
              url: img.src,
              altText: img.alt
            }
          }))
        }]
      });
    }

    // Related links slot
    if (page.enhanced?.relatedLinks?.content && page.enhanced.relatedLinks.content.length > 0) {
      slots.push({
        position: 'Section4',
        components: [{
          uid: `${this.generateUid(page.slug)}-links`,
          typeCode: 'CMSLinkComponent',
          name: 'Related Links',
          linkName: 'Related Content',
          links: page.enhanced.relatedLinks.content.slice(0, 5).map(link => ({
            linkName: link.text,
            url: link.href,
            target: false
          }))
        }]
      });
    }

    return slots;
  }

  /**
   * Format content for SAP CC HTML
   */
  formatContentForSAPCC(page) {
    let html = '';

    if (page.enhanced?.structuredContent?.sections) {
      page.enhanced.structuredContent.sections.forEach(section => {
        if (section.heading) {
          html += `<h2>${this.escapeHtml(section.heading)}</h2>\n`;
        }
        section.content.forEach(para => {
          html += `<p>${this.escapeHtml(para)}</p>\n`;
        });
      });
    } else {
      // Fallback to raw content
      const paragraphs = page.content.split('\n').filter(p => p.trim().length > 0);
      paragraphs.forEach(para => {
        html += `<p>${this.escapeHtml(para)}</p>\n`;
      });
    }

    return html;
  }

  /**
   * Generate media code for SAP CC
   */
  generateMediaCode(url) {
    try {
      const fileName = path.basename(new URL(url).pathname);
      return fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    } catch {
      return `media_${Date.now()}`;
    }
  }

  /**
   * Escape HTML special characters
   */
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * Map product page to SAP CC product format
   */
  mapToProduct(page) {
    if (page.pageType !== 'product') {
      return null;
    }

    return {
      code: this.generateUid(page.slug),
      name: page.title,
      description: page.enhanced?.excerpt || page.content.substring(0, 500),
      catalogVersion: this.catalogVersion,
      unit: 'pieces',
      approvalStatus: 'approved',
      images: page.images?.map((img, index) => ({
        imageType: index === 0 ? 'PRIMARY' : 'GALLERY',
        format: 'product',
        url: img.src,
        altText: img.alt
      })) || [],
      classifications: [],
      categories: []
    };
  }

  /**
   * Map category page to SAP CC category format
   */
  mapToCategory(page) {
    if (page.pageType !== 'category') {
      return null;
    }

    return {
      code: this.generateUid(page.slug),
      name: page.title,
      description: page.enhanced?.excerpt || '',
      catalogVersion: this.catalogVersion,
      allowedPrincipals: [],
      supercategories: []
    };
  }

  /**
   * Generate ImpEx format for SAP CC import
   */
  generateImpEx(pages) {
    let impex = `# SAP Commerce Cloud ImpEx
# Generated: ${new Date().toISOString()}
# Catalog: ${this.catalogId}
# Version: ${this.catalogVersion}

$contentCatalog=${this.catalogId}
$contentCV=catalogVersion(CatalogVersion.catalog(Catalog.id[default=$contentCatalog]),CatalogVersion.version[default=${this.catalogVersion}])[default=$contentCatalog:${this.catalogVersion}]

`;

    // Content Pages
    impex += `# Content Pages\n`;
    impex += `INSERT_UPDATE ContentPage;$contentCV[unique=true];uid[unique=true];name;masterTemplate(uid,$contentCV);label;defaultPage[default='true'];approvalStatus(code)[default='approved'];homepage[default='false']\n`;
    
    pages.forEach(page => {
      const contentPage = this.mapToContentPage(page);
      impex += `;;${contentPage.uid};${contentPage.name};${contentPage.template};${contentPage.label};true;approved;${contentPage.homepage}\n`;
    });

    impex += `\n`;

    return impex;
  }

  /**
   * Convert all pages to SAP CC format
   */
  convertAll(pages) {
    console.log(`[SAPCCAdapter] Converting ${pages.length} pages to SAP CC format...`);

    const converted = {
      contentPages: [],
      products: [],
      categories: [],
      impex: ''
    };

    pages.forEach(page => {
      const contentPage = this.mapToContentPage(page);
      converted.contentPages.push(contentPage);

      if (page.pageType === 'product') {
        const product = this.mapToProduct(page);
        if (product) converted.products.push(product);
      }

      if (page.pageType === 'category') {
        const category = this.mapToCategory(page);
        if (category) converted.categories.push(category);
      }
    });

    converted.impex = this.generateImpEx(pages);

    console.log(`[SAPCCAdapter] Conversion complete: ${converted.contentPages.length} pages, ${converted.products.length} products, ${converted.categories.length} categories`);
    
    return converted;
  }

  /**
   * Save SAP CC data to files
   */
  saveToFiles(data, outputDir) {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save content pages
    const contentPagesPath = path.join(outputDir, 'content_pages.json');
    fs.writeFileSync(contentPagesPath, JSON.stringify(data.contentPages, null, 2), 'utf-8');
    console.log(`[SAPCCAdapter] Content pages saved: ${contentPagesPath}`);

    // Save products
    if (data.products.length > 0) {
      const productsPath = path.join(outputDir, 'products.json');
      fs.writeFileSync(productsPath, JSON.stringify(data.products, null, 2), 'utf-8');
      console.log(`[SAPCCAdapter] Products saved: ${productsPath}`);
    }

    // Save categories
    if (data.categories.length > 0) {
      const categoriesPath = path.join(outputDir, 'categories.json');
      fs.writeFileSync(categoriesPath, JSON.stringify(data.categories, null, 2), 'utf-8');
      console.log(`[SAPCCAdapter] Categories saved: ${categoriesPath}`);
    }

    // Save ImpEx
    const impexPath = path.join(outputDir, 'import.impex');
    fs.writeFileSync(impexPath, data.impex, 'utf-8');
    console.log(`[SAPCCAdapter] ImpEx saved: ${impexPath}`);

    return {
      contentPages: contentPagesPath,
      products: data.products.length > 0 ? path.join(outputDir, 'products.json') : null,
      categories: data.categories.length > 0 ? path.join(outputDir, 'categories.json') : null,
      impex: impexPath
    };
  }
}

module.exports = { SAPCCAdapter };
