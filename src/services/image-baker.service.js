const zlib = require('zlib');

/**
 * PNG Baking for Open Badges 3.0
 *
 * Embeds JSON-LD metadata into a PNG file using the tEXt chunk
 * with the key "openbadges" as per the Open Badges specification.
 *
 * PNG structure: Signature + Chunks (IHDR, ..., IEND)
 * tEXt chunk format: Length(4) + "tEXt"(4) + keyword + null(1) + text + CRC(4)
 */

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createTExtChunk(keyword, text) {
  // tEXt chunk data: keyword + null separator + text
  const keyBuf = Buffer.from(keyword, 'latin1');
  const nullBuf = Buffer.from([0]);
  const textBuf = Buffer.from(text, 'latin1');
  const data = Buffer.concat([keyBuf, nullBuf, textBuf]);

  const type = Buffer.from('tEXt', 'ascii');

  // Length (4 bytes, big-endian)
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);

  // CRC over type + data
  const crcInput = Buffer.concat([type, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput));

  return Buffer.concat([length, type, data, crcBuf]);
}

function createZTxtChunk(keyword, text) {
  // zTXt chunk: keyword + null + compression method (0=deflate) + compressed text
  const keyBuf = Buffer.from(keyword, 'latin1');
  const nullBuf = Buffer.from([0]);
  const methodBuf = Buffer.from([0]); // deflate
  const compressed = zlib.deflateSync(Buffer.from(text, 'utf8'));
  const data = Buffer.concat([keyBuf, nullBuf, methodBuf, compressed]);

  const type = Buffer.from('zTXt', 'ascii');

  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);

  const crcInput = Buffer.concat([type, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput));

  return Buffer.concat([length, type, data, crcBuf]);
}

/**
 * Bakes JSON-LD metadata into a PNG buffer.
 * Inserts a zTXt chunk with key "openbadges" before IEND.
 * Uses zTXt (compressed) to keep file size reasonable for large JSON-LD.
 */
function bakeIntoPng(pngBuffer, jsonLdString) {
  // Validate PNG signature
  if (!pngBuffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('Invalid PNG file');
  }

  // Find IEND chunk position
  let pos = 8;
  let iendPos = -1;

  while (pos < pngBuffer.length) {
    const chunkLength = pngBuffer.readUInt32BE(pos);
    const chunkType = pngBuffer.subarray(pos + 4, pos + 8).toString('ascii');

    if (chunkType === 'IEND') {
      iendPos = pos;
      break;
    }

    // Move to next chunk: length(4) + type(4) + data(chunkLength) + crc(4)
    pos += 4 + 4 + chunkLength + 4;
  }

  if (iendPos === -1) {
    throw new Error('Invalid PNG: IEND chunk not found');
  }

  // Build new PNG: everything before IEND + openbadges chunk + IEND
  const beforeIend = pngBuffer.subarray(0, iendPos);
  const iendChunk = pngBuffer.subarray(iendPos);
  const badgeChunk = createZTxtChunk('openbadges', jsonLdString);

  return Buffer.concat([beforeIend, badgeChunk, iendChunk]);
}

/**
 * Extracts the "openbadges" metadata from a baked PNG.
 * Checks both tEXt and zTXt chunks.
 */
function extractFromPng(pngBuffer) {
  if (!pngBuffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('Invalid PNG file');
  }

  let pos = 8;

  while (pos < pngBuffer.length) {
    const chunkLength = pngBuffer.readUInt32BE(pos);
    const chunkType = pngBuffer.subarray(pos + 4, pos + 8).toString('ascii');
    const chunkData = pngBuffer.subarray(pos + 8, pos + 8 + chunkLength);

    if (chunkType === 'tEXt') {
      const nullIdx = chunkData.indexOf(0);
      const keyword = chunkData.subarray(0, nullIdx).toString('latin1');
      if (keyword === 'openbadges') {
        return chunkData.subarray(nullIdx + 1).toString('latin1');
      }
    }

    if (chunkType === 'zTXt') {
      const nullIdx = chunkData.indexOf(0);
      const keyword = chunkData.subarray(0, nullIdx).toString('latin1');
      if (keyword === 'openbadges') {
        // byte after null is compression method (0 = deflate), then compressed data
        const compressed = chunkData.subarray(nullIdx + 2);
        return zlib.inflateSync(compressed).toString('utf8');
      }
    }

    if (chunkType === 'IEND') break;

    pos += 4 + 4 + chunkLength + 4;
  }

  return null;
}

module.exports = { bakeIntoPng, extractFromPng };
