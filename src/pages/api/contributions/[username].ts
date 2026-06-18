import type { APIRoute } from 'astro';
import cache from '../../../lib/cache';

export const prerender = false;

// Proxy endpoint for GitHub contributions JSON
// Upstream: https://github.com/{username}.contribs

const USERNAME_RE = /^[a-zA-Z0-9-]{1,39}$/;

async function fetchUpstream(username: string) {
	const url = `https://github.com/${encodeURIComponent(username)}.contribs`;
	const headers: Record<string, string> = {
		'Accept': 'application/json',
	};
	const token = process.env.GITHUB_TOKEN;
	if (token) headers['Authorization'] = `token ${token}`;

	const res = await fetch(url, { method: 'GET', headers });
	return res;
}

export const GET: APIRoute = async ({ params }) => {
	const username = params?.username?.toString() || '';
	if (!USERNAME_RE.test(username)) {
		return new Response(JSON.stringify({ error: 'Invalid username' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const cacheKey = `contribs:${username}`;
	const entry = cache.getEntry(cacheKey);

	// Serve fresh cache hit
	if (entry && Date.now() <= entry.expiresAt) {
		return new Response(JSON.stringify(entry.value), {
			headers: {
				'Content-Type': 'application/json',
				'X-Cache': 'hit',
				'X-Cache-UpdatedAt': String(entry.updatedAt),
			},
		});
	}

	// If stale cached value exists, return it and trigger background refresh
	if (entry && Date.now() > entry.expiresAt) {
		// trigger background refresh (best-effort)
		void (async () => {
			try {
				const upstream = await fetchUpstream(username);
				if (upstream.ok) {
					const j = await upstream.json();
					cache.set(cacheKey, j);
				}
			} catch (e) {
				// noop
			}
		})();

		return new Response(JSON.stringify(entry.value), {
			headers: {
				'Content-Type': 'application/json',
				'X-Cache': 'stale',
				'X-Cache-UpdatedAt': String(entry.updatedAt),
			},
		});
	}

	// No cache — fetch upstream
	let upstream: Response;
	try {
		upstream = await fetchUpstream(username);
	} catch (err) {
		return new Response(JSON.stringify({ error: 'Upstream fetch failed' }), {
			status: 502,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const status = upstream.status;
	if (status === 404) {
		return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
	}
	if (status === 429) {
		const retry = upstream.headers.get('Retry-After') || undefined;
		const headers: Record<string, string> = { 'Content-Type': 'application/json' };
		if (retry) headers['Retry-After'] = retry;
		return new Response(JSON.stringify({ error: 'Rate limited upstream' }), { status: 429, headers });
	}
	if (status >= 500) {
		return new Response(JSON.stringify({ error: 'Upstream error' }), { status: 502, headers: { 'Content-Type': 'application/json' } });
	}

	if (!upstream.ok) {
		return new Response(JSON.stringify({ error: 'Unexpected upstream response', status }), { status: 502, headers: { 'Content-Type': 'application/json' } });
	}

	// parse JSON
	let body: any;
	try {
		body = await upstream.json();
	} catch (e) {
		return new Response(JSON.stringify({ error: 'Invalid JSON from upstream' }), { status: 502, headers: { 'Content-Type': 'application/json' } });
	}

	// cache and return
	try {
		cache.set(cacheKey, body);
	} catch (e) {
		// ignore cache failures
	}

	return new Response(JSON.stringify(body), {
		headers: {
			'Content-Type': 'application/json',
			'X-Cache': 'miss',
			'X-Upstream-Status': String(status),
		},
	});
};
