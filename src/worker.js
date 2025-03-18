/**
 * Open Wegram Bot - Cloudflare Worker Entry Point
 * A two-way private messaging Telegram bot
 *
 * GitHub Repository: https://github.com/wozulong/open-wegram-bot
 */

import {handleRequest} from './core.js';

export default {
    async fetch(request, env, ctx) {

        const config = {
            prefix: env.PREFIX || 'public',
            secretToken: env.SECRET_TOKEN || ''
        };

        const storage = {
            async get(key) {
                return await env.KV.get(key);
            },
            async put(key, value) {
                await env.KV.put(key, value);
            },
            async remove(key) {
                await env.KV.delete(key);
            }
        };

        return handleRequest(request, config, storage);
    }
};