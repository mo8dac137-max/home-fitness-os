export type Language = 'en' | 'ar';

export const enDict = {
  // Navigation tabs
  'nav.home': 'Home',
  'nav.train': 'Train',
  'nav.progress': 'Progress',
  'nav.more': 'More',

  // Common & badges
  'common.mock_user_badge': 'MOCK USER',
  'common.close': 'Close',
  'common.apply': 'Apply',
  'common.reset': 'Reset',
  'common.cancel': 'Cancel',
  'common.confirm': 'Confirm',
  'common.active': 'Active',
  'common.inactive': 'Inactive',
  'common.yes': 'Yes',
  'common.no': 'No',
  'common.loading': 'Loading...',

  // Home Screen
  'home.title': 'Home',
  'home.empty_title': 'Training Horizon Ready',
  'home.empty_desc': 'Your 7-day adaptive plan is initialized. Day 0 is locked for execution and waiting for your schedule.',
  'home.stat_today': 'Today',
  'home.stat_status': 'Locked',

  // Train Screen
  'train.title': 'Train',
  'train.empty_title': 'Session Staged',
  'train.empty_desc': 'Prescription engine is active. Workout execution module will be staged in the next milestone.',
  'train.ready_badge': 'Engine Verified',

  // Progress Screen
  'progress.title': 'Progress',
  'progress.empty_title': 'Progression Ledger',
  'progress.empty_desc': 'Exposure and stimulus tracking are operational. Recorded sets will feed the progression review engine.',
  'progress.reviews_due': 'Reviews Due: 0',

  // More Screen
  'more.title': 'More',
  'more.section_general': 'General',
  'more.section_data': 'Data & State',
  'more.section_about': 'System Diagnostics',
  'more.item_settings': 'Settings',
  'more.item_data': 'Data Management',
  'more.item_about': 'About & Diagnostics',

  // Settings Screen
  'settings.title': 'Settings',
  'settings.language_label': 'Interface Language',
  'settings.language_desc': 'Select your preferred language. Supports English and Arabic (RTL).',
  'settings.en': 'English (LTR)',
  'settings.ar': 'العربية (RTL)',
  'settings.theme_label': 'Color Theme',
  'settings.theme_value': 'Deep Dark (Redmi 12 OLED/LCD)',

  // Data Screen
  'data.title': 'Data Management',
  'data.user_profile': 'Active Athlete Profile',
  'data.user_id': 'Athlete ID',
  'data.codename': 'Codename',
  'data.fitness_level': 'Baseline Fitness Level',
  'data.equipment': 'Available Equipment',
  'data.priorities': 'Physique Priorities',
  'data.export_btn': 'Export JSON',
  'data.reset_btn': 'Reset Mock Data',
  'data.reset_confirm_title': 'Reset Mock Data?',
  'data.reset_confirm_desc': 'This will purge all local IndexedDB events and re-initialize the baseline mock athlete profile and environment.',
  'data.reset_success': 'Mock athlete state and IndexedDB successfully re-initialized.',

  // About Screen (Diagnostics)
  'about.title': 'About & Diagnostics',
  'about.version': 'App Version',
  'about.commit': 'Build Commit',
  'about.online': 'Network State',
  'about.online_true': 'Online',
  'about.online_false': 'Offline (Local-First)',
  'about.standalone': 'Display Mode',
  'about.standalone_true': 'Standalone PWA',
  'about.standalone_false': 'Browser Tab',
  'about.sw_state': 'Service Worker',
  'about.storage_persisted': 'Storage Persisted',
  'about.events_count': 'Stored Event Count',
  'about.config_keys': 'Effective Settings Keys',

  // PWA Update Banner
  'update.banner_title': 'Update available',
  'update.apply_btn': 'Apply',

  // Launch intro
  'intro.skip': 'Tap anywhere to skip',
  'intro.tagline': 'Deterministic Bodyweight Engine',
};

