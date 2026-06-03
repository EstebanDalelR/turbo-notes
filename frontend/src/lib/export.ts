import type { Note } from './types'

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function safeName(title: string): string {
  return (title.trim() || 'untitled').replace(/[^a-z0-9\-_]+/gi, '-').toLowerCase()
}

export function exportMarkdown(note: Pick<Note, 'title' | 'content'>) {
  const md = `# ${note.title || 'Untitled'}\n\n${note.content}\n`
  download(`${safeName(note.title)}.md`, md, 'text/markdown')
}

/** Render the note to a standalone, self-styled HTML document (sepia/typewriter). */
export function exportHtml(note: Pick<Note, 'title' | 'content'>, bodyHtml: string) {
  const doc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(note.title || 'Untitled')}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400&family=Special+Elite&display=swap');
  body { font-family: 'Courier Prime', monospace; background: #f4ead3; color: #2e2417;
         max-width: 46rem; margin: 3rem auto; padding: 0 1.25rem; line-height: 1.6; }
  h1 { font-family: 'Special Elite', monospace; }
  pre, code { background: rgba(138,109,59,.12); border-radius: 4px; }
  pre { padding: .75rem; overflow:auto; } code { padding: 0 .25rem; }
  blockquote { border-left: 4px solid #c9a15c; padding-left: .75rem; font-style: italic; }
  img { max-width: 100%; } a { color: #8a6d3b; }
</style>
</head>
<body>
<h1>${escapeHtml(note.title || 'Untitled')}</h1>
${bodyHtml}
</body>
</html>`
  download(`${safeName(note.title)}.html`, doc, 'text/html')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
