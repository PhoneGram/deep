// ============================================
// ملف لوحة المشرف - admin.js
// ============================================

// ===== المتغيرات العامة =====
let currentAdmin = null;
let selectedManagerId = null;
let isAdminLoggedIn = false;

// ===== تسجيل الدخول للمشرف =====
document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const password = document.getElementById('adminPassword').value;
    
    if (!password) {
        showAdminError('يرجى إدخال كلمة المرور');
        return;
    }
    
    try {
        // التحقق من كلمة المرور من قاعدة البيانات
        const { data, error } = await supabaseClient
            .from('admin')
            .select('password')
            .single();
            
        if (error) throw error;
        
        if (data.password === password) {
            isAdminLoggedIn = true;
            document.getElementById('adminLogin').classList.remove('active');
            document.getElementById('adminDashboard').classList.add('active');
            document.getElementById('adminLoginError').style.display = 'none';
            showToast('✅ تم تسجيل الدخول بنجاح', 'success');
        } else {
            showAdminError('كلمة المرور غير صحيحة');
        }
    } catch (error) {
        console.error('خطأ في التحقق:', error);
        showAdminError('حدث خطأ، يرجى المحاولة مرة أخرى');
    }
});

// ===== إظهار وإخفاء الأقسام =====
document.getElementById('viewAccountsBtn').addEventListener('click', () => {
    const section = document.getElementById('accountsSection');
    if (section.style.display === 'none') {
        section.style.display = 'block';
        document.getElementById('generateSection').style.display = 'none';
        loadAccounts();
    } else {
        section.style.display = 'none';
    }
});

document.getElementById('hideAccountsBtn').addEventListener('click', () => {
    document.getElementById('accountsSection').style.display = 'none';
});

document.getElementById('generateAccountBtn').addEventListener('click', () => {
    const section = document.getElementById('generateSection');
    if (section.style.display === 'none') {
        section.style.display = 'block';
        document.getElementById('accountsSection').style.display = 'none';
        // تنظيف النموذج
        document.getElementById('genName').value = '';
        document.getElementById('genUsername').value = '';
        document.getElementById('genPassword').value = '';
    } else {
        section.style.display = 'none';
    }
});

document.getElementById('hideGenerateBtn').addEventListener('click', () => {
    document.getElementById('generateSection').style.display = 'none';
});

