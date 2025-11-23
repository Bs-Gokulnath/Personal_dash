import { useState } from 'react';
import { X, Phone, MessageSquare, Lock, Loader2 } from 'lucide-react';

const TelegramAuthModal = ({ isOpen, onClose, onSuccess }) => {
    const [step, setStep] = useState('phone'); // 'phone', 'code', '2fa', 'success'
    const [phoneNumber, setPhoneNumber] = useState('');
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handlePhoneSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch('http://localhost:5000/api/telegram/auth/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phoneNumber }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to start authentication');
            }

            setStep('code');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCodeSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch('http://localhost:5000/api/telegram/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phoneNumber,
                    code,
                    password: password || undefined
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                // Check if it's a 2FA error
                if (data.error?.includes('2FA') || data.error?.includes('password')) {
                    setStep('2fa');
                    setError('Two-factor authentication required');
                    return;
                }
                throw new Error(data.error || 'Failed to verify code');
            }

            setStep('success');
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 2000);

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const reset = () => {
        setStep('phone');
        setPhoneNumber('');
        setCode('');
        setPassword('');
        setError('');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
            <div className="w-full max-w-md rounded-xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 p-6 bg-gradient-to-r from-blue-500 to-cyan-500">
                    <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                            <MessageSquare className="text-white" size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Connect Telegram</h3>
                            <p className="text-sm text-blue-100">
                                {step === 'phone' && 'Enter your phone number'}
                                {step === 'code' && 'Enter verification code'}
                                {step === '2fa' && 'Two-factor authentication'}
                                {step === 'success' && 'Successfully connected!'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => { reset(); onClose(); }}
                        className="rounded-full p-2 text-white/80 hover:bg-white/20 hover:text-white"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Phone Number Step */}
                    {step === 'phone' && (
                        <form onSubmit={handlePhoneSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <Phone size={16} className="inline mr-2" />
                                    Phone Number
                                </label>
                                <input
                                    type="tel"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="+1234567890"
                                    required
                                    autoFocus
                                />
                                <p className="mt-2 text-xs text-gray-500">
                                    Include country code (e.g., +1 for US, +91 for India)
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !phoneNumber}
                                className={`w-full px-6 py-3 text-white rounded-lg font-medium flex items-center justify-center space-x-2 ${loading || !phoneNumber
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700'
                                    }`}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 size={20} className="animate-spin" />
                                        <span>Connecting...</span>
                                    </>
                                ) : (
                                    <span>Send Code</span>
                                )}
                            </button>
                        </form>
                    )}

                    {/* Verification Code Step */}
                    {step === 'code' && (
                        <form onSubmit={handleCodeSubmit} className="space-y-4">
                            <div className="text-center mb-4">
                                <p className="text-sm text-gray-600">
                                    We sent a code to <span className="font-semibold">{phoneNumber}</span>
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    Check your Telegram app
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Verification Code
                                </label>
                                <input
                                    type="text"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-2xl tracking-widest"
                                    placeholder="12345"
                                    maxLength="5"
                                    required
                                    autoFocus
                                />
                            </div>

                            <div className="flex space-x-3">
                                <button
                                    type="button"
                                    onClick={() => setStep('phone')}
                                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                                    disabled={loading}
                                >
                                    Back
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading || code.length < 5}
                                    className={`flex-1 px-6 py-3 text-white rounded-lg font-medium flex items-center justify-center space-x-2 ${loading || code.length < 5
                                            ? 'bg-gray-400 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700'
                                        }`}
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 size={20} className="animate-spin" />
                                            <span>Verifying...</span>
                                        </>
                                    ) : (
                                        <span>Verify</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* 2FA Password Step */}
                    {step === '2fa' && (
                        <form onSubmit={handleCodeSubmit} className="space-y-4">
                            <div className="text-center mb-4">
                                <Lock className="mx-auto text-blue-600 mb-2" size={32} />
                                <p className="text-sm text-gray-600">
                                    Two-factor authentication is enabled
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Password
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter your 2FA password"
                                    required
                                    autoFocus
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !password}
                                className={`w-full px-6 py-3 text-white rounded-lg font-medium flex items-center justify-center space-x-2 ${loading || !password
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700'
                                    }`}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 size={20} className="animate-spin" />
                                        <span>Verifying...</span>
                                    </>
                                ) : (
                                    <span>Unlock</span>
                                )}
                            </button>
                        </form>
                    )}

                    {/* Success Step */}
                    {step === 'success' && (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                                <MessageSquare className="text-green-600" size={32} />
                            </div>
                            <h4 className="text-xl font-bold text-gray-900 mb-2">Connected!</h4>
                            <p className="text-gray-600">
                                Your Telegram account is now connected to the dashboard.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TelegramAuthModal;
