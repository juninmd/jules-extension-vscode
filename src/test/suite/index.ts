import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

export async function run(): Promise<void> {
  const NYC = require('nyc');
  const nyc = new NYC({
    cwd: path.resolve(__dirname, '../../..'),
    reporter: ['text', 'lcov'],
    all: true,
    silent: false,
    instrument: true,
    hookRequire: true,
    include: ['out/**/*.js'],
    exclude: ['out/test/**', 'out/media/**'],
    extension: ['.js']
  });

  await nyc.reset();
  await nyc.wrap();

  Object.keys(require.cache)
    .filter(k => k.includes('/out/') && !k.includes('/out/test/'))
    .forEach(k => delete require.cache[k]);

  const mocha = new Mocha({
    ui: 'tdd',
    color: true
  });

  const testsRoot = path.resolve(__dirname, '..');

  return new Promise((resolve, reject) => {
    glob('**/**.test.js', { cwd: testsRoot }, async (err, files) => {
      if (err) {
        return reject(err);
      }

      files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

      try {
        mocha.run(async failures => {
          if (failures > 0) {
            reject(new Error(`${failures} tests failed.`));
          } else {
            if (nyc) {
              nyc.writeCoverageFile();
              await nyc.report();
            }
            resolve();
          }
        });
      } catch (err) {
        console.error(err);
        reject(err);
      }
    });
  });
}
