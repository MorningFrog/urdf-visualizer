// Run in a separate process with a heap limit and a parent-enforced timeout.
const assert = require('node:assert/strict');
const { DOMParser, onWarningStopParsing } = require('@xmldom/xmldom');
const parser = new DOMParser({ onError: onWarningStopParsing });

const attributes = Array.from({ length: 32000 }, (_, i) => `a${i}="x"`).join(' ');
assert.equal(parser.parseFromString(`<r ${attributes}/>`, 'text/xml').documentElement.attributes.length, 32000);

const depth = 8000;
const nested = Array.from({ length: depth }, (_, i) => `<r xmlns:p${i}="urn:${i}">`).join('') + '</r>'.repeat(depth);
assert.ok(parser.parseFromString(nested, 'text/xml').documentElement);
assert.throws(() => parser.parseFromString('<'.repeat(32000) + '>', 'text/xml'));
console.log('XML resource checks passed');
