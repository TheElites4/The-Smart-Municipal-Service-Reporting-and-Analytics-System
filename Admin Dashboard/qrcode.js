/*
 * Minimal QR Code encoder for authenticator enrollment.
 *
 * Why vendored instead of a CDN: the otpauth:// URI contains the TOTP shared
 * secret, and the enrollment page must work on an air-gapped/offline municipal
 * network. Rendering the QR locally means the secret is never sent to a
 * third-party service and no external script has to load.
 *
 * Implements byte-mode encoding at error-correction level L for versions 1-10,
 * which comfortably covers an otpauth:// URI (~130 chars). This is deliberately
 * a small subset of the QR spec, not a general-purpose encoder.
 *
 * Usage:
 *   const canvas = window.mzansiQr.render(uri, 220);
 *   element.appendChild(canvas);
 */

(function attachQrRenderer(global) {
  'use strict';

  // --- Reed-Solomon over GF(256), polynomial 0x11d -------------------------
  const EXP = new Uint8Array(512);
  const LOG = new Uint8Array(256);
  (function initTables() {
    let x = 1;
    for (let i = 0; i < 255; i += 1) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
  })();

  const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

  const rsGenerator = (degree) => {
    let poly = [1];
    for (let i = 0; i < degree; i += 1) {
      const next = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j += 1) {
        next[j] ^= gfMul(poly[j], 1);
        next[j + 1] ^= gfMul(poly[j], EXP[i]);
      }
      poly = next;
    }
    return poly;
  };

  const rsEncode = (data, ecCount) => {
    const generator = rsGenerator(ecCount);
    const result = new Uint8Array(ecCount);
    for (const byte of data) {
      const factor = byte ^ result[0];
      result.copyWithin(0, 1);
      result[ecCount - 1] = 0;
      if (factor !== 0) {
        for (let i = 0; i < ecCount; i += 1) {
          result[i] ^= gfMul(generator[i + 1], factor);
        }
      }
    }
    return result;
  };

  // --- Version tables (byte mode, level L only) ----------------------------
  // [totalCodewords, ecCodewordsPerBlock, group1Blocks, group1DataCodewords,
  //  group2Blocks, group2DataCodewords]
  const VERSIONS = {
    1: [26, 7, 1, 19, 0, 0],
    2: [44, 10, 1, 34, 0, 0],
    3: [70, 15, 1, 55, 0, 0],
    4: [100, 20, 1, 80, 0, 0],
    5: [134, 26, 1, 108, 0, 0],
    6: [172, 18, 2, 68, 0, 0],
    7: [196, 20, 2, 78, 0, 0],
    8: [242, 24, 2, 97, 0, 0],
    9: [292, 30, 2, 116, 0, 0],
    10: [346, 18, 2, 68, 2, 69],
  };
  const ALIGNMENT = {
    1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
    6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
  };

  const chooseVersion = (byteLength) => {
    for (let version = 1; version <= 10; version += 1) {
      const [, , g1Blocks, g1Data, g2Blocks, g2Data] = VERSIONS[version];
      const capacity = g1Blocks * g1Data + g2Blocks * g2Data;
      // 4-bit mode indicator + 8-bit length (versions 1-9) or 16-bit (10+).
      const headerBits = version >= 10 ? 4 + 16 : 4 + 8;
      if (byteLength * 8 + headerBits <= capacity * 8) return version;
    }
    throw new Error('Content is too long for the built-in QR encoder.');
  };

  const utf8Bytes = (text) => {
    if (typeof TextEncoder === 'function') return new TextEncoder().encode(text);
    const escaped = unescape(encodeURIComponent(text));
    const bytes = new Uint8Array(escaped.length);
    for (let i = 0; i < escaped.length; i += 1) bytes[i] = escaped.charCodeAt(i);
    return bytes;
  };

  // --- Bit buffer ----------------------------------------------------------
  class BitBuffer {
    constructor() { this.bits = []; }
    put(value, length) {
      for (let i = length - 1; i >= 0; i -= 1) this.bits.push((value >>> i) & 1);
    }
    get length() { return this.bits.length; }
    toBytes() {
      while (this.bits.length % 8 !== 0) this.bits.push(0);
      const bytes = new Uint8Array(this.bits.length / 8);
      for (let i = 0; i < bytes.length; i += 1) {
        let byte = 0;
        for (let j = 0; j < 8; j += 1) byte = (byte << 1) | this.bits[i * 8 + j];
        bytes[i] = byte;
      }
      return bytes;
    }
  }

  const buildCodewords = (data, version) => {
    const [totalCodewords, ecPerBlock, g1Blocks, g1Data, g2Blocks, g2Data] = VERSIONS[version];
    const buffer = new BitBuffer();
    buffer.put(4, 4); // byte mode
    buffer.put(data.length, version >= 10 ? 16 : 8);
    for (const byte of data) buffer.put(byte, 8);

    const dataCodewords = g1Blocks * g1Data + g2Blocks * g2Data;
    const capacityBits = dataCodewords * 8;
    // Terminator, then pad to a byte boundary.
    buffer.put(0, Math.min(4, capacityBits - buffer.length));
    while (buffer.length % 8 !== 0) buffer.put(0, 1);
    let bytes = buffer.toBytes();
    // Pad with the alternating 0xEC / 0x11 pattern defined by the spec.
    const pad = [0xec, 0x11];
    let padIndex = 0;
    while (bytes.length < dataCodewords) {
      bytes = Uint8Array.from([...bytes, pad[padIndex % 2]]);
      padIndex += 1;
    }

    // Split into blocks, add error correction, then interleave.
    const blocks = [];
    let offset = 0;
    for (let i = 0; i < g1Blocks; i += 1) {
      const block = bytes.slice(offset, offset + g1Data);
      offset += g1Data;
      blocks.push({ data: block, ec: rsEncode(block, ecPerBlock) });
    }
    for (let i = 0; i < g2Blocks; i += 1) {
      const block = bytes.slice(offset, offset + g2Data);
      offset += g2Data;
      blocks.push({ data: block, ec: rsEncode(block, ecPerBlock) });
    }

    const result = [];
    const maxData = Math.max(...blocks.map((block) => block.data.length));
    for (let i = 0; i < maxData; i += 1) {
      for (const block of blocks) if (i < block.data.length) result.push(block.data[i]);
    }
    for (let i = 0; i < ecPerBlock; i += 1) {
      for (const block of blocks) result.push(block.ec[i]);
    }
    if (result.length !== totalCodewords) {
      throw new Error('QR codeword assembly mismatch');
    }
    return result;
  };

  // --- Matrix construction -------------------------------------------------
  const createMatrix = (version) => {
    const size = version * 4 + 17;
    const modules = Array.from({ length: size }, () => new Int8Array(size).fill(-1));
    const reserved = Array.from({ length: size }, () => new Uint8Array(size));

    const setFinder = (row, col) => {
      for (let r = -1; r <= 7; r += 1) {
        for (let c = -1; c <= 7; c += 1) {
          const y = row + r;
          const x = col + c;
          if (y < 0 || y >= size || x < 0 || x >= size) continue;
          const inRing = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
            (c >= 0 && c <= 6 && (r === 0 || r === 6));
          const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          modules[y][x] = inRing || inCore ? 1 : 0;
          reserved[y][x] = 1;
        }
      }
    };
    setFinder(0, 0);
    setFinder(0, size - 7);
    setFinder(size - 7, 0);

    // Timing patterns.
    for (let i = 8; i < size - 8; i += 1) {
      const value = i % 2 === 0 ? 1 : 0;
      if (!reserved[6][i]) { modules[6][i] = value; reserved[6][i] = 1; }
      if (!reserved[i][6]) { modules[i][6] = value; reserved[i][6] = 1; }
    }

    // Alignment patterns.
    const positions = ALIGNMENT[version];
    for (const row of positions) {
      for (const col of positions) {
        if ((row === 6 && (col === 6 || col === size - 7)) ||
            (col === 6 && row === size - 7)) continue;
        for (let r = -2; r <= 2; r += 1) {
          for (let c = -2; c <= 2; c += 1) {
            const isBorder = Math.abs(r) === 2 || Math.abs(c) === 2;
            const isCenter = r === 0 && c === 0;
            modules[row + r][col + c] = isBorder || isCenter ? 1 : 0;
            reserved[row + r][col + c] = 1;
          }
        }
      }
    }

    // Reserve format areas (values written later) and the version block.
    for (let i = 0; i < 9; i += 1) {
      if (!reserved[8][i]) reserved[8][i] = 1;
      if (!reserved[i][8]) reserved[i][8] = 1;
    }
    for (let i = 0; i < 8; i += 1) {
      if (!reserved[8][size - 1 - i]) reserved[8][size - 1 - i] = 1;
      if (!reserved[size - 1 - i][8]) reserved[size - 1 - i][8] = 1;
    }
    reserved[size - 8][8] = 1;
    if (version >= 7) {
      for (let i = 0; i < 6; i += 1) {
        for (let j = 0; j < 3; j += 1) {
          reserved[size - 11 + j][i] = 1;
          reserved[i][size - 11 + j] = 1;
        }
      }
    }
    return { modules, reserved, size };
  };

  const placeData = (matrix, codewords) => {
    const { modules, reserved, size } = matrix;
    const bits = [];
    for (const byte of codewords) {
      for (let i = 7; i >= 0; i -= 1) bits.push((byte >>> i) & 1);
    }
    let index = 0;
    let upward = true;
    for (let col = size - 1; col > 0; col -= 2) {
      if (col === 6) col -= 1; // skip the vertical timing column
      for (let step = 0; step < size; step += 1) {
        const row = upward ? size - 1 - step : step;
        for (let c = 0; c < 2; c += 1) {
          const x = col - c;
          if (reserved[row][x]) continue;
          modules[row][x] = index < bits.length ? bits[index] : 0;
          index += 1;
        }
      }
      upward = !upward;
    }
  };

  const FORMAT_GENERATOR = 0b10100110111;
  const formatBits = (ecBits, mask) => {
    let data = (ecBits << 3) | mask;
    let value = data << 10;
    for (let i = 14; i >= 10; i -= 1) {
      if ((value >>> i) & 1) value ^= FORMAT_GENERATOR << (i - 10);
    }
    return ((data << 10) | value) ^ 0b101010000010010;
  };

  const applyMask = (matrix, mask) => {
    const { modules, reserved, size } = matrix;
    const condition = (row, col) => {
      switch (mask) {
        case 0: return (row + col) % 2 === 0;
        case 1: return row % 2 === 0;
        case 2: return col % 3 === 0;
        case 3: return (row + col) % 3 === 0;
        case 4: return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
        case 5: return ((row * col) % 2) + ((row * col) % 3) === 0;
        case 6: return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
        default: return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0;
      }
    };
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        if (!reserved[row][col] && condition(row, col)) {
          modules[row][col] ^= 1;
        }
      }
    }
  };

  const writeFormat = (matrix, mask) => {
    const { modules, size } = matrix;
    const bits = formatBits(0b01, mask); // level L = 0b01
    for (let i = 0; i < 15; i += 1) {
      const bit = (bits >>> i) & 1;
      // Vertical copy beside the top-left finder.
      if (i < 6) modules[i][8] = bit;
      else if (i === 6) modules[7][8] = bit;
      else if (i === 7) modules[8][8] = bit;
      else if (i === 8) modules[8][7] = bit;
      else modules[8][14 - i] = bit;
      // Horizontal copy.
      if (i < 8) modules[8][size - 1 - i] = bit;
      else modules[size - 15 + i][8] = bit;
    }
    modules[size - 8][8] = 1; // always dark
  };

  const writeVersion = (matrix, version) => {
    if (version < 7) return;
    const { modules, size } = matrix;
    let value = version << 12;
    for (let i = 17; i >= 12; i -= 1) {
      if ((value >>> i) & 1) value ^= 0b1111100100101 << (i - 12);
    }
    const bits = (version << 12) | value;
    for (let i = 0; i < 18; i += 1) {
      const bit = (bits >>> i) & 1;
      modules[Math.floor(i / 3)][size - 11 + (i % 3)] = bit;
      modules[size - 11 + (i % 3)][Math.floor(i / 3)] = bit;
    }
  };

  const penalty = (matrix) => {
    const { modules, size } = matrix;
    let score = 0;
    // Rule 1: runs of five or more same-coloured modules in a row/column.
    for (let i = 0; i < size; i += 1) {
      let runRow = 1;
      let runCol = 1;
      for (let j = 1; j < size; j += 1) {
        if (modules[i][j] === modules[i][j - 1]) { runRow += 1; } else { if (runRow >= 5) score += runRow - 2; runRow = 1; }
        if (modules[j][i] === modules[j - 1][i]) { runCol += 1; } else { if (runCol >= 5) score += runCol - 2; runCol = 1; }
      }
      if (runRow >= 5) score += runRow - 2;
      if (runCol >= 5) score += runCol - 2;
    }
    // Rule 2: 2x2 blocks of one colour.
    for (let row = 0; row < size - 1; row += 1) {
      for (let col = 0; col < size - 1; col += 1) {
        const value = modules[row][col];
        if (value === modules[row][col + 1] && value === modules[row + 1][col] && value === modules[row + 1][col + 1]) {
          score += 3;
        }
      }
    }
    return score;
  };

  const buildMatrix = (text) => {
    const data = utf8Bytes(text);
    const version = chooseVersion(data.length);
    const codewords = buildCodewords(data, version);
    let best = null;
    for (let mask = 0; mask < 8; mask += 1) {
      const matrix = createMatrix(version);
      placeData(matrix, codewords);
      applyMask(matrix, mask);
      writeFormat(matrix, mask);
      writeVersion(matrix, version);
      const score = penalty(matrix);
      if (!best || score < best.score) best = { matrix, score, mask };
    }
    return best.matrix;
  };

  /** Render `text` as a QR code onto a fresh canvas of the requested size. */
  const render = (text, pixelSize = 220) => {
    const { modules, size } = buildMatrix(text);
    const quiet = 4;
    const total = size + quiet * 2;
    const scale = Math.max(4, Math.floor(pixelSize / total));
    const canvas = document.createElement('canvas');
    canvas.width = total * scale;
    canvas.height = total * scale;
    canvas.style.width = `${canvas.width}px`;
    canvas.style.height = `${canvas.height}px`;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#173d3c';
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        if (modules[row][col] === 1) {
          ctx.fillRect((col + quiet) * scale, (row + quiet) * scale, scale, scale);
        }
      }
    }
    return canvas;
  };

  global.mzansiQr = { render, buildMatrix };
})(typeof window !== 'undefined' ? window : globalThis);