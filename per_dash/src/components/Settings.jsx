import { useState, useEffect, useRef } from 'react';
import {
    Settings as SettingsIcon, Palette, Bell, Shield, Database,
    Mail, Zap, Moon, Sun, Monitor, Check, RefreshCw, Trash2,
    Download, Upload, Eye, ToggleLeft, ToggleRight, Lock, Wifi,
    FileText, AlertTriangle
} from 'lucide-react';

const LS_KEY = 'crivo_settings';

const defaults = {
    theme: 'light',
    accentColor: 'indigo',
    fontSize: 'medium',
    compactMode: false,
    animationsEnabled: true,
    notifEmail: true,
    notifWhatsapp: true,
    notifTelegram: false,
    notifSound: true,
    notifDesktop: true,
    notifBadge: true,
    emailSignature: '',
    replyQuote: true,
    sendConfirm: false,
    autoSaveDraft: true,
    emailsPerPage: '25',
    readReceipts: true,
    activityStatus: true,
    twoFactor: false,
    sessionTimeout: '30',
};

const accentMap = {
    indigo: '#6366f1', violet: '#8b5cf6', blue: '#3b82f6',
    emerald: '#10b981', rose: '#f43f5e', amber: '#f59e0b',
};

const fontSizeMap = { small: '13px', medium: '15px', large: '17px' };

function loadSettings() {
    try { return { ...defaults, ...JSON.parse(localStorage.getItem(LS_KEY)) }; }
    catch { return defaults; }
}

function applyToDOM(settings) {
    const root = document.documentElement;
    root.style.setProperty('--accent', accentMap[settings.accentColor] || accentMap.indigo);
    root.style.setProperty('--font-size-base', fontSizeMap[settings.fontSize] || fontSizeMap.medium);
    document.body.classList.toggle('compact-mode', settings.compactMode);
    document.body.classList.toggle('no-animations', !settings.animationsEnabled);
    document.body.dataset.theme = settings.theme;
}

const SECTIONS = ['Appearance', 'Notifications', 'Email', 'Privacy & Security', 'Data & Storage', 'About'];

const sectionMeta = {
    'Appearance':        { icon: <Palette size={15} />,     color: 'from-violet-500 to-purple-600' },
    'Notifications':     { icon: <Bell size={15} />,        color: 'from-amber-500 to-orange-500' },
    'Email':             { icon: <Mail size={15} />,        color: 'from-blue-500 to-indigo-500' },
    'Privacy & Security':{ icon: <Shield size={15} />,      color: 'from-emerald-500 to-teal-600' },
    'Data & Storage':    { icon: <Database size={15} />,    color: 'from-slate-500 to-gray-600' },
    'About':             { icon: <SettingsIcon size={15} />, color: 'from-rose-500 to-pink-500' },
};

