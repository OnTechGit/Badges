const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SIZES = {
  Badge: { w: 600, h: 600 },
  Certification: { w: 600, h: 600 },
  Certificate: { w: 1056, h: 816 },
  Diploma: { w: 1056, h: 816 },
};

const DEFAULT_CONFIG = {
  backgroundImageUrl: null,
  elements: {
    badgeName:     { x: 50, y: 45, fontSize: 32, color: '#ffffff', align: 'center', visible: true },
    recipientName: { x: 50, y: 55, fontSize: 24, color: '#ffffff', align: 'center', visible: true, required: false },
    issueDate:     { x: 50, y: 65, fontSize: 16, color: '#cccccc', align: 'center', visible: true },
    expiryDate:    { x: 50, y: 70, fontSize: 16, color: '#cccccc', align: 'center', visible: false },
    criteria:      { x: 50, y: 80, fontSize: 14, color: '#aaaaaa', align: 'center', visible: false },
  },
};

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function svgAnchor(align) {
  if (align === 'left') return 'start';
  if (align === 'right') return 'end';
  return 'middle';
}

function wrapLines(text, maxChars) {
  const words = String(text).split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

/**
 * Generates a badge PNG using design_config.
 * If a background image exists, it is resized to fit and text is overlaid.
 * Otherwise, a solid dark background is used.
 */
async function generateDesignedBadge({ badgeName, recipientName, issuerName, achievementType, criteria, issuedOn, expiresAt, designConfig }) {
  const type = achievementType || 'Badge';
  const size = SIZES[type] || SIZES.Badge;
  const cfg = { ...DEFAULT_CONFIG, ...(designConfig || {}) };
  cfg.elements = { ...DEFAULT_CONFIG.elements };
  if (designConfig && designConfig.elements) {
    for (const key of Object.keys(DEFAULT_CONFIG.elements)) {
      if (designConfig.elements[key]) {
        cfg.elements[key] = { ...DEFAULT_CONFIG.elements[key], ...designConfig.elements[key] };
      }
    }
  }

  const { w, h } = size;

  // Build text elements as SVG overlay
  const textParts = [];

  function addElement(key, text) {
    const el = cfg.elements[key];
    if (!el || !el.visible || !text) return;

    const px = (el.x / 100) * w;
    const py = (el.y / 100) * h;
    const anchor = svgAnchor(el.align);
    const fs = el.fontSize || 16;
    const maxChars = Math.floor(w / (fs * 0.55));

    const lines = wrapLines(text, maxChars);
    lines.forEach((line, i) => {
      textParts.push(
        `<text x="${px}" y="${py + i * (fs * 1.3)}" text-anchor="${anchor}" ` +
        `font-family="Arial,Helvetica,sans-serif" font-size="${fs}" ` +
        `font-weight="${fs >= 24 ? 'bold' : 'normal'}" ` +
        `fill="${el.color}">${escapeXml(line)}</text>`
      );
    });
  }

  addElement('badgeName', badgeName);
  addElement('recipientName', recipientName);

  const dateStr = issuedOn
    ? new Date(issuedOn).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;
  addElement('issueDate', dateStr);

  const expiryStr = expiresAt
    ? new Date(expiresAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;
  addElement('expiryDate', expiryStr);

  addElement('criteria', criteria);

  const overlaySvg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${textParts.join('')}</svg>`;

  // Try to load background image
  let base;
  const bgUrl = cfg.backgroundImageUrl;

  if (bgUrl) {
    const localPath = bgUrl.startsWith('/')
      ? path.join(__dirname, '..', 'public', bgUrl)
      : bgUrl;

    if (fs.existsSync(localPath)) {
      base = await sharp(localPath).resize(w, h, { fit: 'cover' }).png().toBuffer();
    }
  }

  if (!base) {
    // Default gradient background via SVG
    const bgSvg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#2d1b3d"/>
          <stop offset="100%" style="stop-color:#79368f"/>
        </linearGradient>
      </defs>
      <rect width="${w}" height="${h}" fill="url(#bg)"/>
      <circle cx="${w * 0.8}" cy="${h * 0.15}" r="${w * 0.15}" fill="rgba(0,148,212,0.06)"/>
      <circle cx="${w * 0.2}" cy="${h * 0.85}" r="${w * 0.1}" fill="rgba(0,148,212,0.04)"/>
    </svg>`;
    base = await sharp(Buffer.from(bgSvg)).png().toBuffer();
  }

  // Composite text overlay on background
  const result = await sharp(base)
    .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
    .png()
    .toBuffer();

  return result;
}

module.exports = { generateDesignedBadge, DEFAULT_CONFIG, SIZES };
