import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { messages, defaultLocale } from '../src/i18n';
import { supportedLocales } from '../src/i18n/types';
import { flattenMessages } from '../src/i18n/flatten';

function keysOf<T extends object>(o: T) {
  return Object.keys(o) as Array<keyof T> as string[];
}

describe('i18n message catalog', () => {
  it('has entries for all supported locales', () => {
    for (const loc of supportedLocales) {
      assert.ok(messages[loc], `messages for locale ${loc} should exist`);
    }
  });

  it('flattens messages and includes core keys', () => {
    const flattened = flattenMessages(messages);
    const flat = flattened[defaultLocale];
    assert.ok(flat, 'flattened default locale should exist');
    // spot-check a few keys used by the app
    ['configure.panel.services', 'configure.summary.title', 'configure.progress.processing'].forEach((k) => {
      assert.ok(flat[k], `flat key ${k} should exist in default locale`);
    });
  });

  it('all locales have the same flattened key set as the default locale', () => {
    const flattened = flattenMessages(messages);
    const base = new Set(Object.keys(flattened[defaultLocale] ?? {}));
    for (const loc of supportedLocales) {
      const current = new Set(Object.keys(flattened[loc] ?? {}));
      // Compare sizes first for quick fail
      assert.equal(
        current.size,
        base.size,
        `locale ${loc} should have ${base.size} keys but has ${current.size}`
      );
      // Ensure every base key exists
      for (const k of base) {
        assert.ok(current.has(k), `key ${k} missing in locale ${loc}`);
      }
    }
  });

  it('handles placeholder replacement in a representative key', () => {
    const flattened = flattenMessages(messages);
    const value = flattened[defaultLocale]['configure.panel.availableIn'];
    assert.ok(value, 'configure.panel.availableIn must exist');
    const region = 'Warsaw';
    const rendered = value.replace(/\{region\}/g, region);
    assert.match(rendered, /Warsaw/);
  });
});
