import { CompileOptions, Config, TransformOptions } from '../../declarations';
import path from 'path';
import ts from 'typescript';


export const getCompileOptions = (input: CompileOptions) => {
  const rtn: CompileOptions = {
    componentExport: getConfig(input.componentExport, VALID_EXPORT, 'customelement'),
    componentMetadata: getConfig(input.componentMetadata, VALID_METADATA, null),
    proxy: getConfig(input.proxy, VALID_PROXY, 'defineproperty'),
    module: getConfig(input.module, VALID_MODULE, 'esm'),
    script: getConfig(input.script, VALID_SCRIPT, 'es2017'),
    style: getConfig(input.style, VALID_STYLE, 'static'),
    data: input.data ? Object.assign({}, input.data) : null,
  };

  return rtn;
};

const getConfig = (value: any, validValues: Set<string>, defaultValue: string) => {
  if (value === 'null') {
    return null;
  }
  value = (typeof value === 'string' ? value.toLowerCase().trim() : null);
  if (validValues.has(value)) {
    return value;
  }
  return defaultValue;
};

const VALID_PROXY = new Set(['defineproperty', null]);
const VALID_METADATA = new Set(['compilerstatic', null]);
const VALID_EXPORT = new Set(['customelement', 'module']);
const VALID_MODULE = new Set(['esm', 'cjs']);
const VALID_SCRIPT = new Set(['latest', 'esnext', 'es2017', 'es2015', 'es5']);
const VALID_STYLE = new Set(['static']);


export const getCompileModuleTransformOptions = (compilerOpts: CompileOptions) => {
  const transformOpts: TransformOptions = {

    // best we always set this to true
    allowSyntheticDefaultImports: true,

    // best we always set this to true
    esModuleInterop: true,

    // always get source maps
    sourceMap: true,

    // isolated per file transpiling
    isolatedModules: true,

    // transpileModule does not write anything to disk so there is no need to verify that there are no conflicts between input and output paths.
    suppressOutputPathCheck: true,

    // Filename can be non-ts file.
    allowNonTsExtensions: true,

    // We are not returning a sourceFile for lib file when asked by the program,
    // so pass --noLib to avoid reporting a file not found error.
    noLib: true,

    noResolve: true,

    coreImportPath: '@stencil/core/internal/client',
    componentExport: null,
    componentMetadata: compilerOpts.componentMetadata as any,
    proxy: compilerOpts.proxy as any,
    style: compilerOpts.style as any
  };

  if (compilerOpts.module === 'cjs' || compilerOpts.module === 'commonjs') {
    compilerOpts.module = 'cjs';
    transformOpts.module = ts.ModuleKind.CommonJS;

  } else {
    compilerOpts.module = 'esm';
    transformOpts.module = ts.ModuleKind.ESNext;
  }

  if (compilerOpts.script === 'esnext') {
    transformOpts.target = ts.ScriptTarget.ESNext;

  } else if (compilerOpts.script === 'latest') {
    transformOpts.target = ts.ScriptTarget.Latest;

  } else if (compilerOpts.script === 'es2015') {
    transformOpts.target = ts.ScriptTarget.ES2015;

  } else if (compilerOpts.script === 'es5') {
    transformOpts.target = ts.ScriptTarget.ES5;

  } else {
    transformOpts.target = ts.ScriptTarget.ES2017;
    compilerOpts.script = 'es2017';
  }

  if (compilerOpts.componentExport === 'lazy') {
    transformOpts.componentExport = 'lazy';

  } else if (compilerOpts.componentExport === 'module') {
    transformOpts.componentExport = 'native';

  } else {
    transformOpts.componentExport = 'customelement';
  }

  return transformOpts;
};


export const getCompileConfig = () => {
  const config: Config = {
    cwd: '/',
    rootDir: '/',
    srcDir: '/',
    devMode: true,
    _isTesting: true,
    validateTypes: false,
    enableCache: false,
    sys: {
      path: path
    }
  };

  return config;
};
