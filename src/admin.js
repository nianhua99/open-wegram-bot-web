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

            document.getElementById('installForm').addEventListener('submit', handleSubmit);
            document.getElementById('uninstallForm').addEventListener('submit', handleSubmit);
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
