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
  'common.mock_tag': 'MOCK',
  'common.estimate': 'Estimate',

  // Home Screen
  'home.title': 'Home',
  'home.welcome_athlete': 'Welcome athlete',
  'home.week_1': 'Week 1',
  'home.today_day_0': 'Today (Day 0)',
  'home.session_title': 'Upper push (Unit A)',
  'home.session_duration': '38 min',
  'home.exercises_count': '6 exercises',
  'home.working_sets': '18 working sets',
  'home.rpe_target': 'RPE 7-8',
  'home.muscle_chest': 'Chest',
  'home.muscle_shoulders': 'Shoulders',
  'home.muscle_triceps': 'Triceps',
  'home.muscle_core': 'Core',
  'home.muscle_back': 'Back',
  'home.muscle_quads': 'Quads',
  'home.muscle_hamstrings': 'Hamstrings',
  'home.start_workout': 'Start workout',
  'home.horizon_title': '7-day horizon',
  'home.consistency_title': 'Consistency',
  'home.consistency_sub': '3 of 4 sessions done',
  'home.readiness_title': 'Readiness',
  'home.no_checkin_yet': 'No check-in yet',
  'home.add_checkin': 'Check-in',
  'home.exposure_title': 'Muscle stimulus exposure',
  'home.exposure_desc': 'Trailing 7-day volume • Collecting data',
  'home.coach_inbox': 'Coach inbox',
  'home.coach_inbox_desc': 'No suggestions yet. The engine is monitoring execution quality.',
  'home.empty_title': 'Training horizon ready',
  'home.empty_desc': 'Your 7-day adaptive plan is initialized. Day 0 is locked for execution and waiting for your schedule.',
  'home.stat_today': 'Today',
  'home.stat_status': 'Locked',

  // Train Screen
  'train.title': 'Train',
  'train.ready_badge': 'Engine verified',
  'train.segment_plan': "Today's plan",
  'train.segment_library': 'Exercise library',
  'train.session_blueprint': 'Session blueprint',
  'train.session_unit': 'Upper push (Unit A)',
  'train.session_duration': '38 min',
  'train.start_workout': 'Start workout',
  'train.search_placeholder': 'Search exercise by name...',
  'train.all_patterns': 'All patterns',
  'train.exercises_header': 'Exercises',
  'train.level_label': 'Level',
  'train.locked': 'Locked',
  'train.bodyweight': 'bodyweight',
  'train.empty_title': 'Session staged',
  'train.empty_desc': 'Prescription engine is active. Workout execution module will be staged in the next milestone.',

  // Progress Screen
  'progress.title': 'Progress',
  'progress.reviews_due': 'Reviews due: 0',
  'progress.engine_badge': 'Progression engine',
  'progress.mastery_score': 'Mastery score',
  'progress.baseline_title': 'Level 3 baseline',
  'progress.mastery_desc': 'Standard push-up and plank progression criteria tracked across your last 6 sessions.',
  'progress.rep_targets_hit': 'Rep targets hit',
  'progress.rep_targets_value': '10 / 10 reps',
  'progress.avg_effort_rpe': 'Average effort (RPE)',
  'progress.avg_effort_value': '7.5 RPE',
  'progress.exposure_14d': 'Movement exposure (14d)',
  'progress.collecting_data': 'Collecting data',
  'progress.exposures_count': 'exposures',
  'progress.empty_title': 'Collecting data',
  'progress.empty_desc': 'Exposure and stimulus tracking are operational. The engine requires at least 3 completed workouts before offering progression recommendations.',

  // More Screen
  'more.title': 'More',
  'more.section_general': 'General',
  'more.section_data': 'Data & State',
  'more.section_about': 'System Diagnostics',
  'more.item_settings': 'Settings',
  'more.item_settings_desc': 'Language and display preferences',
  'more.item_appearance': 'Appearance',
  'more.item_appearance_desc': 'Colors, clay depth, radius, and density',
  'more.item_equipment': 'Equipment & environment',
  'more.item_equipment_desc': 'Check your training setup',
  'more.item_data': 'Data management',
  'more.item_data_desc': 'Export JSON & reset local storage',
  'more.item_about': 'System diagnostics',
  'more.item_about_desc': 'Diagnostics & PWA update check',

  // Settings Screen
  'settings.title': 'Settings',
  'settings.language_label': 'Interface language',
  'settings.language_desc': 'Select your preferred language. Supports English and Arabic (RTL).',
  'settings.en': 'English (LTR)',
  'settings.ar': 'العربية (RTL)',
  'settings.theme_label': 'Color theme',
  'settings.theme_value': 'Deep dark (Redmi 12 OLED/LCD)',

  // Equipment Screen
  'equipment.title': 'Equipment & environment',
  'equipment.section_title': 'Declared environment items',
  'equipment.desc': 'Items require verification before compound exercise assignment.',
  'equipment.floor': 'Clear floor area',
  'equipment.wall': 'Solid wall space',
  'equipment.door': 'Sturdy interior door',
  'equipment.chair': 'Stable chair / bench',
  'equipment.table': 'Heavy table',

  // Appearance Lab Screen
  'appearance.title': 'Appearance lab',
  'appearance.preview_title': 'Live preview',
  'appearance.preview_card_title': 'Upper push (Unit A)',
  'appearance.preview_button': 'Sample action',
  'appearance.preview_ring_label': 'Mastery',
  'appearance.preview_bar_label': 'Chest stimulus',
  'appearance.accent_label': 'Accent color',
  'appearance.accent_lime': 'Lime',
  'appearance.accent_cyan': 'Cyan',
  'appearance.accent_coral': 'Coral',
  'appearance.accent_violet': 'Violet',
  'appearance.accent_amber': 'Amber',
  'appearance.accent_mint': 'Mint',
  'appearance.depth_label': 'Clay depth',
  'appearance.depth_soft': 'Soft (0.6x)',
  'appearance.depth_medium': 'Medium (1.0x)',
  'appearance.depth_strong': 'Strong (1.4x)',
  'appearance.radius_label': 'Corner radius',
  'appearance.radius_compact': 'Compact (20px)',
  'appearance.radius_round': 'Round (28px)',
  'appearance.radius_extra_round': 'Extra round (36px)',
  'appearance.density_label': 'Layout density',
  'appearance.density_comfortable': 'Comfortable',
  'appearance.density_compact': 'Compact',
  'appearance.motion_label': 'Motion',
  'appearance.motion_full': 'Full motion',
  'appearance.motion_reduced': 'Reduced motion',
  'appearance.haptics_label': 'Haptic feedback',
  'appearance.haptics_on': 'Haptics on',
  'appearance.haptics_off': 'Haptics off',
  'appearance.reset_defaults': 'Reset to defaults',

  // Data Screen
  'data.title': 'Data management',
  'data.user_profile': 'Active athlete profile',
  'data.user_id': 'Athlete ID',
  'data.codename': 'Codename',
  'data.fitness_level': 'Baseline fitness level',
  'data.equipment': 'Available equipment',
  'data.priorities': 'Physique priorities',
  'data.export_btn': 'Export JSON',
  'data.reset_btn': 'Reset mock data',
  'data.reset_confirm_title': 'Reset mock data?',
  'data.reset_confirm_desc': 'This will purge all local IndexedDB events and re-initialize the baseline mock athlete profile and environment.',
  'data.reset_success': 'Mock athlete state and IndexedDB successfully re-initialized.',

  // About Screen (Diagnostics)
  'about.title': 'About & diagnostics',
  'about.system_status': 'System diagnostics',
  'about.version': 'App version',
  'about.commit': 'Build commit',
  'about.online': 'Network state',
  'about.online_true': 'Online',
  'about.online_false': 'Offline (Local-first)',
  'about.standalone': 'Display mode',
  'about.standalone_true': 'Standalone PWA',
  'about.standalone_false': 'Browser tab',
  'about.sw_state': 'Service worker',
  'about.storage_persisted': 'Storage persisted',
  'about.events_count': 'Stored event count',
  'about.config_keys': 'Effective settings keys',

  // PWA Update Banner
  'update.banner_title': 'Update available',
  'update.apply_btn': 'Apply',

  // Launch intro
  'intro.skip': 'Tap anywhere to skip',
  'intro.tagline': 'Deterministic bodyweight engine',
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
  'common.mock_tag': 'تجريبي',
  'common.estimate': 'تقدير',

  // Home Screen
  'home.title': 'الرئيسية',
  'home.welcome_athlete': 'مرحباً بالرياضي',
  'home.start_workout': 'ابدأ التمرين',
  'home.horizon_title': 'أفق 7 أيام',
  'home.consistency_title': 'الاستمرارية',
  'home.readiness_title': 'الجاهزية',
  'home.add_checkin': 'تسجيل الجاهزية',
  'home.exposure_title': 'التعرض لتحفيز العضلات',
  'home.coach_inbox': 'صندوق المدرب',

  // Train Screen
  'train.title': 'التدريب',
  'train.ready_badge': 'المحرك جاهز',
  'train.segment_plan': 'خطة اليوم',
  'train.segment_library': 'مكتبة التمارين',
  'train.start_workout': 'ابدأ التمرين',
  'train.all_patterns': 'كل الأنماط',
  'train.exercises_header': 'التمارين',
  'train.locked': 'مقفل',

  // Progress Screen
  'progress.title': 'التقدم',
  'progress.collecting_data': 'جمع البيانات',
  'progress.rep_targets_hit': 'أهداف التكرارات المحققة',
  'progress.avg_effort_rpe': 'متوسط الجهد (RPE)',

  // More Screen
  'more.title': 'المزيد',
  'more.item_settings': 'الإعدادات',
  'more.item_appearance': 'المظهر والمختبر',
  'more.item_equipment': 'المعدات والبيئة',
  'more.item_equipment_desc': 'تحقق من بيئة التدريب الخاصة بك',
  'more.item_data': 'إدارة البيانات',
  'more.item_about': 'تشخيص النظام',

  // Appearance Lab Screen
  'appearance.title': 'مختبر المظهر',
  'appearance.preview_title': 'معاينة حية',
  'appearance.accent_label': 'لون التمييز',
  'appearance.depth_label': 'عمق الظلال',
  'appearance.radius_label': 'انحناء الزوايا',
  'appearance.density_label': 'كثافة التخطيط',
  'appearance.motion_label': 'الحركة',
  'appearance.haptics_label': 'الاستجابة اللمسية',
  'appearance.reset_defaults': 'إعادة ضبط للافتراضي',

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
