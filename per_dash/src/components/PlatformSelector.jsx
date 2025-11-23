import { Mail, MessageSquare, Inbox } from 'lucide-react';

const PlatformSelector = ({ selectedPlatform, onPlatformChange, counts }) => {
    const platforms = [
        {
            id: 'all',
            label: 'All Messages',
            icon: Inbox,
            color: 'from-gray-600 to-gray-700',
            count: (counts.gmail || 0) + (counts.telegram || 0)
        },
        {
            id: 'gmail',
            label: 'Gmail',
            icon: Mail,
            color: 'from-red-500 to-pink-500',
            count: counts.gmail || 0
        },
        {
            id: 'telegram',
            label: 'Telegram',
            icon: MessageSquare,
            color: 'from-blue-500 to-cyan-500',
            count: counts.telegram || 0
        },
    ];

    return (
        <div className="flex items-center space-x-2 overflow-x-auto pb-2">
            {platforms.map((platform) => {
                const Icon = platform.icon;
                const isActive = selectedPlatform === platform.id;

                return (
                    <button
                        key={platform.id}
                        onClick={() => onPlatformChange(platform.id)}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${isActive
                                ? `bg-gradient-to-r ${platform.color} text-white shadow-lg transform scale-105`
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        <Icon size={18} />
                        <span>{platform.label}</span>
                        {platform.count > 0 && (
                            <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${isActive ? 'bg-white/30' : 'bg-gray-300'
                                }`}>
                                {platform.count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
};

export default PlatformSelector;
