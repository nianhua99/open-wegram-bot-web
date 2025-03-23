/**
 * Open Wegram Bot - Core Logic
 * Shared code between Cloudflare Worker and Vercel deployments
 */

import { renderAdminHtml } from './admin.js';

export function validateSecretToken(token) {
    return token.length > 15 && /[A-Z]/.test(token) && /[a-z]/.test(token) && /[0-9]/.test(token);
}

export function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {'Content-Type': 'application/json'}
    });
}

export async function postToTelegramApi(token, method, body) {
    return fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body)
    });
}

export async function handleInstall(request, ownerUid, botToken, prefix, secretToken) {
    if (!validateSecretToken(secretToken)) {
        return jsonResponse({
            success: false,
            message: 'Secret token must be at least 16 characters and contain uppercase letters, lowercase letters, and numbers.'
        }, 400);
    }

    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.hostname}`;
    const webhookUrl = `${baseUrl}/${prefix}/webhook/${ownerUid}/${botToken}`;

    try {
        const response = await postToTelegramApi(botToken, 'setWebhook', {
            url: webhookUrl,
            allowed_updates: ['message'],
            secret_token: secretToken
        });

        const result = await response.json();
        if (result.ok) {
            return jsonResponse({success: true, message: 'Webhook successfully installed.'});
        }

        return jsonResponse({success: false, message: `Failed to install webhook: ${result.description}`}, 400);
    } catch (error) {
        return jsonResponse({success: false, message: `Error installing webhook: ${error.message}`}, 500);
    }
}

export async function handleUninstall(botToken, secretToken) {
    if (!validateSecretToken(secretToken)) {
        return jsonResponse({
            success: false,
            message: 'Secret token must be at least 16 characters and contain uppercase letters, lowercase letters, and numbers.'
        }, 400);
    }

    try {
        const response = await postToTelegramApi(botToken, 'deleteWebhook', {})

        const result = await response.json();
        if (result.ok) {
            return jsonResponse({success: true, message: 'Webhook successfully uninstalled.'});
        }

        return jsonResponse({success: false, message: `Failed to uninstall webhook: ${result.description}`}, 400);
    } catch (error) {
        return jsonResponse({success: false, message: `Error uninstalling webhook: ${error.message}`}, 500);
    }
}

export async function handleWebhook(request, ownerUid, botToken, secretToken, storage) {
    if (secretToken !== request.headers.get('X-Telegram-Bot-Api-Secret-Token')) {
        return new Response('Unauthorized', {status: 401});
    }

    const update = await request.json();
    if (!update.message) {
        return new Response('OK');
    }

    const message = update.message;
    const reply = message.reply_to_message;
    try {
        if (reply && message.chat.id.toString() === ownerUid) {
            const rm = reply.reply_markup;
            if (rm && rm.inline_keyboard && rm.inline_keyboard.length > 0) {
                let senderUid = rm.inline_keyboard[0][0].callback_data;
                if (!senderUid) {
                    senderUid = rm.inline_keyboard[0][0].url.split('tg://user?id=')[1];
                }

                // 处理ban命令
                if (message.text === '/ban') {
                    await storage.put(`banned:${senderUid}`, "true");
                    await postToTelegramApi(botToken, 'sendMessage', {
                        chat_id: parseInt(ownerUid),
                        text: `已封禁用户 ${senderUid}`
                    });
                    return new Response('OK');
                }
                
                // 处理unban命令
                if (message.text === '/unban') {
                    await storage.delete(`banned:${senderUid}`);
                    await postToTelegramApi(botToken, 'sendMessage', {
                        chat_id: parseInt(ownerUid),
                        text: `已解封用户 ${senderUid}`
                    });
                    return new Response('OK');
                }

                await postToTelegramApi(botToken, 'copyMessage', {
                    chat_id: parseInt(senderUid),
                    from_chat_id: message.chat.id,
                    message_id: message.message_id
                });
            }

            return new Response('OK');
        }

        if ("/start" === message.text) {
            return new Response('OK');
        }

        const sender = message.chat;
        const senderUid = sender.id.toString();

        // 检查发送者是否被封禁
        const isBanned = await storage.get(`banned:${senderUid}`);
        if (isBanned) {
            console.log('sender ' + senderUid + ' is banned, said ' + message.text);
            return new Response('OK');
        }
        const senderName = sender.username ? `@${sender.username}` : [sender.first_name, sender.last_name].filter(Boolean).join(' ');

        const copyMessage = async function (withUrl = false) {
            const ik = [[{
                text: `🔏 From: ${senderName} (${senderUid})`,
                callback_data: senderUid,
            }]];

            if (withUrl) {
                ik[0][0].text = `🔓 From: ${senderName} (${senderUid})`
                ik[0][0].url = `tg://user?id=${senderUid}`;
            }

            return await postToTelegramApi(botToken, 'copyMessage', {
                chat_id: parseInt(ownerUid),
                from_chat_id: message.chat.id,
                message_id: message.message_id,
                reply_markup: {inline_keyboard: ik}
            });
        }

        const response = await copyMessage(true);
        if (!response.ok) {
            await copyMessage();
        }

        return new Response('OK');
    } catch (error) {
        console.error('Error handling webhook:', error);
        return new Response('Internal Server Error', {status: 500});
    }
}


