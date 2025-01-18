function makeHeaders(cookies: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
        Cookie: Object.entries(cookies)
            .map(([k, v]) => `${k}=${v}`)
            .join(';'),
        DNT: '1',
        Priority: 'u=0, i',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-GPC': '1',
        TE: 'trailers',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0',
    };

    return headers;
}

export default {
    async fetch(request, env, ctx): Promise<Response> {
        const url = new URL(request.url);
        if (url.pathname === '/search') {
            const q = url.searchParams.get('q');
            if (!q) {
                return new Response('?q=<query> is required', { status: 400 });
            }

            const start = url.searchParams.get('start');
            if (start) {
                try {
                    parseInt(start, 10);
                } catch {
                    return new Response('?start=<number> your parameter is not number', {
                        status: 400,
                    });
                }
            }

            const go = new URL('https://www.google.com/search');
            go.searchParams.set('client', 'firefox-b-d');

            go.searchParams.set('q', decodeURIComponent(q));
            if (start) go.searchParams.set('start', start);

            const resp = await fetch(go, {
                //headers: makeHeaders({ AEC: env.AEC, DV: env.DV, NID: env.NID }),
                headers: makeHeaders({ SG_SS: env.SG_SS }),
            });

            if (resp.status !== 200) return new Response('Internal Server Error', { status: 500 });

            const text = await resp.text();
            console.log(text.slice(0, 500));

            const splitedOne = text.split('var m={', 2);
            if (splitedOne.length === 2) {
                const splitedTwo = splitedOne[1].split(';var a=m;', 2);

                if (splitedTwo.length === 2) {
                    const data: Record<string, any[]> = JSON.parse('{' + splitedTwo[0]);
                    const results: { title: string; url: string }[] = [];

                    for (const k of Object.keys(data)) {
                        const d = data[k].filter((v) => v);

                        if (d.length >= 4) {
                            if (
                                typeof d[0] === 'string' &&
                                d[0].startsWith('http') &&
                                Array.isArray(d[3]) &&
                                d[3].length >= 2
                            )
                                results.push({
                                    title: d[3][0],
                                    url: d[0],
                                });
                        }
                    }

                    return Response.json(results);
                }
            }

            return new Response('Internal Server Error', { status: 500 });
        } else {
            return new Response('not found', { status: 404 });
        }
    },
} satisfies ExportedHandler<Env>;
