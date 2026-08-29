# Note markdown and emoji shortcodes

Locked 2026-08-29.

## Product

The composer stays a textarea. You type markdown and `:laugh:` shortcodes. The sealed payload is still that **source** string (Unicode emoji after a shortcode resolves). The server never sees plaintext, and it never sees HTML.

After decrypt, this browser renders a safe markdown subset in the tray and in Open. Copy and download still hand over the source, so another app gets what you typed, not a private HTML document.

## Why not save rendered HTML

HTML in the envelope is still plaintext to anyone who decrypts. It drops the source, makes edit-later harder, and is an XSS path next to a non-extractable VaultKey. Render in the page. Do not add a second field, a Worker change, or a schema bump.

## Markdown

Client-only. `marked` lexes; React walks tokens. Never `innerHTML`, never `marked.parse`.

- GFM with `breaks: true` so existing newline-shaped notes do not collapse.
- Allow: headings h1–h6, lists (including nested and an ordered start), quotes, tables (column align from the separator), emphasis, strike, inline code, fenced and indented code, autolinks, `[text](url)` with an optional title, `[ ]` / `[x]` task boxes.
- Links have no underline. `http:`, `https:`, `mailto:` only. No relative URLs (those would be this origin).
- Images: alt text only. No `img`, no remote fetch (CSP `img-src` is already `'self' blob: data:`).
- HTML in the source is shown as text.

The tray clamp is max-height, not `-webkit-line-clamp`, because block markdown breaks box-orient. Tray links are real `<a>` unless this browser turns Tap a note to copy on in Account. Open and the reader always use real links.

## Emoji

GitHub gemoji aliases, plus tags when they do not collide with an alias, so `:laugh:` works. Typing `:[name]` opens a short list above the caret. Arrow keys, Tab/Enter insert, Escape dismisses. When that list is closed, Tab inserts four spaces (Shift+Tab peels them) unless Account turns Tab indents off. Space still indents. A closing `:name:` in prose becomes the character as you type. Fenced and inline code are left alone. Chrome stays emoji-free; notes may contain emoji.

Cap remains 64 KB of **source**.

## Out of scope

- WYSIWYG / contenteditable composer
- Persisting HTML
- Markdown images from the network
- markdown-it plugins (typographer, sub/sup, footnotes, definition lists, containers, syntax highlighting)
- Worker, Neon, protocol schema
