import * as d from '@stencil/core/internal';
import { normalizePath } from '@utils';
import { isOutputTargetDistLazy, isOutputTargetWww } from '../compiler/output-targets/output-utils';


export function shuffleArray(array: any[]) {
  // http://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
  let currentIndex = array.length;
  let temporaryValue: any;
  let randomIndex: number;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}


export function expectFiles(fs: d.InMemoryFileSystem, filePaths: string[]) {
  filePaths.forEach(filePath => {
    fs.disk.statSync(filePath);
  });
}

export function doNotExpectFiles(fs: d.InMemoryFileSystem, filePaths: string[]) {
  filePaths.forEach(filePath => {
    try {
      fs.disk.statSync(filePath);
    } catch (e) {
      return;
    }

    if (fs.accessSync(filePath)) {
      throw new Error(`did not expect access: ${filePath}`);
    }
  });
}

export function wroteFile(r: d.BuildResults, p: string) {
  return r.filesWritten.some(f => {
    return normalizePath(f) === normalizePath(p);
  });
}

export function getAppScriptUrl(config: d.Config, browserUrl: string) {
  const appFileName = `${config.fsNamespace}.esm.js`;
  return getAppUrl(config, browserUrl, appFileName);
}

export function getAppStyleUrl(config: d.Config, browserUrl: string) {
  if (config.globalStyle) {
    const appFileName = `${config.fsNamespace}.css`;
    return getAppUrl(config, browserUrl, appFileName);
  }
  return null;
}

function getAppUrl(config: d.Config, browserUrl: string, appFileName: string) {
  const wwwOutput = config.outputTargets.find(isOutputTargetWww);
  if (wwwOutput) {
    const appBuildDir = wwwOutput.buildDir;
    const appFilePath = config.sys.path.join(appBuildDir, appFileName);
    const appUrlPath = config.sys.path.relative(wwwOutput.dir, appFilePath);
    const url = new URL(appUrlPath, browserUrl);
    return url.href;
  }

  const distOutput = config.outputTargets.find(isOutputTargetDistLazy);
  if (distOutput) {
    const appBuildDir = distOutput.esmDir;
    const appFilePath = config.sys.path.join(appBuildDir, appFileName);
    const appUrlPath = config.sys.path.relative(config.rootDir, appFilePath);
    const url = new URL(appUrlPath, browserUrl);
    return url.href;
  }

  return browserUrl;
}
