// ============================================
// ملف الجافاسكريبت الرئيسي - الدخلّ كاشير سحابي
// ============================================

// ===== إعدادات Supabase =====
const SUPABASE_URL = 'https://gkuqouklhnuulsxpdldw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrdXFvdWtsaG51dWxzeHBkbGR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTA5ODYsImV4cCI6MjA5OTU4Njk4Nn0.uDwCCVS7xGHRVDt_GHmrBorslzwyIejs95eS5rbZxBc';

// ===== تهيئة Supabase =====
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== المتغيرات العامة =====
let currentUser = null;
let currentUserType = null; // 'manager' or 'worker'
let currentManagerId = null;
let currentInvoiceItems = [];
let currentInvoiceId = null;
let currentDebtId = null;
let currentExpenseId = null;
let editingProductIndex = null;
let isDarkMode = false;
let currentLanguage = 'ar';

// ============================================
// ===== دوال المصادقة =====
// ============================================

// تسجيل الدخول
async function login(username, password) {
    try {
        // البحث عن مدير
        const { data: manager, error: managerError } = await supabaseClient
            .from('managers')
            .select('*')
            .eq('username', username)
            .eq('password', password)
            .single();

        if (manager && !managerError) {
            currentUser = manager;
            currentUserType = 'manager';
            currentManagerId = manager.id;
            
            // التحقق من صلاحية الباقة
            const subscriptionEnd = new Date(manager.subscription_end);
            const now = new Date();
            
            if (subscriptionEnd < now) {
                showSubscriptionExpired(manager.username);
                return;
            }
            
            // توجيه للوحة المدير
            window.location.href = 'pages/dm.html';
            return;
        }

        // البحث عن عامل
        const { data: worker, error: workerError } = await supabaseClient
            .from('workers')
            .select('*, managers(*)')
            .eq('username', username)
            .eq('password', password)
            .single();

        if (worker && !workerError) {
            currentUser = worker;
            currentUserType = 'worker';
            currentManagerId = worker.manager_id;
            
            // التحقق من صلاحية باقة المدير
            const { data: manager } = await supabaseClient
                .from('managers')
                .select('subscription_end')
                .eq('id', worker.manager_id)
                .single();
                
            if (manager) {
                const subscriptionEnd = new Date(manager.subscription_end);
                const now = new Date();
                
                if (subscriptionEnd < now) {
                    showSubscriptionExpiredForWorker();
                    return;
                }
            }
            
            // توجيه للوحة العامل
            window.location.href = 'pages/dw.html';
            return;
        }

        showError('اسم المستخدم أو كلمة المرور غير صحيحة');
    } catch (error) {
        console.error('خطأ في تسجيل الدخول:', error);
        showError('حدث خطأ، يرجى المحاولة مرة أخرى');
    }
}

// عرض صفحة انتهاء الباقة للمدير
function showSubscriptionExpired(username) {
    document.body.innerHTML = `
        <div style="background: #dc3545; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 20px; color: white; text-align: center;">
            <h1 style="font-size: 28px; margin-bottom: 20px;">⛔ باقتك منتهية الصلاحية</h1>
            <p style="font-size: 18px; margin-bottom: 10px;">للاشتراك، التقط صورة للشاشة واضغط على الزر في الاسفل</p>
            <div style="background: rgba(255,255,255,0.2); padding: 15px 30px; border-radius: 10px; margin: 20px 0; font-size: 20px; font-weight: bold;">
                @${username}
            </div>
            <button onclick="showContactModal('تفعيل')" style="background: white; color: #dc3545; border: none; padding: 15px 40px; border-radius: 50px; font-size: 20px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">
                🔄 تفعيل الحساب
            </button>
        </div>
    `;
}

// عرض صفحة انتهاء باقة المدير للعامل
function showSubscriptionExpiredForWorker() {
    document.body.innerHTML = `
        <div style="background: #dc3545; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 20px; color: white; text-align: center;">
            <h1 style="font-size: 28px; margin-bottom: 20px;">⛔ باقة مدير المتجر منتهية</h1>
            <p style="font-size: 18px; margin-bottom: 30px;">يرجى التواصل مع مدير المتجر لتجديد الباقة</p>
            <button onclick="showContactModal('استفسار')" style="background: white; color: #dc3545; border: none; padding: 15px 40px; border-radius: 50px; font-size: 20px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">
                📞 التواصل مع المدير
            </button>
        </div>
    `;
}

// عرض نافذة التواصل
function showContactModal(action) {
    const modal = document.getElementById('contactModal');
    if (modal) modal.classList.add('active');
}