// ===== تحميل قائمة الحسابات =====
async function loadAccounts() {
    const container = document.getElementById('accountsList');
    container.innerHTML = '<div class="loading"><div class="spinner"></div>جاري تحميل الحسابات...</div>';
    
    try {
        const { data: managers, error } = await supabaseClient
            .from('managers')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        
        if (!managers || managers.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted" style="padding: 40px;">
                    <p style="font-size: 48px; margin-bottom: 10px;">📭</p>
                    <p>لا يوجد مديرين حتى الآن</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = '';
        
        managers.forEach(manager => {
            const now = new Date();
            const expiry = new Date(manager.subscription_end);
            const isActive = expiry > now;
            
            const card = document.createElement('div');
            card.className = 'account-card';
            card.style.borderRightColor = isActive ? '#28a745' : '#dc3545';
            
            card.innerHTML = `
                <div class="header">
                    <div class="name">${manager.name}</div>
                    <div class="status ${isActive ? 'active' : 'expired'}">
                        ${isActive ? '✅ مفعل' : '❌ منتهي'}
                    </div>
                </div>
                <div class="details">
                    <div><strong>اسم المستخدم:</strong> ${manager.username}</div>
                    <div><strong>تاريخ الانتهاء:</strong> ${new Date(manager.subscription_end).toLocaleDateString('ar-IQ')}</div>
                </div>
                <div class="actions">
                    <button class="btn btn-primary btn-sm" onclick="showAccountDetails('${manager.id}')">
                        📋 تفاصيل
                    </button>
                    ${!isActive ? `
                        <button class="btn btn-success btn-sm" onclick="renewPackage('${manager.id}')">
                            🔄 تفعيل الباقة
                        </button>
                    ` : ''}
                </div>
            `;
            
            container.appendChild(card);
        });
    } catch (error) {
        console.error('خطأ في تحميل الحسابات:', error);
        container.innerHTML = `
            <div class="text-center text-danger" style="padding: 20px;">
                ⚠️ حدث خطأ في تحميل الحسابات
            </div>
        `;
    }
}

// ===== عرض تفاصيل الحساب =====
async function showAccountDetails(managerId) {
    selectedManagerId = managerId;
    
    try {
        const { data: manager, error } = await supabaseClient
            .from('managers')
            .select('*')
            .eq('id', managerId)
            .single();
            
        if (error) throw error;
        
        // عرض المعلومات
        document.getElementById('accountDetailsName').textContent = `📋 ${manager.name}`;
        document.getElementById('detailUsername').textContent = manager.username;
        document.getElementById('detailPassword').textContent = manager.password;
        
        const now = new Date();
        const expiry = new Date(manager.subscription_end);
        const isActive = expiry > now;
        
        document.getElementById('detailStatus').innerHTML = isActive 
            ? '<span style="color: #28a745;">✅ مفعل</span>' 
            : '<span style="color: #dc3545;">❌ منتهي</span>';
        document.getElementById('detailExpiry').textContent = expiry.toLocaleDateString('ar-IQ');
        
        // إظهار النافذة
        document.getElementById('accountDetailsModal').classList.add('active');
        document.getElementById('workersListContainer').style.display = 'none';
        
        // تحميل العمال
        await loadWorkersForManager(managerId);
        
    } catch (error) {
        console.error('خطأ:', error);
        showToast('حدث خطأ في تحميل التفاصيل', 'error');
    }
}

// ===== تحميل عمال المدير =====
async function loadWorkersForManager(managerId) {
    try {
        const { data: workers, error } = await supabaseClient
            .from('workers')
            .select('*')
            .eq('manager_id', managerId)
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        
        const container = document.getElementById('workersListDetails');
        container.innerHTML = '';
        
        if (!workers || workers.length === 0) {
            container.innerHTML = '<p class="text-muted">لا يوجد عمال لهذا المتجر</p>';
            return;
        }
        
        workers.forEach(worker => {
            const div = document.createElement('div');
            div.className = 'worker-item';
            div.innerHTML = `
                <div>
                    <strong>${worker.name}</strong>
                    <div style="font-size: 13px; color: var(--text-secondary);">@${worker.username}</div>
                </div>
                <button class="btn btn-primary btn-sm" onclick="showWorkerDetails('${worker.id}')">
                    📋 تفاصيل
                </button>
            `;
            container.appendChild(div);
        });
    } catch (error) {
        console.error('خطأ في تحميل العمال:', error);
    }
}

// ===== عرض تفاصيل العامل =====
async function showWorkerDetails(workerId) {
    try {
        const { data: worker, error } = await supabaseClient
            .from('workers')
            .select('*')
            .eq('id', workerId)
            .single();
            
        if (error) throw error;
        
        // عرض نافذة منبثقة بتفاصيل العامل
        alert(
            `👤 العامل: ${worker.name}\n` +
            `📝 اسم المستخدم: ${worker.username}\n` +
            `🔑 كلمة المرور: ${worker.password}`
        );
    } catch (error) {
        console.error('خطأ:', error);
        showToast('حدث خطأ', 'error');
    }
}

// ===== زر عرض العمال =====
document.getElementById('viewWorkersBtn').addEventListener('click', () => {
    const container = document.getElementById('workersListContainer');
    if (container.style.display === 'none') {
        container.style.display = 'block';
    } else {
        container.style.display = 'none';
    }
});

// ===== إغلاق نافذة التفاصيل =====
document.getElementById('accountDetailsClose').addEventListener('click', () => {
    document.getElementById('accountDetailsModal').classList.remove('active');
});

// ===== تحميل كود QR =====
document.getElementById('downloadQrBtn').addEventListener('click', async () => {
    if (!selectedManagerId) {
        showToast('يرجى اختيار مدير أولاً', 'warning');
        return;
    }
    
    try {
        // جلب بيانات المدير
        const { data: manager, error } = await supabaseClient
            .from('managers')
            .select('username, password')
            .eq('id', selectedManagerId)
            .single();
            
        if (error) throw error;
        
        // توليد نص مشفر للـ QR
        const qrData = btoa(JSON.stringify({
            username: manager.username,
            password: manager.password,
            type: 'manager'
        }));
        
        // إنشاء QR Code باستخدام مكتبة خارجية
        // هنا سنستخدم API خارجي لتوليد QR
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;
        
        // تحميل الصورة
        const link = document.createElement('a');
        link.href = qrUrl;
        link.download = `QR-${manager.username}.png`;
        link.click();
        
        showToast('✅ تم تحميل كود QR', 'success');
    } catch (error) {
        console.error('خطأ:', error);
        showToast('حدث خطأ في توليد QR', 'error');
    }
});

// ===== تجديد الباقة =====
document.getElementById('renewPackageBtn').addEventListener('click', () => {
    if (!selectedManagerId) return;
    document.getElementById('renewModal').classList.add('active');
});

// ===== اختيار مدة التجديد =====
document.querySelectorAll('#renewOptions .btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        const months = parseInt(btn.dataset.months);
        await renewPackageWithMonths(selectedManagerId, months);
        document.getElementById('renewModal').classList.remove('active');
    });
});

