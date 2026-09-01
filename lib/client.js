// dsh-project-files — browser half.
// A workspace file browser + content preview panel. Toggle button lives in the
// conversation session header actions; the panel overlays the page. On narrow
// (mobile) viewports the panel fills the screen / docks bottom, so it is
// thumb-friendly and never crowds the conversation.
//
// Hand-written in the lazy-CJS bundle protocol (window.__ModuleLoader__.load
// with a factory returning cordis-plugin exports) — no build step, no bundled
// imports beyond react / react-dom and the shipped UI primitives. The factory
// is registered on script execution and materialized on first import; the
// style tag it injects at materialization is claimed by the module system.
//
// Host half (exports ".") lives in ./index.js and serves the
// /plugins/project-files/* file API routes.

window.__ModuleLoader__.load({
  id: 'dsh-project-files',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports

    var React = require('react')
    var createPortal = require('react-dom').createPortal

    var h = React.createElement

    var NS = 'project-files'
    var zh = {
      files: '项目文件',
      close: '关闭',
      refresh: '刷新',
      loading: '加载中…',
      empty: '该目录为空',
      error: '出错了',
      tooLarge: '文件过大，仅显示前 80,000 字符',
      preview: '预览',
      notPreviewable: '此格式暂不支持预览',
      open: '打开项目文件',
      back: '返回',
    }
    var en = {
      files: 'Project Files',
      close: 'Close',
      refresh: 'Refresh',
      loading: 'Loading…',
      empty: 'This directory is empty',
      error: 'Something went wrong',
      tooLarge: 'File too large, showing the first 80,000 characters',
      preview: 'Preview',
      notPreviewable: 'Preview not supported for this format',
      open: 'Open project files',
      back: 'Back',
    }
    var lang = 'zh'
    var t = function (key) { return lang === 'en' ? en[key] ?? zh[key] : zh[key] ?? key }

    // ---------- injected styles (desktop right-dock + mobile full-screen) ----------
    var CSS = `
.dsh-pf { position: fixed; top: 0; right: 0; bottom: 0; z-index: 900;
  width: min(560px, 100vw); display: flex; flex-direction: column; overflow: hidden;
  background: var(--dsw-alias-bg-overlay, #fff);
  border-left: 1px solid var(--dsw-alias-border-l1, #e5e7eb);
  box-shadow: -4px 0 18px rgba(0,0,0,.14); color: var(--dsw-alias-label-primary, #111827);
  font-size: 13px; line-height: 1.45; box-sizing: border-box; }
.dsh-pf * { box-sizing: border-box; }
/* The session-header toggle: a plain icon — no border/background (which made
   it look "selected"), icon centered. */
button[data-project-files-toggle] {
  border: none; background: transparent; box-shadow: none;
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 0; min-height: 0; padding: 0; margin: 0; line-height: 0;
  color: var(--dsw-alias-label-secondary, #6b7280);
}
button[data-project-files-toggle]:hover { color: var(--dsw-alias-label-primary, #111827); }
button[data-project-files-toggle] svg {
  display: block; width: 16px; height: 16px; flex: none;
}
.dsh-pf-header { display: flex; align-items: center; gap: 6px; padding: 7px 10px;
  border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb); flex: none; }
.dsh-pf-title { font-weight: 600; flex: 1; padding: 0 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-pf-iconbtn { display: flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border: none; border-radius: 5px; background: transparent;
  color: var(--dsw-alias-label-secondary, #6b7280); cursor: pointer; }
.dsh-pf-iconbtn:hover { background: var(--dsw-alias-bg-layer-2, #f3f4f6); color: var(--dsw-alias-label-primary, #111827); }
.dsh-pf-crumbbar { display: flex; align-items: center; gap: 4px; padding: 5px 10px;
  font-size: 12px; color: var(--dsw-alias-label-secondary, #6b7280); flex: none; white-space: nowrap; overflow-x: auto; }
.dsh-pf-crumb { cursor: pointer; padding: 1px 3px; border-radius: 3px; }
.dsh-pf-crumb:hover { background: var(--dsw-alias-bg-layer-2, #f3f4f6); color: var(--dsw-alias-label-primary, #111827); }
/* Two pages: the file tree (browse) and the preview are separate full-area
   views. Each is the single flex child that scrolls (flex:1 + min-height:0
   makes overflow:auto actually scroll in a column flex layout). */
.dsh-pf-view { flex: 1; min-height: 0; overflow: auto; padding: 2px 0 8px; user-select: none;
  touch-action: pan-y; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
.dsh-pf-preview { flex: 1; min-height: 0; overflow: auto;
  touch-action: pan-y; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
.dsh-pf-row { display: flex; align-items: center; gap: 5px; padding: 3px 8px; margin: 0 4px;
  border-radius: 5px; cursor: pointer; white-space: nowrap; }
.dsh-pf-row:hover { background: var(--dsw-alias-bg-layer-1, #f9fafb); }
.dsh-pf-row-active { background: var(--dsw-alias-bg-layer-2, #f3f4f6); }
.dsh-pf-node { overflow: hidden; text-overflow: ellipsis; }
.dsh-pf-name { color: var(--dsw-alias-label-primary, #111827); }
.dsh-pf-meta { color: var(--dsw-alias-label-tertiary, #9ca3af); font-size: 11px; margin-left: auto; flex: none; }
.dsh-pf-pre { margin: 0; padding: 10px 12px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 12.5px; line-height: 1.55; white-space: pre-wrap; word-break: break-word;
  user-select: text; -webkit-user-select: text; }
.dsh-pf-img { display: block; max-width: 100%; max-height: 100%; padding: 10px; }
.dsh-pf-note { padding: 16px; color: var(--dsw-alias-label-secondary, #6b7280); }
.dsh-pf-loading { padding: 8px 12px; color: var(--dsw-alias-label-secondary, #6b7280); }
@media (max-width: 720px) {
  .dsh-pf { left: 0; width: 100vw; top: 0; bottom: 0; height: auto; border-left: none;
    border-top: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
}
`
    var CSS_ID = 'dsh-project-files-css'
    function injectCss() {
      if (typeof document === 'undefined') return
      if (document.querySelector('style[data-plugin-css="' + CSS_ID + '"]')) return
      var tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-project-files'
      tag.dataset.pluginCss = CSS_ID
      tag.textContent = CSS
      document.head.appendChild(tag)
    }
    // Runs at materialization (first import), before any component renders;
    // the tagged style is claimed by the module system for HMR bookkeeping.
    injectCss()

    function FolderIcon() {
      return h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
        h('path', { d: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }))
    }

    // ---------- Panel ----------
    function Panel(props) {
      var onClose = props.onClose
      var refreshKey = props.refreshKey
      var sessionId = props.sessionId
      var rootState = React.useState('')
      var root = rootState[0]
      var setRoot = rootState[1]
      var cwdState = React.useState('')
      var cwd = cwdState[0]
      var setCwd = cwdState[1]
      var crumbsState = React.useState([''])
      var crumbs = crumbsState[0]
      var setCrumbs = crumbsState[1]
      var entriesState = React.useState([])
      var entries = entriesState[0]
      var setEntries = entriesState[1]
      var loadingState = React.useState(false)
      var loading = loadingState[0]
      var setLoading = loadingState[1]
      var errorState = React.useState('')
      var error = errorState[0]
      var setError = errorState[1]
      var previewState = React.useState(null)
      var preview = previewState[0]
      var setPreview = previewState[1]

      var loadDir = React.useCallback(function (path) {
        setLoading(true)
        setError('')
        return fetch('/plugins/project-files/list?path=' + encodeURIComponent(path))
          .then(function (r) { return r.json() })
          .then(function (j) {
            if (j && j.error) { setError(j.error) }
            else { setEntries(j.entries || []); setCwd(path || '') }
          })
          .catch(function (e) { setError(String(e)) })
          .finally(function () { setLoading(false) })
      }, [])

      React.useEffect(function () {
        fetch('/plugins/project-files/root' + (sessionId ? '?session=' + encodeURIComponent(sessionId) : ''))
          .then(function (r) { return r.json() })
          .then(function (j) {
            var rootPath = (j && j.path) || ''
            setRoot(rootPath)
            setCwd(rootPath)
            setCrumbs([''])
            setEntries([])
            return loadDir(rootPath)
          })
          .catch(function (e) { setError(String(e)) })
      }, [loadDir, refreshKey])

      // Recompute breadcrumbs by splitting cwd relative to root.
      var rel = cwd.startsWith(root) ? cwd.slice(root.length).replace(/^[\\/]+/, '') : cwd
      var parts = rel ? rel.split(/[\\/]+/) : []
      var goCrumb = function (idx) {
        // idx in [-1 .. parts.length-1]; -1 = root
        var path = idx < 0 ? root : [root].concat(parts.slice(0, idx + 1)).filter(Boolean).join('')
        setCrumbs(parts.slice(0, idx + 1))
        loadDir(path)
      }

      var openEntry = function (entry) {
        if (entry.type === 'directory') {
          setPreview(null)
          setCrumbs(parts.concat([entry.name]))
          loadDir(entry.path)
          return
        }
        setPreview({ path: entry.path, name: entry.name, type: entry.type, loading: true, error: '' })
        fetch('/plugins/project-files/read?path=' + encodeURIComponent(entry.path))
          .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j } }) })
          .then(function (res) {
            if (!res.ok) { setPreview({ path: entry.path, name: entry.name, type: entry.type, error: res.j && res.j.error ? res.j.error : t('error') }) }
            else { setPreview({ path: entry.path, name: entry.name, type: entry.type, content: res.j.content, size: res.j.size, tooLarge: res.j.tooLarge }) }
          })
          .catch(function (e) { setPreview({ path: entry.path, name: entry.name, type: entry.type, error: String(e) }) })
      }

      var isImage = function (name) { return /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(name) }

      // tree rows: directories first, then files
      var sorted = entries.slice().sort(function (a, b) { return a.type === b.type ? 0 : a.type === 'directory' ? -1 : 1 })

      var crumbsEl = h('div', { className: 'dsh-pf-crumbbar' },
        h('span', { className: 'dsh-pf-crumb', onClick: function () { goCrumb(-1) } }, root || '.'),
        parts.map(function (p, i) {
          return h(React.Fragment, { key: i },
            h('span', null, '/'),
            h('span', { className: 'dsh-pf-crumb', onClick: function () { goCrumb(i) } }, p))
        }))

      var treeEl = h('div', { className: 'dsh-pf-view' },
        loading ? h('div', { className: 'dsh-pf-loading' }, t('loading')) :
          error ? h('div', { className: 'dsh-pf-note' }, error) :
            sorted.length === 0 ? h('div', { className: 'dsh-pf-note' }, t('empty')) :
              sorted.map(function (entry) {
                return h('div', {
                  key: entry.path,
                  className: 'dsh-pf-row' + (preview && preview.path === entry.path ? ' dsh-pf-row-active' : ''),
                  onClick: function () { openEntry(entry) },
                },
                  h('span', { className: 'dsh-pf-node' }, entry.type === 'directory' ? '📂 ' : '📄 '),
                  h('span', { className: 'dsh-pf-name' }, entry.name),
                  entry.type === 'file' && entry.size != null ? h('span', { className: 'dsh-pf-meta' }, entry.size) : null)
              }))

      var previewEl = (function () {
        if (!preview) return h('div', { className: 'dsh-pf-note' }, '…')
        if (preview.error) return h('div', { className: 'dsh-pf-note' }, preview.error)
        if (preview.loading) return h('div', { className: 'dsh-pf-loading' }, t('loading'))
        if (preview.tooLarge) return h('div', { className: 'dsh-pf-note' }, t('tooLarge'))
        if (isImage(preview.name)) return h('img', { className: 'dsh-pf-img', src: '/plugins/project-files/read?path=' + encodeURIComponent(preview.path) })
        return h('pre', { className: 'dsh-pf-pre' }, preview.content)
      })()

      if (preview) {
        // Preview page: full area, with a back button to return to the browser.
        return h('div', { className: 'dsh-pf' },
          h('div', { className: 'dsh-pf-header' },
            h('button', { className: 'dsh-pf-iconbtn', title: t('back'), onClick: function () { setPreview(null) } }, '←'),
            h('span', { className: 'dsh-pf-title' }, preview.name || t('preview')),
            h('button', { className: 'dsh-pf-iconbtn', title: t('close'), onClick: onClose }, '✕')),
          h('div', { className: 'dsh-pf-preview' }, previewEl))
      }
      // Browse page: the file tree (full width).
      return h('div', { className: 'dsh-pf' },
        h('div', { className: 'dsh-pf-header' },
          h('span', { className: 'dsh-pf-title' }, t('files')),
          h('button', { className: 'dsh-pf-iconbtn', title: t('refresh'), onClick: function () { loadDir(cwd) } }, '↻'),
          h('button', { className: 'dsh-pf-iconbtn', title: t('close'), onClick: onClose }, '✕')),
        crumbsEl,
        treeEl)
    }

    // ---------- Toggle button (header action) ----------
    function ProjectFilesButton(props) {
      if (props && props.lang !== undefined) lang = props.lang
      var openState = React.useState(false)
      var open = openState[0]
      var setOpen = openState[1]
      var refreshState = React.useState(0)
      var refreshKey = refreshState[0]
      var setRefreshKey = refreshState[1]
      var button = h('button', {
        type: 'button',
        'data-project-files-toggle': '1',
        title: t('open'),
        'aria-label': t('open'),
        onClick: function () { setOpen(!open) },
      }, FolderIcon())
      return h(React.Fragment, null,
        button,
        open && createPortal(h(Panel, { onClose: function () { setOpen(false) }, refreshKey: refreshKey, sessionId: props && props.sessionId }), document.body))
    }

    function apply(ctx) {
      if (typeof ctx.inject !== 'function') return
      ctx.inject(['slots'], function (scope) {
        scope.slots.inject('conversation.session.header.actions', function* () {
          // id for list-kind slots (dsh rc.6), key for keyed-kind slots (rc.7):
          // passing both stays compatible across versions.
          yield scope.slots.register({
            name: 'conversation.session.header.actions',
            id: 'project-files-toggle',
            key: 'project-files-toggle',
            order: 10,
          }, ProjectFilesButton)
        })
      })
    }

    exports.apply = apply
    exports.inject = []
    return module.exports
  },
})
