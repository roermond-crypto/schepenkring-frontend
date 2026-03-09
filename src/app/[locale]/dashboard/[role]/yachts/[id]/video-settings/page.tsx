"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { toast } from "react-hot-toast";
import { ArrowLeft, Save, Loader2, Sparkles, CheckCircle, Video, Instagram, Facebook, Timer, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function VideoSettingsPage() {
    const router = useRouter();
    const params = useParams();
    const t = useTranslations("common");
    const yachtId = params.id as string;
    const locale = params.locale as string;
    const role = params.role as string;

    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [settings, setSettings] = useState<any>({});
    const [socialPosts, setSocialPosts] = useState<any[]>([]);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await api.get(`/yachts/${yachtId}/video-settings`);
                setSettings(res.data.settings);
                setSocialPosts(res.data.social_posts || []);
            } catch (err) {
                toast.error("Failed to load settings");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        if (yachtId) fetchSettings();
    }, [yachtId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await api.put(`/yachts/${yachtId}/video-settings`, settings);
            toast.success("Settings saved successfully");
            router.back();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Failed to save settings");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePlatformToggle = (platform: string) => {
        const current = settings.platforms || [];
        if (current.includes(platform)) {
            setSettings({ ...settings, platforms: current.filter((p: string) => p !== platform) });
        } else {
            setSettings({ ...settings, platforms: [...current, platform] });
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
                <Loader2 className="animate-spin text-[#003566]" size={40} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8FAFC] pb-24">
            <div className="bg-[#003566] text-white p-6 lg:p-8 sticky top-0 z-40 shadow-xl flex justify-between items-center">
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => router.back()}
                        className="hover:bg-white/10 p-2 rounded-full transition-colors"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-xl lg:text-2xl font-serif italic">Video & Social Settings</h1>
                        <p className="text-blue-400 text-[9px] font-black uppercase tracking-[0.3em] mt-1">
                            Configuration for {settings.boat_name || "Yacht"}
                        </p>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto p-6 lg:p-12">
                <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-sm space-y-6">
                        <h3 className="text-[10px] font-black uppercase text-[#003566] tracking-widest flex items-center gap-2 italic border-b border-slate-200 pb-4">
                            <Video size={16} className="text-blue-600" /> Publishing Configuration
                        </h3>

                        <div className="space-y-4">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div className={`w-10 h-6 rounded-full relative transition-all duration-300 ${settings.auto_publish_social ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={settings.auto_publish_social || false}
                                        onChange={(e) => setSettings({ ...settings, auto_publish_social: e.target.checked })}
                                    />
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${settings.auto_publish_social ? 'left-5' : 'left-1'}`} />
                                </div>
                                <span className="text-xs font-bold text-[#003566] group-hover:text-blue-600 transition-colors">Auto-publish to social media</span>
                            </label>

                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div className={`w-10 h-6 rounded-full relative transition-all duration-300 ${settings.auto_generate_caption ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={settings.auto_generate_caption || false}
                                        onChange={(e) => setSettings({ ...settings, auto_generate_caption: e.target.checked })}
                                    />
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${settings.auto_generate_caption ? 'left-5' : 'left-1'}`} />
                                </div>
                                <span className="text-xs font-bold text-[#003566] group-hover:text-blue-600 transition-colors">Auto-generate AI Captions & Hashtags</span>
                            </label>
                        </div>

                        <div className="pt-6 border-t border-slate-100">
                            <p className="text-[9px] font-black uppercase text-slate-400 mb-4 tracking-widest">Target Platforms</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                    { id: 'instagram', icon: <Instagram size={14} />, color: 'text-pink-600' },
                                    { id: 'facebook', icon: <Facebook size={14} />, color: 'text-blue-600' },
                                    { id: 'tiktok', icon: <Timer size={14} />, color: 'text-black' },
                                    { id: 'youtube', icon: <Youtube size={14} />, color: 'text-red-600' }
                                ].map(platform => (
                                    <label
                                        key={platform.id}
                                        className={`flex items-center gap-3 p-3 border rounded-sm cursor-pointer transition-all ${(settings.platforms || []).includes(platform.id)
                                                ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-200'
                                                : 'bg-slate-50 border-transparent hover:border-slate-200'
                                            }`}
                                    >
                                        <input
                                            type="checkbox"
                                            className="sr-only"
                                            checked={(settings.platforms || []).includes(platform.id)}
                                            onChange={() => handlePlatformToggle(platform.id)}
                                        />
                                        <span className={platform.color}>{platform.icon}</span>
                                        <span className="text-[10px] font-bold uppercase tracking-wider">{platform.id}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="pt-6 border-t border-slate-100">
                            <label className="text-[9px] font-black uppercase text-slate-400 mb-3 block tracking-widest">Crop Format</label>
                            <div className="grid grid-cols-3 gap-4">
                                {[
                                    { id: '16:9', label: 'Wide (16:9)', desc: 'YouTube / Web' },
                                    { id: '9:16', label: 'Vertical (9:16)', desc: 'Reels / TikTok' },
                                    { id: '1:1', label: 'Square (1:1)', desc: 'Instagram' }
                                ].map(format => (
                                    <button
                                        key={format.id}
                                        type="button"
                                        onClick={() => setSettings({ ...settings, video_crop_format: format.id })}
                                        className={`p-4 border rounded-sm text-left transition-all ${settings.video_crop_format === format.id
                                                ? 'bg-blue-600 border-blue-600 text-white'
                                                : 'bg-slate-50 border-transparent text-[#003566] hover:border-slate-200'
                                            }`}
                                    >
                                        <p className="text-[10px] font-black uppercase tracking-wider">{format.label}</p>
                                        <p className={`text-[8px] mt-1 ${settings.video_crop_format === format.id ? 'text-blue-100' : 'text-slate-400'}`}>{format.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="pt-6 border-t border-slate-100 space-y-6">
                            <div>
                                <label className="text-[9px] font-black uppercase text-slate-400 mb-2 flex items-center gap-2 tracking-widest">
                                    Caption Template <Sparkles size={12} className="text-yellow-500" />
                                </label>
                                <textarea
                                    className="w-full bg-slate-50 border border-slate-100 p-4 text-xs text-[#003566] outline-none focus:border-blue-600 transition-all rounded-sm min-h-[120px] shadow-inner"
                                    value={settings.caption_template || ""}
                                    onChange={(e) => setSettings({ ...settings, caption_template: e.target.value })}
                                    placeholder="E.g. Step aboard the beautiful {{boat_name}}. Perfect for {{activity}}..."
                                />
                                <p className="text-[8px] text-slate-400 mt-2 font-medium">Use {"{{keyword}}"} for automated replacement</p>
                            </div>

                            <div>
                                <label className="text-[9px] font-black uppercase text-slate-400 mb-2 flex items-center gap-2 tracking-widest">
                                    Hashtag Template <Sparkles size={12} className="text-yellow-500" />
                                </label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-50 border border-slate-100 py-4 px-4 text-xs text-[#003566] outline-none focus:border-blue-600 transition-all rounded-sm shadow-inner"
                                    value={settings.hashtags_template || ""}
                                    onChange={(e) => setSettings({ ...settings, hashtags_template: e.target.value })}
                                    placeholder="#yacht #boat #{{brand}}"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-sm">
                        <h3 className="text-[10px] font-black uppercase text-[#003566] tracking-widest flex items-center gap-2 italic border-b border-slate-200 pb-4 mb-6">
                            <CheckCircle size={16} className="text-emerald-600" /> Publishing History
                        </h3>
                        {socialPosts.length === 0 ? (
                            <div className="text-center py-12 bg-slate-50 rounded-sm border border-dashed border-slate-200">
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">No posts have been published yet.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-200 text-[9px] uppercase tracking-widest text-[#003566]">
                                            <th className="py-3 px-2">Platform</th>
                                            <th className="py-3 px-2">Status</th>
                                            <th className="py-3 px-2">Details</th>
                                            <th className="py-3 px-2 text-right">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {socialPosts.map(post => (
                                            <tr key={post.id} className="border-b border-slate-50 text-[10px] text-[#003566] hover:bg-slate-50 transition-colors">
                                                <td className="py-4 px-2 font-black uppercase tracking-wider">{post.platform}</td>
                                                <td className="py-4 px-2">
                                                    <span className={`px-2 py-1 rounded-full text-white font-black text-[8px] uppercase tracking-tighter ${post.status === 'published' ? 'bg-emerald-500' :
                                                            post.status === 'failed' ? 'bg-rose-500' :
                                                                'bg-amber-500'
                                                        }`}>
                                                        {post.status}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-2 text-slate-500 max-w-[200px] truncate italic">
                                                    {post.error_message || "Published successfully"}
                                                </td>
                                                <td className="py-4 px-2 text-slate-400 text-right font-medium">
                                                    {new Date(post.published_at || post.created_at).toLocaleDateString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-slate-200 p-6 flex justify-between items-center z-50">
                        <Button
                            variant="outline"
                            onClick={() => router.back()}
                            className="text-[10px] h-12 px-8 font-black uppercase tracking-widest border-slate-200 text-slate-500 hover:bg-slate-50 transition-all rounded-none"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-[#003566] text-white hover:bg-blue-800 rounded-none h-12 px-12 font-black uppercase text-[10px] tracking-widest transition-all shadow-xl"
                        >
                            {isSubmitting ? (
                                <Loader2 className="animate-spin mr-2 w-4 h-4" />
                            ) : (
                                <Save className="mr-2 w-4 h-4" />
                            )}
                            Save Configuration
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
