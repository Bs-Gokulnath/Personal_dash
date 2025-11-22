import { useState } from 'react';
import { X, Wand2, Loader2 } from 'lucide-react';

const AIPromptModal = ({ isOpen, onClose, onGenerate, emailContext = null }) => {
    const [prompt, setPrompt] = useState('');
    const [tone, setTone] = useState('professional');
    const [isGenerating, setIsGenerating] = useState(false);

    if (!isOpen) return null;

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            alert('Please enter a prompt');
            return;
        }

        setIsGenerating(true);
        try {
            await onGenerate(prompt, tone, emailContext);
            setPrompt('');
            onClose();
        } catch (error) {
            console.error('Error generating draft:', error);
            alert('Failed to generate draft. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
            <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 p-6">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                            <Wand2 className="text-white" size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">✨ AI Email Assistant</h3>
                            <p className="text-sm text-gray-500">Tell me what you want to write</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Context Display */}
                {emailContext && (
                    <div className="bg-blue-50 border-b border-blue-100 p-4">
                        <p className="text-sm font-medium text-blue-900 mb-1">📧 Replying to:</p>
                        <p className="text-sm text-blue-700">
                            <span className="font-semibold">{emailContext.sender}</span> - {emailContext.subject}
                        </p>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Prompt Input */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            What would you like to write?
                        </label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                            rows={4}
                            placeholder="e.g., Reply thanking them for their offer and asking about next steps&#10;or&#10;Write a professional leave application for tomorrow"
                            autoFocus
                        />
                        <p className="mt-2 text-xs text-gray-500">
                            💡 Tip: Be specific for better results. Example: "Reply politely declining the meeting and suggesting next week instead"
                        </p>
                    </div>

                    {/* Tone Selector */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            Email Tone
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { value: 'professional', label: 'Professional', emoji: '👔' },
                                { value: 'casual', label: 'Casual', emoji: '😊' },
                                { value: 'formal', label: 'Formal', emoji: '🎩' }
                            ].map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => setTone(option.value)}
                                    className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${tone === option.value
                                            ? 'border-purple-500 bg-purple-50 text-purple-700'
                                            : 'border-gray-200 bg-white text-gray-700 hover:border-purple-300'
                                        }`}
                                >
                                    <span className="text-lg mr-2">{option.emoji}</span>
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 p-4 bg-gray-50 flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-200 transition-colors"
                        disabled={isGenerating}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || !prompt.trim()}
                        className={`px-6 py-2 text-sm font-medium text-white rounded-lg transition-all flex items-center space-x-2 ${isGenerating || !prompt.trim()
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg'
                            }`}
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                <span>Generating...</span>
                            </>
                        ) : (
                            <>
                                <Wand2 size={16} />
                                <span>Generate Draft</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AIPromptModal;
