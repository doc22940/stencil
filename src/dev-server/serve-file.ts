import * as d from '../declarations';
import * as util from './dev-server-utils';
import { version } from '../version';
import { serve500 } from './serve-500';
import * as http  from 'http';
import path from 'path';
import fs from 'graceful-fs';
import * as querystring from 'querystring';
import * as Url from 'url';
import * as zlib from 'zlib';
import { Buffer } from 'buffer';


export async function serveFile(devServerConfig: d.DevServerConfig, sys: d.CompilerSystem, req: d.HttpRequest, res: http.ServerResponse) {
  try {
    if (util.isSimpleText(req.filePath)) {
      // easy text file, use the internal cache
      let content = await sys.readFile(req.filePath, 'utf8');

      if (devServerConfig.websocket && util.isHtmlFile(req.filePath) && !util.isDevServerClient(req.pathname)) {
        // auto inject our dev server script
        content = appendDevServerClientScript(devServerConfig, req, content);

      } else if (util.isCssFile(req.filePath)) {
        content = updateStyleUrls(req.url, content);
      }

      if (util.shouldCompress(devServerConfig, req)) {
        // let's gzip this well known web dev text file
        res.writeHead(200, util.responseHeaders({
          'Content-Type': util.getContentType(devServerConfig, req.filePath) + ';charset=UTF-8',
          'Content-Encoding': 'gzip',
          'Vary': 'Accept-Encoding'
        }));

        zlib.gzip(content, { level: 9 }, (_, data) => {
          res.end(data);
        });

      } else {
        // let's not gzip this file
        res.writeHead(200, util.responseHeaders({
          'Content-Type': util.getContentType(devServerConfig, req.filePath) + ';charset=UTF-8',
          'Content-Length': Buffer.byteLength(content, 'utf8')
        }));
        res.write(content);
        res.end();
      }

    } else {
      // non-well-known text file or other file, probably best we use a stream
      // but don't bother trying to gzip this file for the dev server
      res.writeHead(200, util.responseHeaders({
        'Content-Type': util.getContentType(devServerConfig, req.filePath),
        'Content-Length': req.stats.size
      }));
      fs.createReadStream(req.filePath).pipe(res);
    }

    if (devServerConfig.logRequests) {
      util.sendMsg(process, {
        requestLog: {
          method: req.method,
          url: req.url,
          status: 200
        }
      });
    }

  } catch (e) {
    serve500(devServerConfig, req, res, e);
  }
}


function updateStyleUrls(cssUrl: string, oldCss: string) {
  const parsedUrl = Url.parse(cssUrl);
  const qs = querystring.parse(parsedUrl.query);

  const versionId = qs['s-hmr'];
  const hmrUrls = qs['s-hmr-urls'];

  if (versionId && hmrUrls) {
    (hmrUrls as string).split(',').forEach(hmrUrl => {
      urlVersionIds.set(hmrUrl, versionId as string);
    });
  }

  const reg = /url\((['"]?)(.*)\1\)/ig;
  let result;
  let newCss = oldCss;

  while ((result = reg.exec(oldCss)) !== null) {
    const oldUrl = result[2];

    const parsedUrl = Url.parse(oldUrl);

    const fileName = path.basename(parsedUrl.pathname);
    const versionId = urlVersionIds.get(fileName);
    if (!versionId) {
      continue;
    }

    const qs = querystring.parse(parsedUrl.query);
    qs['s-hmr'] = versionId;

    parsedUrl.search = querystring.stringify(qs);

    const newUrl = Url.format(parsedUrl);

    newCss = newCss.replace(oldUrl, newUrl);
  }

  return newCss;
}

const urlVersionIds = new Map<string, string>();


function appendDevServerClientScript(devServerConfig: d.DevServerConfig, req: d.HttpRequest, content: string) {
  const devServerClientUrl = util.getDevServerClientUrl(devServerConfig, req.host);
  const iframe = `<iframe title="Stencil Dev Server Connector ${version} &#9889;" src="${devServerClientUrl}" style="display:block;width:0;height:0;border:0;visibility:hidden" aria-hidden="true"></iframe>`;
  return appendDevServerClientIframe(content, iframe);
}


export function appendDevServerClientIframe(content: string, iframe: string) {
  if (content.includes('</body>')) {
    return content.replace('</body>', `${iframe}</body>`);
  }
  if (content.includes('</html>')) {
    return content.replace('</html>', `${iframe}</html>`);
  }
  return `${content}${iframe}`;
}