// ============================================
// ===== دوال اللوحة الرئيسية =====
// ============================================

// تحميل بيانات اللوحة للمدير
async function loadDashboardData() {
    if (currentUserType !== 'manager') return;
    
    try {
        // جلب ايرادات اليوم
        const today = new Date().toISOString().split('T')[0];
        const { data: todayData } = await supabaseClient
            .from('daily_records')
            .select('revenue')
            .eq('manager_id', currentManagerId)
            .eq('date', today)
            .single();
            
        if (todayData) {
            document.getElementById('todayRevenue').innerHTML = 
                `${todayData.revenue || 0} <span class="stat-currency">دينار</span>`;
        }
        
        // جلب ايرادات الشهر
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        
        const { data: monthData } = await supabaseClient
            .from('daily_records')
            .select('revenue')
            .eq('manager_id', currentManagerId)
            .gte('date', startOfMonth.toISOString().split('T')[0]);
            
        if (monthData) {
            const total = monthData.reduce((sum, record) => sum + (record.revenue || 0), 0);
            document.getElementById('monthRevenue').innerHTML = 
                `${total} <span class="stat-currency">دينار</span>`;
        }
        
        // جلب المصروفات
        const { data: expensesData } = await supabaseClient
            .from('expenses')
            .select('amount')
            .eq('manager_id', currentManagerId);
            
        if (expensesData) {
            const total = expensesData.reduce((sum, exp) => sum + (exp.amount || 0), 0);
            document.getElementById('monthExpenses').innerHTML = 
                `${total} <span class="stat-currency">دينار</span>`;
        }
        
        // جلب عدد العمال
        const { data: workersData } = await supabaseClient
            .from('workers')
            .select('id')
            .eq('manager_id', currentManagerId);
            
        if (workersData) {
            const count = workersData.length;
            const label = getWorkersLabel(count);
            document.getElementById('workersCount').innerHTML = 
                `${count} <span class="stat-currency" id="workersLabel">${label}</span>`;
        }
    } catch (error) {
        console.error('خطأ في تحميل البيانات:', error);
    }
}

// الحصول على تسمية العمال حسب العدد
function getWorkersLabel(count) {
    if (count === 0) return 'عمال';
    if (count === 1) return 'عامل واحد';
    if (count === 2) return 'عاملان';
    if (count >= 3 && count <= 10) return 'عمال';
    return 'عامل';
}

// ============================================
// ===== دوال الفواتير =====
// ============================================

// بدء فاتورة جديدة
function startNewInvoice() {
    currentInvoiceItems = [];
    currentInvoiceId = null;
    document.getElementById('invoiceItemsBody').innerHTML = '';
    updateInvoiceDate();
    switchPage('page-invoice');
}

// اضافة منتج للفاتورة
function addProductToInvoice(product) {
    const item = {
        product_name: product.name || product.product_name,
        quantity: product.quantity || 1,
        unit_price: product.price || product.unit_price || 0,
        total: (product.quantity || 1) * (product.price || product.unit_price || 0),
        item_order: currentInvoiceItems.length + 1
    };
    
    currentInvoiceItems.push(item);
    renderInvoiceItems();
}

