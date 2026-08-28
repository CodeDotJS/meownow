import type { Token, Tokens } from "marked";
import type { ReactNode } from "react";
import { safeHref } from "./markdown-href";
import { lexNote } from "./note-lex";
import { splitTaskMarks } from "./task-mark";

function isList(token: Token): token is Tokens.List {
	return token.type === "list" && "items" in token && Array.isArray(token.items);
}

function isTable(token: Token): token is Tokens.Table {
	return token.type === "table" && "header" in token && Array.isArray(token.header);
}

function isLink(token: Token): token is Tokens.Link {
	return token.type === "link" && "href" in token && typeof token.href === "string";
}

function NoteCheck({ checked }: { checked: boolean }) {
	return (
		<span
			className={checked ? "note-md-box is-checked" : "note-md-box"}
			role="img"
			aria-label={checked ? "checked" : "unchecked"}
		>
			{checked ? (
				<svg viewBox="0 0 12 12" aria-hidden>
					<path d="M2.2 6.4 4.8 9 9.8 3.2" />
				</svg>
			) : null}
		</span>
	);
}

function renderPlain(text: string, key: number): ReactNode {
	const parts = splitTaskMarks(text);
	const only = parts[0];
	if (parts.length === 1 && only?.type === "text") {
		return <span key={key}>{only.value}</span>;
	}
	return (
		<span key={key}>
			{parts.map((part) =>
				part.type === "box" ? (
					<NoteCheck key={`b${part.at}`} checked={part.checked} />
				) : (
					<span key={`t${part.at}`}>{part.value}</span>
				),
			)}
		</span>
	);
}

function kids(tokens: Token[] | undefined, links: boolean): ReactNode {
	if (!tokens || tokens.length === 0) {
		return null;
	}
	return tokens.map((token, index) => renderToken(token, index, links));
}

function renderToken(token: Token, key: number, links: boolean): ReactNode {
	switch (token.type) {
		case "space":
			return null;
		case "hr":
			return <hr key={key} className="note-md-hr" />;
		case "heading": {
			const depth = token.depth < 1 ? 1 : token.depth > 6 ? 6 : token.depth;
			const Tag = `h${depth}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
			return (
				<Tag key={key} className={`note-md-h note-md-h${depth}`}>
					{kids(token.tokens, links)}
				</Tag>
			);
		}
		case "paragraph":
			return (
				<p key={key} className="note-md-p">
					{kids(token.tokens, links)}
				</p>
			);
		case "blockquote":
			return (
				<blockquote key={key} className="note-md-quote">
					{kids(token.tokens, links)}
				</blockquote>
			);
		case "code":
			return (
				<pre key={key} className="note-md-pre">
					<code>{token.text}</code>
				</pre>
			);
		case "list":
			return isList(token) ? renderList(token, key, links) : null;
		case "list_item":
			return (
				<div key={key} className="note-md-item">
					{kids(token.tokens, links)}
				</div>
			);
		case "table":
			return isTable(token) ? renderTable(token, key, links) : null;
		case "text":
			return token.tokens ? (
				<span key={key}>{kids(token.tokens, links)}</span>
			) : (
				renderPlain(token.text, key)
			);
		case "escape":
			return renderPlain(token.text, key);
		case "strong":
			return <strong key={key}>{kids(token.tokens, links)}</strong>;
		case "em":
			return <em key={key}>{kids(token.tokens, links)}</em>;
		case "del":
			return <del key={key}>{kids(token.tokens, links)}</del>;
		case "codespan":
			return (
				<code key={key} className="note-md-code">
					{token.text}
				</code>
			);
		case "br":
			return <br key={key} />;
		case "link":
			return isLink(token) ? renderLink(token, key, links) : null;
		case "image":
			return (
				<span key={key} className="note-md-alt">
					{token.text || "image"}
				</span>
			);
		case "html":
			return <span key={key}>{token.text || token.raw}</span>;
		case "checkbox":
			return <NoteCheck key={key} checked={"checked" in token && token.checked === true} />;
		case "def":
			return null;
		default:
			if ("raw" in token && typeof token.raw === "string") {
				return renderPlain(token.raw, key);
			}
			return null;
	}
}

function cellAlign(align: string | null | undefined): "left" | "center" | "right" | undefined {
	if (align === "left" || align === "center" || align === "right") {
		return align;
	}
	return undefined;
}

function renderList(token: Tokens.List, key: number, links: boolean): ReactNode {
	const Tag = token.ordered ? "ol" : "ul";
	const start = typeof token.start === "number" && token.start > 1 ? token.start : undefined;
	return (
		<Tag
			key={key}
			className={token.ordered ? "note-md-list is-ol" : "note-md-list"}
			start={start}
			style={start ? { counterReset: `note-md ${start - 1}` } : undefined}
		>
			{token.items.map((item, index) => (
				// Duplicate bullets share `raw`. Position in this snapshot is stable.
				// biome-ignore lint/suspicious/noArrayIndexKey: duplicate list source is valid
				<li key={`${index}:${item.raw}`} className={item.task ? "note-md-task" : undefined}>
					{kids(item.tokens, links)}
				</li>
			))}
		</Tag>
	);
}

function renderTable(token: Tokens.Table, key: number, links: boolean): ReactNode {
	return (
		<div key={key} className="note-md-table-wrap">
			<table className="note-md-table">
				<thead>
					<tr>
						{token.header.map((cell, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: table cells can repeat
							<th key={`${index}:${cell.text}`} style={{ textAlign: cellAlign(cell.align) }}>
								{kids(cell.tokens, links)}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{token.rows.map((row, rowIndex) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: table rows can repeat
						<tr key={`${rowIndex}:${row.map((cell) => cell.text).join("\n")}`}>
							{row.map((cell, index) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: table cells can repeat
								<td key={`${index}:${cell.text}`} style={{ textAlign: cellAlign(cell.align) }}>
									{kids(cell.tokens, links)}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function renderLink(token: Tokens.Link, key: number, links: boolean): ReactNode {
	const inner = kids(token.tokens, links);
	if (!links) {
		return (
			<span key={key} className="note-md-link">
				{inner}
			</span>
		);
	}
	const href = safeHref(token.href);
	if (!href) {
		return <span key={key}>{inner}</span>;
	}
	const title = token.title ? token.title : undefined;
	return (
		<a key={key} href={href} title={title} target="_blank" rel="noopener noreferrer">
			{inner}
		</a>
	);
}

export function NoteMarkdown({ text, links }: { text: string; links: boolean }) {
	return <div className="note-md">{kids(lexNote(text), links)}</div>;
}
