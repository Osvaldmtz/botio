#!/usr/bin/env npx tsx
import assert from 'node:assert/strict';
import { ensureValidUrl } from '../lib/pagespeed-utils';

assert.equal(ensureValidUrl('kalyo.io'), 'https://kalyo.io');
assert.equal(ensureValidUrl('https://kalyo.io'), 'https://kalyo.io');
assert.equal(ensureValidUrl('http://kalyo.io'), 'http://kalyo.io');
assert.equal(ensureValidUrl('  kalyo.io  '), 'https://kalyo.io');

console.log('ensureValidUrl: all assertions passed');