// عرض قائمة المنتجات في الفاتورة
function renderInvoiceItems() {
    const tbody = document.getElementById('invoiceItemsBody');
    tbody.innerHTML = '';
    
    currentInvoiceItems.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${item.product_name}</td>
            <td>${item.quantity}</td>
            <td>${item.unit_price}</td>
            <td>${item.total}</td>
            <td>
                <button class="btn btn-sm btn-outline" onclick="editProduct(${index})">✏️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// تعديل منتج في الفاتورة
function editProduct(index) {
    editingProductIndex = index;
    const item = currentInvoiceItems[index];
    
    document.getElementById('productModalTitle').textContent = 'تعديل المنتج';
    document.getElementById('productName').value = item.product_name;
    document.getElementById('productQuantity').value = item.quantity;
    document.getElementById('productPrice').value = item.unit_price;
    document.getElementById('productTotal').value = item.total;
    document.getElementById('deleteProductBtn').style.display = 'block';
    
    document.getElementById('productModal').classList.add('active');
}

// حفظ الفاتورة
async function saveInvoice() {
    if (currentInvoiceItems.length === 0) {
        showToast('الفاتورة فارغة، أضف منتجات أولاً', 'warning');
        return;
    }
    
    try {
        const total = currentInvoiceItems.reduce((sum, item) => sum + item.total, 0);
        
        // حفظ الفاتورة
        const { data: invoice, error } = await supabaseClient
            .from('invoices')
            .insert({
                manager_id: currentManagerId,
                worker_id: currentUserType === 'worker' ? currentUser.id : null,
                total: total,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                updated_by_worker: currentUserType === 'worker' ? currentUser.name : null
            })
            .select()
            .single();
            
        if (error) throw error;
        
        // حفظ أصناف الفاتورة
        const items = currentInvoiceItems.map((item, index) => ({
            invoice_id: invoice.id,
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.total,
            item_order: index + 1
        }));
        
        const { error: itemsError } = await supabaseClient
            .from('invoice_items')
            .insert(items);
            
        if (itemsError) throw itemsError;
        
        showToast('تم حفظ الفاتورة بنجاح ✅', 'success');
        currentInvoiceItems = [];
        renderInvoiceItems();
        switchPage('page-home');
        loadDashboardData();
    } catch (error) {
        console.error('خطأ في حفظ الفاتورة:', error);
        showToast('حدث خطأ في حفظ الفاتورة', 'error');
    }
}

// ============================================
// ===== دوال الديون =====
// ============================================

// تحميل قائمة الديون
async function loadDebts() {
    try {
        const { data: debts, error } = await supabaseClient
            .from('debts')
            .select('*')
            .eq('manager_id', currentManagerId)
            .order('total_amount', { ascending: false });
            
        if (error) throw error;
        
        const container = document.getElementById('debtsList');
        container.innerHTML = '';
        
        debts.forEach(debt => {
            const card = document.createElement('div');
            card.className = 'list-item';
            card.innerHTML = `
                <div class="left">
                    <strong>${debt.person_name}</strong>
                </div>
                <div class="right text-danger">
                    <strong>${debt.total_amount} دينار</strong>
                </div>
            `;
            card.onclick = () => showDebtDetails(debt.id);
            container.appendChild(card);
        });
    } catch (error) {
        console.error('خطأ في تحميل الديون:', error);
    }
}

// عرض تفاصيل الدين
async function showDebtDetails(debtId) {
    currentDebtId = debtId;
    
    try {
        const { data: debt } = await supabaseClient
            .from('debts')
            .select('*')
            .eq('id', debtId)
            .single();
            
        const { data: transactions } = await supabaseClient
            .from('debt_transactions')
            .select('*')
            .eq('debt_id', debtId)
            .order('created_at', { ascending: false });
            
        // عرض النافذة مع التفاصيل
        // ... (كود عرض التفاصيل)
    } catch (error) {
        console.error('خطأ:', error);
    }
}

// ============================================
// ===== دوال المصروفات =====
// ============================================

// تحميل قائمة المصروفات
async function loadExpenses() {
    try {
        const { data: expenses, error } = await supabaseClient
            .from('expenses')
            .select('*')
            .eq('manager_id', currentManagerId)
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        
        const container = document.getElementById('expensesList');
        if (!container) return;
        
        container.innerHTML = '';
        
        expenses.forEach(expense => {
            const card = document.createElement('div');
            card.className = 'list-item';
            const frequencyMap = {
                'daily': 'يومياً',
                'monthly': 'شهرياً',
                'yearly': 'سنوياً',
                'custom': 'مدة محددة'
            };
            card.innerHTML = `
                <div class="left">
                    <strong>${expense.name}</strong>
                    <small>${expense.amount} دينار</small>
                </div>
                <div class="right text-muted">
                    <small>${frequencyMap[expense.frequency] || expense.frequency}</small>
                </div>
            `;
            card.onclick = () => showExpenseDetails(expense.id);
            container.appendChild(card);
        });
    } catch (error) {
        console.error('خطأ في تحميل المصروفات:', error);
    }
}

// ============================================
// ===== دوال الحاسبة الذكية =====
// ============================================

// تحميل صور العملات
function loadCurrencyImages() {
    const grid = document.getElementById('currencyGrid');
    if (!grid) return;
    
    const currencies = [250, 500, 1000, 5000, 10000, 25000, 50000];
    grid.innerHTML = '';
    
    currencies.forEach(value => {
        const img = document.createElement('img');
        img.src = `../assets/currency/${value}.png`;
        img.alt = `${value} دينار`;
        img.className = 'currency-item';
        img.dataset.value = value;
        img.onclick = () => toggleCurrency(value);
        grid.appendChild(img);
    });
}

// اختيار عملة
let selectedCurrencies = [];

function toggleCurrency(value) {
    const index = selectedCurrencies.indexOf(value);
    if (index > -1) {
        selectedCurrencies.splice(index, 1);
    } else {
        selectedCurrencies.push(value);
    }
    
    // تحديث المظهر
    document.querySelectorAll('.currency-item').forEach(img => {
        if (selectedCurrencies.includes(parseInt(img.dataset.value))) {
            img.classList.add('selected');
        } else {
            img.classList.remove('selected');
        }
    });
}

// حساب الباقي
function calculateChange() {
    const total = parseFloat(document.getElementById('invoiceTotal').value);
    if (!total || total <= 0) {
        showToast('يرجى إدخال مبلغ الفاتورة', 'warning');
        return;
    }
    
    const paid = selectedCurrencies.reduce((sum, val) => sum + val, 0);
    if (paid < total) {
        showToast('المبلغ المدفوع أقل من قيمة الفاتورة', 'error');
        return;
    }
    
    const change = paid - total;
    document.getElementById('resultAmount').textContent = `${change} دينار`;
    
    // عرض صور العملات للباقي
    showCurrencyImages(change);
    document.getElementById('calculatorResultModal').classList.add('active');
}

// عرض صور العملات للباقي
function showCurrencyImages(amount) {
    const container = document.getElementById('resultCurrencyImages');
    container.innerHTML = '';
    
    const currencies = [50000, 25000, 10000, 5000, 1000, 500, 250];
    let remaining = amount;
    
    currencies.forEach(value => {
        while (remaining >= value) {
            const img = document.createElement('img');
            img.src = `../assets/currency/${value}.png`;
            img.alt = `${value} دينار`;
            img.className = 'result-currency-img';
            container.appendChild(img);
            remaining -= value;
        }
    });
}

// ============================================
// ===== دوال الاعدادات =====
// ============================================

// تبديل الوضع (فاتح/داكن)
function toggleTheme(theme) {
    isDarkMode = theme === 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    document.querySelectorAll('[data-theme]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });
}

// تبديل اللغة
function changeLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('language', lang);
    document.documentElement.dir = lang === 'en' ? 'ltr' : 'rtl';
    document.documentElement.lang = lang;
    
    document.querySelectorAll('[data-lang]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });
    
    // تحديث النصوص حسب اللغة (سيتم تنفيذه لاحقاً)
    updateTextsByLanguage(lang);
}

// ============================================
// ===== دوال مساعدة =====
// ============================================

// عرض رسالة خطأ
function showError(message) {
    const errorDiv = document.getElementById('loginError');
    if (errorDiv) {
        document.getElementById('errorMessage').textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => errorDiv.style.display = 'none', 5000);
    } else {
        showToast(message, 'error');
    }
}

// عرض رسالة منبثقة
function showToast(message, type = 'info') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), 3000);
}

