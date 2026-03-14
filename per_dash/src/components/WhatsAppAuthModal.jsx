import { useState, useEffect, useRef } from 'react';
import { X, Loader2, CheckCircle, Wifi } from 'lucide-react';
import QRCode from 'qrcode';
import { io } from 'socket.io-client';

const BACKEND = 'http://localhost:5000';

const WhatsAppAuthModal = ({ isOpen, onClose, onSuccess }) => {
    const [qrCodeImage, setQrCodeImage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [connected, setConnected] = useState(false);
    const [status, setStatus] = useState('');
    const socketRef = useRef(null);

    useEffect(() => {
        if (!isOpen) { cleanup(); return; }
        startAuth();
        connectSocket();
        return () => cleanup();
    }, [isOpen]);

    const cleanup = () => {
        if (socketRef.current) {
            socketRef.current.off('wa:qr');
            socketRef.current.off('wa:ready');
            socketRef.current.disconnect();
            socketRef.current = null;
        }
        setQrCodeImage(null);
        setError(null);
        setConnected(false);
        setStatus('');
    };

    const connectSocket = () => {
        const socket = io(BACKEND, { transports: ['websocket', 'polling'] });
        socketRef.current = socket;

        socket.on('wa:qr', async (rawQR) => {
            setStatus('');
            setError(null);
            setLoading(false);
            const img = await QRCode.toDataURL(rawQR, {
                width: 280, margin: 2,
                color: { dark: '#000000', light: '#FFFFFF' }
            });
            setQrCodeImage(img);
        });

        socket.on('wa:ready', () => {
            setConnected(true);
            setQrCodeImage(null);
            setLoading(false);
            setTimeout(() => { onSuccess(); onClose(); }, 1500);
        });
    };

    const startAuth = async () => {
        setLoading(true);
        setError(null);
        setQrCodeImage(null);
        setStatus('Starting WhatsApp connection...');

        try {
            const res = await fetch(`${BACKEND}/api/whatsapp/auth/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-user-id': 'anonymous' }
            });
            const data = await res.json();

            if (data.connected) {
                setConnected(true);
                setLoading(false);
                setTimeout(() => { onSuccess(); onClose(); }, 1200);
                return;
            }

            if (data.qr) {
                const img = await QRCode.toDataURL(data.qr, {
                    width: 280, margin: 2,
                    color: { dark: '#000000', light: '#FFFFFF' }
                });
                setQrCodeImage(img);
                setLoading(false);
                setStatus('');
                return;
            }

            // Initializing — socket will deliver QR via wa:qr event
            setStatus('Connecting via WebSocket... (no browser needed)');
            setLoading(true);
        } catch (err) {
            setError('Failed to start: ' + err.message);
            setLoading(false);
            setStatus('');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#25D366] flex items-center justify-center">
                            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.558 4.119 1.533 5.843L0 24l6.335-1.513A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.8 9.8 0 01-5.013-1.376l-.36-.213-3.761.988.988-3.687-.234-.38A9.818 9.818 0 1112 21.818z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="font-semibold text-gray-900 text-sm">Connect WhatsApp</h2>
                            <p className="text-xs text-gray-400">Scan QR to link your account</p>
                        </div>
                    </div>
                    <button onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 flex flex-col items-center min-h-[300px] justify-center">
                    {connected ? (
                        <div className="py-6 text-center">
                            <CheckCircle size={52} className="text-[#25D366] mx-auto mb-3" />
                            <p className="font-semibold text-gray-900">Connected!</p>
                            <p className="text-sm text-gray-500 mt-1">Your WhatsApp is now linked</p>
                        </div>
                    ) : loading ? (
                        <div className="py-6 text-center">
                            <Loader2 size={40} className="text-[#25D366] animate-spin mx-auto mb-4" />
                            <p className="text-sm font-medium text-gray-700">{status || 'Starting...'}</p>
                            <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-400 justify-center">
                                <Wifi size={13} />
                                <span>Direct WebSocket · No Chrome needed</span>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="py-6 text-center">
                            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
                                <X size={24} className="text-red-500" />
                            </div>
                            <p className="font-medium text-gray-800 mb-1">Connection failed</p>
                            <p className="text-sm text-red-500 mb-4">{error}</p>
                            <button onClick={startAuth}
                                className="px-5 py-2 bg-[#25D366] text-white text-sm rounded-xl hover:bg-[#1ea85a] transition-colors font-medium">
                                Try Again
                            </button>
                        </div>
                    ) : qrCodeImage ? (
                        <>
                            <p className="text-sm text-gray-600 text-center mb-4">
                                Open WhatsApp → <strong>Linked Devices → Link a Device</strong>
                            </p>
                            <div className="p-2.5 bg-white rounded-xl border-2 border-[#25D366]/40 shadow-sm">
                                <img src={qrCodeImage} alt="WhatsApp QR" className="w-[240px] h-[240px]" />
                            </div>
                            <p className="text-xs text-gray-400 mt-3 text-center">
                                Waiting for scan... QR refreshes automatically
                            </p>
                            <button onClick={startAuth}
                                className="mt-2 text-xs text-[#25D366] hover:underline">
                                Regenerate QR
                            </button>
                        </>
                    ) : (
                        <div className="py-6 text-center">
                            <Loader2 size={36} className="text-[#25D366] animate-spin mx-auto mb-3" />
                            <p className="text-sm text-gray-500">Waiting for QR code...</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WhatsAppAuthModal;
