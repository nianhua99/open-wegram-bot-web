/**
 * Open Wegram Bot - Vercel Entry Point
 * A two-way private messaging Telegram bot
 *
 * GitHub Repository: https://github.com/wozulong/open-wegram-bot
 */

import {handleRequest} from '../src/core.js';
import { createClient } from 'redis';

export default async function handler(req, res) {
    const request = new Request(`${req.headers['x-forwarded-proto']}://${req.headers.host}${req.url}`, {
        method: req.method,
        headers: new Headers(req.headers),
        body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : null
    });

    const redis = await createClient().connect();

    const config = {
        prefix: process.env.PREFIX || 'public',
        secretToken: process.env.SECRET_TOKEN || ''
    };

    const storage = {

        async get(key) {
            return await redis.get(key);
        },
        async put(key, value) {
            await redis.set(key, value);
        },
        async remove(key) {
            await redis.del(key);
        },
        async list(options){
            const keys = await redis.keys(options.prefix + '*');
            return keys.map(key => ({name: key}));
        }
    };

    const response = await handleRequest(request, config, storage);

    const body = await response.text();
    const headers = {};
    for (const [key, value] of response.headers.entries()) {
        headers[key] = value;
    }

    res.status(response.status).setHeader('Content-Type', response.headers.get('Content-Type') || 'text/plain').send(body);
}
