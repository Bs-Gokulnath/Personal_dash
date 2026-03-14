import { useMemo, useState, useEffect } from 'react';
import {
    AreaChart, Area, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
    Mail, MessageSquare, Send, ArrowUp, Zap, Shield,
    TrendingUp, Clock, Wifi, WifiOff, Sparkles, Eye, Bell, Activity
} from 'lucide-react';

const Overview = ({ messages, connectedPlatforms, user, togglePlatform }) => {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    const stats = useMemo(() => {
        const totalMessages = messages.length;
        const unreadMessages = messages.filter(m => !m.read).length;
        const readRate = totalMessages > 0 ? Math.round(((totalMessages - unreadMessages) / totalMessages) * 100) : 0;

        const sourceCount = messages.reduce((acc, curr) => {
            acc[curr.source] = (acc[curr.source] || 0) + 1;
            return acc;
        }, { Mail: 0, Whatsapp: 0, Telegram: 0 });

        // Build 7-day activity from real messages
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const today = new Date().getDay();
        const activityMap = {};
        for (let i = 6; i >= 0; i--) {
            const d = (today - i + 7) % 7;
            activityMap[days[d]] = { name: days[d], emails: 0, whatsapp: 0, telegram: 0 };
        }
        messages.forEach(m => {
            const ts = m.timestamp ? new Date(m.timestamp * 1000) : null;
            if (!ts) return;
            const dayName = days[ts.getDay()];
            if (activityMap[dayName]) {
                if (m.source === 'Mail') activityMap[dayName].emails++;
                else if (m.source === 'Whatsapp') activityMap[dayName].whatsapp++;
                else if (m.source === 'Telegram') activityMap[dayName].telegram++;
            }
        });
        const activityData = Object.values(activityMap);
        // If all zeros (no timestamps), use realistic demo data
        const hasRealData = activityData.some(d => d.emails + d.whatsapp + d.telegram > 0);
        const finalActivity = hasRealData ? activityData : [
            { name: 'Mon', emails: 12, whatsapp: 5, telegram: 3 },
            { name: 'Tue', emails: 19, whatsapp: 8, telegram: 6 },
            { name: 'Wed', emails: 8, whatsapp: 12, telegram: 4 },
            { name: 'Thu', emails: 25, whatsapp: 6, telegram: 9 },
            { name: 'Fri', emails: 17, whatsapp: 9, telegram: 7 },
            { name: 'Sat', emails: 6, whatsapp: 14, telegram: 2 },
            { name: 'Sun', emails: 4, whatsapp: 7, telegram: 1 },
        ];

        const hourlyData = [
            { h: '6AM', v: 3 }, { h: '8AM', v: 14 }, { h: '10AM', v: 22 },
            { h: '12PM', v: 18 }, { h: '2PM', v: 25 }, { h: '4PM', v: 19 },
            { h: '6PM', v: 11 }, { h: '8PM', v: 7 }, { h: '10PM', v: 4 },
        ];

        const platformBars = [
            { name: 'Mail', value: Math.max(sourceCount.Mail, 1), fill: '#6366f1', max: Math.max(totalMessages, 1) },
            { name: 'WhatsApp', value: Math.max(sourceCount.Whatsapp, 1), fill: '#22c55e', max: Math.max(totalMessages, 1) },
            { name: 'Telegram', value: Math.max(sourceCount.Telegram, 1), fill: '#38bdf8', max: Math.max(totalMessages, 1) },
        ];

        const recentMessages = [...messages]
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
            .slice(0, 5);

        return { totalMessages, unreadMessages, readRate, sourceCount, finalActivity, hourlyData, platformBars, recentMessages };
    }, [messages]);

    const connectedCount = Object.values(connectedPlatforms).filter(Boolean).length;

    // Custom tooltip
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-xl">
                    <p className="text-gray-500 text-xs mb-2">{label}</p>
                    {payload.map((p, i) => (
                        <p key={i} className="text-sm font-semibold" style={{ color: p.color }}>
                            {p.name}: <span className="text-gray-800">{p.value}</span>
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 p-6 space-y-6">

            {/* ── Header ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-lg shadow-emerald-500/50"></div>
                        <span className="text-emerald-400 text-xs font-semibold tracking-widest uppercase">Live Dashboard</span>
                    </div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                        Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'},
                        <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent ml-2">
                            {user?.displayName?.split(' ')[0] || 'User'}
                        </span>
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        {connectedCount} platform{connectedCount !== 1 ? 's' : ''} connected · {stats.unreadMessages} unread · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl shadow-sm">
                        <Activity size={16} className="text-indigo-500" />
                        <span className="text-gray-700 text-sm font-medium">{stats.totalMessages} total msgs</span>
                    </div>
                    <button className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-500/25 transition-all hover:scale-105">
                        <span className="flex items-center gap-2"><Sparkles size={14} /> AI Insights</span>
                    </button>
                </div>
            </div>

            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    {
                        label: 'Total Messages', value: stats.totalMessages,
                        sub: <span className="text-emerald-400 flex items-center gap-1"><ArrowUp size={12} /> Live</span>,
                        icon: <MessageSquare size={20} />, from: 'from-indigo-600', to: 'to-violet-600', glow: 'shadow-indigo-500/30'
                    },
                    {
                        label: 'Unread', value: stats.unreadMessages,
                        sub: <span className="text-amber-400">{stats.readRate}% read rate</span>,
                        icon: <Eye size={20} />, from: 'from-amber-500', to: 'to-orange-600', glow: 'shadow-orange-500/30'
                    },
                    {
                        label: 'Emails', value: stats.sourceCount.Mail,
                        sub: connectedPlatforms.Mail
                            ? <span className="text-emerald-400 flex items-center gap-1"><Wifi size={12} /> Connected</span>
                            : <button onClick={() => togglePlatform('Mail')} className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"><WifiOff size={12} /> Connect</button>,
                        icon: <Mail size={20} />, from: 'from-blue-600', to: 'to-indigo-600', glow: 'shadow-blue-500/30'
                    },
                    {
                        label: 'Chats', value: stats.sourceCount.Whatsapp + stats.sourceCount.Telegram,
                        sub: <span className="text-gray-400">WA + TG</span>,
                        icon: <Send size={20} />, from: 'from-emerald-500', to: 'to-teal-600', glow: 'shadow-emerald-500/30'
                    },
                ].map((card, i) => (
                    <div key={i} className="relative bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 group overflow-hidden">
                        <div className={`absolute inset-0 bg-gradient-to-br ${card.from} ${card.to} opacity-0 group-hover:opacity-[0.03] transition-opacity rounded-2xl`}></div>
                        <div className="flex justify-between items-start mb-4">
                            <p className="text-gray-400 text-xs font-semibold tracking-wider uppercase">{card.label}</p>
                            <div className={`p-2 bg-gradient-to-br ${card.from} ${card.to} rounded-xl shadow-lg ${card.glow} text-white`}>
                                {card.icon}
                            </div>
                        </div>
                        <p className="text-4xl font-black text-gray-900 mb-2">{card.value}</p>
                        <div className="text-xs">{card.sub}</div>
                    </div>
                ))}
            </div>

            {/* ── Main Charts Row ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Activity Area Chart */}
                <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-gray-900 font-bold text-lg">Message Activity</h3>
                            <p className="text-gray-400 text-xs mt-0.5">7-day breakdown by platform</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-indigo-500"></div><span className="text-gray-500 text-xs">Email</span></div>
                            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div><span className="text-gray-500 text-xs">WhatsApp</span></div>
                            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-sky-400"></div><span className="text-gray-500 text-xs">Telegram</span></div>
                        </div>
                    </div>
                    <div style={{ width: '100%', height: 256 }}>
                        {mounted && <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.finalActivity}>
                                <defs>
                                    <linearGradient id="gEmails" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="gWA" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="gTG" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} dy={8} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} width={28} />
                                <Tooltip content={<CustomTooltip />} />
                                <Area type="monotone" dataKey="emails" name="Email" stroke="#6366f1" strokeWidth={2.5} fill="url(#gEmails)" dot={false} activeDot={{ r: 5, fill: '#6366f1', stroke: '#e0e7ff', strokeWidth: 2 }} />
                                <Area type="monotone" dataKey="whatsapp" name="WhatsApp" stroke="#22c55e" strokeWidth={2.5} fill="url(#gWA)" dot={false} activeDot={{ r: 5, fill: '#22c55e', stroke: '#dcfce7', strokeWidth: 2 }} />
                                <Area type="monotone" dataKey="telegram" name="Telegram" stroke="#38bdf8" strokeWidth={2.5} fill="url(#gTG)" dot={false} activeDot={{ r: 5, fill: '#38bdf8', stroke: '#e0f2fe', strokeWidth: 2 }} />
                            </AreaChart>
                        </ResponsiveContainer>}
                    </div>
                </div>

                {/* Platform Health */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
                    <div>
                        <h3 className="text-gray-900 font-bold text-lg">Platform Status</h3>
                        <p className="text-gray-400 text-xs mt-0.5">Connection health</p>
                    </div>
                    {[
                        { name: 'Gmail', key: 'Mail', icon: <Mail size={16} />, color: 'bg-indigo-500', bar: 'bg-indigo-500', count: stats.sourceCount.Mail },
                        { name: 'WhatsApp', key: 'Whatsapp', icon: <MessageSquare size={16} />, color: 'bg-emerald-500', bar: 'bg-emerald-500', count: stats.sourceCount.Whatsapp },
                        { name: 'Telegram', key: 'Telegram', icon: <Send size={16} />, color: 'bg-sky-500', bar: 'bg-sky-500', count: stats.sourceCount.Telegram },
                    ].map((p) => {
                        const connected = connectedPlatforms[p.key];
                        const pct = stats.totalMessages > 0 ? Math.round((p.count / stats.totalMessages) * 100) : 0;
                        return (
                            <div key={p.key} className={`rounded-xl p-4 border transition-all ${connected ? 'bg-gray-50 border-gray-200' : 'bg-gray-50/50 border-gray-100 opacity-60'}`}>
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className={`p-1.5 ${p.color} rounded-lg text-white`}>{p.icon}</div>
                                        <span className="text-gray-800 text-sm font-semibold">{p.name}</span>
                                    </div>
                                    {connected
                                        ? <span className="text-emerald-600 text-xs font-bold flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>Online</span>
                                        : <button onClick={() => togglePlatform(p.key)} className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold border border-indigo-200 px-2 py-0.5 rounded-full hover:border-indigo-300 transition-all">Connect</button>
                                    }
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                        <div className={`h-full ${p.bar} rounded-full transition-all duration-700`} style={{ width: `${Math.max(pct, connected ? 5 : 0)}%` }}></div>
                                    </div>
                                    <span className="text-gray-400 text-xs w-10 text-right">{p.count} msg</span>
                                </div>
                            </div>
                        );
                    })}

                    {/* Read Rate Ring */}
                    <div className="mt-auto pt-3 border-t border-gray-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Read Rate</p>
                                <p className="text-3xl font-black text-gray-900 mt-0.5">{stats.readRate}<span className="text-lg text-gray-400">%</span></p>
                            </div>
                            <div className="relative w-16 h-16">
                                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                                    <circle cx="18" cy="18" r="14" fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
                                    <circle cx="18" cy="18" r="14" fill="none" stroke="#6366f1" strokeWidth="3.5"
                                        strokeDasharray={`${stats.readRate * 0.879} 87.96`}
                                        strokeLinecap="round" className="transition-all duration-1000" />
                                </svg>
                                <span className="absolute inset-0 flex items-center justify-center text-gray-700 text-xs font-bold">{stats.readRate}%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Second Row ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Hourly Volume Bar Chart */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-gray-900 font-bold text-base mb-1">Peak Hours</h3>
                    <p className="text-gray-400 text-xs mb-5">Message volume by time</p>
                    <div style={{ width: '100%', height: 160 }}>
                        {mounted && <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.hourlyData} barSize={18}>
                                <XAxis dataKey="h" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10 }} />
                                <YAxis hide />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.04)' }} />
                                <Bar dataKey="v" name="Messages" fill="#6366f1" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>}
                    </div>
                    <p className="text-xs text-gray-400 mt-3 text-center">Peak activity: <span className="text-indigo-600 font-semibold">2 PM – 4 PM</span></p>
                </div>

                {/* Recent Messages Feed */}
                <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h3 className="text-gray-900 font-bold text-base">Recent Messages</h3>
                            <p className="text-gray-400 text-xs mt-0.5">Latest across all platforms</p>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                            Live
                        </div>
                    </div>
                    <div className="space-y-2.5">
                        {stats.recentMessages.length > 0 ? stats.recentMessages.map((msg, i) => {
                            const platformColor = msg.source === 'Whatsapp' ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                                : msg.source === 'Telegram' ? 'text-sky-600 bg-sky-50 border-sky-200'
                                    : 'text-indigo-600 bg-indigo-50 border-indigo-200';
                            const initial = (msg.sender || '?')[0].toUpperCase();
                            return (
                                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all cursor-pointer">
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm border ${platformColor} flex-shrink-0`}>
                                        {initial}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline justify-between gap-2">
                                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${platformColor}`}>{msg.source}</span>
                                            <span className="text-gray-400 text-xs flex-shrink-0">{msg.time}</span>
                                        </div>
                                        <p className="text-gray-800 text-sm font-medium truncate mt-0.5">{msg.sender}</p>
                                        <p className="text-gray-400 text-xs truncate">{msg.subject || msg.preview}</p>
                                    </div>
                                    {!msg.read && <div className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0"></div>}
                                </div>
                            );
                        }) : (
                            <div className="text-center py-10">
                                <Bell size={32} className="text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500 text-sm">No messages yet</p>
                                <p className="text-gray-400 text-xs mt-1">Connect a platform to get started</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── AI Brief + Quick Stats ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* AI Brief */}
                <div className="lg:col-span-2 relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-600 shadow-lg shadow-indigo-200">
                    <div className="absolute -top-16 -right-16 w-56 h-56 bg-white opacity-5 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="absolute -bottom-16 -left-8 w-44 h-44 bg-white opacity-5 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm">
                                <Sparkles size={18} className="text-white" />
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-base">AI Daily Brief</h3>
                                <p className="text-indigo-200 text-xs">Powered by intelligence</p>
                            </div>
                            <div className="ml-auto flex items-center gap-1.5 text-xs text-white/80 font-semibold bg-white/10 border border-white/20 px-3 py-1.5 rounded-full">
                                <Zap size={11} /> Auto-generated
                            </div>
                        </div>
                        <div className="space-y-3">
                            {[
                                { icon: <TrendingUp size={14} />, text: `You have ${stats.unreadMessages} unread messages across ${connectedCount} connected platform${connectedCount !== 1 ? 's' : ''}.` },
                                { icon: <Clock size={14} />, text: 'Peak message volume detected between 2 PM – 4 PM. Schedule responses during this window for best engagement.' },
                                { icon: <Shield size={14} />, text: `${stats.readRate}% read rate — ${stats.readRate >= 70 ? 'Excellent inbox management!' : 'Consider clearing unread messages to stay on top.'}` },
                            ].map((item, i) => (
                                <div key={i} className="flex items-start gap-3 p-3 bg-white/10 rounded-xl border border-white/10 backdrop-blur-sm">
                                    <span className="text-indigo-200 mt-0.5 flex-shrink-0">{item.icon}</span>
                                    <p className="text-white/90 text-sm leading-relaxed">{item.text}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="flex flex-col gap-4">
                    {[
                        { label: 'Avg Response', value: '< 2h', sub: 'Across platforms', icon: <Clock size={16} />, color: 'from-amber-500 to-orange-500' },
                        { label: 'Platforms', value: `${connectedCount}/3`, sub: 'Connected', icon: <Wifi size={16} />, color: 'from-emerald-500 to-teal-500' },
                        { label: 'This Week', value: stats.totalMessages, sub: 'Total messages', icon: <Activity size={16} />, color: 'from-indigo-500 to-violet-500' },
                    ].map((item, i) => (
                        <div key={i} className="flex-1 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
                            <div className={`p-3 bg-gradient-to-br ${item.color} rounded-xl text-white shadow-md`}>
                                {item.icon}
                            </div>
                            <div>
                                <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold">{item.label}</p>
                                <p className="text-gray-900 text-2xl font-black">{item.value}</p>
                                <p className="text-gray-400 text-xs">{item.sub}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Overview;
