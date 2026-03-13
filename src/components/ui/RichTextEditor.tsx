"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import {
    Bold,
    Italic,
    Underline as UnderlineIcon,
    List,
    ListOrdered,
    Undo,
    Redo,
    RemoveFormatting,
} from "lucide-react";
import { useEffect, useRef } from "react";

interface RichTextEditorProps {
    content: string;
    onChange: (html: string) => void;
    placeholder?: string;
}

interface ToolbarButtonProps {
    onClick: () => void;
    isActive?: boolean;
    children: React.ReactNode;
    title: string;
}

function ToolbarButton({
    onClick,
    isActive = false,
    children,
    title,
}: ToolbarButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            className={`p-2 rounded-md transition-all duration-150 ${isActive
                ? "bg-blue-100 text-blue-700 shadow-sm"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                }`}
        >
            {children}
        </button>
    );
}

function applyHeading(editor: Editor, level: 1 | 2 | 3 | 4) {
    editor.chain().focus().toggleHeading({ level }).run();
}

export default function RichTextEditor({
    content,
    onChange,
    placeholder = "Start typing...",
}: RichTextEditorProps) {
    const isInternalChange = useRef(false);

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3, 4] },
            }),
            Underline,
        ],
        content,
        editorProps: {
            attributes: {
                class:
                    "prose prose-sm max-w-none min-h-[280px] p-5 outline-none text-slate-800 leading-relaxed focus:outline-none " +
                    "[&_h1]:mb-4 [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:text-slate-900 " +
                    "[&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-slate-900 " +
                    "[&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-slate-800 " +
                    "[&_h4]:mt-4 [&_h4]:mb-2 [&_h4]:text-base [&_h4]:font-semibold [&_h4]:uppercase [&_h4]:tracking-[0.12em] [&_h4]:text-blue-700 " +
                    "[&_p]:my-3 [&_p]:text-[15px] [&_p]:leading-7 " +
                    "[&_ul]:my-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 " +
                    "[&_ol]:my-4 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 " +
                    "[&_li]:pl-1 [&_strong]:font-semibold [&_em]:italic",
            },
        },
        onUpdate: ({ editor }) => {
            isInternalChange.current = true;
            onChange(editor.getHTML());
        },
    });

    // Sync external content changes (e.g. language switch)
    useEffect(() => {
        if (editor && !isInternalChange.current) {
            const currentContent = editor.getHTML();
            if (currentContent !== content) {
                editor.commands.setContent(content || "");
            }
        }
        isInternalChange.current = false;
    }, [content, editor]);

    if (!editor) return null;

    return (
        <div className="relative border border-slate-200 rounded-lg overflow-hidden shadow-sm bg-white">
            {/* Toolbar */}
            <div className="flex items-center gap-0.5 px-3 py-2 border-b border-slate-200 bg-slate-50/80 flex-wrap">
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    isActive={editor.isActive("bold")}
                    title="Bold"
                >
                    <Bold size={16} />
                </ToolbarButton>

                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    isActive={editor.isActive("italic")}
                    title="Italic"
                >
                    <Italic size={16} />
                </ToolbarButton>

                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    isActive={editor.isActive("underline")}
                    title="Underline"
                >
                    <UnderlineIcon size={16} />
                </ToolbarButton>

                <div className="w-px h-5 bg-slate-200 mx-1" />

                {[1, 2, 3, 4].map((level) => (
                    <ToolbarButton
                        key={level}
                        onClick={() => applyHeading(editor, level)}
                        isActive={editor.isActive("heading", { level })}
                        title={`Heading ${level}`}
                    >
                        <span className="text-[11px] font-bold tracking-wide">
                            H{level}
                        </span>
                    </ToolbarButton>
                ))}

                <div className="w-px h-5 bg-slate-200 mx-1" />

                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    isActive={editor.isActive("bulletList")}
                    title="Bullet List"
                >
                    <List size={16} />
                </ToolbarButton>

                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    isActive={editor.isActive("orderedList")}
                    title="Numbered List"
                >
                    <ListOrdered size={16} />
                </ToolbarButton>

                <div className="w-px h-5 bg-slate-200 mx-1" />

                <ToolbarButton
                    onClick={() => editor.chain().focus().unsetAllMarks().run()}
                    title="Clear Formatting"
                >
                    <RemoveFormatting size={16} />
                </ToolbarButton>

                <div className="flex-1" />

                <ToolbarButton
                    onClick={() => editor.chain().focus().undo().run()}
                    title="Undo"
                >
                    <Undo size={16} />
                </ToolbarButton>

                <ToolbarButton
                    onClick={() => editor.chain().focus().redo().run()}
                    title="Redo"
                >
                    <Redo size={16} />
                </ToolbarButton>
            </div>

            {/* Editor */}
            <EditorContent editor={editor} />

            {/* Empty state placeholder */}
            {editor.isEmpty && (
                <div className="absolute top-[52px] left-5 text-slate-400 text-sm pointer-events-none">
                    {placeholder}
                </div>
            )}
        </div>
    );
}