// تبديل الصفحات
function switchPage(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    const target = document.getElementById(pageId);
    if (target) target.classList.add('active');
    
    // تحديث النافبار
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === pageId);
    });
}

// تحديث التاريخ في الفاتورة
function updateInvoiceDate() {
    const now = new Date();
    const options = { 
        year: 'numeric', 
        month: 'numeric', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    };
    const dateStr = now.toLocaleDateString('ar-IQ', options);
    document.getElementById('currentDate').textContent = dateStr;
}

// ============================================
// ===== تهيئة التطبيق =====
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    // التحقق من وجود مستخدم مسجل الدخول
    const currentPath = window.location.pathname;
    
    // إذا كنا في صفحة التثبيت
    if (currentPath === '/' || currentPath === '/index.html' || currentPath.endsWith('supermarket-cashier/')) {
        // تهيئة زر التثبيت
        let deferredPrompt;
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            document.getElementById('installBtn').style.display = 'flex';
        });
        
        document.getElementById('installBtn').addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const result = await deferredPrompt.userChoice;
                if (result.outcome === 'accepted') {
                    showToast('تم تثبيت التطبيق بنجاح 🎉', 'success');
                }
                deferredPrompt = null;
            } else {
                showToast('يرجى استخدام متصفح حديث (Chrome, Edge, Safari)', 'warning');
            }
        });
        return;
    }
    
    // إذا كنا في صفحة تسجيل الدخول
    if (currentPath.includes('login.html')) {
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            await login(username, password);
        });
        
        document.getElementById('qrBtn').addEventListener('click', () => {
            document.getElementById('qrFileInput').click();
        });
        
        document.getElementById('qrFileInput').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            // قراءة QR من الصورة (سيتم تنفيذها لاحقاً)
            showToast('جاري قراءة رمز QR...', 'info');
        });
        
        document.getElementById('registerBtn').addEventListener('click', () => {
            document.getElementById('contactModal').classList.add('active');
        });
        
        document.querySelectorAll('.platform-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const platform = btn.dataset.platform;
                // توجيه لمنصة التواصل
                const urls = {
                    facebook: 'https://facebook.com/yourpage',
                    whatsapp: 'https://wa.me/yournumber',
                    instagram: 'https://instagram.com/youraccount',
                    telegram: 'https://t.me/yourchannel',
                    tiktok: 'https://tiktok.com/@youraccount'
                };
                window.open(urls[platform], '_blank');
                document.getElementById('contactModal').classList.remove('active');
            });
        });
        
        document.getElementById('contactModalClose').addEventListener('click', () => {
            document.getElementById('contactModal').classList.remove('active');
        });
        return;
    }
    
    // إذا كنا في لوحة المدير أو العامل
    if (currentPath.includes('dm.html') || currentPath.includes('dw.html')) {
        // تحميل البيانات
        if (currentUserType === 'manager') {
            loadDashboardData();
        }
        
        // تهيئة النافبار
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const pageId = item.dataset.page;
                switchPage(pageId);
                // تحميل بيانات الصفحة حسب الحاجة
                if (pageId === 'page-home' && currentUserType === 'manager') {
                    loadDashboardData();
                }
                if (pageId === 'page-debts') {
                    loadDebts();
                }
                if (pageId === 'page-expenses' && currentUserType === 'manager') {
                    loadExpenses();
                }
            });
        });
        
        // زر فاتورة جديدة
        document.getElementById('newInvoiceBtn').addEventListener('click', startNewInvoice);
        
        // زر العودة من الفاتورة
        document.getElementById('backFromInvoice').addEventListener('click', () => {
            if (currentInvoiceItems.length > 0) {
                if (confirm('هل تريد التخلي عن الفاتورة الحالية؟')) {
                    currentInvoiceItems = [];
                    renderInvoiceItems();
                    switchPage('page-home');
                }
            } else {
                switchPage('page-home');
            }
        });
        
        // زر اضافة منتج
        document.getElementById('addProductBtn').addEventListener('click', () => {
            document.getElementById('productModalTitle').textContent = 'منتج جديد';
            document.getElementById('productName').value = '';
            document.getElementById('productQuantity').value = 1;
            document.getElementById('productPrice').value = '';
            document.getElementById('productTotal').value = '';
            document.getElementById('deleteProductBtn').style.display = 'none';
            editingProductIndex = null;
            document.getElementById('productModal').classList.add('active');
        });
        
        // حفظ المنتج
        document.getElementById('productForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('productName').value;
            const quantity = parseInt(document.getElementById('productQuantity').value);
            const price = parseFloat(document.getElementById('productPrice').value);
            const total = quantity * price;
            
            if (!name || !price) {
                showToast('يرجى إدخال اسم المنتج والسعر', 'warning');
                return;
            }
            
            const product = { name, quantity, price, total };
            
            if (editingProductIndex !== null) {
                currentInvoiceItems[editingProductIndex] = {
                    product_name: name,
                    quantity: quantity,
                    unit_price: price,
                    total: total,
                    item_order: editingProductIndex + 1
                };
                editingProductIndex = null;
            } else {
                addProductToInvoice(product);
            }
            
            document.getElementById('productModal').classList.remove('active');
            renderInvoiceItems();
        });
        
        // حذف المنتج
        document.getElementById('deleteProductBtn').addEventListener('click', () => {
            if (editingProductIndex !== null) {
                if (confirm('هل تريد حذف هذا المنتج؟')) {
                    currentInvoiceItems.splice(editingProductIndex, 1);
                    currentInvoiceItems.forEach((item, index) => item.item_order = index + 1);
                    renderInvoiceItems();
                    document.getElementById('productModal').classList.remove('active');
                    editingProductIndex = null;
                    showToast('تم حذف المنتج', 'success');
                }
            }
        });
        
        // حفظ الفاتورة
        document.getElementById('saveInvoice').addEventListener('click', saveInvoice);
        
        // زر حفظ كصورة
        document.getElementById('saveInvoiceImage').addEventListener('click', () => {
            // سيتم تنفيذها لاحقاً باستخدام html2canvas
            showToast('جاري حفظ الصورة...', 'info');
        });
        
        // زر الطباعة
        document.getElementById('printInvoice').addEventListener('click', () => {
            // سيتم تنفيذها لاحقاً
            showToast('جاري الطباعة...', 'info');
        });
        
        // زر أحدث الفواتير
        document.getElementById('recentInvoicesBtn').addEventListener('click', () => {
            switchPage('page-recent');
            loadRecentInvoices();
        });
        
        // زر الاحصائيات (للمدير فقط)
        if (document.getElementById('statisticsBtn')) {
            document.getElementById('statisticsBtn').addEventListener('click', () => {
                switchPage('page-statistics');
            });
        }
        
        // زر تحديد المدة للاحصائيات
        document.getElementById('selectPeriodBtn').addEventListener('click', () => {
            document.getElementById('periodModal').classList.add('active');
        });
        
        // أزرار المدة
        document.querySelectorAll('.period-options .btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const period = btn.dataset.period;
                if (period === 'custom') {
                    document.getElementById('customPeriodFields').style.display = 'block';
                } else {
                    document.getElementById('customPeriodFields').style.display = 'none';
                    generateReport(period);
                    document.getElementById('periodModal').classList.remove('active');
                }
            });
        });
        
        // زر تحميل التقرير
        document.getElementById('downloadReportBtn').addEventListener('click', () => {
            const from = document.getElementById('periodFrom').value;
            const to = document.getElementById('periodTo').value;
            if (!from || !to) {
                showToast('يرجى اختيار تاريخ البداية والنهاية', 'warning');
                return;
            }
            generateReport('custom', from, to);
            document.getElementById('periodModal').classList.remove('active');
        });
        
        // زر الحاسبة الذكية
        loadCurrencyImages();
        document.getElementById('calculateBtn').addEventListener('click', calculateChange);
        document.getElementById('resetCalculator').addEventListener('click', () => {
            selectedCurrencies = [];
            document.querySelectorAll('.currency-item').forEach(img => img.classList.remove('selected'));
            document.getElementById('invoiceTotal').value = '';
            showToast('تم إعادة تعيين الحاسبة', 'info');
        });
        document.getElementById('calculatorResultDone').addEventListener('click', () => {
            document.getElementById('calculatorResultModal').classList.remove('active');
        });
        
        // زر الديون
        document.getElementById('newDebtBtn').addEventListener('click', () => {
            document.getElementById('debtModalTitle').textContent = 'دين جديد';
            document.getElementById('debtPersonName').value = '';
            document.getElementById('debtAmount').value = '';
            document.getElementById('debtModal').classList.add('active');
        });
        
        document.getElementById('debtForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('debtPersonName').value;
            const amount = parseFloat(document.getElementById('debtAmount').value);
            
            if (!name || !amount) {
                showToast('يرجى إدخال الاسم والمبلغ', 'warning');
                return;
            }
            
            try {
                const { data, error } = await supabaseClient
                    .from('debts')
                    .insert({
                        manager_id: currentManagerId,
                        person_name: name,
                        total_amount: amount
                    })
                    .select()
                    .single();
                    
                if (error) throw error;
                
                // اضافة حركة دين
                await supabaseClient
                    .from('debt_transactions')
                    .insert({
                        debt_id: data.id,
                        amount: amount,
                        type: 'debt',
                        notes: 'دين جديد'
                    });
                    
                showToast('تم اضافة الدين بنجاح ✅', 'success');
                document.getElementById('debtModal').classList.remove('active');
                loadDebts();
            } catch (error) {
                console.error('خطأ:', error);
                showToast('حدث خطأ في اضافة الدين', 'error');
            }
        });
        
        // زر المصروفات (للمدير فقط)
        if (document.getElementById('newExpenseBtn')) {
            document.getElementById('newExpenseBtn').addEventListener('click', () => {
                document.getElementById('expenseModalTitle').textContent = 'مصروف جديد';
                document.getElementById('expenseName').value = '';
                document.getElementById('expenseAmount').value = '';
                document.getElementById('expenseFrequency').value = 'daily';
                document.getElementById('customDateFields').style.display = 'none';
                document.getElementById('expenseModal').classList.add('active');
            });
            
            document.getElementById('expenseFrequency').addEventListener('change', (e) => {
                document.getElementById('customDateFields').style.display = 
                    e.target.value === 'custom' ? 'block' : 'none';
            });
            
            document.getElementById('expenseForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('expenseName').value;
                const amount = parseFloat(document.getElementById('expenseAmount').value);
                const frequency = document.getElementById('expenseFrequency').value;
                
                if (!name || !amount) {
                    showToast('يرجى إدخال الاسم والمبلغ', 'warning');
                    return;
                }
                
                try {
                    const expenseData = {
                        manager_id: currentManagerId,
                        name: name,
                        amount: amount,
                        frequency: frequency,
                        start_date: new Date().toISOString().split('T')[0]
                    };
                    
                    if (frequency === 'custom') {
                        expenseData.start_date = document.getElementById('expenseStartDate').value;
                        expenseData.end_date = document.getElementById('expenseEndDate').value;
                    }
                    
                    const { error } = await supabaseClient
                        .from('expenses')
                        .insert(expenseData);
                        
                    if (error) throw error;
                    
                    showToast('تم اضافة المصروف بنجاح ✅', 'success');
                    document.getElementById('expenseModal').classList.remove('active');
                    loadExpenses();
                } catch (error) {
                    console.error('خطأ:', error);
                    showToast('حدث خطأ في اضافة المصروف', 'error');
                }
            });
        }
        
        // زر المخزن
        document.getElementById('productsBtn').addEventListener('click', () => {
            document.getElementById('productInventoryModal').classList.add('active');
        });
        
        // حفظ منتج المخزن
        document.getElementById('productInventoryForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('productInventoryName').value;
            const price = parseFloat(document.getElementById('productInventoryPrice').value);
            const barcode = document.getElementById('productBarcode').value;
            
            if (!name || !price) {
                showToast('يرجى إدخال اسم المنتج والسعر', 'warning');
                return;
            }
            
            try {
                const { error } = await supabaseClient
                    .from('products')
                    .insert({
                        manager_id: currentManagerId,
                        name: name,
                        price: price,
                        barcode: barcode || null
                    });
                    
                if (error) throw error;
                
                showToast('تم اضافة المنتج للمخزن ✅', 'success');
                document.getElementById('productInventoryModal').classList.remove('active');
                document.getElementById('productInventoryForm').reset();
            } catch (error) {
                console.error('خطأ:', error);
                showToast('حدث خطأ في اضافة المنتج', 'error');
            }
        });
        
        // زر العمال (للمدير فقط)
        if (document.getElementById('workersBtn')) {
            document.getElementById('workersBtn').addEventListener('click', () => {
                document.getElementById('workerModal').classList.add('active');
            });
            
            document.getElementById('workerForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('workerName').value;
                const username = document.getElementById('workerUsername').value;
                const password = document.getElementById('workerPassword').value;
                
                if (!name || !username || !password) {
                    showToast('يرجى ملء جميع الحقول', 'warning');
                    return;
                }
                
                try {
                    const { error } = await supabaseClient
                        .from('workers')
                        .insert({
                            manager_id: currentManagerId,
                            name: name,
                            username: username,
                            password: password
                        });
                        
                    if (error) throw error;
                    
                    showToast('تم انشاء حساب العامل ✅', 'success');
                    document.getElementById('workerModal').classList.remove('active');
                    document.getElementById('workerForm').reset();
                    loadDashboardData();
                } catch (error) {
                    console.error('خطأ:', error);
                    showToast('حدث خطأ في انشاء الحساب', 'error');
                }
            });
        }
        
        // زر الدعم الفني
        document.getElementById('supportBtn').addEventListener('click', () => {
            document.getElementById('supportModal').classList.add('active');
        });
        
        document.querySelectorAll('#supportModal .platform-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const platform = btn.dataset.platform;
                const urls = {
                    facebook: 'https://facebook.com/yourpage',
                    whatsapp: 'https://wa.me/yournumber',
                    instagram: 'https://instagram.com/youraccount',
                    telegram: 'https://t.me/yourchannel',
                    tiktok: 'https://tiktok.com/@youraccount'
                };
                window.open(urls[platform], '_blank');
                document.getElementById('supportModal').classList.remove('active');
            });
        });
        
        document.getElementById('supportModalClose').addEventListener('click', () => {
            document.getElementById('supportModal').classList.remove('active');
        });
        
        // زر تسجيل الخروج
        document.getElementById('logoutBtn').addEventListener('click', () => {
            if (confirm('هل تريد تسجيل الخروج؟')) {
                currentUser = null;
                currentUserType = null;
                window.location.href = '../pages/login.html';
            }
        });
        
        // اعدادات اللغة والوضع
        document.querySelectorAll('[data-theme]').forEach(btn => {
            btn.addEventListener('click', () => {
                toggleTheme(btn.dataset.theme);
            });
        });
        
        document.querySelectorAll('[data-lang]').forEach(btn => {
            btn.addEventListener('click', () => {
                changeLanguage(btn.dataset.lang);
            });
        });
        
        // استعادة الاعدادات المحفوظة
        const savedTheme = localStorage.getItem('theme') || 'light';
        toggleTheme(savedTheme);
        
        const savedLang = localStorage.getItem('language') || 'ar';
        changeLanguage(savedLang);
        
        // تحميل الديون والمصروفات
        loadDebts();
        if (currentUserType === 'manager') {
            loadExpenses();
        }
    }
});

