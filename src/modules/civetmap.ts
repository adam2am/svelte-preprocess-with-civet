import { decode, encode, SourceMapMappings, SourceMapSegment } from '@jridgewell/sourcemap-codec';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';

import type { DecodedSourceMap, EncodedSourceMap } from '@jridgewell/trace-mapping';

const CIVET_MAP_DEBUG = process.env.CIVET_MAP_DEBUG === 'true';

/**
 * Chains two source maps together.
 *
 * This function takes a `map1` (original -> intermediate) and `map2` (intermediate -> final)
 * and combines them into a single map (original -> final).
 *
 * @param map1 The source map from the first transformation step (e.g., Civet to TypeScript).
 * @param map2 The source map from the second transformation step (e.g., TypeScript to JavaScript).
 * @returns A new, combined source map.
 */
export function chainSourceMaps(
  map1: EncodedSourceMap | DecodedSourceMap | null | undefined,
  map2: EncodedSourceMap | DecodedSourceMap | string | null | undefined,
  options: { indentation?: number } = {},
): EncodedSourceMap | undefined {
  if (CIVET_MAP_DEBUG) {
    console.log('--- Civet Map Chaining ---');
    console.log('[MAP 1: Civet -> TS]', JSON.stringify(map1, null, 2));
    console.log('[MAP 2: TS -> JS]', JSON.stringify(map2, null, 2));
    console.log(`[CHAIN] Using indentation: ${options.indentation || 0}`);
  }

  const { indentation = 0 } = options;
  const map2Object = typeof map2 === 'string' ? JSON.parse(map2) : map2;

  if (!map1 || !map2Object) {
    return (map2 as EncodedSourceMap) ?? (map1 as EncodedSourceMap) ?? undefined;
  }

  const tracer = new TraceMap(map1);
  const decodedMap2: SourceMapMappings =
    typeof map2Object.mappings === 'string' ? decode(map2Object.mappings) : map2Object.mappings;

  const newMappings: SourceMapSegment[][] = [];

  for (const line of decodedMap2) {
    const newLine: SourceMapSegment[] = [];
    for (const segment of line) {
      if (segment.length < 4) continue;
      // segment: [generatedColumn, sourceIndex, originalLine, originalColumn, nameIndex]
      const original = originalPositionFor(tracer, {
        line: segment[2]! + 1, // trace-mapping expects 1-based lines
        column: segment[3]!,
      });

      if (original.line !== null && original.column !== null) {
        // Create a new segment that maps from the final generated code
        // directly to the original source code.
        const newSegment: SourceMapSegment = [
          segment[0], // generatedColumn in final code
          0, // sourceIndex in the new map (always 0, pointing to the single original file)
          original.line - 1, // originalLine in original source (0-based)
          original.column + indentation, // Add back the stripped indentation
        ];

        // Preserve nameIndex if it exists
        if (segment.length === 5 && segment[4] != null) {
          newSegment.push(segment[4]);
        }
        
        newLine.push(newSegment);
      }
    }
    newMappings.push(newLine);
  }

  // The new map points from the final generated code (map2's consumer) back to the original source (map1's source).
  const finalMap: EncodedSourceMap = {
    version: 3,
    sources: ('sources' in map1 && map1.sources) || [],
    sourcesContent: ('sourcesContent' in map1 && map1.sourcesContent) || [],
    names: ('names' in map2Object && map2Object.names) || [],
    mappings: encode(newMappings),
  };

  if (CIVET_MAP_DEBUG) {
    console.log('[FINAL MAP: Civet -> JS]', JSON.stringify(finalMap, null, 2));
    console.log('--------------------------');
  }

  return finalMap;
} 