const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function updateSocialBadge(count) {
    const badge = document.getElementById('social_badge');
    if (!badge) return;
    
    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'inline-flex';
    } else {
        badge.style.display = 'none';
    }
}

function getQQAvatarUrl(qq) {
    if (!qq) return '../assets/default_avatar.jpg';
    return `https://q.qlogo.cn/headimg_dl?dst_uin=${qq}&src_uin=${qq}&spec=100&feed=100`;
}

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

window.simpmcAPI.onProtocolUrl((url) => {
    try {
        const urlObj = new URL(url);

        const isTurnstile = urlObj.host === 'turnstile-callback' || 
                            urlObj.pathname.includes('turnstile-callback');

        if (isTurnstile) {
            const token = urlObj.searchParams.get('token');
            const token_input = document.getElementById('captcha-token');
            const captcha_button = document.getElementById('captcha-button');

            token_input.value = token;
            captcha_button.disabled = 'disabled';
            captcha_button.classList.add('finished');
            captcha_button.innerText = i18n('social.finished');

            console.log('成功得到人机验证 token 并保存至表单');
        }
    } catch (err) {
        console.error('解析链接失败');
    }
});

async function initRegForm() {
    console.log('初始化注册表单')
    document.getElementById('regForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const captchaToken = document.getElementById('captcha-token').value;
        const submitBtn = e.target.querySelector('.btn-submit');
        const captcha_button = document.getElementById('captcha-button');

        if (!captchaToken) {
            submitBtn.innerText = i18n('social.captcha_first');
            submitBtn.style.backgroundColor = '#901212';
            submitBtn.classList.add('error');
            submitBtn.disabled = true;
            await sleep(4000);
            submitBtn.innerText = i18n('social.reg_button');
            submitBtn.classList.remove('error');
            submitBtn.removeAttribute('style');
            submitBtn.disabled = false;
            return;
        }

        submitBtn.innerText = i18n('social.submitting');
        submitBtn.disabled = true;

        try {
            const response = await fetch('https://simpmcapi.phsver.icu/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    "username": username,
                    "password": await hashPassword(password),
                    "turnstile_token": captchaToken
                })
            });

            const result = await response.json();

            if ((response.ok && result.success) || result.message === 'Registered successfully' ) {
                switchPage('social/reg_success')
            } else {
                submitBtn.innerText = (result.error || '未知错误');
                submitBtn.style.backgroundColor = '#901212';
                submitBtn.classList.add('error');
                submitBtn.disabled = true;
                captcha_button.disabled = false;
                captcha_button.classList.remove('finished');
                captcha_button.innerText = i18n('social.captcha');
                captchaToken.value = '';
                await sleep(4000);
                submitBtn.innerText = i18n('social.reg_button');
                submitBtn.classList.remove('error');
                submitBtn.removeAttribute('style');
                submitBtn.disabled = false;
                return;
            }
        } catch (error) {
            submitBtn.innerText = 'Network Error:', error;
            submitBtn.style.backgroundColor = '#901212';
            submitBtn.classList.add('error');
            submitBtn.disabled = true;
            await sleep(4000);
            submitBtn.innerText = i18n('social.reg_button');
            submitBtn.classList.remove('error');
            submitBtn.removeAttribute('style');
            submitBtn.disabled = false;
            return;
        } finally {
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;
        }
    });
}

