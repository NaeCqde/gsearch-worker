import { drizzle, DrizzleD1Database } from 'drizzle-orm/d1';
import { parse as parseSetCookie } from 'set-cookie-parser';

import { Cookie, cookies } from './schema.js';

function makeHeaders(cookies: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'ja',
        Cookie: Object.entries(cookies)
            .map(([k, v]) => `${k}=${v}`)
            .join(';'),
        Dnt: '1',
        Downlink: '4.9',
        Preferanonymous: '1',
        Priority: 'u=0, i',
        Referer:
            'https://www.google.com/search?q=ohio&sourceid=chrome&ie=UTF-8',
        rtt: '50',
        'sec-ch-prefers-color-scheme': 'dark',
        'sec-ch-ua': '"Not(A:Brand";v="99", "Chromium";v="134", "Google Chrome";v="134"',
        'sec-ch-ua-arch': '"x86"',
        'sec-ch-ua-bitness': '"64"',
        'sec-ch-ua-form-factors': '"Desktop"',
        'sec-ch-ua-full-version': '"134.0.6998.36"',
        'sec-ch-ua-full-version-list':
            '"Not(A:Brand";v="99.0.0.0", "Chromium";v="134.0.6998.36", "Google Chrome";v="134.0.6998.36"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-model': '',
        'sec-ch-ua-platform': 'Windows',
        'sec-ch-ua-platform-version': '19.0.0',
        'sec-ch-ua-wow64': '?0',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/1134.0.6998.36 Safari/537.36',
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

            const db = drizzle(env.DB);
            const go = new URL('https://www.google.com/search');
            go.searchParams.set('client', 'chrome');

            go.searchParams.set('q', decodeURIComponent(q));
            if (start) go.searchParams.set('start', start);

            let c: Cookie[] = await db.select().from(cookies).all();
            if (!c.length) {
                c = [await fetchCookiesAndSave(db, env.SG_SS)];
            }

            let retried = false;
            while (true) {
                const resp = await fetch(go, {
                    headers: makeHeaders({
                        AEC: c[0].aec,
                        NID: c[0].nid || '',
                        '__Secure-ENID': c[0].secureEnid || '',
                    }),
                });

                let text = await resp.text();
                console.info(text.slice(0, 500));

                if (resp.status !== 200 || !text.includes('var m={')) {
                    if (retried) break;

                    c = [await fetchCookiesAndSave(db, env.SG_SS)];
                    retried = true;
                    continue;
                }

                return Response.json(await parseResult(text));
            }

            throw Error('scraping failure');
        } else {
            return new Response('not found', { status: 404 });
        }
    },
} satisfies ExportedHandler<Env>;

async function parseResult(text: string) {
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

            return results;
        }
    }

    throw Error('parsing failure');
}

async function fetchCookiesAndSave(db: DrizzleD1Database, sgSS: string): Promise<Cookie> {
    await db.delete(cookies).all();
    const url = new URL('https://www.google.com/search');
    url.searchParams.set('client', 'chrome');
    url.searchParams.set('q', 'ohio');

    const resp = await fetch(url, {
        headers: makeHeaders({ SG_SS: sgSS }),
    });
    const c = parseSetCookie(resp.headers.getSetCookie(), { map: true });
    console.info((await resp.text()).slice(0, 500));
    console.info(c);

    return (
        await db
            .insert(cookies)
            .values({
                aec: c['AEC'].value,
                nid: (c['NID'] || {}).value,
                secureEnid: (c['__Secure-ENID'] || {}).value,
            })
            .returning()
    )[0];
}
