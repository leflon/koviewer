import viewer from './client/viewer.html';
import fetchWikiPage from './wiki';

const PUBLIC_GEO_FILES: Record<string, string> = {
	sido: '../data/topo/sido.json',
	sgg: '../data/topo/sgg.json',
	emdong: '../data/topo/emdong.json',
	li: '../data/topo/li.json'
};

const server = Bun.serve({
	port: process.env.PORT || process.env.BUN_PORT || 3000,
	routes: {
		'/': viewer,
		'/geo/:id': async (req) => {
			const { id } = req.params;

			const path = PUBLIC_GEO_FILES[id];
			if (!path) {
				return new Response('Not found', { status: 404 });
			}

			const file = Bun.file(path);
			const body = await file.text();
			return new Response(body);
		},
		'/wiki': async (req) => {
			const url = new URL(req.url);
			const target = url.searchParams.get('target');
			const parent = url.searchParams.get('parent');
			const lang = url.searchParams.get('lang') as 'en' | 'ko' || 'en';

			if (!target || !parent) {
				return new Response('Missing parameters', { status: 400 });
			}

			const result = await fetchWikiPage(target, parent, lang);
			return Response.json(result);

		}
	},
	development: process.env.NODE_ENV === 'development'
});
