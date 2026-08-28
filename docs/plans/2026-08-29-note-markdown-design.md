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
- Allow: headings, lists (dot markers), quotes, tables, emphasis, strike, inline code, fenced code, autolinks, `[text](url)`, `[ ]` / `[x]` task boxes.
- Links have no underline. `http:`, `https:`, `mailto:` only. No relative URLs (those would be this origin).
- Images: alt text only. No `img`, no remote fetch (CSP `img-src` is already `'self' blob: data:`).
- HTML in the source is shown as text.

The tray clamp is max-height, not `-webkit-line-clamp`, because block markdown breaks box-orient. Tray links are not `<a>` (the row is still tap-to-copy). Open and the reader use real links.

## Emoji

GitHub gemoji aliases, plus tags when they do not collide with an alias, so `:laugh:` works. Typing `:[name]` opens a short list above the caret. Arrow keys, Tab/Enter insert, Escape dismisses. A closing `:name:` in prose becomes the character as you type. Fenced and inline code are left alone. Chrome stays emoji-free; notes may contain emoji.

Cap remains 64 KB of **source**.

## Out of scope

- WYSIWYG / contenteditable composer
- Persisting HTML
- Markdown images from the network
- Editing a sent note
- Worker, Neon, protocol schema
