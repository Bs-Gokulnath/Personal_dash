import React from 'react';
import { Mail, MessageSquare, Phone } from 'lucide-react';

const Connectors = ({ connectedPlatforms, togglePlatform }) => {
    const platforms = [
        { id: 'Mail', name: 'Gmail', icon: <Mail size={24} className="text-red-500" /> },
        { id: 'Whatsapp', name: 'WhatsApp', icon: <MessageSquare size={24} className="text-green-500" /> },
        { id: 'Telegram', name: 'Telegram', icon: <MessageSquare size={24} className="text-blue-500" /> },
    ];

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Platform Connectors</h2>
            <div className="grid gap-6">
                {platforms.map((platform) => (
                    <div key={platform.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="p-3 bg-gray-50 rounded-lg">
                                {platform.icon}
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">{platform.name}</h3>
                                <p className="text-sm text-gray-500">
                                    {connectedPlatforms[platform.id] ? 'Connected and syncing' : 'Disconnected'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => togglePlatform(platform.id)}
                            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${connectedPlatforms[platform.id] ? 'bg-green-500' : 'bg-gray-200'
                                }`}
                        >
                            <span
                                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${connectedPlatforms[platform.id] ? 'translate-x-7' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>
                ))}
            </div>

            {/* Help Section for Google Verification Error */}
            <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h4 className="text-sm font-semibold text-yellow-800 mb-2">Having trouble connecting Gmail?</h4>
                <p className="text-xs text-yellow-700 mb-2">
                    If you see an "Access blocked: Crivo Inai has not completed the Google verification process" error:
                </p>
                <ol className="list-decimal list-inside text-xs text-yellow-700 space-y-1 ml-2">
                    <li>This is because the app is in "Testing" mode.</li>
                    <li>Contact the developer to add your email to the "Test Users" list.</li>
                    <li>Once added, try connecting again.</li>
                </ol>
            </div>
        </div>
    );
};

export default Connectors;