async function initLoginForm() {
    console.log('初始化登录表单');
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const captchaToken = document.getElementById('captcha-token').value;
        const submitBtn = e.target.querySelector('.btn-submit');
        const captcha_button = document.getElementById('captcha-button');

        if (!captchaToken) {
            submitBtn.innerText = i18n('social.captcha_first');
            submitBtn.style.backgroundColor = '#901212';
            submitBtn.classList.add('error');
            submitBtn.disabled = true;
            await sleep(4000);
            submitBtn.innerText = i18n('social.login_button');
            submitBtn.classList.remove('error');
            submitBtn.removeAttribute('style');
            submitBtn.disabled = false;
            return;
        }

        const originalText = submitBtn.innerText;
        submitBtn.innerText = i18n('social.submitting');
        submitBtn.disabled = true;

        try {
            const response = await fetch('https://simpmcapi.phsver.icu/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    "username": username,
                    "password": await hashPassword(password),
                    "turnstile_token": captchaToken
                })
            });

            const result = await response.json();
            console.log('登录响应:', result);

            if (response.ok && result.token) {
                console.log('登录成功，准备保存 token');
                await window.simpmcAPI.setAuthToken(result.token);
                console.log('Token 已保存，准备切换到社交页面');
                switchPage('social');
            } else {
                submitBtn.innerText = result.error || '登录失败';
                submitBtn.style.backgroundColor = '#901212';
                submitBtn.classList.add('error');
                submitBtn.disabled = true;
                captcha_button.disabled = false;
                captcha_button.classList.remove('finished');
                captcha_button.innerText = i18n('social.captcha');
                document.getElementById('captcha-token').value = '';
                await sleep(4000);
                submitBtn.innerText = i18n('social.login_button');
                submitBtn.classList.remove('error');
                submitBtn.removeAttribute('style');
                submitBtn.disabled = false;
                return;
            }
        } catch (error) {
            submitBtn.innerText = 'Network Error: ' + error.message;
            submitBtn.style.backgroundColor = '#901212';
            submitBtn.classList.add('error');
            submitBtn.disabled = true;
            await sleep(4000);
            submitBtn.innerText = i18n('social.login_button');
            submitBtn.classList.remove('error');
            submitBtn.removeAttribute('style');
            submitBtn.disabled = false;
            return;
        } finally {
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;
        }
    });
}

async function initSocial() {
    console.log('initSocial 被调用');
    const userInfoDiv = document.getElementById('user_info');
    const userAvatar = document.getElementById('user_avatar');
    const loginBtn = document.getElementById('login_btn');
    const logoutBtn = document.getElementById('logout_btn');
    const settingsBtn = document.getElementById('settings_btn');
    const userName = document.getElementById('user_name');
    const userStatus = document.getElementById('user_status');
    const loading = document.getElementById('loading');
    const friendsContainer = document.getElementById('friends_container');
    const friendList = document.getElementById('friend_list');
    const friendBadge = document.getElementById('friend_badge');
    const friendEmpty = document.getElementById('friend_empty');
    const friend_loading = document.getElementById('friend_loading');


    if (!userInfoDiv) {
        console.log('userInfoDiv 不存在，跳过');
        return;
    }

    try {
        console.log('开始获取用户信息...');
        const tokenResult = await window.simpmcAPI.getAuthToken();
        console.log('当前 token:', tokenResult ? '存在' : '不存在');
        const result = await window.simpmcAPI.getUserInfo();
        console.log('getUserInfo 返回:', result);

        loading.style.display = 'none';
        if (result.success || result.error === 'Not logged in') {
            userName.textContent = result.data.username || 'Unknown';
            userStatus.className = 'user_status ' + result.data.status;
            userStatus.textContent = result.data.status === 'online' ? '在线' :
                                     result.data.status === 'in_game' ? '游戏中' : '离线';

            userAvatar.src = getQQAvatarUrl(result.data.qq);
            userAvatar.style.display = 'block';
            userInfoDiv.style.display = 'flex';
            settingsBtn.style.display = 'block';
            logoutBtn.style.display = 'block';

            friendsContainer.style.display = 'block';

            if (typeof startHeartbeatTimer === 'function') {
                const interval = await window.simpmcAPI.getHeartbeatInterval();
                startHeartbeatTimer(interval);
            }

            await loadFriendsPreview(friendList, friendBadge, friendEmpty);
            friend_loading.style.display = 'none';

            const countResult = await window.simpmcAPI.getActiveRequestsCount();
            if (countResult.success && countResult.count > 0) {
                friendBadge.textContent = countResult.count;
                friendBadge.style.display = 'inline-flex';
                updateSocialBadge(countResult.count);
            } else {
                updateSocialBadge(0);
            }
        } else {
            showLoginState();
            userName.textContent = 'ERROR';
            loginBtn.style.display = 'none';
        }
    } catch (error) {
        console.error('获取用户信息失败:', error);
        showLoginState();
    }

    function showLoginState() {
        userAvatar.src = '../assets/default_avatar.jpg';
        userAvatar.style.display = 'block';
        userName.textContent = '未登录';
        userStatus.textContent = '';
        userInfoDiv.style.display = 'flex';
        loginBtn.style.display = 'block';
        updateSocialBadge(0);
    }
}

