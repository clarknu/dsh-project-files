# dsh-project-files

A workspace **file browser + content preview** plugin for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) web GUI, with a **mobile-friendly** panel.

- Browse the project/workspace folder (lazy-loaded directory tree, directories first).
- Click a file to preview it: text/code in a monospace view, images rendered inline; oversized files show the first 80,000 characters.
- Opens from a **folder button** in the conversation session header (desktop: right-docked panel; mobile: full-width bottom sheet via its own responsive CSS — no dependency on `dsh-web-mobile`).

## Install

```bash
dsh plugin --profile web add dsh-project-files
```

Then restart `dsh web` (or refresh the page).

## What it does

Host half exposes `/plugins/project-files/*` routes (list / read / root) driven by the workspace-gated `fs` service; the browser half renders the file tree + preview panel.

## License

MIT
