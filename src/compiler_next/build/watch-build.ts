import * as d from '../../declarations';
import { build } from './build';
import { BuildContext } from '../../compiler/build/build-ctx';
import { compilerRequest } from '../bundle/dev-module';
import { createTsWatchProgram } from '../transpile/create-watch-program';
import { filesChanged, hasHtmlChanges, hasScriptChanges, hasStyleChanges, scriptsAdded, scriptsDeleted } from '../../compiler/fs-watch/fs-watch-rebuild';
import { hasServiceWorkerChanges } from '../../compiler/service-worker/generate-sw';
import ts from 'typescript';


export const createWatchBuild = async (config: d.Config, compilerCtx: d.CompilerCtx): Promise<d.CompilerWatcher> => {
  let isRebuild = false;
  let tsWatchProgram: any;
  let fileWatcher: any;

  let closeResolver: Function;
  const watchWaiter = new Promise<d.WatcherCloseResults>(resolve => closeResolver = resolve);

  const dirsAdded = new Set<string>();
  const dirsDeleted = new Set<string>();
  const filesAdded = new Set<string>();
  const filesUpdated = new Set<string>();
  const filesDeleted = new Set<string>();

  const onFileChange: d.CompilerFileWatcherCallback = (file, kind) => {
    compilerCtx.fs.clearFileCache(file);
    compilerCtx.changedFiles.add(file);
    switch (kind) {
      case 'dirAdd': dirsAdded.add(file); break;
      case 'dirDelete': dirsDeleted.add(file); break;
      case 'fileAdd': filesAdded.add(file); break;
      case 'fileUpdate': filesUpdated.add(file); break;
      case 'fileDelete': filesDeleted.add(file); break;
    }
    config.logger.debug(`${kind}: ${file}`);
    tsWatchProgram.rebuild();
  };

  const onBuild = async (tsBuilder: ts.BuilderProgram) => {
    const buildCtx = new BuildContext(config, compilerCtx);
    buildCtx.isRebuild = isRebuild;
    buildCtx.requiresFullBuild = !isRebuild;
    buildCtx.dirsAdded = Array.from(dirsAdded.keys()).sort();
    buildCtx.dirsDeleted = Array.from(dirsDeleted.keys()).sort();
    buildCtx.filesAdded = Array.from(filesAdded.keys()).sort();
    buildCtx.filesUpdated = Array.from(filesUpdated.keys()).sort();
    buildCtx.filesDeleted = Array.from(filesDeleted.keys()).sort();
    buildCtx.filesChanged = filesChanged(buildCtx);
    buildCtx.scriptsAdded = scriptsAdded(config, buildCtx);
    buildCtx.scriptsDeleted = scriptsDeleted(config, buildCtx);
    buildCtx.hasScriptChanges = hasScriptChanges(buildCtx);
    buildCtx.hasStyleChanges = hasStyleChanges(buildCtx);
    buildCtx.hasHtmlChanges = hasHtmlChanges(config, buildCtx);
    buildCtx.hasServiceWorkerChanges = hasServiceWorkerChanges(config, buildCtx);

    dirsAdded.clear();
    dirsDeleted.clear();
    filesAdded.clear();
    filesUpdated.clear();
    filesDeleted.clear();

    emitFsChange(compilerCtx, buildCtx);

    buildCtx.start();

    await build(config, compilerCtx, buildCtx, tsBuilder);

    isRebuild = true;
  };

  const start = async () => {
    fileWatcher = await watchSrcDirectory(config, compilerCtx, onFileChange);
    tsWatchProgram = await createTsWatchProgram(config, onBuild);
    return watchWaiter;
  };

  const close = async () => {
    if (tsWatchProgram) {
      fileWatcher.close();
      tsWatchProgram.program.close();
      tsWatchProgram = null;
    }
    const watcherCloseResults: d.WatcherCloseResults = {
      exitCode: 0
    };
    closeResolver(watcherCloseResults);
    return watcherCloseResults;
  };

  const request = async (data: d.CompilerRequest) => compilerRequest(config, compilerCtx, data);

  config.sys_next.addDestory(close);

  return {
    start,
    close,
    on: compilerCtx.events.on,
    request
  };
};

export const watchSrcDirectory = async (config: d.Config, compilerCtx: d.CompilerCtx, callback: d.CompilerFileWatcherCallback) => {
  const watching = new Map();
  const watchFile = (path: string) => {
    if (!watching.has(path)) {
      watching.set(path, config.sys_next.watchFile(path, callback));
    }
  };
  const files = await compilerCtx.fs.readdir(config.srcDir, {
    recursive: true,
    excludeDirNames: [
      '.cache',
      '.github',
      '.stencil',
      '.vscode',
      'node_modules',
    ],
    excludeExtensions: [
      '.md', '.markdown', '.txt',
      '.spec.ts', '.spec.tsx',
      '.e2e.ts', '.e2e.tsx',
      '.gitignore', '.editorconfig',
    ]
  });

  files
    .filter(({ isFile }) => isFile)
    .forEach(({ absPath }) => watchFile(absPath));

  watching.set(
    config.srcDir,
    config.sys_next.watchDirectory(config.srcDir, (filename, kind) => {
      watchFile(filename);
      callback(filename, kind);
    })
  );

  return {
    close() {
      watching.forEach(w => w.close());
    }
  };
};

const emitFsChange = (compilerCtx: d.CompilerCtx, buildCtx: BuildContext) => {
  if (buildCtx.dirsAdded.length > 0 ||
    buildCtx.dirsDeleted.length > 0 ||
    buildCtx.filesUpdated.length > 0 ||
    buildCtx.filesAdded.length > 0 ||
    buildCtx.filesDeleted.length > 0) {

    compilerCtx.events.emit('fsChange', {
      dirsAdded: buildCtx.dirsAdded.slice(),
      dirsDeleted: buildCtx.dirsDeleted.slice(),
      filesUpdated: buildCtx.filesUpdated.slice(),
      filesAdded: buildCtx.filesAdded.slice(),
      filesDeleted: buildCtx.filesDeleted.slice(),
    });

  }
}