// ============================================
// ===== دوال إضافية =====
// ============================================

// تحميل أحدث الفواتير
async function loadRecentInvoices() {
    try {
        const { data: invoices, error } = await supabaseClient
            .from('invoices')
            .select('*, invoice_items(*)')
            .eq('manager_id', currentManagerId)
            .order('created_at', { ascending: false })
            .limit(20);
            
        if (error) throw error;
        
        const container = document.getElementById('invoicesList');
        container.innerHTML = '';
        
        invoices.forEach(invoice => {
            const card = document.createElement('div');
            card.className = 'card mb-10';
            const date = new Date(invoice.created_at).toLocaleDateString('ar-IQ');
            card.innerHTML = `
                <div class="flex-between">
                    <div>
                        <strong>فاتورة #${invoice.id.slice(0, 6)}</strong>
                        <div class="text-muted">${date}</div>
                    </div>
                    <div class="text-primary">${invoice.total} دينار</div>
                </div>
                <div class="text-muted mt-10" style="font-size: 14px;">
                    ${invoice.invoice_items?.length || 0} منتج
                    ${invoice.updated_by_worker ? `🟡 تم تعديلها بواسطة ${invoice.updated_by_worker}` : ''}
                </div>
            `;
            card.onclick = () => showInvoiceDetails(invoice.id);
            container.appendChild(card);
        });
    } catch (error) {
        console.error('خطأ في تحميل الفواتير:', error);
        showToast('حدث خطأ في تحميل الفواتير', 'error');
    }
}