async function loadFriendsPreview(friendList, friendBadge, friendEmpty) {
    friendList.innerHTML = '';
    friendBadge.style.display = 'none';
    friendEmpty.style.display = 'none';

    const result = await window.simpmcAPI.getFriends();

    if (result.success && result.data.length > 0) {
        const previewFriends = result.data.slice(0, 5);
        previewFriends.forEach(friend => {
            const item = document.createElement('div');
            item.className = 'friend-item';
            item.innerHTML = `
                <img class="friend_avatar" src="${getQQAvatarUrl(friend.qq)}" alt="avatar">
                <div class="friend_info">
                    <span class="friend_name">${friend.username}</span>
                    <span class="friend_status ${friend.status}">${friend.status === 'online' ? '在线' : friend.status === 'in_game' ? '游戏中' : '离线'}</span>
                </div>
            `;
            friendList.appendChild(item);
        });
        if (result.data.length > 5) {
            const more = document.createElement('div');
            more.className = 'friends_more';
            more.textContent = `还有 ${result.data.length - 5} 位好友...`;
            friendList.appendChild(more);
        }
    } else {
        friendEmpty.style.display = 'block';
    }
}

window.logout = async function() {
    try {
        await window.simpmcAPI.setAuthToken(null);
        if (typeof stopHeartbeatTimer === 'function') {
            stopHeartbeatTimer();
        }
        window.location.reload();
    } catch (error) {
        console.error('退出登录失败:', error);
    }
};

async function initAccountPage() {
    const userAvatar = document.getElementById('user_avatar');
    const usernameEl = document.getElementById('username');
    const qqDisplay = document.getElementById('qq_display');
    const qqForm = document.getElementById('qqForm');
    const deleteForm = document.getElementById('deleteForm');

    const result = await window.simpmcAPI.getUserInfo();
    if (result.success) {
        usernameEl.textContent = result.data.username || '-';
        userAvatar.src = getQQAvatarUrl(result.data.qq);
        if (result.data.qq) {
            qqDisplay.textContent = 'QQ: ' + result.data.qq;
        }
    }

    qqForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const qq = document.getElementById('qq_input').value;
        const submitBtn = qqForm.querySelector('.btn-submit');
        const statusEl = document.getElementById('qq_status');

        submitBtn.disabled = true;
        submitBtn.innerText = i18n('social.submitting');

        const res = await window.simpmcAPI.setQQ(qq);
        if (res.success) {
            statusEl.className = 'status-message success';
            statusEl.textContent = i18n('social.qq_updated');
            qqDisplay.textContent = 'QQ: ' + qq;
            document.getElementById('qq_input').value = '';
        } else {
            statusEl.className = 'status-message error';
            statusEl.textContent = res.error || i18n('social.qq_update_failed');
        }

        submitBtn.disabled = false;
        submitBtn.innerText = i18n('social.save_qq');
        await sleep(3000);
        statusEl.className = 'status-message';
        statusEl.style.display = 'none';
    });

    deleteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('delete_password').value;
        const submitBtn = deleteForm.querySelector('.btn-danger');
        const statusEl = document.getElementById('delete_status');

        if (!confirm(i18n('social.delete_confirm'))) {
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerText = i18n('social.submitting');

        const res = await window.simpmcAPI.deleteAccount(password);
        if (res.success) {
            alert(i18n('social.delete_success'));
            switchPage('social');
        } else {
            statusEl.className = 'status-message error';
            statusEl.textContent = res.error || i18n('social.delete_failed');
            submitBtn.disabled = false;
            submitBtn.innerText = i18n('social.delete_account');
            await sleep(3000);
            statusEl.className = 'status-message';
            statusEl.style.display = 'none';
        }
    });
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    if (days < 7) return `${days} 天前`;
    return date.toLocaleDateString();
}

async function initFriendsPage() {
    const addFriendForm = document.getElementById('addFriendForm');
    const addStatus = document.getElementById('add_status');
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
        });
    });

    addFriendForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const usernameInput = document.getElementById('friend_username');
        const username = usernameInput.value.trim();
        const submitBtn = addFriendForm.querySelector('.add-friend-btn');
        const addStatus = document.getElementById('add_status');

        console.log('添加好友 - 输入的用户名:', username);

        if (!username) {
            addStatus.className = 'status-message error';
            addStatus.textContent = '请输入用户名';
            addStatus.style.display = 'block';
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerText = i18n('social.submitting');

        const res = await window.simpmcAPI.sendFriendRequest(username);
        console.log('添加好友 - API 响应:', res);

        if (res.success) {
            addStatus.className = 'status-message success';
            addStatus.textContent = i18n('social.request_sent');
            addStatus.style.display = 'block';
            usernameInput.value = '';
        } else {
            addStatus.className = 'status-message error';
            addStatus.textContent = res.error || i18n('social.request_failed');
            addStatus.style.display = 'block';
        }

        submitBtn.disabled = false;
        submitBtn.innerText = i18n('social.send_request');

        await loadAllFriendData();

        await sleep(3000);
        addStatus.style.display = 'none';
    });

    await loadAllFriendData();
}

