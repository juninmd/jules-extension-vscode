import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

export async function run(): Promise<void> {
    const nyc = require('nyc');
    const nycInstance = new nyc({
        cwd: path.resolve(__dirname, '../../'),
        reporter: ['text', 'lcov'],
        all: true,
        instrument: true,
        hookRequire: true,
        hookRunInContext: true,
        hookRunInThisContext: true
    });
    nycInstance.reset();
    nycInstance.wrap();

    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 20000
    });

    const testsRoot = path.resolve(__dirname, '.');

    const files = await glob('**/**.test.js', { cwd: testsRoot });

    files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

    return new Promise((c, e) => {
        try {
            mocha.run(failures => {
                if (failures > 0) {
                    e(new Error(`${failures} tests failed.`));
                } else {
                    nycInstance.writeCoverageFile();
                    nycInstance.report();
                    c();
                }
            });
        } catch (err) {
            console.error(err);
            e(err);
        }
    });
}
