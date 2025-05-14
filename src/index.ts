import { drizzle, DrizzleD1Database } from 'drizzle-orm/d1';

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
        Downlink: '10',
        Preferanonymous: '1',
        Priority: 'u=0, i',
        Referer: 'https://www.google.com/search?q=a&oq=a&sourceid=chrome&ie=UTF-8',
        Rtt: '50',
        'Sec-Ch-Prefers-Color-Scheme': 'dark',
        'Sec-Ch-Ua': '"Chromium";v="134", "Not:A-Brand";v="24", "Microsoft Edge";v="134"',
        'Sec-Ch-Ua-Arch': '"arm"',
        'Sec-Ch-Ua-Bitness': '"64"',
        'Sec-Ch-Ua-Form-Factors': '"Desktop"',
        'Sec-Ch-Ua-Full-Version': '"134.0.3124.68"',
        'Sec-Ch-Ua-Full-Version-List':
            '"Chromium";v="134.0.6998.89", "Not:A-Brand";v="24.0.0.0", "Microsoft Edge";v="134.0.3124.68"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-ch-Ua-Model': '""',
        'Sec-Ch-Ua-Platform': '"macOS"',
        'Sec-Ch-Ua-Platform-Version': '"15.4.0"',
        'Sec-Ch-Ua-Wow64': '?0',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0',
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
            console.log(c);
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
    url.searchParams.set('q', 'a');
    url.searchParams.set('oq', 'a');
    url.searchParams.set('client', 'chrome');
    url.searchParams.set('ie', 'UTF-8');

    const resp =
        (await (
            await fetch(
                'https://github.com/kino-tkr/google-cookie-autogen/raw/refs/heads/main/cookies.json'
            )
        ).json()) || ({} as any);
    console.info(resp);

    if (!resp['AEC']) throw Error('cookies is none');

    return (
        await db
            .insert(cookies)
            .values({
                aec: resp['AEC'].value,
                nid: (resp['NID'] || {}).value,
                secureEnid: (resp['__Secure-ENID'] || {}).value,
            })
            .returning()
    )[0];
}
