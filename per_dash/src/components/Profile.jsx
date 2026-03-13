import { useState, useEffect } from 'react';
import { updateProfile } from 'firebase/auth';
import { auth } from '../firebase';
import {
    User, Mail, Shield, Bell, Plug, LogOut, Edit3, Check, X,
    Calendar, Clock, Key, ToggleLeft, ToggleRight, AlertTriangle, Chrome, Copy
} from 'lucide-react';

const LS_NOTIF_KEY = 'crivo_notif_prefs';

const Profile = ({ user, connectedPlatforms, onSignOut }) => {
    const [editingName, setEditingName] = useState(false);
    const [displayName, setDisplayName] = useState(user?.displayName || user?.email?.split('@')[0] || 'User');
    const [tempName, setTempName] = useState(displayName);
    const [savingName, setSavingName] = useState(false);
    const [nameError, setNameError] = useState('');
    const [toast, setToast] = useState(null);

    const [notifications, setNotifications] = useState(() => {
        try { return JSON.parse(localStorage.getItem(LS_NOTIF_KEY)) || { email: true, whatsapp: true, telegram: false }; }
        catch { return { email: true, whatsapp: true, telegram: false }; }
    });

    const [copied, setCopied] = useState(false);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    // Persist notification prefs
    useEffect(() => {
        localStorage.setItem(LS_NOTIF_KEY, JSON.stringify(notifications));
    }, [notifications]);

    const toggleNotif = (key) => {
        setNotifications(prev => {
            const next = { ...prev, [key]: !prev[key] };
            showToast(`${key.charAt(0).toUpperCase() + key.slice(1)} alerts ${next[key] ? 'enabled' : 'disabled'}`);
            return next;
        });
    };

    const saveName = async () => {
        if (!tempName.trim()) { setNameError('Name cannot be empty'); return; }
        setNameError('');
        setSavingName(true);
        try {
            await updateProfile(auth.currentUser, { displayName: tempName.trim() });
            setDisplayName(tempName.trim());
            setEditingName(false);
            showToast('Display name updated!');
        } catch (e) {
            setNameError('Failed to update name. Try again.');
        } finally {
            setSavingName(false);
        }
    };

    const copyUID = () => {
        navigator.clipboard.writeText(user?.uid || '');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        showToast('User ID copied!');
    };

    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

    const platformsList = [
        { key: 'Mail', label: 'Gmail', icon: '📧' },
        { key: 'Whatsapp', label: 'WhatsApp', icon: '💬' },
        { key: 'Telegram', label: 'Telegram', icon: '✈️' },
    ];
    const connectedCount = platformsList.filter(p => connectedPlatforms?.[p.key]).length;
    const avatarLetter = (displayName || user?.email || 'U')[0].toUpperCase();

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-12 relative">

            {/* Toast */}
            {toast && (
                <div className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition-all ${toast.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`}
                    style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
                    <Check size={16} />
                    {toast.msg}
                </div>
            )}

            {/* Hero card */}
            <div className="relative rounded-2xl overflow-hidden shadow-sm border border-gray-100">
                <div className="h-32" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)' }}>
                    <div className="absolute inset-0 opacity-20"
                        style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                </div>

                <div className="bg-white px-8 pb-6">
                    <div className="flex items-end justify-between -mt-12 mb-4">
                        <div className="w-24 h-24 rounded-2xl border-4 border-white shadow-lg overflow-hidden">
                            {user?.photoURL
                                ? <img src={user.photoURL} alt="avatar" className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center text-white text-3xl font-bold"
                                    style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}>{avatarLetter}</div>
                            }
                        </div>
                        <button onClick={onSignOut}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 active:scale-95 transition-all">
                            <LogOut size={16} /> Sign Out
                        </button>
                    </div>

                    {editingName ? (
                        <div className="mb-1">
                            <div className="flex items-center gap-2">
                                <input value={tempName} onChange={e => setTempName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && saveName()}
                                    className="text-2xl font-bold text-gray-900 border-b-2 border-indigo-500 focus:outline-none bg-transparent w-64"
                                    autoFocus disabled={savingName} />
                                <button onClick={saveName} disabled={savingName}
                                    className="p-1.5 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 transition-all">
                                    {savingName ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check size={16} />}
                                </button>
                                <button onClick={() => { setTempName(displayName); setEditingName(false); setNameError(''); }}
                                    className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-all">
                                    <X size={16} />
                                </button>
                            </div>
                            {nameError && <p className="text-xs text-red-500 mt-1">{nameError}</p>}
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 mb-1">
                            <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
                            <button onClick={() => { setTempName(displayName); setEditingName(true); }}
                                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-indigo-600 transition-all" title="Edit name">
                                <Edit3 size={15} />
                            </button>
                        </div>
                    )}
                    <p className="text-gray-500 text-sm">{user?.email}</p>

                    <div className="flex gap-6 mt-4 pt-4 border-t border-gray-100">
                        <Stat value={connectedCount} label="Connected" />
                        <div className="w-px bg-gray-100" />
                        <Stat value={platformsList.length} label="Platforms" />
                        <div className="w-px bg-gray-100" />
                        <Stat value={user?.emailVerified ? '✓' : '✗'}
                            label="Verified"
                            color={user?.emailVerified ? 'text-emerald-600' : 'text-red-500'} />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Account Info */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <SectionHeader icon={<User size={16} />} title="Account Info" gradient="from-indigo-500 to-violet-600" />
                    <div className="space-y-1">
                        <InfoRow icon={<Mail size={14} />} label="Email" value={user?.email} />
                        <InfoRow icon={<Shield size={14} />} label="Verified"
                            value={user?.emailVerified ? 'Verified ✓' : 'Not verified'}
                            valueClass={user?.emailVerified ? 'text-emerald-600 font-semibold' : 'text-amber-500 font-semibold'} />
                        <InfoRow icon={<Calendar size={14} />} label="Member Since" value={formatDate(user?.metadata?.creationTime)} />
                        <InfoRow icon={<Clock size={14} />} label="Last Sign In" value={formatDate(user?.metadata?.lastSignInTime)} />
                        <div className="flex items-center justify-between py-2.5 border-b border-gray-50">
                            <div className="flex items-center gap-2 text-gray-400 text-sm">
                                <Key size={14} /><span>User ID</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs font-mono text-gray-500">{user?.uid?.substring(0, 14)}…</span>
                                <button onClick={copyUID} className="p-1 rounded hover:bg-gray-100 transition-colors" title="Copy full ID">
                                    {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} className="text-gray-400" />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Notifications */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <SectionHeader icon={<Bell size={16} />} title="Notifications" gradient="from-amber-500 to-orange-500" />
                    <div className="space-y-1">
                        {[
                            { key: 'email', label: 'Email alerts', desc: 'New emails & replies' },
                            { key: 'whatsapp', label: 'WhatsApp alerts', desc: 'Incoming messages' },
                            { key: 'telegram', label: 'Telegram alerts', desc: 'Messages & mentions' },
                        ].map(item => (
                            <div key={item.key} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                                <div>
                                    <div className="text-sm font-medium text-gray-800">{item.label}</div>
                                    <div className="text-xs text-gray-400">{item.desc}</div>
                                </div>
                                <button onClick={() => toggleNotif(item.key)} className="transition-all ml-4 flex-shrink-0">
                                    {notifications[item.key]
                                        ? <ToggleRight size={30} className="text-indigo-500" />
                                        : <ToggleLeft size={30} className="text-gray-300" />}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Connected Platforms */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <SectionHeader icon={<Plug size={16} />} title="Connected Platforms" gradient="from-emerald-500 to-teal-600"
                    extra={<span className="text-xs text-gray-400">{connectedCount}/{platformsList.length} connected</span>} />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {platformsList.map(p => {
                        const ok = connectedPlatforms?.[p.key];
                        return (
                            <div key={p.key} className={`rounded-xl p-4 border-2 transition-all ${ok ? 'border-emerald-200 bg-emerald-50' : 'border-gray-100 bg-gray-50'}`}>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-2xl">{p.icon}</span>
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'}`}>
                                        {ok ? 'Connected' : 'Not connected'}
                                    </span>
                                </div>
                                <div className="font-semibold text-sm text-gray-800">{p.label}</div>
                                <div className="text-xs text-gray-400 mt-0.5">{ok ? 'Active & syncing' : 'Go to Connectors to link'}</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Sign-In Method */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <SectionHeader icon={<Chrome size={16} />} title="Sign-In Method" gradient="from-blue-500 to-indigo-600" />
                <div className="flex items-center gap-4 p-4 rounded-xl bg-blue-50 border border-blue-100">
                    <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center">
                        <svg viewBox="0 0 24 24" className="w-5 h-5">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <div className="font-medium text-gray-800 text-sm">Google Account</div>
                        <div className="text-xs text-gray-500">{user?.email}</div>
                    </div>
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-700">Active</span>
                </div>
            </div>

            {/* Sign Out */}
            <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-6">
                <SectionHeader icon={<AlertTriangle size={16} />} title="Session" gradient="bg-red-100" iconClass="text-red-500" />
                <div className="flex items-center justify-between p-4 rounded-xl bg-red-50 border border-red-100">
                    <div>
                        <div className="font-medium text-gray-800 text-sm">Sign out from Crivo Inai</div>
                        <div className="text-xs text-gray-500">You will be redirected to the login page</div>
                    </div>
                    <button onClick={onSignOut}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 active:scale-95 transition-all shadow-sm">
                        <LogOut size={15} /> Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
};

const Stat = ({ value, label, color = 'text-indigo-600' }) => (
    <div className="text-center">
        <div className={`text-2xl font-bold ${color}`}>{value}</div>
        <div className="text-xs text-gray-500">{label}</div>
    </div>
);

const SectionHeader = ({ icon, title, gradient, extra, iconClass }) => (
    <div className="flex items-center gap-2 mb-5">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${gradient.startsWith('from') ? `bg-gradient-to-br ${gradient}` : gradient} ${iconClass || 'text-white'}`}>
            {icon}
        </div>
        <h2 className="font-semibold text-gray-900">{title}</h2>
        {extra && <span className="ml-auto">{extra}</span>}
    </div>
);

const InfoRow = ({ icon, label, value, valueClass = 'text-gray-700' }) => (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
        <div className="flex items-center gap-2 text-gray-400 text-sm">{icon}<span>{label}</span></div>
        <span className={`text-sm ${valueClass}`}>{value || '—'}</span>
    </div>
);

export default Profile;