// ===== إلغاء التجديد =====
document.getElementById('cancelRenewBtn').addEventListener('click', () => {
    document.getElementById('renewModal').classList.remove('active');
});

document.getElementById('renewModalClose').addEventListener('click', () => {
    document.getElementById('renewModal').classList.remove('active');
});

// ===== دالة تجديد الباقة =====
async function renewPackageWithMonths(managerId, months) {
    try {
        // جلب التاريخ الحالي
        const now = new Date();
        const newExpiry = new Date(now);
        newExpiry.setMonth(newExpiry.getMonth() + months);
        
        // تحديث تاريخ انتهاء الباقة
        const { error } = await supabaseClient
            .from('managers')
            .update({ subscription_end: newExpiry.toISOString().split('T')[0] })
            .eq('id', managerId);
            
        if (error) throw error;
        
        showToast(`✅ تم تجديد الباقة لـ ${months} شهر`, 'success');
        
        // إعادة تحميل الحسابات
        loadAccounts();
        
        // تحديث التفاصيل إذا كانت النافذة مفتوحة
        if (document.getElementById('accountDetailsModal').classList.contains('active')) {
            showAccountDetails(managerId);
        }
    } catch (error) {
        console.error('خطأ في التجديد:', error);
        showToast('حدث خطأ في تجديد الباقة', 'error');
    }
}

// ===== دالة تجديد الباقة من الزر في البطاقة =====
window.renewPackage = function(managerId) {
    selectedManagerId = managerId;
    document.getElementById('renewModal').classList.add('active');
};

// ===== توليد حساب جديد =====
document.getElementById('generateAccountForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('genName').value;
    const username = document.getElementById('genUsername').value;
    const password = document.getElementById('genPassword').value;
    
    if (!name || !username || !password) {
        showToast('يرجى ملء جميع الحقول', 'warning');
        return;
    }
    
    try {
        // التحقق من عدم وجود اسم مستخدم مكرر
        const { data: existing, error: checkError } = await supabaseClient
            .from('managers')
            .select('username')
            .eq('username', username)
            .single();
            
        if (existing) {
            showToast('اسم المستخدم موجود مسبقاً', 'error');
            return;
        }
        
        // إنشاء حساب جديد
        const { data, error } = await supabaseClient
            .from('managers')
            .insert({
                name: name,
                username: username,
                password: password,
                subscription_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 30 يوم
            })
            .select()
            .single();
            
        if (error) throw error;
        
        showToast('✅ تم إنشاء الحساب بنجاح', 'success');
        
        // تنظيف النموذج
        document.getElementById('genName').value = '';
        document.getElementById('genUsername').value = '';
        document.getElementById('genPassword').value = '';
        
        // إخفاء قسم التوليد
        document.getElementById('generateSection').style.display = 'none';
        
        // تحديث قائمة الحسابات
        loadAccounts();
    } catch (error) {
        console.error('خطأ في إنشاء الحساب:', error);
        showToast('حدث خطأ في إنشاء الحساب', 'error');
    }
});

// ===== دوال مساعدة =====
function showAdminError(message) {
    const errorDiv = document.getElementById('adminLoginError');
    document.getElementById('adminErrorMessage').textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => errorDiv.style.display = 'none', 5000);
}

// ===== تهيئة الصفحة =====
document.addEventListener('DOMContentLoaded', function() {
    // إذا كان المشرف مسجل دخول بالفعل
    if (isAdminLoggedIn) {
        document.getElementById('adminLogin').classList.remove('active');
        document.getElementById('adminDashboard').classList.add('active');
        loadAccounts();
    }
});

// ===== تصدير الدوال =====
window.showAccountDetails = showAccountDetails;
window.showWorkerDetails = showWorkerDetails;
window.renewPackage = renewPackage;
window.loadAccounts = loadAccounts;

console.log('✅ تم تحميل لوحة المشرف بنجاح');