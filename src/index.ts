import viewer from './viewer.html';

const server = Bun.serve({
    routes: {
        '/': viewer,
        '/geo/:id': async (req) => {
            const { id } = req.params;
            const file = Bun.file(`southkorea-maps/kostat/2018/json/${id}.json`);
            const body = await file.text();
            return new Response(body);
    },
    },
});