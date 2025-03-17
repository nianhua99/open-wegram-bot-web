/**
 * Open Wegram Bot - Vercel Entry Point
 * A two-way private messaging Telegram bot
 *
 * GitHub Repository: https://github.com/wozulong/open-wegram-bot
 */

import {handleRequest} from '../src/core.js';

export default async function handler(req, res) {
    const request = new Request(`${req.headers['x-forwarded-proto']}://${req.headers.host}${req.url}`, {
        method: req.method,
        headers: new Headers(req.headers),
        body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : null
    });

    const config = {
        prefix: process.env.PREFIX || 'public',
        secretToken: process.env.SECRET_TOKEN || '',
        adminPassword: process.env.ADMIN_PASSWORD || ''
    };

    const response = await handleRequest(request, config);

    const body = await response.text();
    const headers = {};
    for (const [key, value] of response.headers.entries()) {
        headers[key] = value;
    }

    res.status(response.status).setHeader('Content-Type', response.headers.get('Content-Type') || 'text/plain').send(body);
}
