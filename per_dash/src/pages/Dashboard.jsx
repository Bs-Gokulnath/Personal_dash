import React, { useState, useEffect } from 'react';
import {
    Home,
    Inbox,
    Calendar,
    LayoutDashboard,
    Users,
    ChevronDown,
    ChevronRight,
    ChevronLeft,
    Search,
    Bell,
    LogOut,
    Menu,
    Settings,
    User,
    RefreshCw,
    Wand2,
    Sparkles
} from 'lucide-react';
import { auth } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import AIPromptModal from '../components/AIPromptModal';
import DraftPreview from '../components/DraftPreview';


const MOCK_MESSAGES = [
    { id: 1, source: 'Whatsapp', sender: 'John Doe', preview: 'Hey, are we still on for lunch?', time: '10:30 AM' },
    { id: 2, source: 'Mail', sender: 'Amazon', preview: 'Your package has been delivered', time: '9:15 AM' },
    { id: 3, source: 'Telegram', sender: 'Crypto Group', preview: 'Bitcoin is up 5%!', time: '8:45 AM' },
    { id: 4, source: 'Whatsapp', sender: 'Mom', preview: 'Call me when you can', time: 'Yesterday' },
    { id: 5, source: 'Mail', sender: 'Newsletter', preview: 'Weekly tech roundup', time: 'Yesterday' },
];

