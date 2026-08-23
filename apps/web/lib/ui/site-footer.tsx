import { CatMark } from "./marks";

export function SiteFooter() {
	const year = new Date().getFullYear();

	return (
		<footer className="site-foot">
			<p className="site-foot-copy">
				<span className="site-foot-mark">©</span>
				<time dateTime={String(year)}>{year}</time>
				<a className="site-foot-name" href="https://rishi.rest" rel="noreferrer">
					Rishi Giri
				</a>
			</p>
			<span className="site-foot-rule" aria-hidden />
			<a className="site-foot-seal" href="/" aria-label="meownow">
				<CatMark className="site-foot-cat" size={22} decorative />
			</a>
		</footer>
	);
}