// عرض تفاصيل الفاتورة
async function showInvoiceDetails(invoiceId) {
    try {
        const { data: invoice, error } = await supabaseClient
            .from('invoices')
            .select('*, invoice_items(*)')
            .eq('id', invoiceId)
            .single();
            
        if (error) throw error;
        
        // عرض النافذة مع التفاصيل
        // سيتم تنفيذها لاحقاً
        showToast('جاري عرض تفاصيل الفاتورة...', 'info');
    } catch (error) {
        console.error('خطأ:', error);
        showToast('حدث خطأ في عرض التفاصيل', 'error');
    }
}

// توليد تقرير الاحصائيات
async function generateReport(period, from, to) {
    try {
        let query = supabaseClient
            .from('daily_records')
            .select('*')
            .eq('manager_id', currentManagerId);
            
        if (period === 'today') {
            const today = new Date().toISOString().split('T')[0];
            query = query.eq('date', today);
        } else if (period === 'month') {
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            query = query.gte('date', startOfMonth.toISOString().split('T')[0]);
        } else if (period === 'year') {
            const startOfYear = new Date();
            startOfYear.setMonth(0, 1);
            query = query.gte('date', startOfYear.toISOString().split('T')[0]);
        } else if (period === 'custom' && from && to) {
            query = query.gte('date', from).lte('date', to);
        }
        
        const { data, error } = await query.order('date', { ascending: true });
        if (error) throw error;
        
        // توليد ملف PDF (سيتم تنفيذها لاحقاً باستخدام jsPDF)
        showToast('جاري تحميل ملف PDF...', 'info');
        // تنفيذ التحميل لاحقاً
    } catch (error) {
        console.error('خطأ في توليد التقرير:', error);
        showToast('حدث خطأ في توليد التقرير', 'error');
    }
}

// تحديث النصوص حسب اللغة
function updateTextsByLanguage(lang) {
    // سيتم تنفيذها لاحقاً مع ملف الترجمة
}

// ============================================
// ===== تصدير الدوال للاستخدام في HTML =====
// ============================================
window.showContactModal = showContactModal;
window.addProductToInvoice = addProductToInvoice;
window.editProduct = editProduct;
window.toggleCurrency = toggleCurrency;
window.calculateChange = calculateChange;
window.showCurrencyImages = showCurrencyImages;
window.startNewInvoice = startNewInvoice;
window.saveInvoice = saveInvoice;
window.loadDebts = loadDebts;
window.loadExpenses = loadExpenses;
window.loadDashboardData = loadDashboardData;
window.loadRecentInvoices = loadRecentInvoices;
window.switchPage = switchPage;
window.showToast = showToast;
window.toggleTheme = toggleTheme;
window.changeLanguage = changeLanguage;
window.generateReport = generateReport;
window.showInvoiceDetails = showInvoiceDetails;

console.log('✅ تم تحميل التطبيق بنجاح');