async function loadAllFriendData() {
    console.log('[loadAllFriendData] 开始加载好友数据');
    
    // 等待 DOM 完全渲染
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // 调试：检查页面中的所有 tab-badge 元素
    console.log('[loadAllFriendData] 页面中所有 tab-badge 类元素:', document.querySelectorAll('.tab-badge'));
    console.log('[loadAllFriendData] page-content children:', document.getElementById('page-content')?.children);
    
    const loadingEl = document.getElementById('friends_loading');
    const receivedList = document.getElementById('received_requests_list');
    console.log('[loadAllFriendData] page-content 子元素:', document.getElementById('page-content')?.children.length);
    
    // 显示加载动画，隐藏内容
    if (loadingEl) loadingEl.style.display = 'block';
    if (receivedList) receivedList.style.display = 'none';
    
    const activeResult = await window.simpmcAPI.getActiveRequests();
    const friendsResult = await window.simpmcAPI.getFriends();
    console.log('[loadAllFriendData] activeResult:', activeResult);
    console.log('[loadAllFriendData] friendsResult:', friendsResult);

    const sentList = document.getElementById('sent_requests_list');
    const resultsList = document.getElementById('results_list');
    const friendsList = document.getElementById('friends_list');

    const receivedEmpty = document.getElementById('received_empty');
    const sentEmpty = document.getElementById('sent_empty');
    const resultsEmpty = document.getElementById('results_empty');
    const friendsEmpty = document.getElementById('friends_empty');

    const pageContent = document.getElementById('page-content');
    const tabBadgeRequests = pageContent?.querySelector('#tab-badge-requests');
    const tabBadgeSent = pageContent?.querySelector('#tab-badge-sent');
    const tabBadgeResults = pageContent?.querySelector('#tab-badge-results');
    const tabBadgeFriends = pageContent?.querySelector('#tab-badge-friends');
    console.log('[loadAllFriendData] badge 元素 (from page-content):', { tabBadgeRequests, tabBadgeSent, tabBadgeResults, tabBadgeFriends });

    receivedList.innerHTML = '';
    sentList.innerHTML = '';
    resultsList.innerHTML = '';
    friendsList.innerHTML = '';

    receivedEmpty.style.display = 'none';
    sentEmpty.style.display = 'none';
    resultsEmpty.style.display = 'none';
    friendsEmpty.style.display = 'none';

    if (activeResult.success) {
        const received = activeResult.data.filter(r => r.type === 'received_request');
        const sent = activeResult.data.filter(r => r.type === 'sent_pending');
        const results = activeResult.data.filter(r => r.type === 'request_result');

        if (received.length > 0) {
            received.forEach(req => {
                const item = createRequestItem(req, 'received');
                receivedList.appendChild(item);
            });
        } else {
            receivedEmpty.style.display = 'block';
        }

        if (sent.length > 0) {
            sent.forEach(req => {
                const item = createRequestItem(req, 'sent');
                sentList.appendChild(item);
            });
        } else {
            sentEmpty.style.display = 'block';
        }

        if (results.length > 0) {
            results.forEach(req => {
                const item = createResultItem(req);
                resultsList.appendChild(item);
            });
        } else {
            resultsEmpty.style.display = 'block';
        }
    } else {
        receivedEmpty.style.display = 'block';
        sentEmpty.style.display = 'block';
        resultsEmpty.style.display = 'block';
    }

    if (friendsResult.success && friendsResult.data.length > 0) {
        friendsResult.data.forEach(friend => {
            const item = document.createElement('div');
            item.className = 'friend-item';
            item.innerHTML = `
                <img class="friend-avatar" src="${getQQAvatarUrl(friend.qq)}" alt="avatar">
                <div class="friend-info">
                    <span class="friend-name">${friend.username}</span>
                    <span class="friend-status ${friend.status}">${friend.status === 'online' ? '在线' : friend.status === 'in_game' ? '游戏中' : '离线'}</span>
                </div>
                <button class="btn-remove" onclick="removeFriend(${friend.id})">删除</button>
            `;
            friendsList.appendChild(item);
        });
        if (friendsResult.data.length > 5) {
            const more = document.createElement('div');
            more.className = 'friends-more';
            more.textContent = `还有 ${friendsResult.data.length - 5} 位好友...`;
            friendsList.appendChild(more);
        }
        if (friendsResult.data.length > 5) {
            const more = document.createElement('div');
            more.className = 'friends-more';
            more.textContent = `还有 ${friendsResult.data.length - 5} 位好友...`;
            friendsList.appendChild(more);
        }
    } else {
        friendsEmpty.style.display = 'block';
    }

    if (activeResult.success) {
        const received = activeResult.data.filter(r => r.type === 'received_request').length;
        const sent = activeResult.data.filter(r => r.type === 'sent_pending').length;
        const results = activeResult.data.filter(r => r.type === 'request_result').length;

        console.log('[loadAllFriendData] 收到的申请数:', received);
        console.log('[loadAllFriendData] 发出的申请数:', sent);
        console.log('[loadAllFriendData] 结果通知数:', results);

        if (tabBadgeRequests) {
            if (received > 0) {
                tabBadgeRequests.textContent = received;
                tabBadgeRequests.style.display = 'inline-flex';
            } else {
                tabBadgeRequests.style.display = 'none';
            }
        }

        if (tabBadgeSent) {
            if (sent > 0) {
                tabBadgeSent.textContent = sent;
                tabBadgeSent.style.display = 'inline-flex';
            } else {
                tabBadgeSent.style.display = 'none';
            }
        }

        if (tabBadgeResults) {
            if (results > 0) {
                tabBadgeResults.textContent = results;
                tabBadgeResults.style.display = 'inline-flex';
            } else {
                tabBadgeResults.style.display = 'none';
            }
        }
    }

    console.log('[loadAllFriendData] 好友数量:', friendsResult.success ? friendsResult.data.length : 0);
    if (tabBadgeFriends) {
        if (friendsResult.success && friendsResult.data.length > 0) {
            tabBadgeFriends.textContent = friendsResult.data.length;
            tabBadgeFriends.style.display = 'inline-flex';
        } else {
            tabBadgeFriends.style.display = 'none';
        }
    }
    
    // 隐藏加载动画，显示内容
    if (loadingEl) loadingEl.style.display = 'none';
    if (receivedList) receivedList.style.display = 'block';
    console.log('[loadAllFriendData] 完成');
}

