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
    Sparkles,
    MessageSquare,
    Send,
    Mail,
    X,
    FileText,
    ArrowRightLeft,
    Package,
    PieChart as PieChartIcon,
    BarChart as BarChartIcon
} from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { auth } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useNavigate, useLocation } from 'react-router-dom';
import AIPromptModal from '../components/AIPromptModal';
import DraftPreview from '../components/DraftPreview';
import TelegramAuthModal from '../components/TelegramAuthModal';
import PlatformSelector from '../components/PlatformSelector';
import Connectors from '../components/Connectors';


const Dashboard = () => {
    const [user, setUser] = useState(null);
    const [isInboxOpen, setIsInboxOpen] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [activePage, setActivePage] = useState('Inbox');
    const [messages, setMessages] = useState([]); // Start with empty - will be populated with real data
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [errorMessages, setErrorMessages] = useState(null);
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [composeData, setComposeData] = useState({ to: '', subject: '', body: '' });
    const [sendingEmail, setSendingEmail] = useState(false);

    // Connectors State
    const [connectedPlatforms, setConnectedPlatforms] = useState({
        Mail: false,
        Whatsapp: false,
        Telegram: false
    });

    const fetchPlatformStatus = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/platforms/status');
            if (response.ok) {
                const data = await response.json();
                setConnectedPlatforms(data);
            }
        } catch (error) {
            console.error("Error fetching platform status:", error);
        }
    };

    useEffect(() => {
        fetchPlatformStatus();
    }, []);

    const togglePlatform = async (platformId) => {
        const isConnected = connectedPlatforms[platformId];

        if (isConnected) {
            // Handle Disconnection
            if (window.confirm(`Are you sure you want to disconnect ${platformId}?`)) {
                try {
                    const response = await fetch(`http://localhost:5000/api/platforms/disconnect/${platformId}`, {
                        method: 'POST',
                        headers: { 'x-user-id': user?.uid || 'anonymous' }
                    });

                    if (response.ok) {
                        setConnectedPlatforms(prev => ({ ...prev, [platformId]: false }));
                    } else {
                        alert('Failed to disconnect. Please try again.');
                    }
                } catch (error) {
                    console.error("Error disconnecting:", error);
                    alert('Error disconnecting platform.');
                }
            }
        } else {
            // Handle Connection
            if (platformId === 'Mail') {
                window.location.href = 'http://localhost:5000/auth/google';
            } else if (platformId === 'Telegram') {
                setIsTelegramAuthOpen(true);
            } else if (platformId === 'Whatsapp') {
                alert("WhatsApp integration is coming soon!");
            }
        }
    };

    // Draft States
    const [drafts, setDrafts] = useState({});
    const [loadingDrafts, setLoadingDrafts] = useState({});

    const handleQuickDraft = async (message) => {
        setLoadingDrafts(prev => ({ ...prev, [message.id]: true }));
        try {
            const response = await fetch('http://localhost:5000/api/ai/generate-draft', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: "Draft a helpful reply to this message.",
                    emailContext: {
                        originalEmail: {
                            id: message.id,
                            sender: message.sender,
                            subject: message.subject,
                            body: message.body || message.preview
                        },
                        additionalContext: "The product cost is $34."
                    },
                    tone: 'professional'
                })
            });
            const data = await response.json();
            if (data.success) {
                // Extract body and strip HTML for quick view
                const bodyHtml = data.draft.body || '';
                const tempDiv = document.createElement("div");
                tempDiv.innerHTML = bodyHtml;
                const bodyText = tempDiv.textContent || tempDiv.innerText || "";
                setDrafts(prev => ({ ...prev, [message.id]: bodyText }));
            }
        } catch (error) {
            console.error("Draft generation failed", error);
        } finally {
            setLoadingDrafts(prev => ({ ...prev, [message.id]: false }));
        }
    };

    const [reviewDraft, setReviewDraft] = useState(null);

    const handleOpenReview = (message) => {
        const recipientEmail = message.sender.match(/<(.+?)>/)?.[1] || message.sender;
        const draftBody = drafts[message.id];

        if (!draftBody) return;

        setReviewDraft({
            to: recipientEmail,
            subject: `Re: ${message.subject}`,
            body: draftBody,
            messageId: message.id
        });
    };

    const handleSendReviewedDraft = async (draft) => {
        const response = await fetch('http://localhost:5000/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to: draft.to,
                subject: draft.subject,
                body: draft.body
            }),
        });

        if (!response.ok) throw new Error('Failed to send email');

        alert('Reply sent successfully!');
        setDrafts(prev => {
            const newDrafts = { ...prev };
            if (reviewDraft?.messageId) delete newDrafts[reviewDraft.messageId];
            return newDrafts;
        });
        setReviewDraft(null);
    };

    // AI Assistant States
    const [isAIPromptOpen, setIsAIPromptOpen] = useState(false);
    const [aiContext, setAIContext] = useState(null);
    const [generatedDraft, setGeneratedDraft] = useState(null);
    const [showDraftPreview, setShowDraftPreview] = useState(false);

    // Telegram States
    const [isTelegramAuthOpen, setIsTelegramAuthOpen] = useState(false);
    const [telegramConnected, setTelegramConnected] = useState(false);
    const [telegramChats, setTelegramChats] = useState([]);
    const [selectedPlatform, setSelectedPlatform] = useState('all');
    const [selectedTelegramChat, setSelectedTelegramChat] = useState(null);
    const [replyText, setReplyText] = useState('');

    // AI Chat State
    const [isAIChatOpen, setIsAIChatOpen] = useState(false);
    const [aiChatMessages, setAIChatMessages] = useState([{ role: 'system', content: 'Hello! I am your personal dashboard assistant. How can I help you today?' }]);
    const [aiChatInput, setAIChatInput] = useState('');
    const [isAiThinking, setIsAiThinking] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const pageParam = params.get('page');
        if (pageParam) {
            setActivePage(pageParam);
        }
    }, [location]);

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
            // Merge with existing messages, removing old Mail messages
            setMessages(prev => [...prev.filter(m => m.source !== 'Mail'), ...data]);
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

    useEffect(() => {
        // Check Telegram connection on mount
        checkTelegramConnection();
    }, []);

    useEffect(() => {
        // Fetch Telegram chats when on Telegram page
        if (activePage === 'Telegram' && telegramConnected) {
            fetchTelegramChats();
        }
    }, [activePage, telegramConnected]);

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
        if (message.source === 'Telegram') {
            setSelectedTelegramChat(message);
            // Don't close the modal, just show reply input
        } else {
            // Default to Mail behavior
            const recipientEmail = message.sender.match(/<(.+?)>/)?.[1] || message.sender;
            setComposeData({
                to: recipientEmail,
                subject: `Re: ${message.subject}`,
                body: `\n\n---\nOn ${message.time}, ${message.sender} wrote:\n${message.preview}`
            });
            setIsComposeOpen(true);
            setSelectedMessage(null);
        }
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

    const handleSendAIChat = async () => {
        if (!aiChatInput.trim()) return;

        const userMessage = { role: 'user', content: aiChatInput };
        setAIChatMessages(prev => [...prev, userMessage]);
        setAIChatInput('');
        setIsAiThinking(true);

        try {
            const response = await fetch('http://localhost:5000/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: userMessage.content }),
            });

            const data = await response.json();

            if (data.success) {
                setAIChatMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
            } else {
                setAIChatMessages(prev => [...prev, { role: 'assistant', content: "I'm sorry, I encountered an error. Please try again." }]);
            }
        } catch (error) {
            console.error('AI Chat Error:', error);
            setAIChatMessages(prev => [...prev, { role: 'assistant', content: "I'm having trouble connecting to the server." }]);
        } finally {
            setIsAiThinking(false);
        }
    };

    const handleSendTelegramReply = async () => {
        if (!replyText.trim() || !selectedTelegramChat) return;

        try {
            const response = await fetch('http://localhost:5000/api/telegram/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatId: selectedTelegramChat.chatId, // We need to ensure chatId is preserved
                    text: replyText
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to send message');
            }

            setReplyText('');
            setSelectedTelegramChat(null);
            alert('Reply sent!');
            fetchTelegramChats(); // Refresh to show new message
        } catch (error) {
            console.error('Error sending Telegram reply:', error);
            alert('Failed to send reply');
        }
    };

    // Telegram Functions
    const checkTelegramConnection = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/telegram/status');
            const data = await response.json();
            setTelegramConnected(data.connected);
            if (data.connected) {
                fetchTelegramChats();
            }
        } catch (error) {
            console.error('Error checking Telegram status:', error);
        }
    };

    const fetchTelegramChats = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/telegram/chats');
            if (response.ok) {
                const data = await response.json();
                setTelegramChats(data.chats || []);

                // Convert Telegram chats to message format and add to messages
                const telegramMessages = (data.chats || []).map(chat => ({
                    id: `telegram_${chat.id}`,
                    chatId: chat.id,
                    source: 'Telegram',
                    sender: chat.title,
                    preview: chat.message?.text || 'No messages yet',
                    time: chat.message?.date ? new Date(chat.message.date * 1000).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                    }) : '',
                    subject: '',
                    body: chat.message?.text || '',
                    unreadCount: chat.unreadCount
                }));

                // Merge with existing messages, removing old Telegram messages first
                setMessages(prev => [
                    ...prev.filter(m => m.source !== 'Telegram'),
                    ...telegramMessages
                ]);
            }
        } catch (error) {
            console.error('Error fetching Telegram chats:', error);
        }
    };

    const handleTelegramAuthSuccess = () => {
        setTelegramConnected(true);
        fetchTelegramChats();
        fetchPlatformStatus(); // Update connectors status
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

    useEffect(() => {
        if (user) {
            fetchEmails();
            checkTelegramConnection();
        }
    }, [user]);

    useEffect(() => {
        if (telegramConnected) {
            fetchTelegramChats();
        }
    }, [telegramConnected]);

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

    // Chart Data
    const pieData = [
        { name: 'Mail', value: connectedPlatforms['Mail'] ? messages.filter(m => m.source === 'Mail').length : 0, color: '#3b82f6' },
        { name: 'Telegram', value: connectedPlatforms['Telegram'] ? messages.filter(m => m.source === 'Telegram').length : 0, color: '#8b5cf6' },
        { name: 'Whatsapp', value: connectedPlatforms['Whatsapp'] ? messages.filter(m => m.source === 'Whatsapp').length : 0, color: '#22c55e' },
    ].filter(d => d.value > 0);

    const barData = [
        { name: 'Mon', count: 12 },
        { name: 'Tue', count: 19 },
        { name: 'Wed', count: 3 },
        { name: 'Thu', count: 5 },
        { name: 'Fri', count: 2 },
    ];

    if (!user) return <div className="flex h-screen items-center justify-center bg-gray-50 text-gray-600">Loading...</div>;

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
                        {isSidebarOpen ? (
                            <div className="flex items-center space-x-2">
                                <img src="/assets/clogo.jpg" alt="Logo" className="h-8 w-8 rounded-full" />
                                <span className="text-xl font-bold">Crivo's PA</span>
                            </div>
                        ) : (
                            <img src="/assets/clogo.jpg" alt="Logo" className="h-8 w-8 rounded-full hidden md:block" />
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
                    <NavItem
                        icon={<ArrowRightLeft size={20} />}
                        label="Connectors"
                        isOpen={isSidebarOpen}
                        active={activePage === 'Connectors'}
                        onClick={() => handleNavClick('Connectors')}
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
                    {activePage === 'Connectors' ? (
                        <Connectors connectedPlatforms={connectedPlatforms} togglePlatform={togglePlatform} />
                    ) : activePage === 'Dashboard' ? (
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
                                    {activePage === 'Telegram' && !telegramConnected && (
                                        <button
                                            onClick={() => setIsTelegramAuthOpen(true)}
                                            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-all text-sm font-medium flex items-center space-x-2 shadow-md"
                                        >
                                            <MessageSquare size={16} />
                                            <span>Connect Telegram</span>
                                        </button>
                                    )}

                                    {/* Refresh button for Telegram */}
                                    {activePage === 'Telegram' && telegramConnected && (
                                        <button
                                            onClick={fetchTelegramChats}
                                            className="p-2 text-gray-500 hover:text-blue-600 transition-colors rounded-full hover:bg-blue-50"
                                            title="Refresh Telegram Chats"
                                        >
                                            <RefreshCw size={20} />
                                        </button>
                                    )}

                                    {/* Compose button only for Mail and Inbox */}
                                    {(activePage === 'Mail' || activePage === 'Inbox') && (
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
                                    )}

                                    {/* Refresh button for Mail */}
                                    {(activePage === 'Mail' || activePage === 'Inbox') && (
                                        <>
                                            <button
                                                onClick={fetchEmails}
                                                className="p-2 text-gray-500 hover:text-blue-600 transition-colors rounded-full hover:bg-blue-50"
                                                title="Refresh Emails"
                                            >
                                                <RefreshCw size={20} className={loadingMessages ? 'animate-spin' : ''} />
                                            </button>
                                            <span className="text-sm text-gray-500">
                                                {loadingMessages ? 'Loading...' : `${messages.filter(m => connectedPlatforms[m.source] && (activePage === 'Inbox' || m.source === activePage)).length} messages`}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="rounded-xl bg-white shadow-sm overflow-hidden">
                                {loadingMessages ? (
                                    <div className="p-8 text-center text-gray-500">Loading messages...</div>
                                ) : (errorMessages && (activePage === 'Mail' || activePage === 'Inbox')) ? (
                                    <div className="p-8 text-center text-red-500">{errorMessages}</div>
                                ) : (
                                    <>
                                        {messages
                                            .filter(m => connectedPlatforms[m.source] && (activePage === 'Inbox' || m.source === activePage))
                                            .map((message) => (
                                                <div key={message.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                                    <div className="flex flex-col md:flex-row">
                                                        {/* Left: Message Content */}
                                                        <div
                                                            className="flex-1 p-4 cursor-pointer border-r border-gray-100"
                                                            onClick={() => {
                                                                setSelectedMessage(message);
                                                                if (message.source === 'Telegram') setSelectedTelegramChat(message);
                                                            }}
                                                        >
                                                            <div className="flex items-center space-x-4">
                                                                <div className={`flex h-10 w-10 items-center justify-center rounded-full text-white font-bold flex-shrink-0
                                                                    ${message.source === 'Whatsapp' ? 'bg-green-500' :
                                                                        message.source === 'Telegram' ? 'bg-blue-400' : 'bg-red-500'}`}>
                                                                    {message.source[0]}
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex items-center justify-between mb-1">
                                                                        <h4 className="font-semibold text-gray-900 truncate">{message.sender}</h4>
                                                                        <span className="text-xs text-gray-400 whitespace-nowrap ml-2">{message.time}</span>
                                                                    </div>
                                                                    <p className="text-sm text-gray-600 line-clamp-1 font-medium">{message.subject || message.preview}</p>
                                                                    <p className="text-xs text-gray-400 line-clamp-2">{message.preview}</p>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Right: AI Draft */}
                                                        <div className="w-full md:w-1/2 p-4 bg-gray-50/50">
                                                            <div className="bg-white rounded-lg border border-gray-200 p-3 h-full flex flex-col shadow-sm min-h-[120px]">
                                                                <div className="flex justify-between items-center mb-2">
                                                                    <span className="text-xs font-bold text-purple-600 flex items-center gap-1">
                                                                        <Sparkles size={12} /> AI Draft
                                                                    </span>
                                                                    <div className="flex gap-2">
                                                                        {drafts[message.id] && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleOpenReview(message);
                                                                                }}
                                                                                className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition-colors flex items-center gap-1"
                                                                            >
                                                                                <FileText size={12} /> Review
                                                                            </button>
                                                                        )}
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleQuickDraft(message);
                                                                            }}
                                                                            disabled={loadingDrafts[message.id]}
                                                                            className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded hover:bg-purple-200 disabled:opacity-50 transition-colors"
                                                                        >
                                                                            {loadingDrafts[message.id] ? 'Generating...' : drafts[message.id] ? 'Regenerate' : 'Generate'}
                                                                        </button>
                                                                    </div>
                                                                </div>

                                                                {drafts[message.id] ? (
                                                                    <textarea
                                                                        className="flex-1 w-full text-sm text-gray-600 resize-none border-none focus:ring-0 bg-transparent p-0"
                                                                        value={drafts[message.id]}
                                                                        onChange={(e) => setDrafts(prev => ({ ...prev, [message.id]: e.target.value }))}
                                                                    />
                                                                ) : (
                                                                    <div className="flex-1 flex items-center justify-center text-gray-400 text-xs italic p-4 text-center">
                                                                        Click Generate to create a draft response based on this message.
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}

                                        {messages.filter(m => activePage === 'Inbox' || m.source === activePage).length === 0 && (
                                            <div className="p-12 text-center">
                                                <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                                                    {activePage === 'Whatsapp' && <MessageSquare className="text-gray-400" size={32} />}
                                                    {activePage === 'Mail' && <Mail className="text-gray-400" size={32} />}
                                                    {activePage === 'Telegram' && <MessageSquare className="text-gray-400" size={32} />}
                                                    {activePage === 'Inbox' && <Inbox className="text-gray-400" size={32} />}
                                                </div>
                                                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                                                    {activePage === 'Inbox' ? 'No Messages' : `${activePage} Not Connected`}
                                                </h3>
                                                <p className="text-sm text-gray-500">
                                                    {activePage === 'Whatsapp' && 'Connect your WhatsApp account to view messages'}
                                                    {activePage === 'Mail' && 'Connect your email account to view messages'}
                                                    {activePage === 'Telegram' && !telegramConnected && 'Click "Connect Telegram" to view messages'}
                                                    {activePage === 'Telegram' && telegramConnected && 'Loading your Telegram chats...'}
                                                    {activePage === 'Inbox' && 'No messages from any platform yet'}
                                                </p>
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
                    )
                    }
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

                                    {/* Telegram Reply Input */}
                                    {selectedTelegramChat && selectedTelegramChat.id === selectedMessage.id && (
                                        <div className="mt-6 border-t pt-4">
                                            <h5 className="text-sm font-medium text-gray-700 mb-2">Reply to {selectedMessage.sender}</h5>
                                            <textarea
                                                value={replyText}
                                                onChange={(e) => setReplyText(e.target.value)}
                                                placeholder="Type your reply..."
                                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                                rows="3"
                                                autoFocus
                                            />
                                            <div className="flex justify-end mt-3 space-x-2">
                                                <button
                                                    onClick={() => {
                                                        setSelectedTelegramChat(null);
                                                        setReplyText('');
                                                    }}
                                                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={handleSendTelegramReply}
                                                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-1"
                                                >
                                                    <span>Send Reply</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Modal Footer - Hide if replying via Telegram */}
                                {(!selectedTelegramChat || selectedTelegramChat.id !== selectedMessage.id) && (
                                    <div className="border-t border-gray-100 p-4 bg-gray-50 flex justify-end space-x-2">
                                        <button onClick={() => setSelectedMessage(null)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800">
                                            Close
                                        </button>
                                        <button onClick={() => handleReply(selectedMessage)} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                                            Reply
                                        </button>
                                    </div>
                                )}
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
            < AIPromptModal
                isOpen={isAIPromptOpen}
                onClose={() => {
                    setIsAIPromptOpen(false);
                    setAIContext(null);
                }}
                onGenerate={handleGenerateDraft}
                emailContext={aiContext}
            />

            {/* Draft Preview Modal */}
            {
                showDraftPreview && generatedDraft && (
                    <DraftPreview
                        draft={generatedDraft}
                        onClose={() => {
                            setShowDraftPreview(false);
                            setGeneratedDraft(null);
                        }}
                        onSend={handleSendAIDraft}
                        onImprove={handleImproveDraft}
                    />
                )
            }
            {/* Telegram Auth Modal */}
            <TelegramAuthModal
                isOpen={isTelegramAuthOpen}
                onClose={() => setIsTelegramAuthOpen(false)}
                onSuccess={handleTelegramAuthSuccess}
            />

            {/* AI Chat FAB */}
            <button
                onClick={() => setIsAIChatOpen(!isAIChatOpen)}
                className="fixed bottom-6 right-6 p-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full shadow-2xl hover:scale-105 transition-transform z-50"
            >
                {isAIChatOpen ? <X size={24} /> : <Wand2 size={24} />}
            </button>

            {/* AI Chat Window */}
            {
                isAIChatOpen && (
                    <div className="fixed bottom-24 right-6 w-96 h-[500px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 border border-gray-100">
                        <div className="p-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white flex justify-between items-center">
                            <h3 className="font-bold flex items-center gap-2"><Wand2 size={18} /> AI Assistant</h3>
                            <button onClick={() => setIsAIChatOpen(false)} className="hover:bg-white/20 p-1 rounded"><X size={18} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                            {aiChatMessages.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] p-3 rounded-xl text-sm ${msg.role === 'user'
                                        ? 'bg-purple-600 text-white rounded-br-none'
                                        : 'bg-white text-gray-800 shadow-sm rounded-bl-none border border-gray-100'
                                        }`}>
                                        {msg.content}
                                    </div>
                                </div>
                            ))}
                            {isAiThinking && (
                                <div className="flex justify-start">
                                    <div className="bg-white p-3 rounded-xl rounded-bl-none shadow-sm border border-gray-100">
                                        <div className="flex space-x-1">
                                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-3 bg-white border-t border-gray-100">
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={aiChatInput}
                                    onChange={(e) => setAIChatInput(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSendAIChat()}
                                    placeholder="Ask me anything..."
                                    className="flex-1 p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                                />
                                <button
                                    onClick={handleSendAIChat}
                                    disabled={!aiChatInput.trim() || isAiThinking}
                                    className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                                >
                                    <Send size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {reviewDraft && (
                <DraftPreview
                    draft={reviewDraft}
                    onClose={() => setReviewDraft(null)}
                    onSend={handleSendReviewedDraft}
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
        className={`flex w-full items-center rounded-lg px-4 py-3 transition-all duration-200 group ${active
            ? 'bg-blue-50 text-blue-600'
            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            } ${!isOpen && 'justify-center'}`}
    >
        <div className={`${active ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`}>
            {icon}
        </div>
        {isOpen && <span className="ml-3 font-medium text-sm">{label}</span>}
    </button>
);

const SubNavItem = ({ label, onClick }) => (
    <button
        onClick={onClick}
        className="block w-full rounded-md px-4 py-2 text-left text-sm text-gray-500 transition-colors hover:bg-blue-50 hover:text-blue-600"
    >
        {label}
    </button>
);

const DropdownItem = ({ icon, label, onClick }) => (
    <button
        onClick={onClick}
        className="flex w-full items-center rounded-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
    >
        <span className="mr-3 text-gray-400">{icon}</span>
        {label}
    </button>
);

const StatCard = ({ title, value, icon, change }) => (
    <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col justify-between h-32 hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start">
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <div className="p-2 bg-gray-50 rounded-lg text-gray-600">
                {icon}
            </div>
        </div>
        <div className="flex items-end justify-between">
            <h4 className="text-2xl font-bold text-gray-900">{value}</h4>
            {change && <span className="text-xs text-green-500">{change}</span>}
        </div>
    </div>
);

export default Dashboard;
