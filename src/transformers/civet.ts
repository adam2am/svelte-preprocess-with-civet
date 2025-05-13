import civet from '@danielx/civet';

import type { Transformer, Options } from '../types';

// Define a type for the Civet SourceMap instance, based on observed methods/properties
interface CivetSourceMapInstance {
  json: (sourceFileName: string, outputFileName: string) => object; // Or a more specific V3 map type
  // Add other properties like lines, source, etc., if needed for type checking, but json() is key
}

const transformer: Transformer<Options.Civet> = ({
  content,
  filename, // This should be the original Svelte/Civet filename
  options, 
  attributes,
}) => {
  const civetCompilationOptions = {
    filename,
    js: false, 
    ...options, 
    sync: true, 
  };

  if (civetCompilationOptions.sourceMap && !civetCompilationOptions.inlineMap) {
    const civetResult = civet.compile(content, { ...civetCompilationOptions, sourceMap: true, ast: undefined }) as unknown as { code: string; sourceMap?: CivetSourceMapInstance }; // Type assertion
    
    if (typeof civetResult === 'object' && civetResult !== null && civetResult.code && civetResult.sourceMap && typeof civetResult.sourceMap.json === 'function') {
      const outputMapFileName = filename ? `${filename}.ts` : 'output.ts';
      const v3Map = civetResult.sourceMap.json(filename || 'input.civet', outputMapFileName);
      return { code: civetResult.code, map: v3Map, attributes: { ...attributes, lang: 'ts' } }; // Added attributes
    } else {
      console.warn(
        'svelte-preprocess-with-civet: Civet did not return expected { code, sourceMap with json() } object ' +
        'when called with sourceMap:true and sync:true. Output from Civet:', civetResult
      );
      const fallbackCode = typeof civetResult === 'object' && civetResult !== null && civetResult.code ? civetResult.code : 
                           typeof civetResult === 'string' ? civetResult : content; 
      return { code: fallbackCode, attributes: { ...attributes, lang: 'ts' } }; // Added attributes
    }
  }
  else if (civetCompilationOptions.inlineMap) {
    const compiledCodeWithInlineMap = civet.compile(content, civetCompilationOptions);
    
    if (typeof compiledCodeWithInlineMap === 'string') {
      console.warn(
        'svelte-preprocess-with-civet: inlineMap:true was used, but parsing the inline map comment ' +
        'and extracting the map object is not yet fully implemented in this preprocessor. ' +
        'The raw code (including the inline map comment) will be returned without a separate map object.'
      );
      return { code: compiledCodeWithInlineMap, attributes: { ...attributes, lang: 'ts' } }; // Added attributes
    } else {
      console.warn(
        'svelte-preprocess-with-civet: Civet did not return expected string output ' +
        'when called with inlineMap:true and sync:true. Output from Civet:', compiledCodeWithInlineMap
      );
      const fallbackCode = typeof compiledCodeWithInlineMap === 'string' ? compiledCodeWithInlineMap : content;
      return { code: fallbackCode, attributes: { ...attributes, lang: 'ts' } }; // Added attributes
    }
  }
  else {
    const compiledCode = civet.compile(content, civetCompilationOptions);
    if (typeof compiledCode === 'string'){
        return { code: compiledCode, attributes: { ...attributes, lang: 'ts' } }; // Added attributes
    } else {
        console.warn(
            'svelte-preprocess-with-civet: Civet did not return expected string output ' +
            'when no source map was requested. Output from Civet:', compiledCode
        );
        const fallbackCode = typeof compiledCode === 'object' && compiledCode !== null && (compiledCode as any).code ? (compiledCode as any).code :
                             typeof compiledCode === 'string' ? compiledCode : content;
        return { code: fallbackCode, attributes: { ...attributes, lang: 'ts' } }; // Added attributes
    }
  }
};

export { transformer };
