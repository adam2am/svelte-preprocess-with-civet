import { describe, it, expect } from 'vitest';
import { transformer } from '../../src/transformers/civet';
import { transformer as tsTransformer } from '../../src/transformers/typescript';

const sampleCivet = `export hello = 'world';`;
const filename = 'test.civet';

describe('transformers/civet', () => {
  it('compiles to TypeScript by default', async () => {
    const result = await transformer({
      content: sampleCivet,
      filename,
      options: {},
      attributes: {},
    });

    // Should emit TypeScript output and set lang to 'ts'
    expect(result.code).toContain('export');
    expect(result.attributes?.lang).toBe('ts');
  });

  it('compiles to JavaScript when js:true', async () => {
    const result = await transformer({
      content: sampleCivet,
      filename,
      options: { js: true },
      attributes: {},
    });

    // Should emit JS output (var or const) and set lang to 'js'
    expect(result.code).toMatch(/export\s+(?:var|const)\s+hello/);
    expect(result.attributes?.lang).toBe('js');
  });

  it('generates a source map when sourceMap:true and inlineMap is false', async () => {
    const result = await transformer({
      content: sampleCivet,
      filename,
      options: { sourceMap: true, inlineMap: false },
      attributes: {},
    });

    expect(result.map).toBeDefined();
    expect(typeof result.map).toBe('object');
  });

  it('handles function expression with return type annotations via TS pipeline', async () => {
    const sample = `name := (): void -> { console.log('hi'); }`;
    // First, Civet -> TS
    const civetRes = await transformer({ content: sample, filename, options: {}, attributes: {} });
    expect(civetRes.code).toMatch(/const name = function\(\): void/);
    expect(civetRes.attributes?.lang).toBe('ts');

    // Then, TS -> JS
    const tsRes = await tsTransformer({
      content: civetRes.code,
      filename,
      options: { tsconfigFile: false },
      attributes: { lang: 'ts' },
    });
    expect(tsRes.code).toMatch(/const name = function \(\) \{/);
    expect(tsRes.code).not.toContain(': void');
  });
}); 