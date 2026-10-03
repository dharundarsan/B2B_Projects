import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Language } from '../types';

const en = {
  home: 'Home', repairs: 'Repairs', visits: 'Visits', report: 'Report', profile: 'Account',
  signIn: 'Sign in', email: 'Email', password: 'Password', signOut: 'Sign out', retry: 'Try again',
  welcome: 'A better home,\none repair at a time.', welcomeWatchman: 'A clear plan\nfor every shift.',
  loginHelp: 'Use the account assigned by your apartment manager.', residentPreview: 'Preview resident app', watchmanPreview: 'Preview watchman app',
  preview: 'LOCAL PREVIEW · Changes reset when you leave', greeting: 'GOOD TO SEE YOU', watchman: 'Watchman', resident: 'Resident',
  open: 'Open repairs', action: 'Need your response', history: 'History', shared: 'Shared areas', myHome: 'My home',
  reportTitle: 'What needs attention?', reportHelp: 'A few clear details help the right person fix it faster.',
  quickReport: 'Report a problem', activeRepairs: 'Your active repairs', viewAll: 'View all', nextVisit: 'Your next visit',
  emptyRepairs: 'Nothing needs fixing.', emptyHelp: 'Your maintenance reports and updates will appear here.',
  loading: 'Loading…', refresh: 'Refresh', search: 'Search reports', all: 'All', urgent: 'Urgent', routine: 'Routine',
  building: 'Building', unit: 'Apartment', location: 'Shared location', locationHint: 'For example: Block A, second-floor corridor',
  apartment: 'Inside my apartment', common: 'Common area', title: 'Short title', category: 'Category', details: 'What happened?',
  name: 'Your name', safety: 'Is there an immediate safety risk?', safetyHelp: 'For fire, gas smell or immediate danger, contact local emergency services and building staff. Do not wait for the app.',
  danger: 'Active leak / exposed electrical hazard', access: 'Access arrangement', atHome: 'I will be at home', contactFirst: 'Contact me to arrange access',
  accessNotes: 'Access notes (optional)', accessHelp: 'Never include passwords, key codes or private documents.',
  preferred: 'Preferred visit window (optional)', review: 'Review report', back: 'Back', submit: 'Send report',
  publicReport: 'Shared-area reports and manager updates are visible to assigned building users. Do not include apartment numbers, resident names or other private details.',
  reportSaved: 'Report received', savedHelp: 'Your manager can now review the problem.',
  confirmVisit: 'Confirm visit', declineVisit: 'This time does not work', proposed: 'Waiting for both confirmations', confirmed: 'Confirmed by resident and vendor',
  yourResponse: 'YOUR RESPONSE', verifyHelp: 'The vendor marked this work complete. Is the problem actually fixed?',
  fixed: 'Yes, it is fixed', notFixed: 'Still not fixed', note: 'Add a note', noteNeeded: 'Describe what is still wrong before sending.',
  messages: 'Conversation', messageHint: 'Write a message…', send: 'Send', messageHelp: 'Messages are shared with the manager and the assigned vendor. Do not include passwords or access codes.',
  timeline: 'Repair history', repairDetails: 'Repair details', nextAction: 'What happens next', photos: 'Photos',
  attach: 'Attach a photo', camera: 'Take photo', library: 'Choose photo', viewPhoto: 'View photo', permission: 'Camera permission is needed to take a photo.',
  photoHelp: 'JPEG, PNG or WebP · up to 20 MB · private storage', uploadFail: 'The report is saved. The photo did not upload; retry it from the repair details.',
  today: 'TODAY AT THE GATE', expected: 'Expected', onSite: 'On site', finished: 'Left',
  todayVisits: 'Confirmed vendor visits', gateHelp: 'Check the vendor identity at the gate. Logging arrival does not grant apartment-entry permission or start repair work.',
  arrive: 'Record arrival', depart: 'Record departure', noVisits: 'No confirmed visits today.', noVisitsHelp: 'Only visits confirmed by both the resident and vendor appear here.',
  arrivalQuestion: 'Have you checked this vendor at the gate?', departureQuestion: 'Has this vendor left the property?', cancel: 'Cancel', confirm: 'Confirm',
  arrivedAt: 'Arrived', departedAt: 'Departed', sharedTitle: 'Keep shared spaces in shape.', noShared: 'No shared-area reports yet.',
  managerUpdate: 'Manager update', reported: 'Reported', inProgress: 'In progress', resolved: 'Resolved',
  language: 'App language', languageHelp: 'Changes app labels. Reports, messages and server error text are not automatically translated.',
  assigned: 'Your assigned buildings', privacy: 'Your permissions', residentPrivacy: 'Your assigned apartments and shared-area reports. No manager approval controls.',
  watchmanPrivacy: 'Confirmed vendor visits and shared-area reports in assigned buildings. No resident conversations, access notes or repair costs.',
  connection: 'Connection', unsupported: 'This account is not assigned a mobile role.', unsupportedHelp: 'Ask your manager to assign a resident or watchman account. Owners and vendors should use the web app.',
  noAssignment: 'No building is assigned.', noAssignmentHelp: 'Ask your manager to assign your building and apartment. The app cannot grant itself permissions.',
  offline: 'Changes require a connection. No background retries or offline submissions.', settingsHelp: 'Push notifications are not enabled in this version. Open or refresh the app to see current updates.',
  invalid: 'Check the required fields before continuing.', noPhotoPreview: 'Private photo uploads require a configured, signed-in account.',
  submitted: 'Submitted', acknowledged: 'Acknowledged', assignedState: 'Vendor assigned', waiting: 'Waiting', scheduled: 'Visit proposed', approved: 'Approved',
  verification: 'Check the repair', closed: 'Closed', cancelled: 'Cancelled', completed: 'Work complete', invoiceReview: 'Invoice review', draft: 'Draft'
} as const;
type Key = keyof typeof en;
// Navigation and key actions are localized. English is an explicit fallback for longer help text.
const hi: Partial<Record<Key, string>> = {
  home: 'होम', repairs: 'मरम्मत', visits: 'विज़िट', report: 'रिपोर्ट', profile: 'खाता', signIn: 'साइन इन', signOut: 'साइन आउट', email: 'ईमेल', password: 'पासवर्ड',
  retry: 'फिर कोशिश करें', open: 'खुली मरम्मत', action: 'आपका उत्तर चाहिए', history: 'इतिहास', shared: 'साझा स्थान', myHome: 'मेरा घर',
  reportTitle: 'किस समस्या पर ध्यान चाहिए?', quickReport: 'समस्या की रिपोर्ट करें', activeRepairs: 'आपकी सक्रिय मरम्मत', viewAll: 'सभी देखें',
  loading: 'लोड हो रहा है…', refresh: 'रीफ़्रेश', search: 'रिपोर्ट खोजें', all: 'सभी', urgent: 'अत्यावश्यक', routine: 'सामान्य',
  building: 'इमारत', unit: 'अपार्टमेंट', location: 'साझा स्थान', apartment: 'मेरे अपार्टमेंट में', common: 'साझा क्षेत्र', title: 'संक्षिप्त शीर्षक',
  category: 'श्रेणी', details: 'क्या हुआ?', name: 'आपका नाम', access: 'प्रवेश की व्यवस्था', atHome: 'मैं घर पर रहूँगा', contactFirst: 'प्रवेश के लिए पहले संपर्क करें',
  review: 'रिपोर्ट की समीक्षा', back: 'वापस', submit: 'रिपोर्ट भेजें', reportSaved: 'रिपोर्ट मिली', confirmVisit: 'विज़िट की पुष्टि करें', declineVisit: 'यह समय ठीक नहीं है',
  fixed: 'हाँ, ठीक हो गया', notFixed: 'अभी ठीक नहीं हुआ', note: 'टिप्पणी जोड़ें', messages: 'बातचीत', messageHint: 'संदेश लिखें…', send: 'भेजें',
  timeline: 'मरम्मत का इतिहास', repairDetails: 'मरम्मत का विवरण', nextAction: 'अगला कदम', photos: 'फ़ोटो', attach: 'फ़ोटो जोड़ें', camera: 'फ़ोटो लें', library: 'फ़ोटो चुनें',
  expected: 'अपेक्षित', onSite: 'परिसर में', finished: 'जा चुका है', todayVisits: 'पुष्टि की गई विक्रेता विज़िट', arrive: 'आगमन दर्ज करें', depart: 'प्रस्थान दर्ज करें',
  cancel: 'रद्द करें', confirm: 'पुष्टि करें', arrivedAt: 'आगमन', departedAt: 'प्रस्थान', managerUpdate: 'प्रबंधक का अपडेट', reported: 'रिपोर्ट किया गया',
  inProgress: 'काम जारी है', resolved: 'समाधान हो गया', language: 'ऐप की भाषा', assigned: 'आपकी इमारतें', privacy: 'आपकी अनुमतियाँ', connection: 'कनेक्शन',
  resident: 'निवासी', watchman: 'चौकीदार', submitted: 'जमा किया गया', verification: 'मरम्मत जाँचें', closed: 'बंद', cancelled: 'रद्द'
};
const ta: Partial<Record<Key, string>> = {
  home: 'முகப்பு', repairs: 'பழுதுகள்', visits: 'வருகைகள்', report: 'புகார்', profile: 'கணக்கு', signIn: 'உள்நுழை', signOut: 'வெளியேறு', email: 'மின்னஞ்சல்', password: 'கடவுச்சொல்',
  retry: 'மீண்டும் முயல்க', open: 'நிலுவைப் பழுதுகள்', action: 'உங்கள் பதில் தேவை', history: 'வரலாறு', shared: 'பொதுப் பகுதிகள்', myHome: 'என் வீடு',
  reportTitle: 'எந்தச் சிக்கலை சரிசெய்ய வேண்டும்?', quickReport: 'சிக்கலைப் புகாரளிக்க', activeRepairs: 'நிலுவையில் உள்ள பழுதுகள்', viewAll: 'அனைத்தையும் காண்க',
  loading: 'ஏற்றுகிறது…', refresh: 'புதுப்பி', search: 'புகார்களைத் தேடு', all: 'அனைத்தும்', urgent: 'அவசரம்', routine: 'சாதாரணம்', building: 'கட்டிடம்', unit: 'வீடு',
  location: 'பொது இடம்', apartment: 'என் வீட்டிற்குள்', common: 'பொதுப் பகுதி', title: 'சுருக்கமான தலைப்பு', category: 'வகை', details: 'என்ன நடந்தது?', name: 'உங்கள் பெயர்',
  access: 'அணுகல் ஏற்பாடு', atHome: 'நான் வீட்டில் இருப்பேன்', contactFirst: 'முதலில் என்னைத் தொடர்புகொள்ளவும்', review: 'புகாரை சரிபார்', back: 'பின்செல்', submit: 'புகாரை அனுப்பு',
  reportSaved: 'புகார் பெறப்பட்டது', confirmVisit: 'வருகையை உறுதிசெய்', declineVisit: 'இந்த நேரம் பொருந்தாது', fixed: 'ஆம், சரியாகிவிட்டது', notFixed: 'இன்னும் சரியாகவில்லை',
  note: 'குறிப்பு சேர்க்க', messages: 'உரையாடல்', messageHint: 'செய்தி எழுதுக…', send: 'அனுப்பு', timeline: 'பழுது வரலாறு', repairDetails: 'பழுது விவரங்கள்', nextAction: 'அடுத்த நடவடிக்கை',
  photos: 'படங்கள்', attach: 'படம் இணைக்க', camera: 'படம் எடுக்க', library: 'படம் தேர்ந்தெடுக்க', expected: 'எதிர்பார்க்கப்படுகிறது', onSite: 'வளாகத்தில்', finished: 'வெளியேறினார்',
  todayVisits: 'உறுதிசெய்யப்பட்ட வருகைகள்', arrive: 'வருகையைப் பதிவு செய்', depart: 'வெளியேறியதைப் பதிவு செய்', cancel: 'ரத்துசெய்', confirm: 'உறுதிசெய்', arrivedAt: 'வந்த நேரம்', departedAt: 'வெளியேறிய நேரம்',
  managerUpdate: 'மேலாளர் தகவல்', reported: 'புகார் பெறப்பட்டது', inProgress: 'பணி நடைபெறுகிறது', resolved: 'தீர்க்கப்பட்டது', language: 'செயலியின் மொழி', assigned: 'உங்கள் கட்டிடங்கள்',
  privacy: 'உங்கள் அனுமதிகள்', connection: 'இணைப்பு', resident: 'குடியிருப்பாளர்', watchman: 'காவலர்', submitted: 'சமர்ப்பிக்கப்பட்டது', verification: 'பழுதை சரிபார்', closed: 'முடிக்கப்பட்டது', cancelled: 'ரத்துசெய்யப்பட்டது'
};
export const catalogs = { en, hi, ta };
export const languageNames: Record<Language, string> = { en: 'English', hi: 'हिन्दी', ta: 'தமிழ்' };
const I18n = createContext<{ language: Language; setLanguage: (value: Language) => void; t: (key: Key) => string }>({ language: 'en', setLanguage: () => {}, t: key => en[key] });
export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setValue] = useState<Language>('en');
  useEffect(() => { let mounted = true; AsyncStorage.getItem('rl.language').then(value => { if (mounted && (value === 'hi' || value === 'ta')) setValue(value); }).catch(() => {}); return () => { mounted = false; }; }, []);
  const setLanguage = (value: Language) => { setValue(value); void AsyncStorage.setItem('rl.language', value).catch(() => {}); };
  return <I18n.Provider value={{ language, setLanguage, t: key => catalogs[language][key] ?? en[key] }}>{children}</I18n.Provider>;
}
export const useI18n = () => useContext(I18n);
export function statusKey(status: string): Key {
  const keys: Record<string, Key> = { reported: 'reported', submitted: 'submitted', urgent: 'urgent', acknowledged: 'acknowledged', assigned: 'assignedState', waiting: 'waiting', scheduled: 'scheduled', approved: 'approved', in_progress: 'inProgress', verification: 'verification', closed: 'closed', cancelled: 'cancelled', resolved: 'resolved', completed: 'completed', invoice_review: 'invoiceReview', draft: 'draft' };
  return keys[status] ?? 'submitted';
}
export function repairStatusKey(repair: { state: string; appointments: { status: string }[] }): Key {
  return repair.state === 'scheduled' && repair.appointments.filter(a => a.status !== 'cancelled').at(-1)?.status === 'confirmed'
    ? 'confirmed' : statusKey(repair.state);
}