export async function handleAdminRequest(request, prefix, secretToken, storage) {
    // 处理登录请求
    const url = new URL(request.url);
    const path = url.pathname;
    
    // 处理安装请求
    if (path === `/${prefix}/admin/install` && request.method === 'POST') {
        const { ownerUid, botToken } = await request.json();
        return handleInstall(request, ownerUid, botToken, prefix, secretToken);
    }
    
    // 处理卸载请求
    if (path === `/${prefix}/admin/uninstall` && request.method === 'POST') {
        const { botToken } = await request.json();
        return handleUninstall(botToken, secretToken);
    }
    
    // 获取被封禁用户列表
    if (path === `/${prefix}/admin/banned-users` && request.method === 'GET') {
        try {
            // 获取所有以 "banned:" 开头的键
            const {keys} = await storage.list({ prefix: 'banned:' });
            const users = [];
            
            // 处理每个键，提取用户信息
            for (const key of keys) {
            
                if (key.includes(':name')) continue; // 跳过用户名键
                
                const uid = key.replace('banned:', '');
                const banned = await storage.get(key);
                const name = await storage.get(`banned:${uid}:name`) || '未知';
                
                users.push({
                    uid,
                    name,
                    banned: banned === 'true' || banned === true
                });
            }
            
            return jsonResponse({
                success: true,
                users
            });
        } catch (error) {
            return jsonResponse({
                success: false,
                message: `获取被封禁用户列表失败: ${error.message}`
            }, 500);
        }
    }
    
    // 处理从管理面板解封用户的请求
    if (path === `/${prefix}/admin/unban-user` && request.method === 'POST') {
        try {
            const { uid } = await request.json();
            if (!uid) {
                return jsonResponse({
                    success: false,
                    message: '缺少用户ID'
                }, 400);
            }
            
            await storage.put(`banned:${uid}`, false);
            
            return jsonResponse({
                success: true,
                message: `已成功解封用户 ${uid}`
            });
        } catch (error) {
            return jsonResponse({
                success: false,
                message: `解封用户失败: ${error.message}`
            }, 500);
        }
    }
}  

export async function handleRequest(request, config, storage) {

    const {prefix, secretToken} = config;

    const url = new URL(request.url);
    const path = url.pathname;

    const INSTALL_PATTERN = new RegExp(`^/${prefix}/install/([^/]+)/([^/]+)$`);
    const UNINSTALL_PATTERN = new RegExp(`^/${prefix}/uninstall/([^/]+)$`);
    const WEBHOOK_PATTERN = new RegExp(`^/${prefix}/webhook/([^/]+)/([^/]+)$`);
    const ADMIN_PATTERN = new RegExp(`^/${prefix}/admin(/.*)?$`);
    let match;

    if (match = path.match(INSTALL_PATTERN)) {
        return handleInstall(request, match[1], match[2], prefix, secretToken, storage);
    }

    if (match = path.match(UNINSTALL_PATTERN)) {
        return handleUninstall(match[1], secretToken, storage);
    }

    if (match = path.match(WEBHOOK_PATTERN)) {
        return handleWebhook(request, match[1], match[2], secretToken, storage);
    }

    if (match = path.match(ADMIN_PATTERN)) {
        // 判断进入页面还是安装和卸载请求
        if (request.method === 'POST' || path.includes('/admin/banned-users') || path.includes('/admin/unban-user')) {
            return handleAdminRequest(request, prefix, secretToken, storage);
        }
        return renderAdminHtml();
    }

    return new Response('Not Found', {status: 404});
}