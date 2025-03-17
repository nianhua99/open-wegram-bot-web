/**
 * Open Wegram Bot - Core Logic
 * Shared code between Cloudflare Worker and Vercel deployments
 */

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

export async function handleWebhook(request, ownerUid, botToken, secretToken) {
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
        if (reply && message.from.id.toString() === ownerUid) {
            const rm = reply.reply_markup;
            if (rm && rm.inline_keyboard && rm.inline_keyboard.length > 0) {
                await postToTelegramApi(botToken, 'copyMessage', {
                    chat_id: rm.inline_keyboard[0][0].callback_data,
                    from_chat_id: message.chat.id,
                    message_id: message.message_id
                });
            }

            return new Response('OK');
        }

        if ("/start" === message.text) {
            return new Response('OK');
        }

        const sender = message.from;
        const senderUid = sender.id.toString();
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
                chat_id: ownerUid,
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

export async function renderAdminPage(isProtected, prefix, isLoggedIn = false, error = null) {
    const loginForm = isProtected && !isLoggedIn ? `
        <form method="POST" class="max-w-md mx-auto mt-8 p-4 bg-white shadow-md rounded-lg">
            <h2 class="text-2xl font-bold mb-4">管理员登录</h2>
            ${error ? `<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">${error}</div>` : ''}
            <div class="mb-4">
                <input type="password" name="password" class="form-control w-full" placeholder="请输入管理员密码" required>
            </div>
            <button type="submit" class="btn btn-primary w-full">登录</button>
        </form>
    ` : '';

    const actionForms = !isProtected || isLoggedIn ? `
        <div class="container mx-auto px-4 py-8">
            <div id="message" class="hidden mb-4 p-4 rounded"></div>
            <div class="grid md:grid-cols-2 gap-8">
                <div class="bg-white p-6 rounded-lg shadow-md">
                    <h2 class="text-2xl font-bold mb-4">安装 Bot</h2>
                    <form id="installForm" class="install-form">
                        <div class="mb-4">
                            <label class="block mb-2">Owner UID</label>
                            <input type="text" name="ownerUid" class="form-control w-full" required>
                        </div>
                        <div class="mb-4">
                            <label class="block mb-2">Bot Token</label>
                            <input type="text" name="botToken" class="form-control w-full" required>
                        </div>
                        <button type="submit" class="btn btn-success w-full">安装</button>
                    </form>
                </div>
                
                <div class="bg-white p-6 rounded-lg shadow-md">
                    <h2 class="text-2xl font-bold mb-4">卸载 Bot</h2>
                    <form id="uninstallForm" class="uninstall-form">
                        <div class="mb-4">
                            <label class="block mb-2">Bot Token</label>
                            <input type="text" name="botToken" class="form-control w-full" required>
                        </div>
                        <button type="submit" class="btn btn-danger w-full">卸载</button>
                    </form>
                </div>
            </div>
        </div>

        <script>
        document.addEventListener('DOMContentLoaded', function() {
            const messageDiv = document.getElementById('message');
            
            function showMessage(success, text) {
                messageDiv.textContent = text;
                messageDiv.className = success 
                    ? 'mb-4 p-4 rounded bg-green-100 text-green-700 border border-green-400'
                    : 'mb-4 p-4 rounded bg-red-100 text-red-700 border border-red-400';
                messageDiv.style.display = 'block';
                setTimeout(() => {
                    messageDiv.style.display = 'none';
                }, 5000);
            }

            async function handleSubmit(e) {
                e.preventDefault();
                const form = e.target;
                const formData = new FormData(form);
                const isInstall = form.id === 'installForm';
                
                let url;
                if (isInstall) {
                    url = \`/${prefix}/install/\${formData.get('ownerUid')}/\${formData.get('botToken')}\`;
                } else {
                    url = \`/${prefix}/uninstall/\${formData.get('botToken')}\`;
                }

                try {
                    const response = await fetch(url);
                    const data = await response.json();
                    showMessage(data.success, data.message);
                    if (data.success) {
                        form.reset();
                    }
                } catch (error) {
                    showMessage(false, '操作失败：' + error.message);
                }
            }

            document.getElementById('installForm').addEventListener('submit', handleSubmit);
            document.getElementById('uninstallForm').addEventListener('submit', handleSubmit);
        });
        </script>
    ` : '';

    return new Response(`<!DOCTYPE html>
        <html lang="zh">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Wegram Bot 管理面板</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
            <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-gray-100">
            <div class="container mx-auto px-4 py-8">
                <h1 class="text-3xl font-bold text-center mb-8">Wegram Bot 管理面板</h1>
                ${loginForm}
                ${actionForms}
            </div>
        </body>
        </html>`, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
}


export async function handleAdminRequest(request, prefix, secretToken, adminPassword) {
    const url = new URL(request.url);
    const isProtected = !!adminPassword;
    
    // 检查登录状态
    const cookies = request.headers.get('Cookie') || '';
    const isLoggedIn = cookies.includes(`admin_auth=${adminPassword}`);
    
    if (request.method === 'POST') {
        const formData = await request.formData();
        
        // 处理登录
        if (isProtected && !isLoggedIn) {
            const password = formData.get('password');
            if (password === adminPassword) {
                return new Response('', {
                    status: 302,
                    headers: {
                        'Location': url.pathname,
                        'Set-Cookie': `admin_auth=${adminPassword}; Path=/; HttpOnly; SameSite=Strict`
                    }
                });
            }
            return renderAdminPage(isProtected, prefix, false, '密码错误');
        }

        // 处理安装/卸载操作
        if (!isProtected || isLoggedIn) {
            const action = url.pathname.endsWith('/install') ? 'install' : 'uninstall';
            const ownerUid = formData.get('ownerUid');
            const botToken = formData.get('botToken');
            
            if (action === 'install' && ownerUid && botToken) {
                return handleInstall(request, ownerUid, botToken, prefix, secretToken);
            } else if (action === 'uninstall' && botToken) {
                return handleUninstall(botToken, secretToken);
            }
        }
    }
    
    return renderAdminPage(isProtected, prefix, isLoggedIn);
}

export async function handleRequest(request, config) {
    const {prefix, secretToken, adminPassword} = config;

    const url = new URL(request.url);
    const path = url.pathname;

    const INSTALL_PATTERN = new RegExp(`^/${prefix}/install/([^/]+)/([^/]+)$`);
    const UNINSTALL_PATTERN = new RegExp(`^/${prefix}/uninstall/([^/]+)$`);
    const WEBHOOK_PATTERN = new RegExp(`^/${prefix}/webhook/([^/]+)/([^/]+)$`);
    const ADMIN_PATTERN = new RegExp(`^/${prefix}/admin(/.*)?$`);
    let match;

    if (match = path.match(INSTALL_PATTERN)) {
        return handleInstall(request, match[1], match[2], prefix, secretToken);
    }

    if (match = path.match(UNINSTALL_PATTERN)) {
        return handleUninstall(match[1], secretToken);
    }

    if (match = path.match(WEBHOOK_PATTERN)) {
        return handleWebhook(request, match[1], match[2], secretToken);
    }

    if (match = path.match(ADMIN_PATTERN)) {
        return handleAdminRequest(request, prefix, secretToken, adminPassword);
    }

    return new Response('Not Found', {status: 404});
}