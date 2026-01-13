import { useState, useEffect } from 'react';
import { X, Loader2, CheckCircle, QrCode } from 'lucide-react';
import QRCode from 'qrcode';

const WhatsAppAuthModal = ({ isOpen, onClose, onSuccess }) => {
    const [qrCodeImage, setQrCodeImage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [connected, setConnected] = useState(false);
    const [checkingStatus, setCheckingStatus] = useState(false);

    useEffect(() => {
        if (isOpen) {
            startAuth();
        } else {
            // Reset state when modal closes
            setQrCodeImage(null);
            setError(null);
            setConnected(false);
        }
    }, [isOpen]);

    const startAuth = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('http://localhost:5000/api/whatsapp/auth/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': 'anonymous'
                }
            });

            const data = await response.json();

            if (data.connected) {
                setConnected(true);
                setTimeout(() => {
                    onSuccess();
                    onClose();
                }, 1500);
                return;
            }

            if (data.qr) {
                // Generate QR code image
                const qrImage = await QRCode.toDataURL(data.qr, {
                    width: 300,
                    margin: 2,
                    color: {
                        dark: '#000000',
                        light: '#FFFFFF'
                    }
                });
                setQrCodeImage(qrImage);

                // Start checking for connection
                startStatusCheck();
            } else if (data.initializing) {
                // Wait a bit and try again
                setTimeout(startAuth, 2000);
            }

        } catch (err) {
            console.error('WhatsApp auth error:', err);
            setError(err.message || 'Failed to initialize WhatsApp connection');
        } finally {
            setLoading(false);
        }
    };

    const startStatusCheck = () => {
        setCheckingStatus(true);
        const interval = setInterval(async () => {
            try {
                const response = await fetch('http://localhost:5000/api/whatsapp/status');
                const data = await response.json();

                if (data.connected) {
                    clearInterval(interval);
                    setConnected(true);
                    setCheckingStatus(false);

                    setTimeout(() => {
                        onSuccess();
                        onClose();
                    }, 1500);
                }
            } catch (err) {
                console.error('Status check error:', err);
            }
        }, 3000); // Check every 3 seconds

        // Stop checking after 5 minutes
        setTimeout(() => {
            clearInterval(interval);
            setCheckingStatus(false);
            if (!connected) {
                setError('Connection timeout. Please try again.');
            }
        }, 300000);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 p-6 bg-gradient-to-r from-green-50 to-emerald-50">
                    <div>
                        <div className="flex items-center space-x-2 mb-1">
                            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">Connect WhatsApp</h3>
                        </div>
                        <p className="text-sm text-gray-600">Scan QR code with your phone</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-full p-2 text-gray-400 hover:bg-white hover:text-gray-600 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8">
                    {loading && !qrCodeImage && (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Loader2 className="w-12 h-12 text-green-500 animate-spin mb-4" />
                            <p className="text-gray-600">Initializing WhatsApp...</p>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                            <p className="text-red-800 text-sm">{error}</p>
                            <button
                                onClick={startAuth}
                                className="mt-2 text-sm text-red-600 hover:text-red-700 font-medium"
                            >
                                Try Again
                            </button>
                        </div>
                    )}

                    {connected && (
                        <div className="flex flex-col items-center justify-center py-12">
                            <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
                            <p className="text-lg font-semibold text-gray-900">Connected!</p>
                            <p className="text-sm text-gray-600 mt-2">WhatsApp is now connected</p>
                        </div>
                    )}

                    {qrCodeImage && !connected && (
                        <div className="flex flex-col items-center">
                            <div className="bg-white p-4 rounded-2xl shadow-lg border-4 border-green-500 mb-6">
                                <img src={qrCodeImage} alt="WhatsApp QR Code" className="w-64 h-64" />
                            </div>

                            {checkingStatus && (
                                <div className="flex items-center gap-2 text-green-600 mb-4">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span className="text-sm">Waiting for scan...</span>
                                </div>
                            )}

                            <div className="bg-green-50 border border-green-200 rounded-lg p-4 w-full">
                                <h4 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                                    <QrCode size={18} />
                                    How to connect:
                                </h4>
                                <ol className="text-sm text-green-800 space-y-2 list-decimal list-inside">
                                    <li>Open WhatsApp on your phone</li>
                                    <li>Tap <strong>Menu</strong> or <strong>Settings</strong></li>
                                    <li>Tap <strong>Linked Devices</strong></li>
                                    <li>Tap <strong>Link a Device</strong></li>
                                    <li>Point your phone at this screen to scan the code</li>
                                </ol>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WhatsAppAuthModal;
