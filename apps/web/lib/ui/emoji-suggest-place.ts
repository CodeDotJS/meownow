const ITEM_PX = 34;
const PAD_PX = 10;
const MAX_PX = 224;
const GAP_PX = 8;

export function emojiSuggestListHeight(count: number): number {
	return Math.min(Math.max(0, count) * ITEM_PX + PAD_PX, MAX_PX);
}

export function emojiSuggestBelow(input: {
	caretTop: number;
	caretHeight: number;
	listHeight: number;
	viewHeight: number;
}): boolean {
	const need = input.listHeight + GAP_PX;
	const above = input.caretTop;
	const below = input.viewHeight - input.caretTop - input.caretHeight;
	if (above >= need) {
		return false;
	}
	return below >= need || below > above;
}