const Settings = ({ user }) => {
    const [s, setS] = useState(loadSettings);
    const [activeSection, setActiveSection] = useState('Appearance');
    const [saved, setSaved] = useState(false);
    const [toast, setToast] = useState(null);
    const [cacheSize, setCacheSize] = useState(0);
    const [checking, setChecking] = useState(false);
    const importRef = useRef();

    // Compute localStorage size on mount
    useEffect(() => {
        let bytes = 0;
        for (const k in localStorage) {
            if (Object.prototype.hasOwnProperty.call(localStorage, k))
                bytes += (localStorage[k].length + k.length) * 2;
        }
        setCacheSize((bytes / 1024).toFixed(1));
    }, []);

    // Apply to DOM whenever settings change
    useEffect(() => { applyToDOM(s); }, [s]);

    const set = (key, val) => setS(prev => ({ ...prev, [key]: val }));

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const saveAll = () => {
        localStorage.setItem(LS_KEY, JSON.stringify(s));
        applyToDOM(s);
        setSaved(true);
        showToast('Settings saved!');
        setTimeout(() => setSaved(false), 2500);
    };

    const clearCache = () => {
        const keep = {};
        // preserve auth and important keys
        ['firebase:authUser', 'crivo_settings', 'activePage'].forEach(k => {
            if (localStorage.getItem(k)) keep[k] = localStorage.getItem(k);
        });
        localStorage.clear();
        Object.entries(keep).forEach(([k, v]) => localStorage.setItem(k, v));
        setCacheSize('0.0');
        showToast('Cache cleared!');
    };

    const exportData = () => {
        const data = { settings: s, exportedAt: new Date().toISOString(), app: 'Crivo Inai' };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'crivo-settings.json'; a.click();
        URL.revokeObjectURL(url);
        showToast('Settings exported!');
    };

    const importData = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const parsed = JSON.parse(ev.target.result);
                const incoming = parsed.settings || parsed;
                const merged = { ...defaults, ...incoming };
                setS(merged);
                localStorage.setItem(LS_KEY, JSON.stringify(merged));
                applyToDOM(merged);
                showToast('Settings imported!');
            } catch {
                showToast('Invalid file format', 'error');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const requestDesktopNotif = async () => {
        if (!('Notification' in window)) { showToast('Browser does not support notifications', 'error'); return; }
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
            set('notifDesktop', true);
            new Notification('Crivo Inai', { body: 'Desktop notifications enabled!' });
            showToast('Desktop notifications enabled!');
        } else {
            set('notifDesktop', false);
            showToast('Permission denied by browser', 'error');
        }
    };

    const checkUpdate = () => {
        setChecking(true);
        setTimeout(() => { setChecking(false); showToast("You're on the latest version (v1.0.0)"); }, 1500);
    };

    return (
        <div className="max-w-5xl mx-auto pb-12 relative">

            {/* Toast */}
            {toast && (
                <div className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold text-white transition-all`}
                    style={{ background: toast.type === 'error' ? '#ef4444' : '#10b981', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
                    {toast.type === 'error' ? <AlertTriangle size={16} /> : <Check size={16} />}
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Changes apply instantly · Save to persist across sessions</p>
                </div>
                <button onClick={saveAll}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all shadow-md active:scale-95"
                    style={{ background: saved ? '#10b981' : 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                    {saved ? <><Check size={16} /> Saved!</> : 'Save Changes'}
                </button>
            </div>

            <div className="flex gap-6">
                {/* Sidebar */}
                <div className="w-52 flex-shrink-0 space-y-1">
                    {SECTIONS.map(sec => (
                        <button key={sec} onClick={() => setActiveSection(sec)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-left transition-all ${activeSection === sec ? 'bg-white shadow-sm border border-gray-100 text-indigo-600' : 'text-gray-600 hover:bg-white/80 hover:text-gray-900'}`}>
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-gradient-to-br text-white ${sectionMeta[sec].color}`}>
                                {sectionMeta[sec].icon}
                            </div>
                            {sec}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 space-y-4">

                    {/* ── APPEARANCE ── */}
                    {activeSection === 'Appearance' && (<>
                        <Card title="Theme" icon={<Sun size={15} />} color="from-violet-500 to-purple-600">
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { id: 'light', label: 'Light', icon: <Sun size={18} /> },
                                    { id: 'dark', label: 'Dark', icon: <Moon size={18} /> },
                                    { id: 'system', label: 'System', icon: <Monitor size={18} /> },
                                ].map(t => (
                                    <button key={t.id} onClick={() => { set('theme', t.id); showToast(`${t.label} theme selected`); }}
                                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-sm font-medium transition-all active:scale-95 ${s.theme === t.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'}`}>
                                        {t.icon}{t.label}
                                        {s.theme === t.id && <Check size={14} className="text-indigo-500" />}
                                    </button>
                                ))}
                            </div>
                        </Card>

                        <Card title="Accent Color" icon={<Palette size={15} />} color="from-violet-500 to-purple-600">
                            <div className="flex gap-4 flex-wrap">
                                {Object.entries(accentMap).map(([id, hex]) => (
                                    <button key={id} onClick={() => { set('accentColor', id); document.documentElement.style.setProperty('--accent', hex); showToast(`${id.charAt(0).toUpperCase() + id.slice(1)} accent applied`); }}
                                        className="flex flex-col items-center gap-1.5 transition-all">
                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${s.accentColor === id ? 'ring-2 ring-offset-2 ring-gray-500 scale-110' : 'hover:scale-105'}`}
                                            style={{ background: hex }}>
                                            {s.accentColor === id && <Check size={16} className="text-white" />}
                                        </div>
                                        <span className="text-xs text-gray-500 capitalize">{id}</span>
                                    </button>
                                ))}
                            </div>
                        </Card>

                        <Card title="Display" icon={<Monitor size={15} />} color="from-violet-500 to-purple-600">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-medium text-gray-800">Font Size</div>
                                        <div className="text-xs text-gray-400">Adjusts text size immediately</div>
                                    </div>
                                    <select value={s.fontSize}
                                        onChange={e => { set('fontSize', e.target.value); document.documentElement.style.setProperty('--font-size-base', fontSizeMap[e.target.value]); showToast(`Font size set to ${e.target.value}`); }}
                                        className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white cursor-pointer">
                                        <option value="small">Small (13px)</option>
                                        <option value="medium">Medium (15px)</option>
                                        <option value="large">Large (17px)</option>
                                    </select>
                                </div>
                                <Toggle label="Compact Mode" desc="Reduces padding & spacing across the app" value={s.compactMode}
                                    onChange={v => { set('compactMode', v); document.body.classList.toggle('compact-mode', v); showToast(`Compact mode ${v ? 'on' : 'off'}`); }} />
                                <Toggle label="Animations" desc="UI transition effects" value={s.animationsEnabled}
                                    onChange={v => { set('animationsEnabled', v); document.body.classList.toggle('no-animations', !v); showToast(`Animations ${v ? 'enabled' : 'disabled'}`); }} />
                            </div>
                        </Card>
                    </>)}

                    {/* ── NOTIFICATIONS ── */}
                    {activeSection === 'Notifications' && (<>
                        <Card title="Platform Alerts" icon={<Bell size={15} />} color="from-amber-500 to-orange-500">
                            <div className="space-y-1">
                                <Toggle label="Email notifications" desc="New emails & replies" value={s.notifEmail}
                                    onChange={v => { set('notifEmail', v); showToast(`Email notifications ${v ? 'on' : 'off'}`); }} />
                                <Toggle label="WhatsApp notifications" desc="Incoming messages" value={s.notifWhatsapp}
                                    onChange={v => { set('notifWhatsapp', v); showToast(`WhatsApp notifications ${v ? 'on' : 'off'}`); }} />
                                <Toggle label="Telegram notifications" desc="Messages & mentions" value={s.notifTelegram}
                                    onChange={v => { set('notifTelegram', v); showToast(`Telegram notifications ${v ? 'on' : 'off'}`); }} />
                            </div>
                        </Card>

                        <Card title="Notification Style" icon={<Zap size={15} />} color="from-amber-500 to-orange-500">
                            <div className="space-y-1">
                                <Toggle label="Sound alerts" desc="Play audio on new notifications" value={s.notifSound}
                                    onChange={v => { set('notifSound', v); showToast(`Sound ${v ? 'on' : 'off'}`); }} />
                                <div className="flex items-center justify-between py-2.5 border-b border-gray-50">
                                    <div>
                                        <div className="text-sm font-medium text-gray-800">Desktop notifications</div>
                                        <div className="text-xs text-gray-400">
                                            {Notification?.permission === 'denied' ? '⚠️ Blocked by browser — check site settings' : 'Show browser push notifications'}
                                        </div>
                                    </div>
                                    <button onClick={() => { if (s.notifDesktop) { set('notifDesktop', false); showToast('Desktop notifications off'); } else { requestDesktopNotif(); } }} className="ml-4 flex-shrink-0">
                                        {s.notifDesktop ? <ToggleRight size={30} className="text-indigo-500" /> : <ToggleLeft size={30} className="text-gray-300" />}
                                    </button>
                                </div>
                                <Toggle label="Badge counter" desc="Unread count on browser tab" value={s.notifBadge}
                                    onChange={v => { set('notifBadge', v); showToast(`Badge counter ${v ? 'on' : 'off'}`); }} />
                            </div>
                        </Card>
                    </>)}

                    {/* ── EMAIL ── */}
                    {activeSection === 'Email' && (<>
                        <Card title="Compose Behavior" icon={<Mail size={15} />} color="from-blue-500 to-indigo-500">
                            <div className="space-y-1">
                                <Toggle label="Quote original on reply" desc="Include original message thread" value={s.replyQuote}
                                    onChange={v => { set('replyQuote', v); showToast(`Reply quoting ${v ? 'on' : 'off'}`); }} />
                                <Toggle label="Confirm before sending" desc="Show dialog before every send" value={s.sendConfirm}
                                    onChange={v => { set('sendConfirm', v); showToast(`Send confirmation ${v ? 'on' : 'off'}`); }} />
                                <Toggle label="Auto-save drafts" desc="Save draft every 30 seconds" value={s.autoSaveDraft}
                                    onChange={v => { set('autoSaveDraft', v); showToast(`Auto-save ${v ? 'on' : 'off'}`); }} />
                                <div className="flex items-center justify-between pt-2">
                                    <div>
                                        <div className="text-sm font-medium text-gray-800">Emails per page</div>
                                        <div className="text-xs text-gray-400">Number shown in inbox list</div>
                                    </div>
                                    <select value={s.emailsPerPage}
                                        onChange={e => { set('emailsPerPage', e.target.value); showToast(`Showing ${e.target.value} emails per page`); }}
                                        className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white cursor-pointer">
                                        <option value="10">10</option>
                                        <option value="25">25</option>
                                        <option value="50">50</option>
                                        <option value="100">100</option>
                                    </select>
                                </div>
                            </div>
                        </Card>

                        <Card title="Email Signature" icon={<FileText size={15} />} color="from-blue-500 to-indigo-500">
                            <p className="text-xs text-gray-400 mb-2">Appended to every outgoing email</p>
                            <textarea value={s.emailSignature}
                                onChange={e => set('emailSignature', e.target.value)}
                                rows={4}
                                className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none text-gray-700"
                                placeholder={`Best regards,\n${user?.displayName || 'Your Name'}`} />
                            <p className="text-xs text-gray-400 mt-1">{s.emailSignature.length} characters · click Save Changes to apply</p>
                        </Card>
                    </>)}

                    {/* ── PRIVACY & SECURITY ── */}
                    {activeSection === 'Privacy & Security' && (<>
                        <Card title="Privacy" icon={<Eye size={15} />} color="from-emerald-500 to-teal-600">
                            <div className="space-y-1">
                                <Toggle label="Read receipts" desc="Let senders know when you've opened their email" value={s.readReceipts}
                                    onChange={v => { set('readReceipts', v); showToast(`Read receipts ${v ? 'on' : 'off'}`); }} />
                                <Toggle label="Activity status" desc="Show when you were last active" value={s.activityStatus}
                                    onChange={v => { set('activityStatus', v); showToast(`Activity status ${v ? 'visible' : 'hidden'}`); }} />
                            </div>
                        </Card>

                        <Card title="Security" icon={<Lock size={15} />} color="from-emerald-500 to-teal-600">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between py-2 border-b border-gray-50">
                                    <div>
                                        <div className="text-sm font-medium text-gray-800">Two-factor authentication</div>
                                        <div className="text-xs text-gray-400">Managed via your Google account settings</div>
                                    </div>
                                    <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer"
                                        className="text-xs font-medium text-indigo-500 hover:text-indigo-700 underline transition-colors">
                                        Manage →
                                    </a>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-medium text-gray-800">Session timeout</div>
                                        <div className="text-xs text-gray-400">Auto sign-out after inactivity</div>
                                    </div>
                                    <select value={s.sessionTimeout}
                                        onChange={e => { set('sessionTimeout', e.target.value); showToast(`Timeout set to ${e.target.options[e.target.selectedIndex].text}`); }}
                                        className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white cursor-pointer">
                                        <option value="15">15 minutes</option>
                                        <option value="30">30 minutes</option>
                                        <option value="60">1 hour</option>
                                        <option value="480">8 hours</option>
                                        <option value="never">Never</option>
                                    </select>
                                </div>
                            </div>
                        </Card>

                        <Card title="Active Sessions" icon={<Wifi size={15} />} color="from-emerald-500 to-teal-600">
                            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                                        <Monitor size={18} className="text-gray-500" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-gray-800">This browser</div>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            <span className="text-xs text-gray-400">Active now · {user?.email}</span>
                                        </div>
                                    </div>
                                </div>
                                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">Current</span>
                            </div>
                        </Card>
                    </>)}

                    {/* ── DATA & STORAGE ── */}
                    {activeSection === 'Data & Storage' && (<>
                        <Card title="Cache & Storage" icon={<Database size={15} />} color="from-slate-500 to-gray-600">
                            <div className="space-y-4">
                                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-gray-700">Local storage used</span>
                                        <span className="text-sm font-semibold text-gray-700">{cacheSize} KB</span>
                                    </div>
                                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full transition-all"
                                            style={{ width: `${Math.min((cacheSize / 5000) * 100, 100)}%`, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }} />
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1">{cacheSize} KB of ~5 MB quota</div>
                                </div>
                                <button onClick={clearCache}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-sm text-red-500 hover:bg-red-50 active:scale-95 transition-all w-full justify-center font-medium">
                                    <Trash2 size={15} /> Clear App Cache
                                </button>
                            </div>
                        </Card>

                        <Card title="Import / Export" icon={<Download size={15} />} color="from-slate-500 to-gray-600">
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={exportData}
                                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-indigo-200 text-sm text-indigo-600 hover:bg-indigo-50 active:scale-95 transition-all font-medium">
                                    <Download size={16} /> Export Settings
                                </button>
                                <button onClick={() => importRef.current?.click()}
                                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-indigo-200 text-sm text-indigo-600 hover:bg-indigo-50 active:scale-95 transition-all font-medium">
                                    <Upload size={16} /> Import Settings
                                </button>
                                <input ref={importRef} type="file" accept=".json" className="hidden" onChange={importData} />
                            </div>
                            <p className="text-xs text-gray-400 mt-3">Export saves all settings as a JSON file. Import restores from a previous backup.</p>
                        </Card>
                    </>)}

                    {/* ── ABOUT ── */}
                    {activeSection === 'About' && (<>
                        <Card title="App Info" icon={<SettingsIcon size={15} />} color="from-rose-500 to-pink-500">
                            <div className="flex items-center gap-5 p-2">
                                <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-md flex-shrink-0"
                                    style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}>
                                    <span className="text-white font-bold text-xl">CI</span>
                                </div>
                                <div>
                                    <div className="text-lg font-bold text-gray-900">Crivo Inai</div>
                                    <div className="text-sm text-gray-500">Version 1.0.0 · Build 2026</div>
                                    <div className="text-xs text-gray-400 mt-1">Unified communications dashboard</div>
                                </div>
                            </div>
                        </Card>

                        <Card title="Tech Stack" icon={<Zap size={15} />} color="from-rose-500 to-pink-500">
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { label: 'Frontend', value: 'React + Vite', icon: '⚛️' },
                                    { label: 'Styling', value: 'Tailwind CSS', icon: '🎨' },
                                    { label: 'Backend', value: 'Node.js + Express', icon: '🟢' },
                                    { label: 'Database', value: 'MongoDB', icon: '🍃' },
                                    { label: 'Auth', value: 'Firebase Auth', icon: '🔥' },
                                    { label: 'AI', value: 'GROQ / LLaMA 3', icon: '🤖' },
                                ].map(t => (
                                    <div key={t.label} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                                        <span className="text-xl">{t.icon}</span>
                                        <div>
                                            <div className="text-xs text-gray-400">{t.label}</div>
                                            <div className="text-sm font-medium text-gray-700">{t.value}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>

                        <Card title="Updates" icon={<RefreshCw size={15} />} color="from-rose-500 to-pink-500">
                            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-sm font-medium text-emerald-700">
                                        {checking ? 'Checking...' : "You're on the latest version"}
                                    </span>
                                </div>
                                <button onClick={checkUpdate}
                                    className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 active:scale-95 transition-all px-2 py-1 rounded-lg hover:bg-white">
                                    <RefreshCw size={13} className={checking ? 'animate-spin' : ''} /> Check
                                </button>
                            </div>
                        </Card>
                    </>)}

                </div>
            </div>
        </div>
    );
};

/* Sub-components */
const Card = ({ title, icon, color, children }) => (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-gradient-to-br text-white ${color}`}>{icon}</div>
            <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
        </div>
        {children}
    </div>
);

const Toggle = ({ label, desc, value, onChange }) => (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
        <div>
            <div className="text-sm font-medium text-gray-800">{label}</div>
            {desc && <div className="text-xs text-gray-400">{desc}</div>}
        </div>
        <button onClick={() => onChange(!value)} className="transition-all flex-shrink-0 ml-4 active:scale-90">
            {value ? <ToggleRight size={30} className="text-indigo-500" /> : <ToggleLeft size={30} className="text-gray-300" />}
        </button>
    </div>
);

export default Settings;
