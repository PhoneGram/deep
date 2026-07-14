const CACHE_NAME = 'cashier-v1';

// الملفات الأساسية التي يجب تخزينها مؤقتاً
const STATIC_FILES = [
    '/',
    '/index.html',
    '/style.css',
    '/manifest.json',
    '/assets/logo.png',
    '/assets/icon-72.png',
    '/assets/icon-96.png',
    '/assets/icon-128.png',
    '/assets/icon-144.png',
    '/assets/icon-152.png',
    '/assets/icon-192.png',
    '/assets/icon-384.png',
    '/assets/icon-512.png'
];

// ملفات الصفحات التي يجب تخزينها
const PAGE_FILES = [
    '/pages/login.html',
    '/pages/dm.html',
    '/pages/dw.html'
];

// ملفات الجافاسكريبت
const JS_FILES = [
    '/js/app.js'
];

// ملفات لوحة التحكم
const ADMIN_FILES = [
    '/admin/index.html',
    '/admin/admin.js'
];

// تجميع كل الملفات
const ALL_FILES = [...STATIC_FILES, ...PAGE_FILES, ...JS_FILES, ...ADMIN_FILES];

// تثبيت Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('جاري تخزين الملفات مؤقتاً...');
                return cache.addAll(ALL_FILES);
            })
            .then(() => {
                console.log('تم تخزين جميع الملفات بنجاح');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('خطأ في التخزين المؤقت:', error);
            })
    );
});

// تنشيط Service Worker
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // حذف المخابئ القديمة
                    if (cacheName !== CACHE_NAME) {
                        console.log('جاري حذف المخبأ القديم:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
        .then(() => {
            console.log('تم تنشيط Service Worker');
            return self.clients.claim();
        })
    );
});

// استراتيجية: Cache First مع Fallback
self.addEventListener('fetch', event => {
    const requestUrl = new URL(event.request.url);

    // تجاهل طلبات التحليلات والتتبع
    if (requestUrl.pathname.includes('analytics') || 
        requestUrl.pathname.includes('tracking') ||
        requestUrl.pathname.includes('telemetry')) {
        return;
    }

    // طلبات API من Supabase - استراتيجية Network First
    if (requestUrl.hostname.includes('supabase.co')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // تخزين نسخة من الرد في المخبأ
                    if (response && response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // إذا فشل الشبكة، حاول من المخبأ
                    return caches.match(event.request)
                        .then(cachedResponse => {
                            if (cachedResponse) {
                                return cachedResponse;
                            }
                            // إذا لم يكن في المخبأ، اعرض صفحة الخطأ
                            return new Response('غير متصل بالإنترنت - يرجى التحقق من الاتصال', {
                                status: 503,
                                statusText: 'Service Unavailable'
                            });
                        });
                })
        );
        return;
    }

    // الملفات الثابتة - استراتيجية Cache First
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    // تحديث المخبأ في الخلفية للصفحات الرئيسية
                    if (event.request.mode === 'navigate' || 
                        event.request.destination === 'document') {
                        fetch(event.request)
                            .then(response => {
                                if (response && response.status === 200) {
                                    caches.open(CACHE_NAME).then(cache => {
                                        cache.put(event.request, response);
                                    });
                                }
                            })
                            .catch(() => {});
                    }
                    return cachedResponse;
                }

                // إذا لم يكن في المخبأ، قم بجلبه من الشبكة
                return fetch(event.request)
                    .then(response => {
                        // تخزين الملف الجديد في المخبأ
                        if (response && response.status === 200) {
                            const responseClone = response.clone();
                            caches.open(CACHE_NAME).then(cache => {
                                cache.put(event.request, responseClone);
                            });
                        }
                        return response;
                    })
                    .catch(() => {
                        // إذا كان طلب صفحة، اعرض صفحة عدم الاتصال
                        if (event.request.mode === 'navigate') {
                            return caches.match('/index.html');
                        }
                        return new Response('غير متصل بالإنترنت', {
                            status: 503,
                            statusText: 'Service Unavailable'
                        });
                    });
            })
    );
});

// مزامنة البيانات عندما يعود الاتصال
self.addEventListener('sync', event => {
    if (event.tag === 'sync-invoices') {
        event.waitUntil(syncPendingData());
    }
});

// معالجة الإشعارات
self.addEventListener('push', event => {
    const data = event.data.json();
    const options = {
        body: data.body,
        icon: '/assets/logo.png',
        badge: '/assets/icon-96.png',
        vibrate: [200, 100, 200],
        data: {
            url: data.url || '/'
        },
        actions: [
            {
                action: 'open',
                title: 'فتح'
            },
            {
                action: 'close',
                title: 'إغلاق'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// معالجة النقر على الإشعار
self.addEventListener('notificationclick', event => {
    event.notification.close();

    if (event.action === 'open' || event.action === '') {
        const url = event.notification.data.url || '/';
        event.waitUntil(
            clients.openWindow(url)
        );
    }
});

// تحديث المخبأ تلقائياً عند تغيير الملفات
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'CACHE_UPDATE') {
        event.waitUntil(
            caches.open(CACHE_NAME)
                .then(cache => {
                    return cache.addAll(event.data.files);
                })
        );
    }
});

// دالة لمزامنة البيانات المعلقة
async function syncPendingData() {
    try {
        // جلب البيانات المعلقة من IndexedDB
        const db = await openDB();
        const pending = await getPendingData(db);
        
        for (const item of pending) {
            try {
                await sendToServer(item);
                await markAsSynced(db, item.id);
            } catch (error) {
                console.error('فشل في مزامنة:', item, error);
            }
        }
    } catch (error) {
        console.error('خطأ في المزامنة:', error);
    }
}

// فتح IndexedDB
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('CashierDB', 1);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('pending')) {
                db.createObjectStore('pending', { keyPath: 'id', autoIncrement: true });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// جلب البيانات المعلقة
function getPendingData(db) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('pending', 'readonly');
        const store = transaction.objectStore('pending');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// إرسال للخادم
async function sendToServer(data) {
    const response = await fetch(data.url, {
        method: data.method || 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': 'YOUR_SUPABASE_ANON_KEY',
            'Authorization': 'Bearer YOUR_SUPABASE_ANON_KEY'
        },
        body: JSON.stringify(data.payload)
    });
    if (!response.ok) {
        throw new Error('فشل في الإرسال');
    }
    return response.json();
}

// تحديث حالة المزامنة
function markAsSynced(db, id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('pending', 'readwrite');
        const store = transaction.objectStore('pending');
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}