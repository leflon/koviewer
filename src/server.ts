import viewer from './client/viewer.html';

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
		}
	},
	development: process.env.NODE_ENV === 'development'
});
