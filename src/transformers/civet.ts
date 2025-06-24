import civet from '@danielx/civet';
import { findConfig, loadConfig } from '@danielx/civet/config';
import path from 'path';

import type { Transformer, Options } from '../types';

// Define a type for the Civet SourceMap instance, based on observed methods/properties
interface CivetSourceMapInstance {
  json: (sourceFileName: string, outputFileName: string) => object; // Or a more specific V3 map type
  // Add other properties like lines, source, etc., if needed for type checking, but json() is key
}

const transformer: Transformer<Options.Civet> = async (rawArgs) => {
  // Allow custom meta fields without extending the public TransformerArgs type
  const {
    content,
    filename,
    options,
    attributes,
    scriptTagLine = 1,
    indentLen = 0,
  } = rawArgs as any;

  let discoveredOptions = {};
  if (filename) {
    try {
      const configPath = await findConfig(path.dirname(filename));
      if (configPath) {
        discoveredOptions = (await loadConfig(configPath)) || {};
      }
    } catch (e) {
      console.warn(
        `svelte-preprocess-with-civet: Error while searching for Civet config file. \n` +
        `The error was: ${e}`
      );
    }
  }

  const civetCompilationOptions = {
    filename,
    js: false,
    ...discoveredOptions,
    ...options,
    sourceMap: true,
    inlineMap: false,
    sync: true,
  };

  const outputLang = civetCompilationOptions.js ? 'js' : 'ts';

  try {
    const civetResult = civet.compile(content, civetCompilationOptions) as unknown as {
      code: string;
      sourceMap?: CivetSourceMapInstance;
    };

    let v3Map: object | undefined = undefined;
    if (civetResult?.sourceMap && typeof civetResult.sourceMap.json === 'function') {
      const outputMapFileName = filename ? `${filename}.${outputLang}` : `output.${outputLang}`;
      v3Map = civetResult.sourceMap.json(filename || 'input.civet', outputMapFileName);
    }

    return {
      code: civetResult.code,
      map: v3Map,
      civetMapInstance: civetResult.sourceMap,
      attributes: { ...attributes, lang: outputLang },
    };
  } catch (err: any) {
    // Map Civet ParseError (with numeric or string fields) to a Svelte error at the correct location
    if (err?.name === 'ParseError') {
      // If user disabled parse errors, swallow and return empty result
      if (options && (options as any).parseError === false) {
        return { code: '', diagnostics: [] } as any;
      }

      if (err.line != null && err.column != null) {
        const relLine = Number(err.line);
        const relCol = Number(err.column);
        const absLine = scriptTagLine + relLine;
        const absCol = indentLen + relCol - 1;

        const mappedError: any = new Error(`Civet: ${err.message}`);
        mappedError.name = 'CivetParseError';
        mappedError.start = { line: absLine, column: absCol };
        mappedError.end = { line: absLine, column: absCol + 1 };

        throw mappedError;
      }
    }

    // Not a Civet parse error we can map, re-throw
    throw err;
  }
};

export { transformer };
