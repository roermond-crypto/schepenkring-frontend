"use client";

import { useState } from "react";
import { X, Plus, Trash, Loader2, DownloadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { toast } from "react-hot-toast";

interface BulkImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const DEFAULT_URLS = [
    "https://krekelberg.yachtshift.nl/yachtshift/export/feed/key/790b0db72e79d4f9f461b469a6b75c1249",
    "https://krekelberg.yachtshift.nl/yachtshift/export/feed/key/b838013b411e375e537ff6e722d9f22f19",
];

export function BulkImportModal({ isOpen, onClose, onSuccess }: BulkImportModalProps) {
    const [urls, setUrls] = useState<string[]>([...DEFAULT_URLS]);
    const [isImporting, setIsImporting] = useState(false);
    const [results, setResults] = useState<{ imported: number; updated: number; errors: number } | null>(null);

    if (!isOpen) return null;

    const handleAddUrl = () => {
        setUrls([...urls, ""]);
    };

    const handleUrlChange = (index: number, value: string) => {
        const newUrls = [...urls];
        newUrls[index] = value;
        setUrls(newUrls);
    };

    const handleRemoveUrl = (index: number) => {
        const newUrls = urls.filter((_, i) => i !== index);
        setUrls(newUrls);
    };

    const handleImport = async () => {
        const validUrls = urls.filter((url) => url.trim() !== "");
        if (validUrls.length === 0) {
            toast.error("Please provide at least one valid feed URL.");
            return;
        }

        setIsImporting(true);
        setResults(null);

        try {
            // NOTE: This process might be slow (downloading images), so wait for it.
            // Using /api/proxy securely forwards the HttpOnly auth cookie to the backend
            const axios = require('axios');
            const response = await axios.post("/api/proxy/admin/yachts/bulk-import", { urls: validUrls });
            const { imported, updated, errors } = response.data;

            setResults({ imported, updated, errors });

            if (errors === 0) {
                toast.success(`Successfully imported ${imported} new yachts and updated ${updated}.`);
                onSuccess();
            } else {
                toast.success(`Import partial: ${imported} imported, ${updated} updated, with ${errors} errors.`);
                onSuccess();
            }
        } catch (error: any) {
            console.error("Bulk import failed:", error);
            toast.error(error.response?.data?.message || "Failed to import yachts from Yachtshift.");
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-2xl shadow-xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded">
                            <DownloadCloud size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-serif italic text-slate-900">
                                Bulk Yacht Import
                            </h2>
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-1">
                                Yachtshift XML Feed
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isImporting}
                        className="text-slate-400 hover:text-slate-900 transition-colors disabled:opacity-50"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
                    <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                        Provide the Yachtshift API XML feed URLs below. The system will download the feeds,
                        parse the vessel details, and automatically securely download the primary and gallery images.
                        This may take a few minutes depending on the number of new boats.
                    </p>

                    <div className="space-y-3">
                        {urls.map((url, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <input
                                    type="url"
                                    placeholder="https://krekelberg.yachtshift.nl/yachtshift/export/feed/key/..."
                                    value={url}
                                    onChange={(e) => handleUrlChange(index, e.target.value)}
                                    disabled={isImporting}
                                    className="w-full bg-white border border-slate-200 p-3 text-[11px] font-mono outline-none focus:ring-1 focus:ring-blue-600 transition-all disabled:bg-slate-50 disabled:text-slate-400"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleRemoveUrl(index)}
                                    disabled={isImporting || urls.length === 1}
                                    className="p-3 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors"
                                >
                                    <Trash size={16} />
                                </button>
                            </div>
                        ))}
                    </div>

                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleAddUrl}
                        disabled={isImporting}
                        className="mt-4 w-full border-dashed bg-transparent border-slate-300 text-slate-500 hover:text-[#003566] hover:border-[#003566] text-[10px] font-black uppercase tracking-widest h-12"
                    >
                        <Plus size={14} className="mr-2" />
                        Add Another URL
                    </Button>

                    {/* Results Block */}
                    {results && (
                        <div className="mt-6 p-4 bg-emerald-50 border border-emerald-100 rounded-sm">
                            <h3 className="text-emerald-800 font-bold mb-2">Import Complete</h3>
                            <ul className="text-sm text-emerald-700 space-y-1">
                                <li>• <strong>{results.imported}</strong> new vessels created.</li>
                                <li>• <strong>{results.updated}</strong> existing vessels updated.</li>
                                {results.errors > 0 && (
                                    <li className="text-red-600">• <strong>{results.errors}</strong> vessels failed to process.</li>
                                )}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 bg-white flex justify-end gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        disabled={isImporting}
                        className="rounded-none border-slate-200 text-slate-600 hover:bg-slate-50 h-10 px-6 font-black uppercase text-[10px] tracking-widest"
                    >
                        {results ? "Close" : "Cancel"}
                    </Button>
                    <Button
                        type="button"
                        onClick={handleImport}
                        disabled={isImporting || urls.filter((u) => u.trim() !== "").length === 0}
                        className="bg-[#003566] text-white hover:bg-blue-800 rounded-none h-10 px-8 font-black uppercase text-[10px] tracking-widest min-w-[140px]"
                    >
                        {isImporting ? (
                            <>
                                <Loader2 size={14} className="mr-2 animate-spin" />
                                Importing...
                            </>
                        ) : (
                            "Start Import"
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
