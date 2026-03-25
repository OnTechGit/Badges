const sharp = require('sharp');

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapText(text, maxChars) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = (current + ' ' + word).trim();
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

async function generateBadgeImage({ badgeName, issuerName, achievementType, issuedOn }) {
  const width = 600;
  const height = 400;
  const typeLabel = achievementType || 'Badge';
  const dateStr = new Date(issuedOn).toLocaleDateString('es-ES', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const nameLines = wrapText(badgeName, 30);
  const nameY = 185;
  const nameSvg = nameLines.map((line, i) =>
    `<text x="300" y="${nameY + i * 36}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="28" font-weight="bold" fill="#ffffff">${escapeXml(line)}</text>`
  ).join('');

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e"/>
      <stop offset="100%" style="stop-color:#0f3460"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#e94560"/>
      <stop offset="100%" style="stop-color:#f06292"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${width}" height="${height}" rx="20" fill="url(#bg)"/>

  <!-- Decorative elements -->
  <circle cx="500" cy="80" r="120" fill="rgba(255,255,255,0.03)"/>
  <circle cx="100" cy="350" r="80" fill="rgba(255,255,255,0.03)"/>

  <!-- Top accent bar -->
  <rect x="40" y="30" width="80" height="4" rx="2" fill="url(#accent)"/>

  <!-- Type label -->
  <rect x="40" y="50" width="${typeLabel.length * 11 + 24}" height="30" rx="15" fill="url(#accent)"/>
  <text x="${40 + (typeLabel.length * 11 + 24) / 2}" y="70" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="bold" fill="#ffffff" letter-spacing="1">${escapeXml(typeLabel.toUpperCase())}</text>

  <!-- Shield icon -->
  <g transform="translate(267, 105)">
    <path d="M33 4 L60 16 L60 36 C60 56 48 68 33 74 C18 68 6 56 6 36 L6 16 Z" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
    <path d="M25 38 L31 44 L43 30" fill="none" stroke="#e94560" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  </g>

  <!-- Badge name -->
  ${nameSvg}

  <!-- Divider -->
  <line x1="200" y1="${nameY + nameLines.length * 36 + 5}" x2="400" y2="${nameY + nameLines.length * 36 + 5}" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>

  <!-- Issuer -->
  <text x="300" y="${nameY + nameLines.length * 36 + 35}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="16" fill="#a8a8b3">Emitido por</text>
  <text x="300" y="${nameY + nameLines.length * 36 + 58}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="18" font-weight="bold" fill="#e0e0e0">${escapeXml(issuerName)}</text>

  <!-- Date -->
  <text x="300" y="${height - 40}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="12" fill="#666">${escapeXml(dateStr)}</text>

  <!-- OB3 watermark -->
  <text x="${width - 50}" y="${height - 20}" text-anchor="end" font-family="Arial,Helvetica,sans-serif" font-size="10" fill="rgba(255,255,255,0.15)" font-weight="bold">Open Badges 3.0</text>
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { generateBadgeImage };
