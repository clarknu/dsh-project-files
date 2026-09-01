/**
 * dsh-project-files — host half.
 *
 * Registers /plugins/project-files/* HTTP routes for the web file browser +
 * preview panel:
 *   list  (GET  ?path=)  -> directory entries { path, name, type, size }
 *   read  (GET  ?path=)  -> { content, size } for text files
 *   root  (GET)          -> { path } workspace root
 * Served by the same web server as the GUI (webServer / httpServer), so the
 * browser client fetches them from the page origin. Paths are resolved
 * through ctx.fs (workspace-gated) so traversal outside the workspace is
 * blocked upstream.
 *
 * @module dsh-project-files
 */
import { createReadStream } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { join, basename, extname } from 'node:path'

export const name = 'project-files'
export const inject = ['fs']

const MAX_READ = 1_000_000

// Content types for the raw /file route (inline preview + attachment download).
const FILE_MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.ogv': 'video/ogg', '.m4v': 'video/mp4', '.mkv': 'video/x-matroska',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.flac': 'audio/flac', '.opus': 'audio/opus',
}

function readBody(req) {
  const chunks = []
  return new Promise((resolve, reject) => {
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

export function apply(ctx) {
  const fs = ctx.fs

  // Names to skip in listings: cache/temp/hidden/sensitive dirs that are noise
  // in a file browser and often carry restrictive ACLs (e.g. .pytest_cache)
  // that make an OS-level readDir of the PARENT fail only when stat-ing the
  // child. We never stat directories, so skipping them avoids the EACCES.
  const IGNORED = new Set([
    '.pytest_cache', '__pycache__', '.git', '.credential', '.cred', '.secret',
    '.secrets', '.ssh', '.env', '.mypy_cache', '.ruff_cache', '.tox', '.cache',
    'node_modules', '.venv', '.venvs', 'site-packages', '.reasonix', '.uploads',
    '.idea', '.vscode', '.DS_Store',
  ])

  const message = (err) => String((err && err.message) || err)
  const send = (res, status, obj) => {
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    })
    res.end(JSON.stringify(obj))
  }
  const param = (req, key) => {
    try {
      return new URL(req.url ?? '/', 'http://x').searchParams.get(key)
    } catch {
      return null
    }
  }

  // Workspace root: prefer the session's workspace via the workspace registry
  // (list()[0] as the active/current workspace), falling back to the fs cwd.
  // Lazily read ctx.get('workspaceRegistry') so a missing/renamed service never
  // fails the plugin load.
  const workspaceBySession = (reg, session) => {
    if (!reg || typeof reg.list !== 'function') return undefined
    try {
      const ws = reg.list()
      if (session && ws) return ws.find((w) => w.sessionIds && w.sessionIds.includes(session))
      if (ws && ws.length) return ws[0]
    } catch (e) { /* ignore */ }
    return undefined
  }
  const getRoot = async (session) => {
    // Prefer the current session's cwd — its actual workspace — which is what
    // the file browser should root at. The session header stores the directory
    // the session runs in, so this is correct even when the workspace registry
    // has not yet indexed a fresh session or lists several workspaces.
    if (session) {
      try {
        const sessions = ctx.get('sessions')
        const s = sessions && typeof sessions.get === 'function' ? sessions.get(session) : undefined
        const cwd = s && s.header && s.header.cwd
        if (typeof cwd === 'string' && cwd.length > 0) return cwd
      } catch (e) { /* ignore */ }
    }
    const reg = ctx.get('workspaceRegistry')
    const ws = workspaceBySession(reg, session)
    if (ws && ws.path) return ws.path
    try {
      const target = await fs.resolve('.')
      if (target !== undefined) return fs.processPath(target)
    } catch (e) { /* ignore */ }
    return null
  }

  const registerWeb = () => {
    const webServer = ctx.get('webServer') ?? ctx.get('httpServer')
    if (webServer === undefined) return

    const route = (path, handler) => {
      ctx.effect(() => webServer.register({ kind: 'exact', path, handler }), 'project-files: ' + path)
    }

    route('/plugins/project-files/root', async (req, res) => {
      try {
        const root = await getRoot(param(req, 'session'))
        send(res, 200, { path: root })
      } catch (err) {
        send(res, 500, { error: message(err) })
      }
    })

    route('/plugins/project-files/list', async (req, res) => {
      const path = param(req, 'path')
      try {
        const root = await getRoot(param(req, 'session'))
        // An empty/missing path means the workspace root. fs.resolve rejects
        // empty strings, so fall back to '.'; resolve relative paths against
        // the workspace root so browsing always lands inside the workspace.
        const opts = root ? { cwd: root } : undefined
        const target = await fs.resolve(path && path.length > 0 ? path : '.', opts)
        const info = await fs.stat(target)
        if (info === undefined || info.type !== 'directory') {
          send(res, 404, { error: 'not-a-directory' })
          return
        }
        const entries = []
        const actual = fs.processPath(target)
        let names
        try {
          names = await readdir(actual, { withFileTypes: true })
        } catch (err) {
          send(res, 500, { error: message(err) })
          return
        }
        for (const d of names) {
          if (IGNORED.has(d.name)) continue
          const child = join(actual, d.name)
          const isDir = d.isDirectory()
          let size = null
          if (!isDir) {
            try { size = (await stat(child)).size } catch (e) { continue }
          }
          entries.push({ name: d.name, type: isDir ? 'directory' : 'file', size, path: child })
        }
        entries.sort((a, b) => a.type === b.type ? 0 : a.type === 'directory' ? -1 : 1)
        send(res, 200, { path: actual, entries })
      } catch (err) {
        send(res, 500, { error: message(err) })
      }
    })

    route('/plugins/project-files/read', async (req, res) => {
      const path = param(req, 'path')
      if (!path) {
        send(res, 400, { error: 'missing path' })
        return
      }
      try {
        const root = await getRoot(param(req, 'session'))
        const opts = root ? { cwd: root } : undefined
        const target = await fs.resolve(path, opts)
        const info = await fs.stat(target)
        if (info === undefined) {
          send(res, 404, { error: 'not-found' })
          return
        }
        if (info.type !== 'file') {
          send(res, 400, { error: 'not-a-file' })
          return
        }
        const size = typeof info.size === 'number' ? info.size : 0
        if (size > MAX_READ) {
          send(res, 200, { tooLarge: true, size })
          return
        }
        const content = await fs.readText(target)
        send(res, 200, { content, size })
      } catch (err) {
        send(res, 500, { error: message(err) })
      }
    })

    // Stream a file's raw bytes (inline for preview, attach for download).
    route('/plugins/project-files/file', async (req, res) => {
      const path = param(req, 'path')
      if (!path) {
        send(res, 400, { error: 'missing path' })
        return
      }
      const download = param(req, 'download') === '1'
      try {
        const root = await getRoot(param(req, 'session'))
        const opts = root ? { cwd: root } : undefined
        const target = await fs.resolve(path, opts)
        const actual = fs.processPath(target)
        const ext = extname(actual).toLowerCase()
        const type = FILE_MIME[ext] ?? 'application/octet-stream'
        // HTTP headers must be ASCII. Use RFC 5987: an ASCII-safe `filename`
        // fallback plus a UTF-8 percent-encoded `filename*` for non-ASCII names
        // (Chinese/CJK filenames previously blew up the header -> 500).
        const name = basename(actual)
        const asciiName = name.replace(/[^A-Za-z0-9._ -]/g, '_').replace(/"/g, '')
        const utf8Name = encodeURIComponent(name)
        res.writeHead(200, {
          'content-type': type,
          'cache-control': 'no-store',
          'content-disposition': download
            ? `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`
            : 'inline',
        })
        createReadStream(actual)
          .on('error', () => { try { res.end() } catch (e) { /* noop */ } })
          .pipe(res)
      } catch (err) {
        send(res, 500, { error: message(err) })
      }
    })
  }

  registerWeb()
}