const Dashboard = () => {
    const [user, setUser] = useState(null);
    const [isInboxOpen, setIsInboxOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [activePage, setActivePage] = useState('Dashboard');
    const [messages, setMessages] = useState(MOCK_MESSAGES);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [errorMessages, setErrorMessages] = useState(null);
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [composeData, setComposeData] = useState({ to: '', subject: '', body: '' });
    const [sendingEmail, setSendingEmail] = useState(false);

    // AI Assistant States
    const [isAIPromptOpen, setIsAIPromptOpen] = useState(false);
    const [aiContext, setAIContext] = useState(null);
    const [generatedDraft, setGeneratedDraft] = useState(null);
    const [showDraftPreview, setShowDraftPreview] = useState(false);

    const navigate = useNavigate();

    const fetchEmails = async () => {
        if (activePage !== 'Inbox' && activePage !== 'Mail') return;

        setLoadingMessages(true);
        setErrorMessages(null);
        try {
            const response = await fetch('http://localhost:5000/api/emails');
            if (!response.ok) {
                throw new Error('Failed to fetch emails');
            }
            const data = await response.json();
            const otherMessages = MOCK_MESSAGES.filter(m => m.source !== 'Mail');
            setMessages([...otherMessages, ...data]);
        } catch (err) {
            console.error("Error fetching emails:", err);
            setErrorMessages("Could not load emails. Please ensure backend is running and authenticated.");
        } finally {
            setLoadingMessages(false);
        }
    };

    useEffect(() => {
        if (activePage === 'Inbox' || activePage === 'Mail') {
            fetchEmails();
        }
    }, [activePage]);

    const sendEmail = async () => {
        if (!composeData.to || !composeData.subject) {
            alert('Please fill in recipient and subject fields');
            return;
        }

        setSendingEmail(true);
        try {
            const response = await fetch('http://localhost:5000/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(composeData),
            });

            if (!response.ok) {
                throw new Error('Failed to send email');
            }

            alert('Email sent successfully!');
            setIsComposeOpen(false);
            setComposeData({ to: '', subject: '', body: '' });
            fetchEmails(); // Refresh inbox
        } catch (err) {
            console.error("Error sending email:", err);
            alert("Failed to send email. Please try again.");
        } finally {
            setSendingEmail(false);
        }
    };

    const handleReply = (message) => {
        const recipientEmail = message.sender.match(/<(.+?)>/)?.[1] || message.sender;
        setComposeData({
            to: recipientEmail,
            subject: `Re: ${message.subject}`,
            body: `\n\n---\nOn ${message.time}, ${message.sender} wrote:\n${message.preview}`
        });
        setIsComposeOpen(true);
        setSelectedMessage(null);
    };

    // AI Assistant Functions
    const handleAIAssistant = (emailContext) => {
        setAIContext(emailContext);
        setIsAIPromptOpen(true);
    };

    const handleGenerateDraft = async (prompt, tone, emailContext) => {
        try {
            const response = await fetch('http://localhost:5000/api/ai/generate-draft', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    tone,
                    emailContext: emailContext ? {
                        originalEmail: {
                            id: emailContext.id,
                            from: emailContext.sender,
                            subject: emailContext.subject,
                            body: emailContext.body || emailContext.preview
                        },
                        userEmail: user?.email || 'user@example.com'
                    } : { userEmail: user?.email || 'user@example.com' }
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to generate draft');
            }

            const data = await response.json();
            setGeneratedDraft(data.draft);
            setShowDraftPreview(true);
            setIsAIPromptOpen(false);
        } catch (error) {
            console.error('Error generating draft:', error);
            alert('Failed to generate draft. Please try again.');
        }
    };

    const handleImproveDraft = async (currentBody, instruction) => {
        const response = await fetch('http://localhost:5000/api/ai/improve-draft', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                currentDraft: currentBody,
                instruction
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to improve draft');
        }

        return await response.json();
    };

    const handleSendAIDraft = async (draft) => {
        try {
            const response = await fetch('http://localhost:5000/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(draft),
            });

            if (!response.ok) {
                throw new Error('Failed to send email');
            }

            alert('Email sent successfully!');
            setShowDraftPreview(false);
            setGeneratedDraft(null);
            fetchEmails(); // Refresh inbox
        } catch (error) {
            console.error('Error sending email:', error);
            throw error;
        }
    };

    const handleSummarize = async (email) => {
        try {
            const response = await fetch('http://localhost:5000/api/ai/summarize-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    emailContent: email.body || email.preview,
                    emailId: email.id
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to summarize email');
            }

            const data = await response.json();
            alert(`Summary:\n${data.summary}\n\nKey Points:\n${data.keyPoints.join('\n')}`);
        } catch (error) {
            console.error('Error summarizing email:', error);
            alert('Failed to summarize email. Please try again.');
        }
    };



    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
            } else {
                navigate('/signin');
            }
        });

        return () => unsubscribe();
    }, [navigate]);

    const handleSignOut = async () => {
        try {
            await signOut(auth);
            navigate('/signin');
        } catch (error) {
            console.error("Error signing out: ", error);
        }
    };

    const handleNavClick = (page) => {
        setActivePage(page);
        if (page !== 'Inbox' && !['Whatsapp', 'Mail', 'Telegram'].includes(page)) {
            setIsProfileOpen(false);
        }
        // On mobile, close sidebar when navigating
        if (window.innerWidth < 768) {
            setIsSidebarOpen(false);
        }
    };

    if (!user) return <div className="flex h-screen items-center justify-center">Loading...</div>;

    return (
        <div className="flex h-screen bg-gray-100 font-sans text-gray-900">
            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed z-50 h-full bg-[#1a1c4b] text-white transition-all duration-300 ease-in-out md:relative
                    ${isSidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0 md:w-20'}
                `}
            >
                {/* Toggle Button - Styled like reference */}
                <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="absolute -right-3 top-6 z-50 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#1a1c4b] shadow-md hover:bg-gray-100 focus:outline-none hidden md:flex"
                >
                    {isSidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
                </button>

                {/* Logo Area */}
                <div className="flex h-20 items-center justify-center border-b border-indigo-900 px-4">
                    <div className="flex items-center space-x-2">
                        <span className={`text-xl font-bold transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 md:hidden md:group-hover:block'} ${!isSidebarOpen && 'md:hidden'}`}>
                            Crivo's PA
                        </span>
                        {/* Show simple logo when collapsed on desktop */}
                        {!isSidebarOpen && (
                            <span className="hidden text-xl font-bold md:block">CP</span>
                        )}
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 space-y-2 overflow-y-auto py-6 px-3">
                    <NavItem
                        icon={<Home size={20} />}
                        label="Home"
                        isOpen={isSidebarOpen}
                        active={activePage === 'Home'}
                        onClick={() => handleNavClick('Home')}
                    />

                    {/* Inbox Dropdown */}
                    <div>
                        <button
                            onClick={() => {
                                setIsInboxOpen(true);
                                handleNavClick('Inbox');
                            }}
                            className={`flex w-full items-center justify-between rounded-lg px-4 py-3 transition-colors ${activePage === 'Inbox'
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                                : 'text-gray-300 hover:bg-indigo-900 hover:text-white'
                                } ${!isSidebarOpen && 'justify-center md:px-2'}`}
                        >
                            <div className="flex items-center space-x-3">
                                <Inbox size={20} />
                                {isSidebarOpen && <span>Inbox</span>}
                            </div>
                            {isSidebarOpen && (
                                <div
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsInboxOpen(!isInboxOpen);
                                    }}
                                    className="p-1 hover:bg-white/10 rounded"
                                >
                                    {isInboxOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </div>
                            )}
                        </button>

                        {/* Dropdown Items */}
                        {(isSidebarOpen && isInboxOpen) && (
                            <div className="ml-4 mt-1 space-y-1 border-l-2 border-indigo-800 pl-4">
                                <SubNavItem label="Whatsapp" onClick={() => handleNavClick('Whatsapp')} />
                                <SubNavItem label="Mail" onClick={() => handleNavClick('Mail')} />
                                <SubNavItem label="Telegram" onClick={() => handleNavClick('Telegram')} />
                            </div>
                        )}
                    </div>

                    <NavItem
                        icon={<Calendar size={20} />}
                        label="Calendar"
                        isOpen={isSidebarOpen}
                        active={activePage === 'Calendar'}
                        onClick={() => handleNavClick('Calendar')}
                    />
                    <NavItem
                        icon={<LayoutDashboard size={20} />}
                        label="Dashboard"
                        isOpen={isSidebarOpen}
                        active={activePage === 'Dashboard'}
                        onClick={() => handleNavClick('Dashboard')}
                    />
                    <NavItem
                        icon={<Users size={20} />}
                        label="Contacts"
                        isOpen={isSidebarOpen}
                        active={activePage === 'Contacts'}
                        onClick={() => handleNavClick('Contacts')}
                    />
                </nav>

                {/* Bottom Action */}
                <div className="border-t border-indigo-900 p-4">
                    <button
                        onClick={handleSignOut}
                        className={`flex w-full items-center rounded-lg bg-indigo-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-indigo-700 ${!isSidebarOpen && 'justify-center'}`}
                    >
                        {isSidebarOpen ? (
                            <>
                                <LogOut size={16} className="mr-2" />
                                <span>Sign Out</span>
                            </>
                        ) : (
                            <LogOut size={20} />
                        )}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Header */}
                <header className="flex h-20 items-center justify-between bg-white px-8 shadow-sm relative z-40">
                    <div className="flex items-center">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="mr-4 text-gray-500 focus:outline-none md:hidden"
                        >
                            <Menu size={24} />
                        </button>
                        <div className="relative hidden md:block">
                            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search..."
                                className="h-10 w-64 rounded-full bg-gray-100 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    <div className="flex items-center space-x-6">
                        <button className="relative text-gray-500 hover:text-gray-700">
                            <Bell size={20} />
                            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">3</span>
                        </button>

                        <div className="relative">
                            <button
                                onClick={() => setIsProfileOpen(!isProfileOpen)}
                                className="flex items-center space-x-3 border-l border-gray-200 pl-6 focus:outline-none"
                            >
                                <div className="text-right hidden md:block">
                                    <p className="text-sm font-semibold text-gray-800">{user.displayName || user.email.split('@')[0]}</p>
                                    <p className="text-xs text-gray-500">Admin</p>
                                </div>
                                <div className="h-10 w-10 overflow-hidden rounded-full border-2 border-white shadow-md">
                                    {user.photoURL ? (
                                        <img src={user.photoURL} alt="Profile" className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-blue-500 text-white font-bold">
                                            {(user.displayName || user.email || 'U')[0].toUpperCase()}
                                        </div>
                                    )}
                                </div>
                            </button>

                            {/* Profile Dropdown */}
                            {isProfileOpen && (
                                <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-lg bg-[#1a1c4b] text-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                                    <div className="p-1">
                                        <DropdownItem icon={<User size={16} />} label="Profile" onClick={() => handleNavClick('Profile')} />
                                        <DropdownItem icon={<Settings size={16} />} label="Settings" onClick={() => handleNavClick('Settings')} />
                                        <DropdownItem icon={<Inbox size={16} />} label="Inbox" onClick={() => { setIsInboxOpen(true); handleNavClick('Inbox'); setIsProfileOpen(false); }} />
                                        <DropdownItem icon={<LayoutDashboard size={16} />} label="Dashboard" onClick={() => { handleNavClick('Dashboard'); setIsProfileOpen(false); }} />
                                        <div className="my-1 h-px bg-indigo-800" />
                                        <DropdownItem icon={<LogOut size={16} />} label="Log out" onClick={handleSignOut} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>
                <main className="flex-1 overflow-y-auto p-8">
                    {activePage === 'Dashboard' ? (
                        <>
                            <div className="mb-8 flex items-center justify-between">
                                <h1 className="text-2xl font-bold text-gray-800">Dashboard Overview</h1>
                                <div className="flex space-x-2">
                                    <span className="text-sm text-gray-500">Today, {new Date().toLocaleDateString()}</span>
                                </div>
                            </div>

                            {/* Stats Cards */}
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                                <StatCard title="Total Sales" value="$3,450" change="+25%" isPositive={true} />
                                <StatCard title="Total Revenue" value="$35,256" change="+15%" isPositive={true} />
                                <StatCard title="Average Price" value="$35.25" change="-15%" isPositive={false} />
                                <StatCard title="Active Users" value="15,893" change="+12%" isPositive={true} />
                            </div>

                            {/* Charts Section Placeholder */}
                            <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
                                <div className="rounded-xl bg-white p-6 shadow-sm lg:col-span-2">
                                    <h3 className="mb-4 text-lg font-semibold text-gray-800">Market Overview</h3>
                                    <div className="flex h-64 items-center justify-center rounded-lg bg-gray-50 border border-dashed border-gray-300">
                                        <span className="text-gray-400">Chart Placeholder</span>
                                    </div>
                                </div>
                                <div className="rounded-xl bg-white p-6 shadow-sm">
                                    <h3 className="mb-4 text-lg font-semibold text-gray-800">Recent Activity</h3>
                                    <div className="space-y-4">
                                        {[1, 2, 3, 4].map((i) => (
                                            <div key={i} className="flex items-center justify-between border-b border-gray-100 pb-3 last:border-0">
                                                <div className="flex items-center space-x-3">
                                                    <div className="h-8 w-8 rounded-full bg-blue-100"></div>
                                                    <div>
                                                        <p className="text-sm font-medium">New Order #{1000 + i}</p>
                                                        <p className="text-xs text-gray-500">2 mins ago</p>
                                                    </div>
                                                </div>
                                                <span className="text-sm font-semibold text-green-600">+$120</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : ['Inbox', 'Whatsapp', 'Mail', 'Telegram'].includes(activePage) ? (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h1 className="text-2xl font-bold text-gray-800">{activePage === 'Inbox' ? 'All Messages' : `${activePage} Messages`}</h1>
                                <div className="flex items-center space-x-4">
                                    <button
                                        onClick={() => {
                                            setComposeData({ to: '', subject: '', body: '' });
                                            setIsComposeOpen(true);
                                        }}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                                        title="Compose Email"
                                    >
                                        Compose
                                    </button>
                                    <button
                                        onClick={() => handleAIAssistant(null)}
                                        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg text-sm font-medium flex items-center space-x-2"
                                        title="AI Email Assistant"
                                    >
                                        <Wand2 size={16} />
                                        <span>AI Assistant</span>
                                    </button>
                                    <button
                                        onClick={fetchEmails}
                                        className="p-2 text-gray-500 hover:text-blue-600 transition-colors rounded-full hover:bg-blue-50"
                                        title="Refresh Emails"
                                    >
                                        <RefreshCw size={20} className={loadingMessages ? 'animate-spin' : ''} />
                                    </button>
                                    <span className="text-sm text-gray-500">
                                        {loadingMessages ? 'Loading...' : `${messages.filter(m => activePage === 'Inbox' || m.source === activePage).length} messages`}
                                    </span>
                                </div>
                            </div>

                            <div className="rounded-xl bg-white shadow-sm overflow-hidden">
                                {loadingMessages ? (
                                    <div className="p-8 text-center text-gray-500">Loading messages...</div>
                                ) : errorMessages ? (
                                    <div className="p-8 text-center text-red-500">{errorMessages}</div>
                                ) : (
                                    <>
                                        {messages
                                            .filter(m => activePage === 'Inbox' || m.source === activePage)
                                            .map((message) => (
                                                <div
                                                    key={message.id}
                                                    onClick={() => setSelectedMessage(message)}
                                                    className="flex items-center justify-between border-b border-gray-100 p-4 hover:bg-gray-50 transition-colors last:border-0 cursor-pointer"
                                                >
                                                    <div className="flex items-center space-x-4">
                                                        <div className={`flex h-10 w-10 items-center justify-center rounded-full text-white font-bold
                                                ${message.source === 'Whatsapp' ? 'bg-green-500' :
                                                                message.source === 'Telegram' ? 'bg-blue-400' : 'bg-red-500'}`}>
                                                            {message.source[0]}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center space-x-2">
                                                                <h4 className="font-semibold text-gray-900">{message.sender}</h4>
                                                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{message.source}</span>
                                                            </div>
                                                            <p className="text-sm text-gray-600 line-clamp-1">{message.subject || message.preview}</p>
                                                            <p className="text-xs text-gray-400 line-clamp-1">{message.preview}</p>
                                                        </div>
                                                    </div>
                                                    <span className="text-xs text-gray-400 whitespace-nowrap ml-2">{message.time}</span>
                                                </div>
                                            ))}
                                        {messages.filter(m => activePage === 'Inbox' || m.source === activePage).length === 0 && (
                                            <div className="p-8 text-center text-gray-500">
                                                No messages found.
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center">
                            <h1 className="mb-4 text-4xl font-bold text-gray-800">{activePage}</h1>
                            <div className="rounded-lg bg-blue-100 px-6 py-3 text-blue-700">
                                <span className="font-semibold">Coming Soon</span>
                            </div>
                            <p className="mt-4 text-gray-500">We are working hard to bring you this feature.</p>
                        </div>
                    )}
                </main >

                {/* Message Detail Modal */}
                {
                    selectedMessage && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedMessage(null)}>
                            <div className="w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-xl bg-white shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
                                {/* Modal Header */}
                                <div className="flex items-center justify-between border-b border-gray-100 p-6">
                                    <div className="flex items-center space-x-4">
                                        <div className={`flex h-12 w-12 items-center justify-center rounded-full text-white font-bold text-xl
                                        ${selectedMessage.source === 'Whatsapp' ? 'bg-green-500' :
                                                selectedMessage.source === 'Telegram' ? 'bg-blue-400' : 'bg-red-500'}`}>
                                            {selectedMessage.source[0]}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900">{selectedMessage.sender}</h3>
                                            <p className="text-sm text-gray-500">{selectedMessage.time} • {selectedMessage.source}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setSelectedMessage(null)}
                                        className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                    >
                                        <ChevronDown className="rotate-180" size={24} />
                                    </button>
                                </div>

                                {/* Modal Content */}
                                <div className="flex-1 overflow-y-auto p-6">
                                    <h4 className="mb-4 text-xl font-semibold text-gray-800">{selectedMessage.subject}</h4>
                                    {selectedMessage.source === 'Mail' && selectedMessage.body ? (
                                        <div
                                            className="prose prose-sm max-w-none text-gray-700"
                                            dangerouslySetInnerHTML={{ __html: selectedMessage.body }}
                                        />
                                    ) : (
                                        <p className="text-gray-700 whitespace-pre-wrap">{selectedMessage.preview}</p>
                                    )}
                                </div>

                                {/* Modal Footer */}
                                <div className="border-t border-gray-100 p-4 bg-gray-50 flex justify-end space-x-2">
                                    <button onClick={() => setSelectedMessage(null)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800">
                                        Close
                                    </button>
                                    <button onClick={() => handleReply(selectedMessage)} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                                        Reply
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Compose Email Modal */}
                {
                    isComposeOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setIsComposeOpen(false)}>
                            <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                                {/* Modal Header */}
                                <div className="flex items-center justify-between border-b border-gray-100 p-6">
                                    <h3 className="text-lg font-bold text-gray-900">Compose Email</h3>
                                    <button
                                        onClick={() => setIsComposeOpen(false)}
                                        className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                    >
                                        <ChevronDown className="rotate-180" size={24} />
                                    </button>
                                </div>

                                {/* Modal Content */}
                                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
                                        <input
                                            type="email"
                                            value={composeData.to}
                                            onChange={(e) => setComposeData({ ...composeData, to: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="recipient@example.com"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                                        <input
                                            type="text"
                                            value={composeData.subject}
                                            onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="Email subject"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                                        <textarea
                                            value={composeData.body}
                                            onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
                                            rows={10}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                            placeholder="Write your message..."
                                        />
                                    </div>
                                </div>

                                {/* Modal Footer */}
                                <div className="border-t border-gray-100 p-4 bg-gray-50 flex justify-end space-x-2">
                                    <button onClick={() => setIsComposeOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800">
                                        Cancel
                                    </button>
                                    <button
                                        onClick={sendEmail}
                                        disabled={sendingEmail}
                                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {sendingEmail ? 'Sending...' : 'Send'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }
            </div >

            {/* AI Prompt Modal */}
            <AIPromptModal
                isOpen={isAIPromptOpen}
                onClose={() => {
                    setIsAIPromptOpen(false);
                    setAIContext(null);
                }}
                onGenerate={handleGenerateDraft}
                emailContext={aiContext}
            />

            {/* Draft Preview Modal */}
            {showDraftPreview && generatedDraft && (
                <DraftPreview
                    draft={generatedDraft}
                    onClose={() => {
                        setShowDraftPreview(false);
                        setGeneratedDraft(null);
                    }}
                    onSend={handleSendAIDraft}
                    onImprove={handleImproveDraft}
                />
            )}
        </div >
    );
};

// Helper Components
const NavItem = ({ icon, label, active, isOpen, onClick }) => (
    <button
        onClick={onClick}
        className={`flex w-full items-center rounded-lg px-4 py-3 transition-colors ${active
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
            : 'text-gray-300 hover:bg-indigo-900 hover:text-white'
            } ${!isOpen && 'justify-center'}`}
    >
        <div className={`${active ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}>
            {icon}
        </div>
        {isOpen && <span className="ml-3 font-medium">{label}</span>}
    </button>
);

const SubNavItem = ({ label, onClick }) => (
    <button
        onClick={onClick}
        className="block w-full rounded-md px-4 py-2 text-left text-sm text-gray-400 transition-colors hover:bg-indigo-900 hover:text-white"
    >
        {label}
    </button>
);

const DropdownItem = ({ icon, label, onClick }) => (
    <button
        onClick={onClick}
        className="flex w-full items-center rounded-md px-4 py-2 text-sm text-gray-300 hover:bg-indigo-800 hover:text-white transition-colors"
    >
        <span className="mr-3">{icon}</span>
        {label}
    </button>
);

const StatCard = ({ title, value, change, isPositive }) => (
    <div className="rounded-xl bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <div className="mt-2 flex items-end justify-between">
            <h4 className="text-2xl font-bold text-gray-800">{value}</h4>
            <span className={`flex items-center text-sm font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                {change}
            </span>
        </div>
    </div>
);

export default Dashboard;
