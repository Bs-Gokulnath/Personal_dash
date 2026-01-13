import React, { useState } from 'react';
import { X, CheckCircle, AlertCircle, Loader, ExternalLink, HelpCircle } from 'lucide-react';

const WhatsAppConnectModal = ({ isOpen, onClose, onConnect }) => {
    const [formData, setFormData] = useState({
        accessToken: '',
        phoneNumberId: '',
        businessAccountId: ''
    });
    const [testing, setTesting] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [error, setError] = useState(null);
    const [showHelp, setShowHelp] = useState(false);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        setError(null);
        setTestResult(null);
    };

    const handleTestConnection = async () => {
        if (!formData.accessToken || !formData.phoneNumberId) {
            setError('Please fill in Access Token and Phone Number ID');
            return;
        }

        setTesting(true);
        setError(null);
        setTestResult(null);

        try {
            const response = await fetch('http://localhost:5000/api/whatsapp/connect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': 'anonymous' // Will be replaced with actual user ID from Firebase
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                setTestResult({
                    success: true,
                    phoneNumber: data.phoneNumber,
                    verifiedName: data.verifiedName,
                    qualityRating: data.qualityRating
                });
            } else {
                setError(data.error || 'Connection test failed');
            }
        } catch (err) {
            setError('Failed to connect to server. Please ensure the backend is running.');
        } finally {
            setTesting(false);
        }
    };

    const handleConnect = async () => {
        if (!testResult || !testResult.success) {
            setError('Please test the connection first');
            return;
        }

        setConnecting(true);

        try {
            // Connection already established during test
            onConnect(testResult);
            onClose();
        } catch (err) {
            setError('Failed to save connection');
        } finally {
            setConnecting(false);
        }
    };

    const handleClose = () => {
        setFormData({ accessToken: '', phoneNumberId: '', businessAccountId: '' });
        setTestResult(null);
        setError(null);
        setShowHelp(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-4 rounded-t-2xl flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold">Connect WhatsApp Business</h2>
                        <p className="text-sm text-green-50 mt-1">Official Meta WhatsApp Cloud API</p>
                    </div>
                    <button
                        onClick={handleClose}
                        className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Help Banner */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <HelpCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
                            <div className="flex-1">
                                <h3 className="font-semibold text-blue-900 mb-1">Need Help Getting Started?</h3>
                                <p className="text-sm text-blue-700 mb-2">
                                    Follow our setup guide to create your Meta Business account and get API credentials.
                                </p>
                                <button
                                    onClick={() => setShowHelp(!showHelp)}
                                    className="text-sm text-blue-600 hover:text-blue-800 font-medium underline"
                                >
                                    {showHelp ? 'Hide' : 'Show'} Setup Instructions
                                </button>
                            </div>
                        </div>

                        {showHelp && (
                            <div className="mt-4 pl-8 space-y-2 text-sm text-blue-800">
                                <p className="font-semibold">Quick Setup Steps:</p>
                                <ol className="list-decimal list-inside space-y-1">
                                    <li>Create Meta Business Manager account at <a href="https://business.facebook.com" target="_blank" rel="noopener noreferrer" className="underline">business.facebook.com</a></li>
                                    <li>Create a Meta Developer app at <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="underline">developers.facebook.com</a></li>
                                    <li>Add WhatsApp product to your app</li>
                                    <li>Get your credentials from the API Setup page</li>
                                    <li>Paste them below and test connection</li>
                                </ol>
                                <p className="mt-2 text-xs">
                                    📄 Check the <code className="bg-blue-100 px-1 rounded">whatsapp_business_api_setup.md</code> file for detailed instructions.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Form Fields */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Access Token *
                            </label>
                            <input
                                type="password"
                                name="accessToken"
                                value={formData.accessToken}
                                onChange={handleChange}
                                placeholder="EAAxxxxxxxxxxxxxxxxxxxxxxxxx"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Get this from Meta Developer Console → Your App → WhatsApp → API Setup
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Phone Number ID *
                            </label>
                            <input
                                type="text"
                                name="phoneNumberId"
                                value={formData.phoneNumberId}
                                onChange={handleChange}
                                placeholder="123456789012345"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Found on the same API Setup page
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Business Account ID *
                            </label>
                            <input
                                type="text"
                                name="businessAccountId"
                                value={formData.businessAccountId}
                                onChange={handleChange}
                                placeholder="123456789012345"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Get this from WhatsApp Manager
                            </p>
                        </div>
                    </div>

                    {/* Test Result */}
                    {testResult && testResult.success && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                                <CheckCircle className="text-green-600 flex-shrink-0" size={24} />
                                <div className="flex-1">
                                    <h3 className="font-semibold text-green-900 mb-2">Connection Successful! ✅</h3>
                                    <div className="space-y-1 text-sm text-green-800">
                                        <p><span className="font-medium">Phone Number:</span> {testResult.phoneNumber}</p>
                                        <p><span className="font-medium">Verified Name:</span> {testResult.verifiedName}</p>
                                        <p><span className="font-medium">Quality Rating:</span>
                                            <span className={`ml-2 px-2 py-0.5 rounded text-xs font-bold ${testResult.qualityRating === 'GREEN' ? 'bg-green-200 text-green-800' :
                                                    testResult.qualityRating === 'YELLOW' ? 'bg-yellow-200 text-yellow-800' :
                                                        'bg-red-200 text-red-800'
                                                }`}>
                                                {testResult.qualityRating}
                                            </span>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
                                <div>
                                    <h3 className="font-semibold text-red-900 mb-1">Connection Failed</h3>
                                    <p className="text-sm text-red-700">{error}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-4 border-t">
                        <button
                            onClick={handleTestConnection}
                            disabled={testing || !formData.accessToken || !formData.phoneNumberId}
                            className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                        >
                            {testing ? (
                                <>
                                    <Loader className="animate-spin" size={20} />
                                    Testing...
                                </>
                            ) : (
                                'Test Connection'
                            )}
                        </button>

                        <button
                            onClick={handleConnect}
                            disabled={!testResult || !testResult.success || connecting}
                            className="flex-1 bg-green-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                        >
                            {connecting ? (
                                <>
                                    <Loader className="animate-spin" size={20} />
                                    Connecting...
                                </>
                            ) : (
                                <>
                                    <CheckCircle size={20} />
                                    Connect WhatsApp
                                </>
                            )}
                        </button>
                    </div>

                    {/* Footer Note */}
                    <div className="text-xs text-gray-500 text-center pt-2 border-t">
                        <p>🔒 Your credentials are encrypted and stored securely</p>
                        <p className="mt-1">First 1,000 user-initiated conversations per month are FREE</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WhatsAppConnectModal;
