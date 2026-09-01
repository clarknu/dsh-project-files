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
      download: '下载',
      format: '格式化',
      raw: '原文',
      jsonFail: 'JSON 解析失败（显示原文）',
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
      download: 'Download',
      format: 'Format',
      raw: 'Raw',
      jsonFail: 'JSON parse failed (showing raw)',
    }
    var lang = 'zh'
    var t = function (key) { return lang === 'en' ? en[key] ?? zh[key] : zh[key] ?? key }

    // Preview type by extension; unknown formats render a "can't preview" note.
    var IMG_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif', 'ico'])
    var VID_EXT = new Set(['mp4', 'webm', 'mov', 'ogv', 'm4v', 'mkv'])
    var AUD_EXT = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus'])
    var TXT_EXT = new Set(['txt', 'md', 'markdown', 'json', 'js', 'ts', 'jsx', 'tsx', 'mjs', 'cjs', 'py', 'rb', 'go', 'java', 'c', 'h', 'cpp', 'hpp', 'cs', 'rs', 'php', 'sh', 'bash', 'zsh', 'bat', 'ps1', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'xml', 'html', 'htm', 'css', 'scss', 'less', 'sql', 'csv', 'tsv', 'log', 'env', 'gitignore', 'dockerfile', 'makefile', 'vue', 'svelte'])
    function previewType(name) {
      var ext = (String(name).split('.').pop() || '').toLowerCase()
      if (IMG_EXT.has(ext)) return 'image'
      if (ext === 'pdf') return 'pdf'
      if (VID_EXT.has(ext)) return 'video'
      if (AUD_EXT.has(ext)) return 'audio'
      if (TXT_EXT.has(ext)) return 'text'
      return 'unknown'
    }
    // Download URL (attachment) for any file.
    function dlUrl(p) { return '/plugins/project-files/file?path=' + encodeURIComponent(p.path) + '&download=1' }

    // ---- syntax highlighting (lightweight, multi-language) ----
    var LANG_BY_EXT = { js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript', json: 'json', py: 'python', rb: 'ruby', go: 'go', java: 'java', c: 'c', h: 'c', cpp: 'cpp', hpp: 'cpp', cs: 'csharp', rs: 'rust', php: 'php', sh: 'bash', bash: 'bash', zsh: 'bash', yaml: 'yaml', yml: 'yaml', xml: 'xml', html: 'xml', htm: 'xml', vue: 'xml', svelte: 'xml', css: 'css', scss: 'css', less: 'css', sql: 'sql', md: 'markdown', markdown: 'markdown', ini: 'ini', toml: 'ini', cfg: 'ini', conf: 'ini', bat: 'batch', ps1: 'powershell', csv: 'csv', tsv: 'csv' }
    function fileLang(name) {
      var lower = String(name).toLowerCase()
      if (lower === 'dockerfile' || lower === 'dockerfile.txt') return 'dockerfile'
      if (lower === 'makefile' || lower === 'gnumakefile') return 'makefile'
      return LANG_BY_EXT[lower.split('.').pop()] || 'text'
    }
    var LANG_KW = {
      javascript: ['const','let','var','function','return','if','else','for','while','do','break','continue','new','class','extends','super','this','typeof','instanceof','in','of','switch','case','default','try','catch','finally','throw','async','await','yield','import','export','from','as','static','get','set','delete','void','null','undefined','true','false','debugger'],
      typescript: ['const','let','var','function','return','if','else','for','while','do','break','continue','new','class','extends','super','this','typeof','instanceof','in','of','switch','case','default','try','catch','finally','throw','async','await','yield','import','export','from','as','static','void','null','undefined','true','false','interface','type','enum','implements','declare','namespace','readonly','public','private','protected','abstract','keyof','infer','is','any','unknown','never','string','number','boolean'],
      python: ['def','class','return','if','elif','else','for','while','break','continue','pass','import','from','as','try','except','finally','raise','with','lambda','yield','global','nonlocal','self','None','True','False','and','or','not','in','is','del','assert','async','await'],
      bash: ['if','then','else','elif','fi','for','while','do','done','case','esac','function','return','local','export','source','alias','read','break','continue','exit','set','unset','shift','select','until'],
      java: ['public','private','protected','class','interface','extends','implements','static','final','void','int','long','double','float','boolean','char','byte','short','return','if','else','for','while','do','break','continue','new','this','super','try','catch','finally','throw','throws','import','package','switch','case','default','abstract','synchronized','volatile','transient','enum','null','true','false'],
      c: ['int','char','float','double','void','long','short','unsigned','signed','struct','union','enum','typedef','static','const','extern','return','if','else','for','while','do','break','continue','switch','case','default','goto','sizeof','NULL','true','false'],
      cpp: ['int','char','float','double','void','long','short','unsigned','signed','struct','union','enum','typedef','static','const','extern','return','if','else','for','while','do','break','continue','switch','case','default','goto','sizeof','class','public','private','protected','namespace','template','typename','new','delete','this','virtual','override','using','bool','auto','nullptr','constexpr','inline','friend','operator','true','false'],
      csharp: ['public','private','protected','class','interface','namespace','using','static','void','int','string','bool','var','return','if','else','for','foreach','while','do','break','continue','new','this','base','try','catch','finally','throw','switch','case','default','enum','struct','async','await','null','true','false','get','set'],
      go: ['func','return','if','else','for','range','break','continue','switch','case','default','package','import','type','struct','interface','const','var','go','defer','chan','select','map','nil','true','false','make','new','len','cap','append'],
      rust: ['fn','let','mut','const','struct','enum','impl','trait','pub','use','mod','match','if','else','for','while','loop','break','continue','return','self','Self','async','await','move','ref','type','where','dyn','true','false'],
      php: ['function','return','if','else','elseif','foreach','for','while','do','break','continue','class','extends','implements','public','private','protected','static','new','echo','print','require','include','namespace','use','try','catch','finally','throw','switch','case','default','true','false','null','array','abstract','final','global'],
      ruby: ['def','end','class','module','return','if','elsif','else','unless','while','until','for','do','break','next','case','when','begin','rescue','ensure','require','include','extend','puts','print','new','true','false','nil','self','yield'],
      sql: ['SELECT','FROM','WHERE','INSERT','INTO','VALUES','UPDATE','SET','DELETE','CREATE','TABLE','DATABASE','INDEX','VIEW','JOIN','LEFT','RIGHT','INNER','OUTER','ON','AS','AND','OR','NOT','NULL','ORDER','BY','GROUP','HAVING','LIMIT','OFFSET','PRIMARY','KEY','FOREIGN','REFERENCES','ALTER','DROP','ADD','COLUMN','DISTINCT','COUNT','SUM','AVG','MIN','MAX','IN','IS','LIKE','BETWEEN','EXISTS','CASE','WHEN','THEN','ELSE','END','UNION','ALL'],
      yaml: ['true','false','null','yes','no','on','off'],
      json: ['true','false','null'],
      css: ['@media','@import','@font-face','@keyframes','@supports','important','inherit','initial','unset','none','auto','block','flex','grid','inline','inline-block','absolute','relative','fixed','sticky'],
      ini: ['true','false','null'],
    }
    function tokenize(code, lang) {
      var kw = LANG_KW[lang] || []
      var kwSet = new Set(kw)
      var out = []
      var i = 0, n = code.length
      var hashComment = /^(python|bash|ruby|yaml|ini|makefile|dockerfile|batch|powershell)$/.test(lang)
      var isSql = lang === 'sql'
      var isXml = lang === 'xml'
      while (i < n) {
        var c = code[i]
        if (hashComment && c === '#') { var e = code.indexOf('\n', i); if (e < 0) e = n; out.push({ t: 'com', s: code.slice(i, e) }); i = e; continue }
        if (isSql && code.startsWith('--', i)) { var e2 = code.indexOf('\n', i); if (e2 < 0) e2 = n; out.push({ t: 'com', s: code.slice(i, e2) }); i = e2; continue }
        if (isXml && code.startsWith('<!--', i)) { var e3 = code.indexOf('-->', i); out.push({ t: 'com', s: code.slice(i, e3 >= 0 ? e3 + 3 : n) }); i = e3 >= 0 ? e3 + 3 : n; continue }
        if (c === '/' && code[i + 1] === '/') { var e4 = code.indexOf('\n', i); if (e4 < 0) e4 = n; out.push({ t: 'com', s: code.slice(i, e4) }); i = e4; continue }
        if (c === '/' && code[i + 1] === '*') { var e5 = code.indexOf('*/', i); out.push({ t: 'com', s: code.slice(i, e5 >= 0 ? e5 + 2 : n) }); i = e5 >= 0 ? e5 + 2 : n; continue }
        if (c === '"' || c === "'" || c === '`') { var q = c, j = i + 1, esc = false; while (j < n) { var ch = code[j]; if (!esc && ch === q) break; if (ch === '\\' && !esc) esc = true; else esc = false; j++ } out.push({ t: 'str', s: code.slice(i, Math.min(j + 1, n)) }); i = Math.min(j + 1, n); continue }
        if (c >= '0' && c <= '9' && (i === 0 || !/[A-Za-z0-9_]/.test(code[i - 1]))) { var nm = /^[0-9][0-9a-fA-FxXoObB._]*/.exec(code.slice(i)); if (nm) { out.push({ t: 'num', s: nm[0] }); i += nm[0].length; continue } }
        if (/[A-Za-z_$]/.test(c)) { var wm = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(code.slice(i)); var w = wm[0]; i += w.length; if (kwSet.has(w)) out.push({ t: 'kw', s: w }); else if (/^[A-Z]/.test(w)) out.push({ t: 'bui', s: w }); else out.push({ t: 'pln', s: w }); continue }
        out.push({ t: 'pun', s: c }); i++
      }
      return out
    }
    function renderCode(code, lang) {
      var toks = tokenize(code, lang)
      return h('pre', { className: 'dsh-pf-pre' }, toks.map(function (tk, i) {
        if (tk.t === 'pln' || tk.t === 'pun') return tk.s
        return h('span', { className: 'dsh-pf-tok-' + tk.t }, tk.s)
      }))
    }

    // ---- markdown rendering (lightweight) ----
    function renderInline(s, key) {
      var parts = []
      var re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|!\[[^\]]*\]\([^)]+\))/g
      var last = 0, m
      while ((m = re.exec(s))) {
        if (m.index > last) parts.push(s.slice(last, m.index))
        var tok = m[0], k = key + '__' + parts.length
        if (tok.slice(0, 2) === '**') parts.push(h('strong', { key: k }, tok.slice(2, -2)))
        else if (tok[0] === '*') parts.push(h('em', { key: k }, tok.slice(1, -1)))
        else if (tok[0] === '`') parts.push(h('code', { key: k }, tok.slice(1, -1)))
        else if (tok.slice(0, 2) === '![') { var im = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(tok); parts.push(h('img', { key: k, src: im[2], alt: im[1] })) }
        else { var lk = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok); parts.push(h('a', { key: k, href: lk[2] }, lk[1])) }
        last = m.index + tok.length
      }
      if (last < s.length) parts.push(s.slice(last))
      return parts
    }
    function renderBlock(b, i) {
      if (b.t === 'h') return h('h' + Math.min(b.lvl, 6), { key: i, className: 'dsh-pf-md-h' }, renderInline(b.s, 'h' + i))
      if (b.t === 'quote') return h('blockquote', { key: i }, renderInline(b.s, 'q' + i))
      if (b.t === 'list') return h('ul', { key: i }, b.items.map(function (it, j) { return h('li', { key: j }, renderInline(it, 'li' + j)) }))
      if (b.t === 'code') return h('div', { className: 'dsh-pf-mdcode', key: i }, renderCode(b.s, b.lang || 'text'))
      if (b.t === 'hr') return h('hr', { key: i })
      return h('p', { key: i }, renderInline(b.s, 'p' + i))
    }
    function renderMarkdown(src) {
      var lines = String(src).split('\n')
      var blocks = [], list = null, code = null, para = []
      function flushPara() { if (para.length) { blocks.push({ t: 'p', s: para.join(' ') }); para = [] } }
      function flushList() { if (list) { blocks.push({ t: 'list', items: list }); list = null } }
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i]
        if (/^```/.test(line)) { flushPara(); flushList(); if (code) { blocks.push({ t: 'code', lang: code.lang, s: code.buf.join('\n') }); code = null } else { code = { lang: line.slice(3).trim(), buf: [] } }; continue }
        if (code) { code.buf.push(line); continue }
        if (/^\s*$/.test(line)) { flushPara(); flushList(); continue }
        var h = /^(#{1,6})\s+(.*)$/.exec(line)
        if (h) { flushPara(); flushList(); blocks.push({ t: 'h', lvl: h[1].length, s: h[2] }); continue }
        var q = /^>\s?(.*)$/.exec(line)
        if (q) { flushPara(); flushList(); blocks.push({ t: 'quote', s: q[1] }); continue }
        var li = /^\s*[-*+]\s+(.*)$/.exec(line)
        if (li) { flushPara(); if (!list) list = []; list.push(li[1]); continue }
        if (/^-{3,}$/.test(line.trim())) { flushPara(); flushList(); blocks.push({ t: 'hr' }); continue }
        para.push(line.trim())
      }
      flushPara(); flushList()
      return h('div', { className: 'dsh-pf-md' }, blocks.map(renderBlock))
    }
    function formatJson(s) {
      try { return JSON.stringify(JSON.parse(s), null, 2) } catch (e) { return String(s) + '\n\n// ' + t('jsonFail') }
    }



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
.dsh-pf-frame { width: 100%; height: 100%; border: none; min-height: 0; display: block; }
.dsh-pf-media { max-width: 100%; max-height: 100%; display: block; padding: 10px; }
.dsh-pf-dl { display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: 5px; text-decoration: none; flex: none;
  color: var(--dsw-alias-label-secondary, #6b7280); cursor: pointer; }
.dsh-pf-dl:hover { background: var(--dsw-alias-bg-layer-2, #f3f4f6); color: var(--dsw-alias-label-primary, #111827); }
/* Text/code view + JSON toolbar */
.dsh-pf-textbox { display: flex; flex-direction: column; min-height: 100%; }
.dsh-pf-toolbar { display: flex; justify-content: flex-end; padding: 6px 8px; flex: none;
  border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
.dsh-pf-tbs { border: 1px solid var(--dsw-alias-border-l1, #e5e7eb); border-radius: 4px;
  padding: 3px 8px; font-size: 12px; background: transparent;
  color: var(--dsw-alias-label-secondary, #6b7280); cursor: pointer; }
.dsh-pf-tbs:hover { color: var(--dsw-alias-label-primary, #111827); background: var(--dsw-alias-bg-layer-2, #f3f4f6); }
/* Syntax highlight tokens */
.dsh-pf-tok-kw { color: #cf222e; font-weight: 600; }
.dsh-pf-tok-str { color: #0a3069; }
.dsh-pf-tok-com { color: #6a737d; font-style: italic; }
.dsh-pf-tok-num { color: #0550ae; }
.dsh-pf-tok-bui { color: #8250df; }
/* Markdown */
.dsh-pf-md { padding: 10px 14px; color: var(--dsw-alias-label-primary, #111827); }
.dsh-pf-md h1 { font-size: 20px; margin: 14px 0 8px; border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb); padding-bottom: 4px; }
.dsh-pf-md h2 { font-size: 17px; margin: 12px 0 6px; }
.dsh-pf-md h3, .dsh-pf-md h4, .dsh-pf-md h5, .dsh-pf-md h6 { font-size: 15px; margin: 10px 0 4px; }
.dsh-pf-md p { margin: 6px 0; line-height: 1.6; }
.dsh-pf-md ul { margin: 6px 0; padding-left: 20px; }
.dsh-pf-md li { margin: 2px 0; }
.dsh-pf-md code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  background: var(--dsw-alias-bg-layer-2, #f3f4f6); border-radius: 3px; padding: 1px 4px; font-size: .92em; }
.dsh-pf-md blockquote { border-left: 3px solid var(--dsw-alias-border-l1, #e5e7eb);
  margin: 8px 0; padding: 2px 12px; color: var(--dsw-alias-label-secondary, #6b7280); }
.dsh-pf-md a { color: var(--dsw-alias-brand-primary, #2563eb); text-decoration: none; }
.dsh-pf-md img { max-width: 100%; border-radius: 4px; }
.dsh-pf-md hr { border: none; border-top: 1px solid var(--dsw-alias-border-l1, #e5e7eb); margin: 12px 0; }
.dsh-pf-mdcode { margin: 8px 0; }
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
      var formatState = React.useState(false)
      var formatted = formatState[0]
      var setFormatted = formatState[1]

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
      var SEP = root.indexOf('\\') >= 0 ? '\\' : '/'
      var goCrumb = function (idx) {
        // idx in [-1 .. parts.length-1]; -1 = root
        var path = idx < 0 ? root : [root].concat(parts.slice(0, idx + 1)).filter(Boolean).join(SEP)
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
        setFormatted(false)
        var mode = previewType(entry.name)
        var base = { path: entry.path, name: entry.name, type: entry.type, mode: mode }
        if (mode === 'text') {
          setPreview(Object.assign({}, base, { loading: true, error: '' }))
          fetch('/plugins/project-files/read?path=' + encodeURIComponent(entry.path))
            .then(function (r) { return r.json() })
            .then(function (j) {
              if (j && j.tooLarge) { setPreview(Object.assign({}, base, { mode: 'large' })) }
              else if (j && j.error) { setPreview(Object.assign({}, base, { error: j.error })) }
              else { setPreview(Object.assign({}, base, { content: j.content })) }
            })
            .catch(function (e) { setPreview(Object.assign({}, base, { error: String(e) })) })
        } else {
          // image / pdf / video / audio stream inline via /file; unknown shows a
          // "can't preview" note with a download link.
          setPreview(base)
        }
      }

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
                  entry.type === 'file' && entry.size != null ? h('span', { className: 'dsh-pf-meta' }, entry.size) : null,
                  entry.type === 'file' ? h('a', { className: 'dsh-pf-dl', title: t('download'), href: dlUrl(entry), download: true, onClick: function (e) { e.stopPropagation() } }, '⤓') : null)
              }))

      var previewEl = (function () {
        if (!preview) return h('div', { className: 'dsh-pf-note' }, '…')
        if (preview.error) return h('div', { className: 'dsh-pf-note' }, preview.error)
        if (preview.loading) return h('div', { className: 'dsh-pf-loading' }, t('loading'))
        var src = '/plugins/project-files/file?path=' + encodeURIComponent(preview.path)
        if (preview.mode === 'text') {
          var lang = fileLang(preview.name)
          if (lang === 'markdown') return renderMarkdown(preview.content)
          // JSON: a format toggle; otherwise render highlighted code.
          var json = lang === 'json'
          var text = (json && formatted) ? formatJson(preview.content) : preview.content
          return h('div', { className: 'dsh-pf-textbox' },
            json ? h('div', { className: 'dsh-pf-toolbar' },
              h('button', { className: 'dsh-pf-tbs', onClick: function () { setFormatted(!formatted) } }, formatted ? t('raw') : t('format'))) : null,
            renderCode(text, json ? 'json' : lang))
        }
        if (preview.mode === 'image') return h('img', { className: 'dsh-pf-img', src: src })
        if (preview.mode === 'pdf') return h('iframe', { className: 'dsh-pf-frame', src: src })
        if (preview.mode === 'video') return h('video', { className: 'dsh-pf-media', controls: true, src: src })
        if (preview.mode === 'audio') return h('audio', { className: 'dsh-pf-media', controls: true, src: src })
        // unknown or too-large: show a note + a download link.
        return h('div', { className: 'dsh-pf-note' },
          h('div', null, preview.mode === 'large' ? t('tooLarge') : t('notPreviewable')),
          h('a', { className: 'dsh-pf-dl', href: dlUrl(preview), download: true }, t('download')))
      })()

      if (preview) {
        // Preview page: full area, with back + download + close.
        return h('div', { className: 'dsh-pf' },
          h('div', { className: 'dsh-pf-header' },
            h('button', { className: 'dsh-pf-iconbtn', title: t('back'), onClick: function () { setPreview(null) } }, '←'),
            h('span', { className: 'dsh-pf-title' }, preview.name || t('preview')),
            h('a', { className: 'dsh-pf-iconbtn dsh-pf-dl', title: t('download'), href: dlUrl(preview), download: true }, '⤓'),
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
