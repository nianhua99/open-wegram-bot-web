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
        secretToken: process.env.SECRET_TOKEN || ''
    };

    const storage = {
        // Vercel KV 使用 @upstash/redis 库
        async get(key) {
            const { kv } = require('@vercel/kv');
            return await kv.get(key);
        },
        async put(key, value) {
            const { kv } = require('@vercel/kv');
            await kv.set(key, value);
        },
        async remove(key) {
            const { kv } = require('@vercel/kv');
            await kv.delete(key);
        },
        async list(options){
            const { kv } = require('@vercel/kv');
            // 根据 options.prefix 过滤列表
            const list = await kv.list(options);
            return list.filter(item => item.name.startsWith(options.prefix));
        }
    };

    const response = await handleRequest(request, config, storage );

    const body = await response.text();
    const headers = {};
    for (const [key, value] of response.headers.entries()) {
        headers[key] = value;
    }

    res.status(response.status).setHeader('Content-Type', response.headers.get('Content-Type') || 'text/plain').send(body);
}
