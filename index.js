'use strict'

const http = require('http');
const url = require('url');
const fs = require('fs').promises;
var querystring = require('querystring');
var util = require('util');
const path = require('path');
const { createReadStream, readFileSync } = require('fs');
const crypto = require('crypto');

const mime = require('mime');
const ejs = require('ejs');

class Server {
  constructor() {
    this.port = 8080;
    this.directory = process.cwd();
    this.service = null;
  }

  init() {
    this.service = http.createServer(this.handleRequest.bind(this));
    this.service.listen(this.port, '0.0.0.0', () => {
      console.log(`服务器启动.`);
    })
  }

  async handleRequest(req, res) {
    const { pathname } = url.parse(req.url);

    if (req.method === 'POST' && pathname == '/checkVersion') {
      // res.writeHead(200, { "Content-Type": "application/json;charset='utf-8'", 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'PUT,POST,GET,DELETE,OPTIONS' });
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end(JSON.stringify({
        bundle: "ceshi",
        version: "1.0.1",
        url: ""
      }));

    } else {
      const filePath = path.join(this.directory, pathname);
      console.log(filePath);

      try {
        const stat = await fs.stat(filePath);

        if (stat.isFile()) {
          this.sendFile(req, res, filePath, stat);
        } else {
          this.sendFolder(req, res, filePath, pathname);
        }
      } catch (e) {
        this.sendError(req, res, e);
      }
    }


  }

  cache(req, res, filePath, stat) {
    res.setHeader('Expires', new Date(Date.now() + 10 * 1000).toGMTString());
    res.setHeader('Cache-Control', `max-age=${10}`);

    const ifModifiedSince = req.headers['if-modified-since'];
    const ctime = stat.ctime.toGMTString();
    if (ifModifiedSince === ctime) {
      return true;
    }

    const ifNoneMatch = req.headers['if-none-match'];
    const etag = crypto.createHash('md5').update(readFileSync(filePath)).digest('base64')
    if (ifNoneMatch === etag) {
      return true
    }

    res.setHeader('Last-Modified', ctime)
    res.setHeader('Etag', etag)
    return false;
  }

  sendFile(req, res, filePath, stat) {
    if (this.cache(req, res, filePath, stat)) {
      res.statusCode = 304
      res.end();
      return;
    }

    res.setHeader('Content-Type', mime.getType(filePath));
    res.setHeader('Access-Control-Allow-Origin', '*');
    createReadStream(filePath).pipe(res)
  }

  async sendFolder(req, res, filePath, pathname) {
    let dirs = await fs.readdir(filePath)
    dirs = dirs.map(item => ({
      filename: item,
      href: path.join(pathname, item)
    }))
    console.log(dirs)
    const temp = await fs.readFile(path.resolve(__dirname, './index.html'), 'utf-8')

    const html = await ejs.render(temp, { dirs }, { async: true })

    res.setHeader('Content-Type', 'text/html;charset=utf-8')
    res.end(html)
  }

  sendError(req, res, e) {
    res.end(e.message)
  }
}


const server = new Server();
server.init();