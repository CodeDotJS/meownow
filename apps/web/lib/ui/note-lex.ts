import { lexer, type Token } from "marked";

export function lexNote(text: string): Token[] {
	return lexer(text, { gfm: true, breaks: true });
}
