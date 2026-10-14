import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dashboardDirectories = ['Admin Dashboard', 'Staff Dashboard'];
const qrSources = await Promise.all(dashboardDirectories.map((directory) =>
  readFile(path.join(backendDirectory, '..', directory, 'qrcode.js'), 'utf8')));

const loadRenderer = (source) => {
  const context = vm.createContext({ TextEncoder });
  vm.runInContext(source, context);
  return context.mzansiQr;
};

const versionCases = [
  { version: 7, length: 140, codewords: 196 },
  { version: 8, length: 170, codewords: 242 },
  { version: 9, length: 200, codewords: 292 },
  { version: 10, length: 250, codewords: 346 },
];

for (const [index, source] of qrSources.entries()) {
  test(`${dashboardDirectories[index]} QR encoder keeps version 7-10 matrices complete`, () => {
    const renderer = loadRenderer(source);

    for (const { version, length, codewords } of versionCases) {
      const prefix = 'otpauth://totp/MzansiConnect:';
      const uri = prefix + 'x'.repeat(length - prefix.length);
      const matrix = renderer.buildMatrix(uri);
      const size = version * 4 + 17;
      const dataModuleCount = matrix.reserved.reduce(
        (count, row) => count + Array.from(row).filter((reserved) => !reserved).length,
        0,
      );

      assert.equal(matrix.size, size, `payload should use QR version ${version}`);
      assert.equal(dataModuleCount, codewords * 8, `version ${version} data modules should match its codeword capacity`);
    }
  });

  test(`${dashboardDirectories[index]} QR encoder places alignments over timing lines`, () => {
    const renderer = loadRenderer(source);
    const prefix = 'otpauth://totp/MzansiConnect:';
    const matrix = renderer.buildMatrix(prefix + 'x'.repeat(140 - prefix.length));

    assert.equal(matrix.size, 45, 'test payload should use QR version 7');
    for (let col = 20; col <= 24; col += 1) {
      assert.equal(matrix.reserved[6][col], 1, `alignment module at row 6, column ${col} should be reserved`);
    }
    assert.deepEqual(
      Array.from(matrix.modules[6].slice(20, 25)),
      [1, 0, 1, 0, 1],
      'version 7 alignment pattern should replace the timing line',
    );
  });
}
