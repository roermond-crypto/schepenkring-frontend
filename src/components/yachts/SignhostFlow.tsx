"use client";

import { useState, useEffect } from "react";
import {
    FileText,
    Send,
    CheckCircle,
    XCircle,
    Loader2,
    UserPlus,
    RefreshCw,
    Eye,
    AlertCircle,
    FileCheck,
    Mail,
    User,
    ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";
import { signhostApi, SignRequest, SignRecipient, SignhostDocument } from "@/lib/api/signhost";

interface SignhostFlowProps {
    yachtId: number;
    yachtName: string;
    locationId: number | null;
}

export function SignhostFlow({ yachtId, yachtName, locationId }: SignhostFlowProps) {
    const [loading, setLoading] = useState(false);
    const [signRequest, setSignRequest] = useState<SignRequest | null>(null);
    const [documents, setDocuments] = useState<SignhostDocument[]>([]);
    const [recipients, setRecipients] = useState<SignRecipient[]>([
        { role: "buyer", name: "", email: "" },
        { role: "seller", name: "", email: "" },
    ]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSending, setIsSending] = useState(false);

    // Poll for status if SENT
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (signRequest && signRequest.status === "SENT") {
            interval = setInterval(async () => {
                try {
                    const res = await signhostApi.getStatus(signRequest.id);
                    if (res.sign_request.status !== signRequest.status) {
                        setSignRequest(res.sign_request);
                        if (res.sign_request.status === "SIGNED") {
                            fetchDocuments(res.sign_request.id);
                            toast.success("Contract has been signed!");
                        }
                    }
                } catch (err) {
                    console.error("Status polling failed", err);
                }
            }, 10000); // Poll every 10s
        }
        return () => clearInterval(interval);
    }, [signRequest]);

    const fetchDocuments = async (requestId: number) => {
        try {
            const res = await signhostApi.getDocuments(requestId);
            setDocuments(res.documents);
        } catch (err) {
            console.error("Failed to fetch documents", err);
        }
    };

    const handleGenerateContract = async () => {
        setIsGenerating(true);
        try {
            const res = await signhostApi.generateContract({
                entity_type: "Vessel",
                entity_id: yachtId,
                location_id: locationId as number,
                title: `Purchase Agreement - ${yachtName}`,
                metadata: {
                    boat_name: yachtName
                }
            });
            setSignRequest(res.sign_request);
            setDocuments(res.sign_request.documents || []);
            toast.success("Contract generated successfully");
        } catch (err) {
            toast.error("Failed to generate contract");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSendRequest = async () => {
        if (!signRequest) return;

        // Validate and clean recipients
        const cleanedRecipients = recipients.map(r => ({
            ...r,
            name: r.name?.trim() || "",
            email: r.email?.trim() || ""
        }));

        const validRecipients = cleanedRecipients.filter(r => r.name && r.email);

        if (validRecipients.length < 1) {
            toast.error("Voer ten minste één ontvanger in met naam en e-mailadres");
            return;
        }

        // Basic email regex validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const invalidEmails = validRecipients.filter(r => !emailRegex.test(r.email));
        if (invalidEmails.length > 0) {
            toast.error(`Ongeldig e-mailadres: ${invalidEmails[0].email}`);
            return;
        }

        // Synchronize state with cleaned values
        setRecipients(cleanedRecipients);

        setIsSending(true);
        const idempotencyKey = `signhost_${signRequest.id}_${Date.now()}`;

        try {
            const res = await signhostApi.createRequest({
                sign_request_id: signRequest.id,
                recipients: validRecipients,
                reference: `vessel-${yachtId}`
            }, idempotencyKey);

            setSignRequest(res.sign_request);
            toast.success("Signature request sent");
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Failed to send signature request");
        } finally {
            setIsSending(false);
        }
    };

    const handleRecipientChange = (index: number, field: keyof SignRecipient, value: string) => {
        const newRecipients = [...recipients];
        newRecipients[index] = { ...newRecipients[index], [field]: value };
        setRecipients(newRecipients);
    };

    const getStatusDisplay = (status: string) => {
        switch (status.toUpperCase()) {
            case "DRAFT": return { label: "Draft", color: "text-slate-500 bg-slate-100 border-slate-200", icon: FileText };
            case "SENT": return { label: "Sent for Signing", color: "text-blue-600 bg-blue-50 border-blue-200", icon: Send };
            case "SIGNED": return { label: "Signed", color: "text-emerald-600 bg-emerald-50 border-emerald-200", icon: FileCheck };
            case "FAILED": return { label: "Cancelled", color: "text-red-600 bg-red-50 border-red-200", icon: XCircle };
            default: return { label: status, color: "text-slate-500 bg-slate-100 border-slate-200", icon: AlertCircle };
        }
    };

    return (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <FileText size={18} className="text-[#003566]" />
                        Signhost Digitale Ondertekening
                    </h4>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black mt-1">Contract Lifecycle Management</p>
                </div>
                {signRequest && (
                    <div className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-wider",
                        getStatusDisplay(signRequest.status).color
                    )}>
                        {(() => {
                            const StatusIcon = getStatusDisplay(signRequest.status).icon;
                            return <StatusIcon size={12} />;
                        })()}
                        {getStatusDisplay(signRequest.status).label}
                    </div>
                )}
            </div>

            <div className="p-6 space-y-6">
                {!signRequest ? (
                    <div className="text-center py-8">
                        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FileText size={32} />
                        </div>
                        <h5 className="font-bold text-slate-800 mb-2">Genereer Verkoopcontract</h5>
                        <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
                            Maak een verkoopcontract op basis van de huidige scheepsgegevens. U kunt de ontvangers daarna uitnodigen om te tekenen.
                        </p>
                        {!locationId && (
                            <div className="bg-amber-50 border border-amber-200 p-4 mb-6 rounded-lg flex items-start gap-3 max-w-lg mx-auto text-left">
                                <AlertCircle size={20} className="text-amber-600 mt-0.5 shrink-0" />
                                <div className="text-sm text-amber-800 leading-relaxed">
                                    <p className="font-bold mb-1">Locatie Ontbreekt (Verplicht)</p>
                                    <p>Dit vaartuig is nog niet gekoppeld aan een verkooplocatie. Ga naar <strong>Stap 2 (Wave icoon)</strong> en selecteer een haven bij <strong>'Verkooplocatie'</strong> om dit contract te kunnen genereren.</p>
                                </div>
                            </div>
                        )}
                        <Button
                            onClick={handleGenerateContract}
                            disabled={isGenerating || !locationId}
                            className="bg-[#003566] text-white hover:bg-blue-800 h-11 px-8 rounded-none font-black uppercase text-[10px] tracking-widest disabled:opacity-50"
                        >
                            {isGenerating ? <Loader2 size={16} className="animate-spin mr-2" /> : <RefreshCw size={16} className="mr-2" />}
                            Genereer Contract PDF
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Left Column: Workflow */}
                        <div className="space-y-6">
                            {signRequest.status === "DRAFT" && (
                                <div className="space-y-4">
                                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">Ontvangers Toevoegen</h5>
                                    {recipients.map((recipient, idx) => (
                                        <div key={idx} className="p-4 border border-slate-100 bg-slate-50 rounded-lg space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-[#003566] bg-white px-2 py-1 border border-slate-200">
                                                    {recipient.role}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-1 gap-3">
                                                <div className="relative">
                                                    <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                    <Input
                                                        placeholder="Volledige naam"
                                                        className="pl-9 h-10 text-sm"
                                                        value={recipient.name}
                                                        onChange={(e) => handleRecipientChange(idx, "name", e.target.value)}
                                                    />
                                                </div>
                                                <div className="relative">
                                                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                    <Input
                                                        placeholder="E-mailadres"
                                                        type="email"
                                                        className="pl-9 h-10 text-sm"
                                                        value={recipient.email}
                                                        onChange={(e) => handleRecipientChange(idx, "email", e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <Button
                                        onClick={handleSendRequest}
                                        disabled={isSending}
                                        className="w-full bg-emerald-600 text-white hover:bg-emerald-700 h-11 rounded-none font-black uppercase text-[10px] tracking-widest shadow-md"
                                    >
                                        {isSending ? <Loader2 size={16} className="animate-spin mr-2" /> : <Send size={16} className="mr-2" />}
                                        Verstuur voor Ondertekening
                                    </Button>
                                </div>
                            )}

                            {signRequest.status === "SENT" && (
                                <div className="bg-blue-50 border border-blue-100 p-6 text-center rounded-xl">
                                    <div className="w-12 h-12 bg-white text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                                        <Loader2 size={24} className="animate-spin" />
                                    </div>
                                    <h5 className="font-bold text-blue-900 mb-2">Wachten op Ondertekening</h5>
                                    <p className="text-sm text-blue-700/70 mb-4">
                                        De uitnodigingen zijn verstuurd naar de ontvangers. Zodra iedereen heeft getekend verschijnt het document hier.
                                    </p>
                                    <div className="flex flex-col gap-2">
                                        {signRequest.sign_url && (
                                            <a
                                                href={signRequest.sign_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800 flex items-center justify-center gap-2"
                                            >
                                                Bekijk Status op Signhost <ExternalLink size={12} />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}

                            {signRequest.status === "SIGNED" && (
                                <div className="bg-emerald-50 border border-emerald-100 p-6 text-center rounded-xl">
                                    <div className="w-12 h-12 bg-white text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                                        <CheckCircle size={24} />
                                    </div>
                                    <h5 className="font-bold text-emerald-900 mb-2">Ondertekening Voltooid</h5>
                                    <p className="text-sm text-emerald-700/70">
                                        Alle partijen hebben het contract getekend. Het getekende exemplaar is hiernaast beschikbaar om te downloaden.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Right Column: Documents */}
                        <div className="space-y-4">
                            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">Documenten ({documents.length})</h5>
                            <div className="space-y-2">
                                {documents.map(doc => (
                                    <div key={doc.id} className="group flex items-center justify-between p-4 bg-white border border-slate-100 hover:border-blue-200 rounded-lg transition-all shadow-sm">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className={cn(
                                                "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                                                doc.type === "signed" ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
                                            )}>
                                                <FileText size={20} />
                                            </div>
                                            <div className="truncate">
                                                <p className="text-sm font-bold text-slate-800 truncate">
                                                    {doc.type === "signed" ? "Getekend Contract" : "Origineel Contract"}
                                                </p>
                                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
                                                    {doc.type === "signed" ? "Verzegeld door Signhost" : "Concept Versie"}
                                                </p>
                                            </div>
                                        </div>
                                        <a
                                            href={doc.file_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all"
                                        >
                                            <Eye size={16} />
                                        </a>
                                    </div>
                                ))}
                            </div>

                            {signRequest.status === "SIGNED" && (
                                <p className="text-[10px] text-center text-slate-400 italic">
                                    * Getekende documenten worden veilig opgeslagen en gearchiveerd.
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
