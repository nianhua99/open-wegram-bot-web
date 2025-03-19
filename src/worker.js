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

        console.log(env);

        const storage = {
            async get(key) {
                return await env.OWB.get(key);
            },
            async put(key, value) {
                await env.OWB.put(key, value);
            },
            async delete(key) {
                await env.OWB.delete(key);
            },
            async list(options) {
                return await env.OWB.list(options);
            }
        };

        return handleRequest(request, config, storage);
    }
};