function createRequestItem(req, type) {
    const item = document.createElement('div');
    item.className = 'request-item';
    item.innerHTML = `
        <img class="request-avatar" src="../assets/default_avatar.jpg" alt="avatar">
        <div class="request-info">
            <span class="request-name">${req.peer_username}</span>
            <span class="request-time">${formatTimestamp(req.created_at)}</span>
        </div>
        ${type === 'received' ? `
        <div class="request-actions">
            <button class="btn-accept" onclick="acceptRequest(${req.id})">接受</button>
            <button class="btn-reject" onclick="rejectRequest(${req.id})">拒绝</button>
        </div>
        ` : `<span class="request-time">等待回应</span>`}
    `;
    return item;
}

function createResultItem(req) {
    const item = document.createElement('div');
    item.className = `result-item ${req.status}`;
    item.innerHTML = `
        <img class="request-avatar" src="../assets/default_avatar.jpg" alt="avatar">
        <div class="request-info">
            <span class="request-name">${req.peer_username}</span>
            <span class="request-time">${formatTimestamp(req.created_at)}</span>
        </div>
        <span class="request-time">${req.status === 'accepted' ? '已同意' : '已拒绝'}</span>
    `;
    return item;
}

window.acceptRequest = async function(requestId) {
    const result = await window.simpmcAPI.acceptFriendRequest(requestId);
    if (result.success) {
        await loadAllFriendData();
    } else {
        alert(result.error || '操作失败');
    }
};

window.rejectRequest = async function(requestId) {
    const result = await window.simpmcAPI.rejectFriendRequest(requestId);
    if (result.success) {
        await loadAllFriendData();
    } else {
        alert(result.error || '操作失败');
    }
};

window.removeFriend = async function(friendId) {
    if (!confirm('确定要删除该好友吗？')) return;
    const result = await window.simpmcAPI.removeFriend(friendId);
    if (result.success) {
        await loadAllFriendData();
    } else {
        alert(result.error || '操作失败');
    }
};