export const arDict: Partial<typeof enDict> = {
  // Navigation tabs
  'nav.home': 'الرئيسية',
  'nav.train': 'التدريب',
  'nav.progress': 'التقدم',
  'nav.more': 'المزيد',

  // Common & badges
  'common.mock_user_badge': 'مستخدم تجريبي',
  'common.close': 'إغلاق',
  'common.apply': 'تطبيق',
  'common.reset': 'إعادة ضبط',
  'common.cancel': 'إلغاء',
  'common.confirm': 'تأكيد',
  'common.active': 'نشط',
  'common.inactive': 'غير نشط',
  'common.yes': 'نعم',
  'common.no': 'لا',
  'common.loading': 'جارٍ التحميل...',

  // Home Screen
  'home.title': 'الرئيسية',
  'home.empty_title': 'الأفق التدريبي جاهز',
  'home.empty_desc': 'تم تهيئة الخطة التكيفية لمدة 7 أيام. اليوم 0 مقفل للتنفيذ وبانتظار جدولك.',
  'home.stat_today': 'اليوم',
  'home.stat_status': 'مقفل',

  // Train Screen
  'train.title': 'التدريب',
  'train.empty_title': 'الجلسة جاهزة',
  'train.empty_desc': 'محرك الوصفات التدريبية نشط. سيتم تفعيل وحدة التمارين في المرحلة القادمة.',
  'train.ready_badge': 'المحرك جاهز',

  // Progress Screen
  'progress.title': 'التقدم',
  'progress.empty_title': 'سجل التطور والتقدم',
  'progress.empty_desc': 'تتبع الحوافز والمجموعات قيد العمل. سيتم تقييم التقدم دورياً.',
  'progress.reviews_due': 'المراجعات المستحقة: 0',

  // More Screen
  'more.title': 'المزيد',
  'more.section_general': 'عام',
  'more.section_data': 'البيانات والحالة',
  'more.section_about': 'تشخيص النظام',
  'more.item_settings': 'الإعدادات',
  'more.item_data': 'إدارة البيانات',
  'more.item_about': 'حول وتشخيص النظام',

  // Settings Screen
  'settings.title': 'الإعدادات',
  'settings.language_label': 'لغة الواجهة',
  'settings.language_desc': 'اختر لغة التطبيق المفضلة. يدعم الإنجليزية والعربية.',
  'settings.en': 'English (LTR)',
  'settings.ar': 'العربية (RTL)',

  // Data Screen
  'data.title': 'إدارة البيانات',
  'data.user_profile': 'الملف الرياضي التجريبي',
  'data.user_id': 'معرف الرياضي',
  'data.codename': 'الاسم الرمزي',
  'data.fitness_level': 'المستوى الأساسي',
  'data.equipment': 'المعدات المتاحة',
  'data.priorities': 'أولويات البنية',
  'data.export_btn': 'تصدير JSON',
  'data.reset_btn': 'إعادة ضبط البيانات',
  'data.reset_confirm_title': 'إعادة ضبط البيانات التجريبية؟',
  'data.reset_confirm_desc': 'سيؤدي هذا إلى مسح سجل IndexedDB المحلي وإعادة تهيئة الملف الرياضي التجريبي.',
  'data.reset_success': 'تمت إعادة ضبط البيانات بنجاح.',

  // About Screen
  'about.title': 'حول وتشخيص النظام',
  'about.version': 'إصدار التطبيق',
  'about.commit': 'معرف البناء',
  'about.online': 'حالة الاتصال',
  'about.online_true': 'متصل',
  'about.online_false': 'غير متصل (محلي أولاً)',
  'about.standalone': 'وضع العرض',
  'about.standalone_true': 'تطبيق مستقل (PWA)',
  'about.standalone_false': 'علامة تبويب المتصفح',
  'about.sw_state': 'عامل الخدمة (Service Worker)',
  'about.storage_persisted': 'تخزين دائم',
  'about.events_count': 'عدد الأحداث المخزنة',
  'about.config_keys': 'إعدادات المحرك النشطة',

  // Update banner
  'update.banner_title': 'تحديث متاح',
  'update.apply_btn': 'تطبيق',

  // Launch intro
  'intro.skip': 'انقر في أي مكان للتخطي',
  'intro.tagline': 'محرك التمارين الحركية الحتمي',
};

export type I18nKey = keyof typeof enDict;

let currentLanguage: Language = 'en';
const listeners = new Set<(lang: Language) => void>();

export function getLanguage(): Language {
  return currentLanguage;
}

export function setLanguage(lang: Language): void {
  currentLanguage = lang;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }
  listeners.forEach((cb) => cb(lang));
}

export function subscribeLanguage(cb: (lang: Language) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function t(key: I18nKey): string {
  if (currentLanguage === 'ar') {
    return arDict[key] ?? enDict[key] ?? key;
  }
  return enDict[key] ?? key;
}
