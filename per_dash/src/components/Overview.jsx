import React, { useMemo } from 'react';
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import {
    Mail, MessageSquare, Send, ArrowUp, ArrowDown, Activity, Clock, Zap
} from 'lucide-react';

const Overview = ({ messages, connectedPlatforms, user }) => {

    // --- Data Processing ---
    const stats = useMemo(() => {
        const totalMessages = messages.length;
        const unreadMessages = messages.filter(m => !m.read).length; // Assuming 'read' property exists or updated

        const sourceCount = messages.reduce((acc, curr) => {
            acc[curr.source] = (acc[curr.source] || 0) + 1;
            return acc;
        }, { Mail: 0, Whatsapp: 0, Telegram: 0 });

        // Mock Activity Data (Messages by hour/time)
        // In a real app, strict date parsing is needed.
        const activityData = [
            { name: 'Mon', emails: 4, chats: 2 },
            { name: 'Tue', emails: 7, chats: 5 },
            { name: 'Wed', emails: 2, chats: 8 },
            { name: 'Thu', emails: 9, chats: 3 },
            { name: 'Fri', emails: 5, chats: 6 },
            { name: 'Sat', emails: 3, chats: 9 },
            { name: 'Sun', emails: 1, chats: 4 },
        ];

        const platformData = [
            { name: 'Mail', value: sourceCount.Mail || 0, color: '#3b82f6' }, // Blue
            { name: 'Whatsapp', value: sourceCount.Whatsapp || 0, color: '#22c55e' }, // Green
            { name: 'Telegram', value: sourceCount.Telegram || 0, color: '#0ea5e9' }, // Sky
        ].filter(d => d.value > 0);

        // Fallback for empty state to show chart structure
        const finalPlatformData = platformData.length > 0 ? platformData : [{ name: 'No Data', value: 1, color: '#e5e7eb' }];

        return { totalMessages, unreadMessages, sourceCount, activityData, finalPlatformData };
    }, [messages]);

    // --- Components ---
    const StatCard = ({ title, value, subtext, icon, colorClass, delay }) => (
        <div
            className={`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-4`}
            style={{ animationDelay: `${delay}ms` }}
        >
            <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
                    <h3 className="text-3xl font-bold text-gray-900">{value}</h3>
                </div>
                <div className={`p-3 rounded-xl ${colorClass} bg-opacity-10 text-opacity-100`}>
                    {icon}
                </div>
            </div>
            {subtext && (
                <div className="flex items-center text-xs font-medium text-gray-500">
                    {subtext}
                </div>
            )}
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                        Welcome back, {user?.displayName?.split(' ')[0] || 'User'}! 👋
                    </h1>
                    <p className="text-gray-500 mt-1">Here's what's happening across your connected platforms today.</p>
                </div>
                <div className="flex gap-3">
                    <button className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm">
                        Export Report
                    </button>
                    <button className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors shadow-lg shadow-gray-200">
                        Insights
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Messages"
                    value={stats.totalMessages}
                    icon={<MessageSquare size={24} />}
                    colorClass="bg-indigo-500 text-indigo-600"
                    subtext={<span className="text-green-600 flex items-center gap-1"><ArrowUp size={14} /> +12% from last week</span>}
                    delay={0}
                />
                <StatCard
                    title="Emails"
                    value={stats.sourceCount.Mail}
                    icon={<Mail size={24} />}
                    colorClass="bg-blue-500 text-blue-600"
                    subtext={<span className="text-gray-500">5 unread emails</span>}
                    delay={100}
                />
                <StatCard
                    title="Telegram"
                    value={stats.sourceCount.Telegram}
                    icon={<Send size={24} />}
                    colorClass="bg-sky-500 text-sky-600"
                    subtext={<span className="text-gray-500">Active in 3 groups</span>}
                    delay={200}
                />
                <StatCard
                    title="Efficiency"
                    value="94%"
                    icon={<Zap size={24} />}
                    colorClass="bg-amber-500 text-amber-600"
                    subtext={<span className="text-green-600 flex items-center gap-1"><ArrowUp size={14} /> Top 5% productivity</span>}
                    delay={300}
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Activity Chart */}
                <div className="lg:col-span-2 bg-white rounded-3xl p-8 shadow-sm border border-gray-100 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Activity size={120} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-6 relative z-10">Activity Overview</h3>
                    <div className="h-[300px] w-full relative z-10">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.activityData}>
                                <defs>
                                    <linearGradient id="colorEmails" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorChats" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    cursor={{ stroke: '#e5e7eb', strokeWidth: 1 }}
                                />
                                <Area type="monotone" dataKey="emails" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorEmails)" />
                                <Area type="monotone" dataKey="chats" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorChats)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Integration Distribution */}
                <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col items-center justify-center relative">
                    <h3 className="text-xl font-bold text-gray-900 mb-2 self-start w-full">Traffic Source</h3>
                    <div className="h-[250px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.finalPlatformData}
                                    innerRadius={70}
                                    outerRadius={90}
                                    paddingAngle={5}
                                    dataKey="value"
                                    cornerRadius={8}
                                >
                                    {stats.finalPlatformData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    {/* Legend */}
                    <div className="flex flex-wrap gap-4 justify-center mt-6">
                        {stats.finalPlatformData.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                                <span className="text-sm font-medium text-gray-600">{item.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Upcoming / Recent Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-3xl p-8 text-white relative overflow-hidden">
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl"></div>
                    <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-500 opacity-20 rounded-full blur-3xl"></div>

                    <div className="relative z-10">
                        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <Clock className="opacity-70" /> Recent Updates
                        </h3>
                        <div className="space-y-4">
                            {messages.slice(0, 3).map((msg, idx) => (
                                <div key={idx} className="bg-white/10 backdrop-blur-md rounded-xl p-4 flex items-center gap-4 hover:bg-white/20 transition-colors cursor-pointer border border-white/10">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg
                                        ${msg.source === 'Whatsapp' ? 'bg-green-500/20 text-green-300' :
                                            msg.source === 'Telegram' ? 'bg-sky-500/20 text-sky-300' :
                                                'bg-blue-500/20 text-blue-300'}`}>
                                        {msg.source[0]}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-baseline mb-1">
                                            <h4 className="font-semibold truncate pr-2">{msg.sender}</h4>
                                            <span className="text-xs opacity-60 text-nowrap">{msg.time}</span>
                                        </div>
                                        <p className="text-sm opacity-70 truncate">{msg.subject || msg.preview}</p>
                                    </div>
                                </div>
                            ))}
                            {messages.length === 0 && (
                                <div className="text-center opacity-60 py-8">No recent messages found</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* AI Insights Placeholder */}
                <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-gradient-to-r from-pink-500 to-rose-500 rounded-lg text-white">
                                <Sparkles size={20} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900">AI Daily Brief</h3>
                        </div>
                        <p className="text-gray-600 leading-relaxed mb-6">
                            Based on your activity, you're receiving 25% more inquiries on Telegram this week.
                            Consider enabling auto-replies for after-hours to maintain your response time efficiency.
                            Your email volume is stable, with most activity occurring between 9 AM and 11 AM.
                        </p>
                    </div>
                    <button className="w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 font-medium hover:border-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all">
                        Generate Full Report
                    </button>
                </div>
            </div>
        </div>
    );
};

// Helper for Lucide generic usage if needed, though specific imports are better
import { Sparkles } from 'lucide-react';

export default Overview;
