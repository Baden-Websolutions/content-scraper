/**
 * Data Transformation Utilities
 * 
 * Transforms scraped content to Storyblok and SAP CC formats
 * 
 * @module migration/transformers
 */

const crypto = require('crypto');
const { URL } = require('url');

/**
 * Generate unique ID for Storyblok components
 */
function generateUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Generate slug from URL
 */
function generateSlug(url) {
  try {
    const urlObj = new URL(url);
    let slug = urlObj.pathname
      .replace(/^\//, '')
      .replace(/\/$/, '')
      .toLowerCase();
    
    return slug || 'home';
  } catch {
    return 'page';
  }
}

/**
 * Generate page UID for SAP CC
 */
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

/**
 * Generate product code for SAP CC
 */
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

/**
 * Generate media code for SAP CC
 */
function generateMediaCode(localPath) {
  const normalized = localPath
    .replace(/^output\/images\//, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .toLowerCase();
  
  const hash = crypto
    .createHash('md5')
    .update(localPath)
    .digest('hex')
    .substring(0, 8);
  
  return `${normalized}_${hash}`;
}

/**
 * Escape CSV values
 */
function escapeCsv(str) {
  if (!str) return '';
  return str.replace(/"/g, '""');
}

/**
 * Escape HTML
 */
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Transform scraped page to Storyblok story
 */
function transformToStoryblok(scrapedPage, assetMapping) {
  // Transform images
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
  
  // Simple richtext content
  const richtextContent = {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [
          {
            type: 'text',
            text: scrapedPage.h1 || scrapedPage.title
          }
        ]
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: scrapedPage.metaDescription || scrapedPage.content.substring(0, 500)
          }
        ]
      }
    ]
  };
  
  // SEO blok
  const seoBlok = {
    component: 'seo',
    _uid: generateUID(),
    title: scrapedPage.title,
    description: scrapedPage.metaDescription,
    og_image: imageBloks.length > 0 ? imageBloks[0].asset : null
  };
  
  // Story structure
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
    is_startpage: scrapedPage.url.endsWith('/') && scrapedPage.url.split('/').length <= 4,
    parent_id: null,
    position: 0
  };
}

/**
 * Transform scraped page to SAP CC page data
 */
function transformToSAPCCPage(scrapedPage) {
  return {
    uid: generatePageUid(scrapedPage.url),
    name: scrapedPage.title,
    label: generatePageUid(scrapedPage.url),
    title: scrapedPage.title,
    description: scrapedPage.metaDescription
  };
}

/**
 * Transform scraped page to SAP CC components
 */
function transformToSAPCCComponents(scrapedPage, mediaMapping) {
  const components = [];
  const pageUid = generatePageUid(scrapedPage.url);
  
  // Paragraph Component (Main Content)
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
          },
          urlLink: img.pageUrl || ''
        }
      });
    }
  });
  
  return components;
}

/**
 * Transform scraped page to SAP CC product
 */
function transformToSAPCCProduct(scrapedPage, mediaMapping) {
  const productCode = generateProductCode(scrapedPage.url);
  
  const product = {
    code: productCode,
    name: scrapedPage.title,
    description: scrapedPage.metaDescription || scrapedPage.content.substring(0, 500),
    approvalStatus: 'approved'
  };
  
  // Primary image
  if (scrapedPage.images.length > 0) {
    const primaryImage = scrapedPage.images[0];
    if (primaryImage.localPath && mediaMapping.has(primaryImage.localPath)) {
      product.picture = mediaMapping.get(primaryImage.localPath);
    }
  }
  
  // Gallery images
  const galleryImages = scrapedPage.images
    .slice(1, 6)
    .filter(img => img.localPath && mediaMapping.has(img.localPath))
    .map(img => mediaMapping.get(img.localPath));
  
  if (galleryImages.length > 0) {
    product.galleryImages = galleryImages;
  }
  
  return product;
}

/**
 * Batch transform pages to Storyblok
 */
function batchTransformToStoryblok(scrapedPages, assetMapping) {
  return scrapedPages.map(page => transformToStoryblok(page, assetMapping));
}

/**
 * Batch transform pages to SAP CC
 */
function batchTransformToSAPCC(scrapedPages, mediaMapping) {
  return scrapedPages.map(page => ({
    page: transformToSAPCCPage(page),
    components: transformToSAPCCComponents(page, mediaMapping),
    product: transformToSAPCCProduct(page, mediaMapping)
  }));
}

module.exports = {
  // Generators
  generateUID,
  generateSlug,
  generatePageUid,
  generateProductCode,
  generateMediaCode,
  
  // Escapers
  escapeCsv,
  escapeHtml,
  
  // Storyblok Transformers
  transformToStoryblok,
  batchTransformToStoryblok,
  
  // SAP CC Transformers
  transformToSAPCCPage,
  transformToSAPCCComponents,
  transformToSAPCCProduct,
  batchTransformToSAPCC
};
