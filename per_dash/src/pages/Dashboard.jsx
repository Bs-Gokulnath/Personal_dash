import React, { useState, useEffect, useRef } from 'react';
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
    BarChart as BarChartIcon,
    Pencil,
    Star,
    Clock,
    File,
    Tag,
    Plus,
    AlertCircle,
    Trash2,
    Archive,
    Lock
} from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { auth } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useNavigate, useLocation } from 'react-router-dom';
import AIPromptModal from '../components/AIPromptModal';
import DraftPreview from '../components/DraftPreview';
import TelegramAuthModal from '../components/TelegramAuthModal';
import WhatsAppAuthModal from '../components/WhatsAppAuthModal';
import PlatformSelector from '../components/PlatformSelector';
import Connectors from '../components/Connectors';
import Overview from '../components/Overview';

const MailSidebarItem = ({ icon, label, count, active, onClick }) => (
    <button
        onClick={onClick}
        className={`flex w-full items-center justify-between rounded-r-full px-6 py-2 text-sm font-medium transition-colors mb-1
            ${active ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
    >
        <div className="flex items-center gap-4">
            <span className={active ? 'text-blue-700' : 'text-gray-500'}>{icon}</span>
            <span>{label}</span>
        </div>
        {count && <span className={`text-xs ${active ? 'font-bold' : ''}`}>{count}</span>}
    </button>
);

const MailTab = ({ icon, label, badge, active, onClick, color }) => {
    const activeColorClass = {
        blue: 'text-blue-600 border-blue-600',
        green: 'text-green-600 border-green-600',
        orange: 'text-orange-600 border-orange-600'
    }[color] || 'text-blue-600 border-blue-600';

    return (
        <button
            onClick={onClick}
            className={`flex-1 flex items-center gap-3 px-4 py-4 border-b-3 transition-all hover:bg-gray-50 min-w-[200px]
                ${active ? activeColorClass + ' bg-gray-50' : 'border-transparent text-gray-500 bg-white'}`}
        >
            {icon}
            <div className="flex-1 text-left flex items-center justify-between">
                <span className={`text-sm font-medium ${active ? 'text-gray-900' : ''}`}>{label}</span>
                {badge && (
                    <span className={`ml-2 text-[10px] px-2 py-0.5 rounded-full text-white font-bold
                    ${color === 'green' ? 'bg-green-600' : color === 'blue' ? 'bg-blue-600' : 'bg-orange-500'}`}>
                        {badge}
                    </span>
                )}
            </div>
        </button>
    );
};


const Dashboard = () => {
    const [user, setUser] = useState(null);
    const [isInboxOpen, setIsInboxOpen] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [activePage, setActivePage] = useState(() => {
        const savedPage = localStorage.getItem('activePage');
        return savedPage || 'Dashboard';
    });
    const [messages, setMessages] = useState([]); // Start with empty - will be populated with real data
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [errorMessages, setErrorMessages] = useState(null);
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [composeData, setComposeData] = useState({ to: '', subject: '', body: '' });
    const [sendingEmail, setSendingEmail] = useState(false);
    const [isGmailWarningOpen, setIsGmailWarningOpen] = useState(false);
    const [hasReadWarning, setHasReadWarning] = useState(false);
    const [mailTab, setMailTab] = useState(() => {
        const savedTab = localStorage.getItem('mailTab');
        return savedTab || 'Primary';
    });
    const [visibleNavItems, setVisibleNavItems] = useState(() => {
        const savedItems = localStorage.getItem('visibleNavItems');
        return savedItems ? JSON.parse(savedItems) : ['Dashboard', 'Mail', 'Whatsapp'];
    }); // Default visible items
    const [isNavCustomizeOpen, setIsNavCustomizeOpen] = useState(false);

    const allNavItems = [
        { id: 'Dashboard', label: 'Overview' },
        { id: 'Mail', label: 'Mail' },
        { id: 'Whatsapp', label: 'Whatsapp' },
        { id: 'Telegram', label: 'Telegram' }
    ];

    const handleNavToggle = (itemId) => {
        setVisibleNavItems(prev => {
            const newItems = prev.includes(itemId)
                ? prev.filter(id => id !== itemId)
                : [...prev, itemId];

            localStorage.setItem('visibleNavItems', JSON.stringify(newItems));
            return newItems;
        });
    };
    const [mailFolder, setMailFolder] = useState('inbox');

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
                setIsGmailWarningOpen(true);
            } else if (platformId === 'Telegram') {
                setIsTelegramAuthOpen(true);
            } else if (platformId === 'Whatsapp') {
                setIsWhatsAppConnectOpen(true);
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
                // Extract body
                const bodyHtml = data.draft.body || '';
                const tempDiv = document.createElement("div");
                tempDiv.innerHTML = bodyHtml;
                const bodyText = tempDiv.textContent || tempDiv.innerText || "";

                // Save to drafts state
                setDrafts(prev => ({ ...prev, [message.id]: bodyText }));

                // Open Preview Modal
                const recipientEmail = message.sender.match(/<(.+?)>/)?.[1] || message.sender;
                setGeneratedDraft({
                    to: recipientEmail,
                    subject: `Re: ${message.subject}`,
                    body: bodyHtml || bodyText // Prefer HTML if available, otherwise text
                });
                setShowDraftPreview(true);
            }
        } catch (error) {
            console.error("Draft generation failed", error);
        } finally {
            setLoadingDrafts(prev => ({ ...prev, [message.id]: false }));
        }
    };

    // Remove separate reviewDraft state if it exists or reuse it? 
    // We'll migrate to using generatedDraft for consistency with the DraftPreview component.
    // const [reviewDraft, setReviewDraft] = useState(null); // Commented out or removed

    const handleOpenReview = (message) => {
        const recipientEmail = message.sender.match(/<(.+?)>/)?.[1] || message.sender;
        const draftBody = drafts[message.id];

        if (!draftBody) return;

        setGeneratedDraft({
            to: recipientEmail,
            subject: `Re: ${message.subject}`,
            body: draftBody
        });
        setShowDraftPreview(true);
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
    const [telegramError, setTelegramError] = useState(null);

    // WhatsApp States
    const [isWhatsAppConnectOpen, setIsWhatsAppConnectOpen] = useState(false);
    const [whatsappConnected, setWhatsappConnected] = useState(false);
    const [whatsappConversations, setWhatsappConversations] = useState([]);
    const [whatsappMessages, setWhatsappMessages] = useState([]);
    const [loadingWhatsAppMessages, setLoadingWhatsAppMessages] = useState(false);
    const [whatsappError, setWhatsappError] = useState(null);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (activePage === 'Whatsapp' && whatsappMessages.length > 0) {
            scrollToBottom();
        }
    }, [whatsappMessages, activePage]);



    // AI Chat State
    const [isAIChatOpen, setIsAIChatOpen] = useState(false);
    const [aiChatMessages, setAIChatMessages] = useState([{ role: 'system', content: 'Hello! I am your Crivo Inai assistant. How can I help you today?' }]);
    const [aiChatInput, setAIChatInput] = useState('');
    const [isAiThinking, setIsAiThinking] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const pageParam = params.get('page');
        if (pageParam) {
            setActivePage(pageParam);
            localStorage.setItem('activePage', pageParam);
        }
    }, [location]);

    const fetchEmails = async () => {
        if (activePage !== 'Inbox' && activePage !== 'Mail') return;

        setLoadingMessages(true);
        setErrorMessages(null);
        try {
            const response = await fetch('http://localhost:5000/api/emails');

            if (response.status === 401) {
                // Session expired or invalid
                setConnectedPlatforms(prev => ({ ...prev, Mail: false }));
                return; // Stop processing
            }

            if (!response.ok) {
                throw new Error('Failed to fetch emails');
            }
            const data = await response.json();
            // Merge with existing messages, removing old Mail messages
            setMessages(prev => [...prev.filter(m => m.source !== 'Mail'), ...data]);
        } catch (err) {
            console.error("Error fetching emails:", err);
            // Instead of showing an error, we assume it's a connection issue and redirect to Connectors
            setErrorMessages(null);
            setConnectedPlatforms(prev => ({ ...prev, Mail: false }));
            handleNavClick('Connectors');
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

    useEffect(() => {
        // Check WhatsApp connection on mount
        checkWhatsAppConnection();
    }, []);

    useEffect(() => {
        // Fetch WhatsApp chats when on Whatsapp page
        if (activePage === 'Whatsapp' && whatsappConnected) {
            fetchWhatsAppConversations();
        }
    }, [activePage, whatsappConnected]);


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
        } else if (message.source === 'Whatsapp') {
            // For WhatsApp, just select the message to show in right panel
            setSelectedMessage(message);
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
            console.log('Fetching Telegram chats...');
            const response = await fetch('http://localhost:5000/api/telegram/chats');
            console.log('Telegram fetch status:', response.status);

            if (response.ok) {
                const data = await response.json();
                console.log('Telegram chats raw data:', data);
                setTelegramChats(data.chats || []);

                // Convert Telegram chats to message format and add to messages
                const telegramMessages = (data.chats || []).map(chat => ({
                    id: `telegram_${chat.id}`,
                    chatId: chat.id,
                    source: 'Telegram',
                    sender: chat.title,
                    preview: chat.message?.text || 'No messages yet',
                    time: chat.date ? new Date(chat.date * 1000).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                    }) : '',
                    subject: '',
                    body: chat.message?.text || '',
                    unreadCount: chat.unreadCount
                }));

                console.log(`✅ Setting ${telegramMessages.length} Telegram messages`);

                // Merge with existing messages, removing old Telegram messages first
                setMessages(prev => [
                    ...prev.filter(m => m.source !== 'Telegram'),
                    ...telegramMessages
                ]);
                setTelegramError(null);
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.error(`❌ Telegram fetch status: ${response.status}`, errorData);

                if (errorData.error?.includes('SESSION_PASSWORD_NEEDED')) {
                    setTelegramError('2FA_REQUIRED');
                } else {
                    setTelegramError('FETCH_ERROR');
                }
            }
        } catch (error) {
            console.error('❌ Error fetching Telegram chats:', error);
            setTelegramError('NETWORK_ERROR');
        }
    };

    const handleTelegramAuthSuccess = () => {
        setTelegramConnected(true);
        fetchTelegramChats();
        fetchPlatformStatus(); // Update connectors status
    };

    // WhatsApp Functions
    const checkWhatsAppConnection = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/whatsapp/status');
            const data = await response.json();
            setWhatsappConnected(data.connected);
            if (data.connected) {
                fetchWhatsAppConversations();
            }
        } catch (error) {
            console.error('Error checking WhatsApp status:', error);
        }
    };

    const fetchWhatsAppConversations = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/whatsapp/chats');
            if (response.ok) {
                const data = await response.json();
                const chats = data.chats || [];
                setWhatsappConversations(chats);

                // Convert WhatsApp chats to message format and add to messages
                const whatsappMessages = chats.map(chat => ({
                    id: `whatsapp_${chat.id}`,
                    chatId: chat.id,
                    source: 'Whatsapp',
                    sender: chat.name,
                    preview: chat.lastMessage?.body || 'No messages yet',
                    time: chat.lastMessage?.timestamp ? new Date(chat.lastMessage.timestamp * 1000).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                    }) : '',
                    subject: '',
                    body: chat.lastMessage?.body || '',
                    unreadCount: chat.unreadCount || 0,
                    isGroup: chat.isGroup
                }));

                // Merge with existing messages, removing old WhatsApp messages first
                setMessages(prev => [
                    ...prev.filter(m => m.source !== 'Whatsapp'),
                    ...whatsappMessages
                ]);
                setWhatsappError(null);
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.error('❌ WhatsApp fetch error:', errorData);
                setWhatsappError(errorData.error || 'Failed to fetch conversations');
                setWhatsappConversations([]);
            }
        } catch (error) {
            console.error('Error fetching WhatsApp conversations:', error);
            setWhatsappError('Network error. Please check if backend is running.');
        }
    };

    const handleWhatsAppConnect = (connectionResult) => {
        setWhatsappConnected(true);
        fetchWhatsAppConversations();
        fetchPlatformStatus(); // Update connectors status
        alert(`WhatsApp connected successfully!\nPhone: ${connectionResult.phoneNumber}`);
    };

    const handleSendWhatsAppMessage = async (phoneNumber, message) => {
        try {
            const response = await fetch('http://localhost:5000/api/whatsapp/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': user?.uid || 'anonymous'
                },
                body: JSON.stringify({
                    to: phoneNumber,
                    message: message
                })
            });

            if (!response.ok) {
                throw new Error('Failed to send WhatsApp message');
            }

            const data = await response.json();
            console.log('WhatsApp message sent:', data);

            // Refresh conversations
            fetchWhatsAppConversations();

            return { success: true };
        } catch (error) {
            console.error('Error sending WhatsApp message:', error);
            return { success: false, error: error.message };
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

    useEffect(() => {
        if (user) {
            fetchEmails();
            checkTelegramConnection();
            checkWhatsAppConnection();
        }
    }, [user]);

    useEffect(() => {
        if (telegramConnected && (activePage === 'Telegram' || activePage === 'Dashboard')) {
            fetchTelegramChats();
        }
    }, [telegramConnected, activePage]);

    useEffect(() => {
        if (whatsappConnected && (activePage === 'Whatsapp' || activePage === 'Dashboard')) {
            fetchWhatsAppConversations();
        }
    }, [whatsappConnected, activePage]);

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
        localStorage.setItem('activePage', page);
        if (page !== 'Mail' && !['Whatsapp', 'Telegram'].includes(page)) {
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
        <div className="flex flex-col h-screen bg-gray-100 font-sans text-gray-900">
            <header className="flex h-20 flex-shrink-0 items-center justify-between bg-white px-8 shadow-sm relative z-40">
                {/* Left: Logo */}
                <div className="flex items-center space-x-2 w-48">
                    <img src="/assets/clogo.jpg" alt="Logo" className="h-8 w-8 rounded-full" />
                    <span className="text-xl font-bold text-gray-800">Crivo Inai</span>
                </div>

                {/* Center: Navigation Pills */}
                {/* Center: Navigation Pills */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:flex items-center space-x-2">
                    {allNavItems.filter(item => visibleNavItems.includes(item.id)).map((item) => (
                        <button
                            key={item.id}
                            onClick={() => handleNavClick(item.id)}
                            className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${activePage === item.id
                                ? 'border-2 border-indigo-500 text-indigo-900 bg-white'
                                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                                }`}
                        >
                            {item.label}
                        </button>
                    ))}

                    {/* Fixed Connectors Item */}
                    <button
                        onClick={() => handleNavClick('Connectors')}
                        className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${activePage === 'Connectors'
                            ? 'border-2 border-indigo-500 text-indigo-900 bg-white'
                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                            }`}
                    >
                        Connectors
                    </button>

                    {/* Customize Button */}
                    <div className="relative">
                        <button
                            onClick={() => setIsNavCustomizeOpen(!isNavCustomizeOpen)}
                            className="p-2 rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                            <Plus size={20} />
                        </button>

                        {/* Customization Dropdown */}
                        {isNavCustomizeOpen && (
                            <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 p-4 z-50 animate-in fade-in zoom-in-95 duration-200">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-semibold text-gray-900">Customize menu</h3>
                                    <button onClick={() => setIsNavCustomizeOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                                </div>
                                <p className="text-xs text-gray-500 mb-3">Select the tools you use most</p>
                                <div className="space-y-2">
                                    {allNavItems.map((item) => (
                                        <div key={item.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer" onClick={() => handleNavToggle(item.id)}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${item.id === 'Dashboard' ? 'bg-purple-100 text-purple-600' :
                                                    item.id === 'Mail' ? 'bg-blue-100 text-blue-600' :
                                                        item.id === 'Whatsapp' ? 'bg-green-100 text-green-600' :
                                                            item.id === 'Telegram' ? 'bg-sky-100 text-sky-600' :
                                                                'bg-orange-100 text-orange-600'
                                                    }`}>
                                                    {item.id === 'Dashboard' ? <LayoutDashboard size={16} /> :
                                                        item.id === 'Mail' ? <Mail size={16} /> :
                                                            item.id === 'Whatsapp' ? <MessageSquare size={16} /> :
                                                                item.id === 'Telegram' ? <Send size={16} /> :
                                                                    <RefreshCw size={16} />}
                                                </div>
                                                <span className="text-sm font-medium text-gray-700">{item.label}</span>
                                            </div>
                                            <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${visibleNavItems.includes(item.id)
                                                ? 'bg-blue-600 border-blue-600'
                                                : 'border-gray-300 bg-white'
                                                }`}>
                                                {visibleNavItems.includes(item.id) && <span className="text-white text-xs">✓</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={() => setIsNavCustomizeOpen(false)}
                                    className="w-full mt-4 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                                >
                                    Done
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Profile & Settings */}
                <div className="flex items-center justify-end space-x-6 w-48">
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
                            <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-lg bg-white text-gray-700 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-gray-100">
                                <div className="p-1">
                                    <DropdownItem icon={<User size={16} />} label="Profile" onClick={() => handleNavClick('Profile')} />
                                    <DropdownItem icon={<Settings size={16} />} label="Settings" onClick={() => handleNavClick('Settings')} />
                                    <div className="my-1 h-px bg-gray-100" />
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
                    <Overview messages={messages} connectedPlatforms={connectedPlatforms} user={user} />
                ) : ['Mail', 'Inbox', 'Whatsapp', 'Telegram'].includes(activePage) ? (
                    activePage === 'Whatsapp' ? (
                        !connectedPlatforms['Whatsapp'] || !whatsappConnected ? (
                            <div className="flex flex-col items-center justify-center p-12 h-[calc(100vh-8rem)] text-center bg-white rounded-xl border border-gray-200 shadow-sm">
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
                                    <MessageSquare size={32} className="text-green-600" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">WhatsApp Not Connected</h3>
                                <p className="text-gray-500 mb-6 max-w-sm">Connect your WhatsApp Business account to view your chats and send messages directly from the dashboard.</p>
                                <button
                                    onClick={() => togglePlatform('Whatsapp')}
                                    className="bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors"
                                >
                                    Connect WhatsApp
                                </button>
                            </div>
                        ) : (
                            /* WhatsApp Web-like UI */
                            <div className="flex bg-[#f0f2f5] h-[calc(100vh-8rem)] rounded-xl overflow-hidden shadow-sm">
                                {/* Left: Chat List */}
                                <div className="w-full md:w-[400px] bg-white border-r border-gray-200 flex flex-col">
                                    {/* Header */}
                                    <div className="bg-[#008069] p-4 flex items-center justify-between">
                                        <h2 className="text-white font-semibold text-lg flex items-center gap-2">
                                            <MessageSquare size={24} />
                                            WhatsApp
                                        </h2>
                                        <button
                                            onClick={fetchWhatsAppConversations}
                                            className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
                                            title="Refresh"
                                        >
                                            <RefreshCw size={20} />
                                        </button>
                                    </div>

                                    {/* Search Bar */}
                                    <div className="p-2 bg-white border-b border-gray-200">
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder="Search or start new chat"
                                                className="w-full pl-12 pr-4 py-2 bg-[#f0f2f5] rounded-lg text-sm focus:outline-none"
                                            />
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                                    <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" fill="currentColor" />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Chat List */}
                                    <div className="flex-1 overflow-y-auto">
                                        {loadingMessages ? (
                                            <div className="p-8 text-center text-gray-500">Loading chats...</div>
                                        ) : whatsappError ? (
                                            <div className="p-12 text-center">
                                                <div className="mx-auto w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
                                                    <AlertCircle className="text-red-500" size={32} />
                                                </div>
                                                <h3 className="text-lg font-semibold text-gray-700 mb-2">Connection Issue</h3>
                                                <p className="text-sm text-gray-500 mb-6">{whatsappError}</p>
                                                <button
                                                    onClick={fetchWhatsAppConversations}
                                                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                                                >
                                                    Retry Connection
                                                </button>
                                            </div>
                                        ) : messages.filter(m => m.source === 'Whatsapp').length === 0 ? (
                                            <div className="p-12 text-center">
                                                <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                                                    <MessageSquare className="text-gray-400" size={32} />
                                                </div>
                                                <h3 className="text-lg font-semibold text-gray-700 mb-2">No Chats Yet</h3>
                                                <p className="text-sm text-gray-500">Your WhatsApp chats will appear here</p>
                                            </div>
                                        ) : (
                                            messages
                                                .filter(m => m.source === 'Whatsapp')
                                                .map((chat) => (
                                                    <div
                                                        key={chat.id}
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            console.log('Clicked chat object:', chat);
                                                            setSelectedMessage(chat);
                                                            setLoadingWhatsAppMessages(true);

                                                            const targetId = chat.chatId || chat.id;
                                                            console.log('Target Chat ID for API:', targetId);

                                                            // Fetch full chat history
                                                            try {
                                                                const url = `http://localhost:5000/api/whatsapp/messages/${encodeURIComponent(targetId)}?limit=50`;
                                                                console.log('Fetching URL:', url);

                                                                const response = await fetch(url, {
                                                                    headers: {
                                                                        'x-user-id': user?.uid || 'anonymous'
                                                                    }
                                                                });

                                                                console.log('Response status:', response.status);

                                                                if (response.ok) {
                                                                    const data = await response.json();
                                                                    console.log('Received WhatsApp messages payload:', data);

                                                                    if (data.messages && Array.isArray(data.messages)) {
                                                                        console.log(`Setting ${data.messages.length} messages`);
                                                                        setWhatsappMessages(data.messages);
                                                                    } else {
                                                                        console.warn('Data.messages is missing or not an array', data);
                                                                        setWhatsappMessages([]);
                                                                    }
                                                                } else {
                                                                    const errorText = await response.text();
                                                                    console.error('Failed to fetch messages. Status:', response.status, 'Error:', errorText);
                                                                    // Use fallback if API fails
                                                                    if (chat.preview) {
                                                                        console.log('Using fallback preview');
                                                                        setWhatsappMessages([{
                                                                            body: chat.preview,
                                                                            fromMe: false, // We don't know for sure, assume false for preview
                                                                            timestamp: chat.time
                                                                        }]);
                                                                    } else {
                                                                        setWhatsappMessages([]);
                                                                    }
                                                                }
                                                            } catch (error) {
                                                                console.error('Error in fetch execution:', error);
                                                                // Fallback
                                                                if (chat.preview) {
                                                                    setWhatsappMessages([{
                                                                        body: chat.preview,
                                                                        fromMe: false,
                                                                        timestamp: chat.time
                                                                    }]);
                                                                } else {
                                                                    setWhatsappMessages([]);
                                                                }
                                                            } finally {
                                                                setLoadingWhatsAppMessages(false);
                                                            }
                                                        }}
                                                        className={`flex items-center p-3 cursor-pointer hover:bg-[#f5f6f6] border-b border-gray-100 transition-colors ${selectedMessage?.id === chat.id ? 'bg-[#f0f2f5]' : 'bg-white'
                                                            }`}
                                                    >
                                                        {/* Avatar */}
                                                        <div className="flex-shrink-0 mr-3">
                                                            <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center text-white font-semibold text-lg">
                                                                {chat.isGroup ? (
                                                                    <Users size={24} />
                                                                ) : (
                                                                    chat.sender[0].toUpperCase()
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Chat Info */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <h3 className="font-semibold text-gray-900 truncate">{chat.sender}</h3>
                                                                <span className="text-xs text-gray-500 ml-2">{chat.time}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between">
                                                                <p className="text-sm text-gray-600 truncate flex-1">{chat.preview}</p>
                                                                {chat.unreadCount > 0 && (
                                                                    <span className="ml-2 bg-[#25d366] text-white text-xs rounded-full px-2 py-0.5 font-semibold">
                                                                        {chat.unreadCount}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                        )}
                                    </div>
                                </div>

                                {/* Right: Chat View */}
                                <div className="flex-1 flex flex-col bg-[#efeae2]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h100v100H0z\' fill=\'%23efeae2\'/%3E%3Cpath d=\'M10 10h20v20H10zM40 10h20v20H40zM70 10h20v20H70zM10 40h20v20H10zM40 40h20v20H40zM70 40h20v20H70zM10 70h20v20H10zM40 70h20v20H40zM70 70h20v20H70z\' fill=\'%23dfd8cc\' opacity=\'.05\'/%3E%3C/svg%3E")' }}>
                                    {selectedMessage ? (
                                        <>
                                            {/* Chat Header */}
                                            <div className="bg-[#f0f2f5] p-3 flex items-center justify-between border-b border-gray-200">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-white font-semibold">
                                                        {selectedMessage.isGroup ? <Users size={20} /> : selectedMessage.sender[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-semibold text-gray-900">{selectedMessage.sender}</h3>
                                                        <p className="text-xs text-gray-500">Click here for contact info</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button className="p-2 text-gray-600 hover:bg-gray-200 rounded-full">
                                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                                                        </svg>
                                                    </button>
                                                    <button className="p-2 text-gray-600 hover:bg-gray-200 rounded-full">
                                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Messages Area */}
                                            <div className="flex-1 overflow-y-auto p-4">
                                                <div className="max-w-4xl mx-auto space-y-2">
                                                    {loadingWhatsAppMessages ? (
                                                        <div className="text-center text-gray-500 py-8">
                                                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#008069]"></div>
                                                            <p className="mt-2">Loading messages...</p>
                                                        </div>
                                                    ) : whatsappMessages.length === 0 ? (
                                                        <div className="text-center text-gray-500 py-8">
                                                            <p>No messages yet</p>
                                                            <p className="text-sm mt-2">Start the conversation!</p>
                                                        </div>
                                                    ) : (
                                                        whatsappMessages.map((msg, idx) => (
                                                            <div key={idx} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                                                                <div className={`rounded-lg p-3 shadow-sm max-w-[65%] ${msg.fromMe
                                                                    ? 'bg-[#d9fdd3]'
                                                                    : 'bg-white'
                                                                    }`}>
                                                                    <p className="text-sm text-gray-800">{msg.body}</p>
                                                                    <span className="text-xs text-gray-500 mt-1 block">
                                                                        {msg.timestamp ? new Date(msg.timestamp * 1000).toLocaleTimeString('en-US', {
                                                                            hour: 'numeric',
                                                                            minute: '2-digit',
                                                                            hour12: true
                                                                        }) : 'Now'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                    <div ref={messagesEndRef} />
                                                </div>
                                            </div>

                                            {/* Message Input */}
                                            <div className="bg-[#f0f2f5] p-3 flex items-center gap-2">
                                                <button className="p-2 text-gray-600 hover:bg-gray-200 rounded-full">
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                                        <path d="M9.153 11.603c.795 0 1.439-.879 1.439-1.962s-.644-1.962-1.439-1.962-1.439.879-1.439 1.962.644 1.962 1.439 1.962zm-3.204 1.362c-.026-.307-.131 5.218 6.063 5.551 6.066-.25 6.066-5.551 6.066-5.551-6.078 1.416-12.129 0-12.129 0zm11.363 1.108s-.669 1.959-5.051 1.959c-3.505 0-5.388-1.164-5.607-1.959 0 0 5.912 1.055 10.658 0zM11.804 1.011C5.609 1.011.978 6.033.978 12.228s4.826 10.761 11.021 10.761S23.02 18.423 23.02 12.228c.001-6.195-5.021-11.217-11.216-11.217zM12 21.354c-5.273 0-9.381-3.886-9.381-9.159s3.942-9.548 9.215-9.548 9.548 4.275 9.548 9.548c-.001 5.272-4.109 9.159-9.382 9.159zm3.108-9.751c.795 0 1.439-.879 1.439-1.962s-.644-1.962-1.439-1.962-1.439.879-1.439 1.962.644 1.962 1.439 1.962z" />
                                                    </svg>
                                                </button>
                                                <button className="p-2 text-gray-600 hover:bg-gray-200 rounded-full">
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                                        <path d="M1.816 15.556v.002c0 1.502.584 2.912 1.646 3.972s2.472 1.647 3.974 1.647a5.58 5.58 0 003.972-1.645l9.547-9.548c.769-.768 1.147-1.767 1.058-2.817-.079-.968-.548-1.927-1.319-2.698-1.594-1.592-4.068-1.711-5.517-.262l-7.916 7.915c-.881.881-.792 2.25.214 3.261.959.958 2.423 1.053 3.263.215l5.511-5.512c.28-.28.267-.722.053-.936l-.244-.244c-.191-.191-.567-.349-.957.04l-5.506 5.506c-.18.18-.635.127-.976-.214-.098-.097-.576-.613-.213-.973l7.915-7.917c.818-.817 2.267-.699 3.23.262.5.501.802 1.1.849 1.685.051.573-.156 1.111-.589 1.543l-9.547 9.549a3.97 3.97 0 01-2.829 1.171 3.975 3.975 0 01-2.83-1.173 3.973 3.973 0 01-1.172-2.828c0-1.071.415-2.076 1.172-2.83l7.209-7.211c.157-.157.264-.579.028-.814L11.5 4.36a.572.572 0 00-.834.018l-7.205 7.207a5.577 5.577 0 00-1.645 3.971z" />
                                                    </svg>
                                                </button>
                                                <input
                                                    type="text"
                                                    placeholder="Type a message"
                                                    value={replyText}
                                                    onChange={(e) => setReplyText(e.target.value)}
                                                    onKeyPress={(e) => {
                                                        if (e.key === 'Enter' && replyText.trim() && selectedMessage) {
                                                            e.preventDefault();
                                                            document.querySelector('button[class*="bg-[#008069]"]').click();
                                                        }
                                                    }}
                                                    className="flex-1 px-4 py-2 rounded-lg bg-white focus:outline-none"
                                                />
                                                <button
                                                    onClick={async () => {
                                                        if (replyText.trim() && selectedMessage) {
                                                            const messageText = replyText;

                                                            // Optimistic update - add message immediately to UI
                                                            const optimisticMessage = {
                                                                body: messageText,
                                                                fromMe: true,
                                                                timestamp: Math.floor(Date.now() / 1000)
                                                            };
                                                            setWhatsappMessages(prev => [...prev, optimisticMessage]);
                                                            setReplyText('');

                                                            try {
                                                                const response = await fetch('http://localhost:5000/api/whatsapp/send', {
                                                                    method: 'POST',
                                                                    headers: {
                                                                        'Content-Type': 'application/json',
                                                                        'x-user-id': user?.uid || 'anonymous'
                                                                    },
                                                                    body: JSON.stringify({
                                                                        chatId: selectedMessage.chatId,
                                                                        message: messageText
                                                                    })
                                                                });

                                                                if (response.ok) {
                                                                    // Optionally refresh chats to show new message
                                                                    fetchWhatsAppConversations();
                                                                } else {
                                                                    alert('Failed to send message');
                                                                    // Remove optimistic message on failure
                                                                    setWhatsappMessages(prev => prev.filter(m => m !== optimisticMessage));
                                                                }
                                                            } catch (error) {
                                                                console.error('Error sending WhatsApp message:', error);
                                                                alert('Failed to send message');
                                                                // Remove optimistic message on error
                                                                setWhatsappMessages(prev => prev.filter(m => m !== optimisticMessage));
                                                            }
                                                        }
                                                    }}
                                                    className="p-2 bg-[#008069] text-white rounded-full hover:bg-[#017561] transition-colors"
                                                >
                                                    <Send size={20} />
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex-1 flex items-center justify-center">
                                            <div className="text-center">
                                                <div className="mx-auto w-64 h-64 mb-8 opacity-20">
                                                    <svg viewBox="0 0 303 172" fill="none">
                                                        <path d="M151.5 0C67.9 0 0 67.9 0 151.5S67.9 303 151.5 303 303 235.1 303 151.5 235.1 0 151.5 0zm0 276C82.4 276 27 220.6 27 151.5S82.4 27 151.5 27 276 82.4 276 151.5 220.6 276 151.5 276z" fill="currentColor" />
                                                    </svg>
                                                </div>
                                                <h3 className="text-2xl font-light text-gray-600 mb-2">WhatsApp Web</h3>
                                                <p className="text-sm text-gray-500">Select a chat to start messaging</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    ) : activePage === 'Telegram' ? (
                        !connectedPlatforms['Telegram'] || !telegramConnected ? (
                            <div className="flex flex-col items-center justify-center p-12 h-screen text-center bg-white rounded-xl border border-gray-200 shadow-sm">
                                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                                    <Send size={32} className="text-blue-600" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">Telegram Not Connected</h3>
                                <p className="text-gray-500 mb-6 max-w-sm">Connect your Telegram account to view your messages and reply directly from the dashboard.</p>
                                <button
                                    onClick={() => togglePlatform('Telegram')}
                                    className="bg-sky-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-sky-600 transition-colors"
                                >
                                    Connect Telegram
                                </button>
                            </div>
                        ) : telegramError === '2FA_REQUIRED' ? (
                            <div className="flex flex-col items-center justify-center p-12 h-screen text-center bg-white rounded-xl border border-gray-200 shadow-sm">
                                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                                    <Lock size={32} className="text-blue-600" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">2FA Password Needed</h3>
                                <p className="text-gray-500 mb-6 max-w-sm">Your Telegram session requires your 2-Step Verification password to access your message history.</p>
                                <button
                                    onClick={() => togglePlatform('Telegram')}
                                    className="bg-sky-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-sky-600 transition-colors"
                                >
                                    Re-authenticate with Password
                                </button>
                                <p className="mt-4 text-xs text-gray-400">
                                    Clicking re-authenticate will allow you to disconnect and sign in again including your password.
                                </p>
                            </div>
                        ) : (
                            /* Original Layout for Telegram */
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h1 className="text-2xl font-bold text-gray-800">{activePage} Messages</h1>
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
                                        {activePage === 'Telegram' && telegramConnected && (
                                            <button
                                                onClick={fetchTelegramChats}
                                                className="p-2 text-gray-500 hover:text-blue-600 transition-colors rounded-full hover:bg-blue-50"
                                                title="Refresh Telegram Chats"
                                            >
                                                <RefreshCw size={20} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="rounded-xl bg-white shadow-sm overflow-hidden">
                                    {loadingMessages ? (
                                        <div className="p-8 text-center text-gray-500">Loading messages...</div>
                                    ) : (
                                        <>
                                            {messages
                                                .filter(m => m.source === activePage)
                                                .map((message) => (
                                                    <div key={message.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                                        <div className="flex flex-col md:flex-row">
                                                            <div
                                                                className="flex-1 p-4 cursor-pointer border-r border-gray-100"
                                                                onClick={() => {
                                                                    setSelectedMessage(message);
                                                                    if (message.source === 'Telegram') setSelectedTelegramChat(message);
                                                                }}
                                                            >
                                                                <div className="flex items-center space-x-4">
                                                                    <div className={`flex h-10 w-10 items-center justify-center rounded-full text-white font-bold flex-shrink-0
                                                                    ${message.source === 'Whatsapp' ? 'bg-green-500' : 'bg-blue-400'}`}>
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
                                                        </div>
                                                    </div>
                                                ))}
                                            {messages.filter(m => m.source === activePage).length === 0 && (
                                                <div className="p-12 text-center">
                                                    <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                                                        <MessageSquare className="text-gray-400" size={32} />
                                                    </div>
                                                    <h3 className="text-lg font-semibold text-gray-700 mb-2">No messages found</h3>
                                                    <p className="text-sm text-gray-500">
                                                        Your {activePage} conversation history is empty.
                                                    </p>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        )
                    ) : (
                        /* New Gmail-like UI for Mail & Inbox */
                        <div className="flex bg-white h-[calc(100vh-8rem)] rounded-xl overflow-hidden shadow-sm border border-gray-200">
                            {/* Left Sidebar */}
                            <div className="w-64 flex flex-col p-4 border-r border-gray-100 hidden md:flex bg-cyan-50/30">
                                <button
                                    onClick={() => {
                                        setComposeData({ to: '', subject: '', body: '' });
                                        setIsComposeOpen(true);
                                    }}
                                    className="flex items-center gap-3 bg-white text-gray-700 font-medium py-4 px-6 rounded-2xl shadow hover:shadow-md transition-all mb-6 w-fit border border-gray-100"
                                >
                                    <Pencil size={18} />
                                    <span>Compose</span>
                                </button>

                                <nav className="space-y-1 flex-1 overflow-y-auto">
                                    <MailSidebarItem icon={<Inbox size={18} />} label="Inbox" count={messages.filter(m => m.source === 'Mail' || m.source === 'Gmail').length} active={mailFolder === 'inbox'} onClick={() => setMailFolder('inbox')} />
                                    <MailSidebarItem icon={<Star size={18} />} label="Starred" active={mailFolder === 'starred'} onClick={() => setMailFolder('starred')} />
                                    <MailSidebarItem icon={<Clock size={18} />} label="Snoozed" active={mailFolder === 'snoozed'} onClick={() => setMailFolder('snoozed')} />
                                    <MailSidebarItem icon={<Send size={18} />} label="Sent" active={mailFolder === 'sent'} onClick={() => setMailFolder('sent')} />
                                    <MailSidebarItem icon={<File size={18} />} label="Drafts" count={52} active={mailFolder === 'drafts'} onClick={() => setMailFolder('drafts')} />
                                    <MailSidebarItem icon={<Package size={18} />} label="Purchases" count={27} active={mailFolder === 'purchases'} onClick={() => setMailFolder('purchases')} />
                                    <MailSidebarItem icon={<ChevronDown size={18} />} label="More" active={false} onClick={() => { }} />
                                </nav>

                                <div className="mt-4 pt-4 border-t border-gray-200">
                                    <div className="flex items-center justify-between px-3 mb-2">
                                        <span className="text-base font-medium text-gray-700">Labels</span>
                                        <button className="text-gray-500 hover:text-gray-700"><Plus size={18} /></button>
                                    </div>
                                </div>
                            </div>

                            {/* Main Content */}
                            <div className="flex-1 flex flex-col min-w-0 bg-white">
                                {/* Tabs */}
                                <div className="flex items-center border-b border-gray-200 bg-white px-2">
                                    <MailTab icon={<Inbox size={18} />} label="Primary" active={mailTab === 'Primary'} onClick={() => { setMailTab('Primary'); localStorage.setItem('mailTab', 'Primary'); }} color="blue" />
                                    <MailTab icon={<Tag size={18} />} label="Promotions" active={mailTab === 'Promotions'} onClick={() => { setMailTab('Promotions'); localStorage.setItem('mailTab', 'Promotions'); }} badge="2 new" color="green" />
                                    <MailTab icon={<Users size={18} />} label="Social" active={mailTab === 'Social'} onClick={() => { setMailTab('Social'); localStorage.setItem('mailTab', 'Social'); }} badge="1 new" color="blue" />
                                    <MailTab icon={<AlertCircle size={18} />} label="Updates" active={mailTab === 'Updates'} onClick={() => { setMailTab('Updates'); localStorage.setItem('mailTab', 'Updates'); }} badge="1 new" color="orange" />
                                </div>

                                {/* Controls Bar */}
                                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50/50">
                                    <div className="flex items-center gap-2">
                                        <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4" />
                                        <button onClick={fetchEmails} className="p-2 text-gray-500 hover:bg-gray-200 rounded-full" title="Refresh">
                                            <RefreshCw size={18} className={loadingMessages ? 'animate-spin' : ''} />
                                        </button>
                                        <button className="p-2 text-gray-500 hover:bg-gray-200 rounded-full" title="Mark as read">
                                            <Mail size={18} />
                                        </button>
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        1-{Math.min(50, messages.length)} of {messages.length}
                                    </div>
                                </div>

                                {/* Message List */}
                                <div className="flex-1 overflow-y-auto">
                                    {loadingMessages ? (
                                        <div className="p-12 text-center text-gray-500">Loading your emails...</div>
                                    ) : !connectedPlatforms['Mail'] ? (
                                        <div className="flex flex-col items-center justify-center p-12 h-full text-center">
                                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                                                <Mail size={32} className="text-blue-600" />
                                            </div>
                                            <h3 className="text-xl font-bold text-gray-900 mb-2">Mail Not Connected</h3>
                                            <p className="text-gray-500 mb-6 max-w-sm">Connect your Gmail account to view your emails, drafts, and manage your inbox directly from the dashboard.</p>
                                            <button
                                                onClick={() => togglePlatform('Mail')}
                                                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                                            >
                                                Connect Mail
                                            </button>
                                        </div>
                                    ) : messages.filter(m => m.source === 'Mail' || m.source === 'Gmail').length === 0 ? (
                                        <div className="p-12 text-center text-gray-500">
                                            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                                <Inbox size={32} className="text-gray-400" />
                                            </div>
                                            <p>Your inbox is empty</p>
                                        </div>
                                    ) : (
                                        messages
                                            .filter(m => m.source === 'Mail' || m.source === 'Gmail')
                                            .map((message) => (
                                                <div
                                                    key={message.id}
                                                    className={`group flex items-center px-4 py-3 border-b border-gray-100 hover:shadow-md hover:z-10 bg-white cursor-pointer transition-all relative ${!message.read ? 'bg-white' : 'bg-gray-50/30'}`}
                                                    onClick={() => {
                                                        setSelectedMessage(message);
                                                        // Mark as read locally
                                                        setMessages(prev => prev.map(m =>
                                                            m.id === message.id ? { ...m, read: true } : m
                                                        ));
                                                    }}
                                                >
                                                    {/* Checkbox & Star */}
                                                    <div className="flex items-center gap-3 mr-4 text-gray-400 flex-shrink-0">
                                                        <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4" onClick={(e) => e.stopPropagation()} />
                                                        <Star size={18} className="hover:text-yellow-400 cursor-pointer" onClick={(e) => { e.stopPropagation(); /* toggle star */ }} />
                                                    </div>

                                                    {/* Sender */}
                                                    <div className={`w-48 font-semibold text-gray-900 truncate mr-4 ${!message.read ? 'font-bold' : 'font-normal'}`}>
                                                        {message.sender}
                                                    </div>

                                                    {/* Subject/Preview */}
                                                    <div className="flex-1 min-w-0 flex items-center text-sm text-gray-600">
                                                        <span className={`text-gray-900 mr-2 ${!message.read ? 'font-bold' : 'font-medium'}`}>
                                                            {message.subject || '(No Subject)'}
                                                        </span>
                                                        <span className="text-gray-400 truncate hidden sm:block">- {message.preview}</span>
                                                    </div>

                                                    {/* Date */}
                                                    <div className={`text-xs text-gray-500 whitespace-nowrap ml-4 w-16 text-right ${!message.read ? 'font-bold text-gray-900' : ''}`}>
                                                        {message.time}
                                                    </div>

                                                    {/* Actions (hover) */}
                                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1 bg-white pl-2 shadow-sm rounded-l-lg border-l border-gray-100">
                                                        <button className="p-2 hover:bg-gray-100 rounded-full text-gray-500 hover:text-gray-700" title="Archive"><Archive size={16} /></button>
                                                        <button className="p-2 hover:bg-gray-100 rounded-full text-gray-500 hover:text-gray-700" title="Delete"><Trash2 size={16} /></button>
                                                        <button className="p-2 hover:bg-gray-100 rounded-full text-gray-500 hover:text-gray-700" title="Mark as unread"><Mail size={16} /></button>
                                                    </div>
                                                </div>
                                            ))
                                    )
                                    }
                                </div>
                            </div>
                        </div>
                    )
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
                selectedMessage && selectedMessage.source !== 'Whatsapp' && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedMessage(null)}>
                        <div className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-xl bg-white shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
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
                                <div className="flex items-center gap-2">
                                    {/* AI Draft Controls in Modal Header */}
                                    <div className="flex gap-2 mr-2">
                                        {drafts[selectedMessage.id] && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenReview(selectedMessage);
                                                }}
                                                className="text-xs bg-blue-100 text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-1 font-medium"
                                            >
                                                <FileText size={14} /> Review
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleQuickDraft(selectedMessage);
                                            }}
                                            disabled={loadingDrafts[selectedMessage.id]}
                                            className="text-xs bg-purple-100 text-purple-700 px-3 py-2 rounded-lg hover:bg-purple-200 disabled:opacity-50 transition-colors font-medium flex items-center gap-1"
                                        >
                                            <Sparkles size={14} />
                                            {loadingDrafts[selectedMessage.id] ? 'Generating...' : drafts[selectedMessage.id] ? 'Regenerate' : 'Generate'}
                                        </button>
                                    </div>

                                    <button
                                        onClick={() => setSelectedMessage(null)}
                                        className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                    >
                                        <ChevronDown className="rotate-180" size={24} />
                                    </button>
                                </div>
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
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleAIAssistant()}
                                        className="rounded-full p-2 text-purple-600 bg-purple-50 hover:bg-purple-100 hover:text-purple-700 transition-colors"
                                        title="Draft with AI"
                                    >
                                        <Sparkles size={20} />
                                    </button>
                                    <button
                                        onClick={() => setIsComposeOpen(false)}
                                        className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                    >
                                        <X size={24} />
                                    </button>
                                </div>
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

            {/* Mobile Compose FAB for Mail View */}
            {
                (activePage === 'Mail' || activePage === 'Inbox') && (
                    <button
                        onClick={() => {
                            setComposeData({ to: '', subject: '', body: '' });
                            setIsComposeOpen(true);
                        }}
                        className="md:hidden fixed bottom-24 right-6 p-4 bg-white text-gray-700 rounded-full shadow-xl hover:bg-gray-50 transition-all z-50 border border-gray-200"
                        title="Compose Email"
                    >
                        <Pencil size={24} className="text-gray-600" />
                    </button>
                )
            }

            {/* AI Chat FAB */}
            <button
                onClick={() => setIsAIChatOpen(!isAIChatOpen)}
                className="fixed bottom-6 right-6 p-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full shadow-2xl hover:scale-105 transition-transform z-50"
            >
                {isAIChatOpen ? <X size={24} /> : <Wand2 size={24} />}
            </button>

            {/* Gmail Warning Modal */}
            {
                isGmailWarningOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setIsGmailWarningOpen(false)}>
                        <div className="w-full max-w-md rounded-xl bg-white shadow-2xl p-6" onClick={e => e.stopPropagation()}>
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Connecting Gmail</h3>

                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                                <h4 className="text-sm font-semibold text-yellow-800 mb-2">Important: Verification Required</h4>
                                <p className="text-sm text-yellow-700 mb-2">
                                    You might see an <strong>"Access blocked"</strong> error from Google. This is normal during testing.
                                </p>
                                <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
                                    <li>The app is in "Testing" mode.</li>
                                    <li>Your email must be added to the <strong>Test Users</strong> list by the developer.</li>
                                </ul>
                            </div>

                            <div className="mb-6 flex items-start space-x-3">
                                <input
                                    type="checkbox"
                                    id="readWarning"
                                    checked={hasReadWarning}
                                    onChange={(e) => setHasReadWarning(e.target.checked)}
                                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <label htmlFor="readWarning" className="text-sm text-gray-600">
                                    I have read the above and confirmed that my email is added to the Test Users list.
                                </label>
                            </div>

                            <div className="flex justify-end space-x-3">
                                <button
                                    onClick={() => {
                                        setIsGmailWarningOpen(false);
                                        setHasReadWarning(false);
                                    }}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        window.location.href = 'http://localhost:5000/auth/google';
                                        setIsGmailWarningOpen(false);
                                        setHasReadWarning(false);
                                    }}
                                    disabled={!hasReadWarning}
                                    className={`px-4 py-2 rounded-lg transition-colors text-white ${hasReadWarning
                                        ? 'bg-blue-600 hover:bg-blue-700'
                                        : 'bg-gray-300 cursor-not-allowed'
                                        }`}
                                >
                                    I Understand, Proceed
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* WhatsApp Auth Modal */}
            <WhatsAppAuthModal
                isOpen={isWhatsAppConnectOpen}
                onClose={() => setIsWhatsAppConnectOpen(false)}
                onSuccess={() => {
                    setWhatsappConnected(true);
                    setConnectedPlatforms(prev => ({ ...prev, Whatsapp: true }));
                    fetchPlatformStatus();
                }}
            />


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

const StatCard = ({ title, value, change, isPositive }) => (
    <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col justify-between h-32 hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start">
            <p className="text-sm font-medium text-gray-500">{title}</p>
        </div>
        <div className="flex items-end justify-between">
            <h4 className="text-2xl font-bold text-gray-900">{value}</h4>
            {change && (
                <span className={`text-xs font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                    {change}
                </span>
            )}
        </div>
    </div>
);



export default Dashboard;
