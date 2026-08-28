const COPY = [
	"box-sizing",
	"width",
	"border-top-width",
	"border-right-width",
	"border-bottom-width",
	"border-left-width",
	"border-style",
	"padding-top",
	"padding-right",
	"padding-bottom",
	"padding-left",
	"font-style",
	"font-variant",
	"font-weight",
	"font-stretch",
	"font-size",
	"font-family",
	"line-height",
	"letter-spacing",
	"text-indent",
	"text-transform",
	"word-spacing",
	"tab-size",
] as const;

export function textareaCaretOffset(
	area: HTMLTextAreaElement,
	position: number,
): { top: number; left: number; height: number } {
	const mirror = document.createElement("div");
	const style = window.getComputedStyle(area);
	mirror.setAttribute("aria-hidden", "true");
	mirror.style.position = "absolute";
	mirror.style.visibility = "hidden";
	mirror.style.whiteSpace = "pre-wrap";
	mirror.style.overflowWrap = "break-word";
	mirror.style.overflow = "hidden";
	mirror.style.top = "0";
	mirror.style.left = "-9999px";
	for (const name of COPY) {
		mirror.style.setProperty(name, style.getPropertyValue(name));
	}
	mirror.style.width = `${area.clientWidth}px`;
	mirror.textContent = area.value.slice(0, position);
	const marker = document.createElement("span");
	marker.textContent = "\u200b";
	mirror.append(marker);
	document.body.append(mirror);
	const top = marker.offsetTop - area.scrollTop;
	const left = marker.offsetLeft - area.scrollLeft;
	const height = Number.parseFloat(style.lineHeight) || marker.offsetHeight || 18;
	mirror.remove();
	return { top, left, height };
}
