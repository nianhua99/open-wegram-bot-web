// 渲染admin.html
export function renderAdminHtml() {
    const html = /*html*/`
    <!DOCTYPE html>
    <html lang="zh">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Wegram Bot 管理面板</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
        <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-100">
        <!-- 未登录时显示登录框 -->
        <div class="container mx-auto px-4 py-8" id="loginContainer">
            <h1 class="text-3xl font-bold text-center mb-8">Wegram Bot 管理面板</h1>
        </div>
        <!-- 安装和卸载表单 -->
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
            
            <!-- 被封禁用户列表 -->
            <div class="mt-8 bg-white p-6 rounded-lg shadow-md">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-2xl font-bold">被封禁用户列表</h2>
                    <button id="refreshBannedList" class="btn btn-primary">刷新列表</button>
                </div>
                <div class="overflow-x-auto">
                    <table class="min-w-full bg-white">
                        <thead class="bg-gray-100">
                            <tr>
                                <th class="py-2 px-4 border-b text-left">用户ID</th>
                                <th class="py-2 px-4 border-b text-left">用户名</th>
                                <th class="py-2 px-4 border-b text-left">状态</th>
                                <th class="py-2 px-4 border-b text-left">操作</th>
                            </tr>
                        </thead>
                        <tbody id="bannedUsersList">
                            <tr>
                                <td colspan="4" class="py-4 text-center text-gray-500">加载中...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        <script>
            document.addEventListener('DOMContentLoaded', function() {
            const messageDiv = document.getElementById('message');
            const bannedUsersListEl = document.getElementById('bannedUsersList');
            
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

                let url = '';
                if (isInstall) {
                    url = "./install/" + formData.get('ownerUid') + "/" + formData.get('botToken');
                } else {
                    url = "./uninstall/" + formData.get('botToken');
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
            
            // 获取被封禁用户列表
            async function fetchBannedUsers() {
                try {
                    bannedUsersListEl.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-gray-500">加载中...</td></tr>';
                    
                    const response = await fetch('./admin/banned-users');
                    const data = await response.json();
                    
                    if (data.success) {
                        if (data.users && data.users.length > 0) {
                            bannedUsersListEl.innerHTML = data.users.map(user => 
                                '<tr>' +
                                '<td class="py-2 px-4 border-b">' + user.uid + '</td>' +
                                '<td class="py-2 px-4 border-b">' + (user.name || '未知') + '</td>' +
                                '<td class="py-2 px-4 border-b">' + (user.banned ? '已封禁' : '已解封') + '</td>' +
                                '<td class="py-2 px-4 border-b">' +
                                '<button class="unban-user btn btn-sm ' + (user.banned ? 'btn-warning' : 'btn-secondary') + '" ' +
                                'data-uid="' + user.uid + '" ' +
                                (user.banned ? '' : 'disabled') + '>' +
                                (user.banned ? '解封' : '已解封') +
                                '</button>' +
                                '</td>' +
                                '</tr>'
                            ).join('');
                            
                            // 添加解封按钮事件
                            document.querySelectorAll('.unban-user').forEach(btn => {
                                btn.addEventListener('click', async function() {
                                    const uid = this.getAttribute('data-uid');
                                    try {
                                        const response = await fetch('./admin/unban-user', {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json'
                                            },
                                            body: JSON.stringify({ uid })
                                        });
                                        const data = await response.json();
                                        if (data.success) {
                                            showMessage(true, '已成功解封用户 ' + uid);
                                            fetchBannedUsers(); // 刷新列表
                                        } else {
                                            showMessage(false, data.message || '解封失败');
                                        }
                                    } catch (error) {
                                        showMessage(false, '操作失败：' + error.message);
                                    }
                                });
                            });
                        } else {
                            bannedUsersListEl.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-gray-500">暂无被封禁用户</td></tr>';
                        }
                    } else {
                        bannedUsersListEl.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-red-500">获取列表失败</td></tr>';
                        showMessage(false, data.message || '获取被封禁用户列表失败');
                    }
                } catch (error) {
                    bannedUsersListEl.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-red-500">获取列表失败</td></tr>';
                    showMessage(false, '获取被封禁用户列表失败：' + error.message);
                }
            }

            document.getElementById('installForm').addEventListener('submit', handleSubmit);
            document.getElementById('uninstallForm').addEventListener('submit', handleSubmit);
            document.getElementById('refreshBannedList').addEventListener('click', fetchBannedUsers);
            
            // 页面加载时获取被封禁用户列表
            fetchBannedUsers();
        });
        </script>
        </body>
    </html>
    `;


    return new Response(
        html,
        {
            headers: {
                'Content-Type': 'text/html; charset=utf-8'
            }
        }
    )
}