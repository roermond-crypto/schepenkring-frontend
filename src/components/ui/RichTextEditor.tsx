"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import {
    Bold,
    Italic,
    Underline as UnderlineIcon,
    List,
    ListOrdered,
    Heading2,
    Heading3,
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
                heading: { levels: [2, 3] },
            }),
            Underline,
        ] as any,
        content,
        editorProps: {
            attributes: {
                class:
                    "prose prose-sm max-w-none min-h-[280px] p-5 outline-none text-slate-800 leading-relaxed focus:outline-none",
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

    const ToolbarButton = ({
        onClick,
        isActive = false,
        children,
        title,
    }: {
        onClick: () => void;
        isActive?: boolean;
        children: React.ReactNode;
        title: string;
    }) => (
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

    return (
        <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm bg-white">
            {/* Toolbar */}
            <div className="flex items-center gap-0.5 px-3 py-2 border-b border-slate-200 bg-slate-50/80 flex-wrap">
                <ToolbarButton
                    onClick={() => (editor.chain().focus() as any).toggleBold().run()}
                    isActive={editor.isActive("bold")}
                    title="Bold"
                >
                    <Bold size={16} />
                </ToolbarButton>

                <ToolbarButton
                    onClick={() => (editor.chain().focus() as any).toggleItalic().run()}
                    isActive={editor.isActive("italic")}
                    title="Italic"
                >
                    <Italic size={16} />
                </ToolbarButton>

                <ToolbarButton
                    onClick={() => (editor.chain().focus() as any).toggleUnderline().run()}
                    isActive={editor.isActive("underline")}
                    title="Underline"
                >
                    <UnderlineIcon size={16} />
                </ToolbarButton>

                <div className="w-px h-5 bg-slate-200 mx-1" />

                <ToolbarButton
                    onClick={() =>
                        (editor.chain().focus() as any).toggleHeading({ level: 2 }).run()
                    }
                    isActive={editor.isActive("heading", { level: 2 })}
                    title="Heading 2"
                >
                    <Heading2 size={16} />
                </ToolbarButton>

                <ToolbarButton
                    onClick={() =>
                        (editor.chain().focus() as any).toggleHeading({ level: 3 }).run()
                    }
                    isActive={editor.isActive("heading", { level: 3 })}
                    title="Heading 3"
                >
                    <Heading3 size={16} />
                </ToolbarButton>

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
