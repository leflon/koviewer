import { hash } from 'bun';
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
	ko: ['다른 뜻', '다음 지역']
};

export async function searchWiki(query: string, lang: 'en' | 'ko') {
	const base = lang === 'en' ? WIKI_EN_ADDR : WIKI_KO_ADDR;
	const url = new URL(WIKI_SEARCH_URI, base);
	url.searchParams.set('q', query);
	const res = await fetch(url);
	const results = (await res.json()).pages as Record<string, any>[];

	const baseName = query.split('-')[0].toLowerCase();

	let relevantResult;
	for (const result of results) {
		const includesKeyword = KEYWORDS[lang].some((keyword) => result.excerpt.toLowerCase().includes(keyword));
		const includesBaseName = result.title.toLowerCase().includes(baseName);
		if (includesKeyword && includesBaseName) {
			relevantResult = result;
			break;
		}
	}

	return relevantResult?.title;
}

export async function formatWikiLink(title: string, lang: 'en' | 'ko') {
	const base = lang === 'en' ? WIKI_EN_ADDR : WIKI_KO_ADDR;
	const url = new URL(`/wiki/${encodeURIComponent(title)}`, base);
	return url.toString();
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
	const firstParagraph = $('p').first().text().toLowerCase();
	return IS_LISTING_HINTS[lang].some((hint) => firstParagraph.includes(hint));
}

export function findRelevantFromList(html: string, target: string, parent: string) {
	const $ = cheerio.load(html);

	let $li = $('li:has(a)');
	let targetLink;
	$li.each((_, elm) => {
		console.log($(elm).text());
		const html = $(elm).html();
		const lowerHtml = html?.toLowerCase();
		if (lowerHtml?.includes(target) && lowerHtml.includes(parent)) {
			const directTargetLink = $(elm).find(`a:icontains(${target})`).attr('href');
			if (directTargetLink && !directTargetLink.includes('edit')) {
				targetLink = directTargetLink;
				return false;
			}
					
			targetLink = $(elm).find(`a:icontains(${parent})`).attr('href');
			return false;
		}
	});
	targetLink ??= '';
	const split = targetLink.split('/');
	const title = split[split.length - 1];
	return title;
}

export function formatHtml(html: string) {
	const $ = cheerio.load(html);
	// Remove conflicting tags
	const base = $('base').attr('href') || '';
	$('meta, base, title').remove();
	// Fix stylesheet relative liks
	$('link[rel="stylesheet"]').each((_, elm) => {
		const href = $(elm).attr('href') || '';
		console.log(href);
		if (href.startsWith('/')) {
			const url = new URL(href, 'https://' + base);
			$(elm).attr('href', url.toString());
		}
	});

	// Remove external links section
	$('section:has(h2:icontains("external links")), section:has(h2:icontains("외부 링크"))').remove();
	return $.html();
}

export default async function fetchWikiPage(target: string, parent: string, lang: 'en' | 'ko') {
	let title = await searchWiki(target, lang);
	if (!title) return null;
	console.log(`Found wiki title: ${title}`);
	
	let html = await getWikiHtml(title, lang);

	if (isListWiki(html, lang)) {
		console.log('The wiki page is a listing. Searching for relevant entry...');
		title = findRelevantFromList(html, target.toLowerCase(), parent.toLowerCase());
		if (!title) return null;
		console.log(`Found relevant wiki title from listing: ${title}`);
		html = await getWikiHtml(title, lang);
	}

	return {
		title,
		link: formatWikiLink(title, lang),
		html: formatHtml(html)
	};
}