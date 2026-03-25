const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const assertionModel = require('../models/assertion.model');
const recipientModel = require('../models/recipient.model');
const { port } = require('../config/env');

const PURPLE = '#79368f';
const BLUE = '#0094d4';
const DARK = '#2d1b3d';
const GRAY = '#636e72';
const LIGHT_GRAY = '#b2bec3';
const BG_LIGHT = '#f8f5fa';

function getBaseUrl() {
  return process.env.APP_URL || process.env.BASE_URL || `http://localhost:${port}`;
}

function fmtDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('es-ES', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

async function generateQR(text) {
  return QRCode.toBuffer(text, {
    width: 60,
    margin: 1,
    color: { dark: DARK, light: '#ffffff' },
  });
}

async function generateTranscript(recipientId) {
  const recipient = await recipientModel.findById(recipientId);
  if (!recipient) {
    const err = new Error('Recipient not found');
    err.status = 404;
    throw err;
  }

  const assertions = await assertionModel.findActiveByRecipient(recipientId);
  const baseUrl = getBaseUrl();
  const issuerName = assertions.length > 0 ? assertions[0].issuer_name : 'Open Badges Issuer';

  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    info: {
      Title: `Transcript — ${recipient.name}`,
      Author: issuerName,
      Subject: 'Comprehensive Learner Record (CLR)',
    },
  });

  const chunks = [];
  doc.on('data', (c) => chunks.push(c));

  const pageW = doc.page.width;
  const contentW = pageW - 100;

  // ---- HEADER ----
  doc.rect(0, 0, pageW, 110).fill(DARK);

  doc.fontSize(22).fill('#ffffff').text('Comprehensive Learner Record', 50, 35, { width: contentW });
  doc.fontSize(11).fill(LIGHT_GRAY).text(issuerName, 50, 62, { width: contentW });
  doc.fontSize(9).fill(LIGHT_GRAY).text(
    `Generado el ${fmtDate(new Date())}`,
    50, 82, { width: contentW }
  );

  // Accent bar
  doc.rect(0, 110, pageW, 4).fill(BLUE);

  // ---- RECIPIENT INFO ----
  let y = 134;
  doc.rect(50, y, contentW, 60).lineWidth(0.5).fillAndStroke(BG_LIGHT, '#e0d6e6');

  y += 14;
  doc.fontSize(14).fill(DARK).text(recipient.name, 66, y);
  y += 20;
  doc.fontSize(10).fill(GRAY).text(recipient.email, 66, y);
  if (recipient.url) {
    doc.text(' · ' + recipient.url, { continued: false });
  }

  y += 30;

  // ---- BADGES COUNT ----
  doc.fontSize(10).fill(PURPLE).text(
    `${assertions.length} credencial${assertions.length !== 1 ? 'es' : ''} activa${assertions.length !== 1 ? 's' : ''}`,
    50, y
  );
  y += 20;

  // Divider
  doc.moveTo(50, y).lineTo(50 + contentW, y).lineWidth(0.5).stroke(LIGHT_GRAY);
  y += 15;

  // ---- BADGE LIST ----
  for (let i = 0; i < assertions.length; i++) {
    const a = assertions[i];
    const verifyUrl = `${baseUrl}/verify/${a.id}`;

    // Check page space — need ~140px for a badge entry
    if (y > doc.page.height - 190) {
      doc.addPage();
      y = 50;
    }

    // Card background
    const cardH = 120;
    doc.rect(50, y, contentW, cardH).lineWidth(0.5).fillAndStroke('#ffffff', '#e0d6e6');

    // Left accent bar
    doc.rect(50, y, 4, cardH).fill(PURPLE);

    const innerX = 70;
    let ty = y + 12;

    // Type tag
    const typeLabel = a.achievement_type || 'Badge';
    const tagW = doc.fontSize(8).widthOfString(typeLabel.toUpperCase()) + 12;
    doc.roundedRect(innerX, ty, tagW, 16, 8).fill(BLUE);
    doc.fontSize(8).fill('#ffffff').text(typeLabel.toUpperCase(), innerX + 6, ty + 4);
    ty += 24;

    // Badge name
    doc.fontSize(13).fill(DARK).text(a.badge_name, innerX, ty, { width: contentW - 110 });
    ty += doc.heightOfString(a.badge_name, { width: contentW - 110, fontSize: 13 }) + 4;

    // Dates
    const dateText = `Emitido: ${fmtDate(a.issued_on)}${a.expires_at ? '  ·  Vence: ' + fmtDate(a.expires_at) : ''}`;
    doc.fontSize(9).fill(GRAY).text(dateText, innerX, ty, { width: contentW - 110 });
    ty += 14;

    // Criteria
    if (a.criteria_narrative) {
      const critText = a.criteria_narrative.length > 120
        ? a.criteria_narrative.substring(0, 120) + '...'
        : a.criteria_narrative;
      doc.fontSize(8).fill(LIGHT_GRAY).text(critText, innerX, ty, { width: contentW - 110 });
    }

    // QR code on the right
    try {
      const qrBuf = await generateQR(verifyUrl);
      doc.image(qrBuf, 50 + contentW - 74, y + 12, { width: 56 });
      doc.fontSize(6).fill(LIGHT_GRAY).text('Verificar', 50 + contentW - 74, y + 70, {
        width: 56, align: 'center',
      });
    } catch (_) {}

    y += cardH + 12;
  }

  // ---- NO BADGES ----
  if (assertions.length === 0) {
    doc.fontSize(12).fill(GRAY).text(
      'Este recipient no tiene credenciales activas.',
      50, y, { width: contentW, align: 'center' }
    );
  }

  // ---- FOOTER (on each page) ----
  const totalPages = doc.bufferedPageRange().count;
  for (let p = 0; p < totalPages; p++) {
    doc.switchToPage(p);
    const footY = doc.page.height - 40;
    doc.fontSize(8).fill(LIGHT_GRAY)
      .text(
        `Documento generado por ${issuerName} · Open Badges 3.0 · ${baseUrl}`,
        50, footY, { width: contentW, align: 'center' }
      );
    doc.fontSize(7).fill(LIGHT_GRAY)
      .text(
        `Página ${p + 1} de ${totalPages}`,
        50, footY + 12, { width: contentW, align: 'center' }
      );
  }

  doc.end();

  return new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

module.exports = { generateTranscript };
