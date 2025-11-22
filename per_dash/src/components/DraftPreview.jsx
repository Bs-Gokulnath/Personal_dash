import { useState } from 'react';
import { X, Send, Loader2, RefreshCw, Edit3 } from 'lucide-react';

const DraftPreview = ({ draft, onClose, onSend, onImprove }) => {
    const [editedDraft, setEditedDraft] = useState(draft);
    const [isSending, setIsSending] = useState(false);
    const [showImprove, setShowImprove] = useState(false);
    const [improveInstruction, setImproveInstruction] = useState('');
    const [isImproving, setIsImproving] = useState(false);

    const handleSend = async () => {
        setIsSending(true);
        try {
            await onSend(editedDraft);
            onClose();
        } catch (error) {
            console.error('Error sending email:', error);
            alert('Failed to send email. Please try again.');
        } finally {
            setIsSending(false);
        }
    };

    const handleImprove = async () => {
        if (!improveInstruction.trim()) {
            alert('Please enter improvement instructions');
            return;
        }

        setIsImproving(true);
        try {
            const result = await onImprove(editedDraft.body, improveInstruction);
            setEditedDraft({
                ...editedDraft,
                body: result.improvedBody
            });
            setImproveInstruction('');
            setShowImprove(false);
        } catch (error) {
            console.error('Error improving draft:', error);
            alert('Failed to improve draft. Please try again.');
        } finally {
            setIsImproving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
            <div className="w-full max-w-3xl rounded-xl bg-white shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 p-6 bg-gradient-to-r from-green-50 to-blue-50">
                    <div>
                        <div className="flex items-center space-x-2 mb-1">
                            <span className="text-2xl">✨</span>
                            <h3 className="text-lg font-bold text-gray-900">AI Generated Draft</h3>
                        </div>
                        <p className="text-sm text-gray-600">Review and edit before sending</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-full p-2 text-gray-400 hover:bg-white hover:text-gray-600"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {/* To Field */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
                        <input
                            type="email"
                            value={editedDraft.to}
                            onChange={(e) => setEditedDraft({ ...editedDraft, to: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Subject Field */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                        <input
                            type="text"
                            value={editedDraft.subject}
                            onChange={(e) => setEditedDraft({ ...editedDraft, subject: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Body Field */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                        <textarea
                            value={editedDraft.body.replace(/<[^>]*>/g, '')} // Strip HTML for editing
                            onChange={(e) => setEditedDraft({ ...editedDraft, body: `<p>${e.target.value.replace(/\n/g, '</p><p>')}</p>` })}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-sans"
                            rows={12}
                        />
                    </div>

                    {/* Improve Section */}
                    {showImprove && (
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                            <label className="block text-sm font-medium text-purple-900 mb-2">
                                How would you like to improve this draft?
                            </label>
                            <textarea
                                value={improveInstruction}
                                onChange={(e) => setImproveInstruction(e.target.value)}
                                className="w-full px-4 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                                rows={2}
                                placeholder="e.g., Make it more formal, Add a closing paragraph, Shorten it"
                                autoFocus
                            />
                            <div className="flex justify-end space-x-2 mt-3">
                                <button
                                    onClick={() => setShowImprove(false)}
                                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                                    disabled={isImproving}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleImprove}
                                    disabled={isImproving || !improveInstruction.trim()}
                                    className={`px-4 py-2 text-sm font-medium text-white rounded-lg flex items-center space-x-2 ${isImproving || !improveInstruction.trim()
                                            ? 'bg-gray-400 cursor-not-allowed'
                                            : 'bg-purple-600 hover:bg-purple-700'
                                        }`}
                                >
                                    {isImproving ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            <span>Improving...</span>
                                        </>
                                    ) : (
                                        <>
                                            <RefreshCw size={16} />
                                            <span>Improve</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 p-4 bg-gray-50 flex justify-between">
                    <button
                        onClick={() => setShowImprove(!showImprove)}
                        className="px-4 py-2 text-sm font-medium text-purple-600 hover:text-purple-700 rounded-lg hover:bg-purple-50 transition-colors flex items-center space-x-2"
                        disabled={isSending}
                    >
                        <Edit3 size={16} />
                        <span>Improve with AI</span>
                    </button>
                    <div className="flex space-x-3">
                        <button
                            onClick={onClose}
                            className="px-5 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-200 transition-colors"
                            disabled={isSending}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSend}
                            disabled={isSending || !editedDraft.to || !editedDraft.subject}
                            className={`px-6 py-2 text-sm font-medium text-white rounded-lg transition-all flex items-center space-x-2 ${isSending || !editedDraft.to || !editedDraft.subject
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 shadow-lg'
                                }`}
                        >
                            {isSending ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    <span>Sending...</span>
                                </>
                            ) : (
                                <>
                                    <Send size={16} />
                                    <span>Send Email</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DraftPreview;
