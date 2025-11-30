import * as cheerio from 'cheerio';

const WIKI_EN_ADDR = 'https://en.wikipedia.org/';
const WIKI_KO_ADDR = 'https://ko.wikipedia.org/';
const WIKI_SEARCH_URI = '/w/rest.php/v1/search/page';
const WIKI_HTML_URL = '/w/rest.php/v1/page/{pageName}/html';

// A wikipedia search result featuring these keywords will be retained
const KEYWORDS = {
	en: ['county', 'city', 'cities', 'state', 'country', 'district', 'village', 'town', 'province'],
	ko: ['시', '도', '군', '구', '면', '읍', '동', '리']
};

// If the first paragraph contains these keywords, the result is likely a listing of wikis and not a specific wiki
const IS_LISTING_HINTS = {
	en: ['several'],
	ko: ['다른 뜻']
};

export async function searchWiki(query: string, lang: 'en' | 'ko') {
	const base = lang === 'en' ? WIKI_EN_ADDR : WIKI_KO_ADDR;
	const url = new URL(WIKI_SEARCH_URI, base);
	url.searchParams.set('q', query);
	const res = await fetch(url);
	const results = (await res.json()).pages as Record<string, any>[];

	let relevantResult;
	for (const result of results) {
		const includesKeyword = KEYWORDS[lang].some((keyword) => result.excerpt.toLowerCase().includes(keyword));
		if (includesKeyword) {
			relevantResult = result;
			break;
		}
	}

	return relevantResult?.title;
}

export async function getWikiHtml(title: string, lang: 'en' | 'ko') {
	const base = lang === 'en' ? WIKI_EN_ADDR : WIKI_KO_ADDR;
	const url = new URL(WIKI_HTML_URL.replace('{pageName}', encodeURIComponent(title)), base);
	const res = await fetch(url);
	const html = await res.text();
	return html;
}

export function isListWiki(html: string, lang: 'en' | 'ko') {
	const $ = cheerio.load(html);
	const firstParagraph = $('section').first().text().toLowerCase();
	return IS_LISTING_HINTS[lang].some((hint) => firstParagraph.includes(hint));
}

export function findRelevantFromList(html: string, target: string, parent: string) {
	const $ = cheerio.load(html);

	let $li = $('li:has(a)');
	let targetLink;
	while ($li && $li.html()) {
		const html = $li.html();
		const lowerHtml = html?.toLowerCase();
		if (lowerHtml?.includes(target) && lowerHtml.includes(parent)) {
			targetLink = $li.find(`a:icontains(${target})`).attr('href');
			break;
		}
		$li = $li.next();
	}
	console.log(targetLink);
	return targetLink;
}
