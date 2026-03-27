// src/app/dashboard/Editor.tsx
'use client';

import { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import * as Y from 'yjs';

interface EditorProps {
  documentId: string;
  username: string;
}

// A simple reusable button component for our toolbar
const MenuButton = ({ onClick, isActive, children }: { onClick: () => void, isActive?: boolean, children: React.ReactNode }) => (
  <button
    onClick={onClick}
    className={`px-2.5 py-1.5 rounded-sm text-xs font-bold transition-colors ${
      isActive 
        ? 'bg-[#0066FF] text-white shadow-sm' 
        : 'text-[#A0A0A0] hover:bg-[#2A2A2A] hover:text-[#E0E0E0]'
    }`}
  >
    {children}
  </button>
);

// A simple divider for the toolbar
const Divider = () => <div className="w-px h-6 bg-[#2A2A2A] mx-1"></div>;

export default function Editor({ documentId, username }: EditorProps) {
  const [ydoc] = useState(() => new Y.Doc());

  // ==========================================
  // P2P SYNC ENGINE: SEND & RECEIVE KEYSTROKES
  // ==========================================
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api) return;

    // 1. SEND YOUR TYPING: Listen for local changes and send them to the network
    const updateHandler = (update: Uint8Array, origin: any) => {
      // Only broadcast if the change came from YOU, not an echo from the network
      if (origin !== 'network') {
        const updateArray = Array.from(update); // Convert binary to standard array for safe transit
        api.sendDocumentUpdate({ docId: documentId, update: updateArray });
      }
    };
    ydoc.on('update', updateHandler);

    // 2. RECEIVE TEAM'S TYPING: Listen for network changes and apply them
    const removeListener = api.onDocumentUpdate((data: { docId: string, update: number[] }) => {
      if (data.docId === documentId) {
        const updateBinary = new Uint8Array(data.update); // Convert back to binary
        // Apply it, and tag it as 'network' so we don't accidentally echo it back!
        Y.applyUpdate(ydoc, updateBinary, 'network'); 
      }
    });

    // 3. CLEANUP: When you close the document, stop listening
    return () => {
      ydoc.off('update', updateHandler);
      if (removeListener) removeListener();
    };
  }, [ydoc, documentId]);
  // ==========================================

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        history: false, // Yjs handles history
      }),
      Collaboration.configure({
        document: ydoc,
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        // Tailwind typography plugin classes for beautiful default styling
        class: 'prose prose-invert prose-sm sm:prose-base max-w-none focus:outline-none min-h-[500px] text-[#E0E0E0] p-4',
      },
    },
  });

  if (!editor) {
    return <div className="text-[#666] text-sm flex items-center gap-2"><span className="animate-spin text-[#0066FF]">⟳</span> Loading Editor Engine...</div>;
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#121212] border border-[#2A2A2A] rounded-md overflow-hidden shadow-lg">
      
      {/* ==================== RICH TOOLBAR ==================== */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-[#0A0A0A] border-b border-[#2A2A2A] sticky top-0 z-10">
        
        {/* Basic Formatting */}
        <MenuButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')}>B</MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')}><i>I</i></MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')}><u>U</u></MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')}><s>S</s></MenuButton>
        
        <Divider />

        {/* Headings */}
        <MenuButton onClick={() => editor.chain().focus().setParagraph().run()} isActive={editor.isActive('paragraph')}>¶</MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })}>H1</MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })}>H2</MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive('heading', { level: 3 })}>H3</MenuButton>

        <Divider />

        {/* Alignment */}
        <MenuButton onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={editor.isActive({ textAlign: 'left' })}>↤ Left</MenuButton>
        <MenuButton onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={editor.isActive({ textAlign: 'center' })}>↔ Center</MenuButton>
        <MenuButton onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={editor.isActive({ textAlign: 'right' })}>Right ↦</MenuButton>

        <Divider />

        {/* Lists */}
        <MenuButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')}>• List</MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')}>1. List</MenuButton>
        <MenuButton onClick={() => (editor.chain().focus() as any).toggleTaskList().run()} isActive={editor.isActive('taskList')}>☑ Tasks</MenuButton>
        
        <Divider />

        {/* Code & Blockquote */}
        <MenuButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')}>" Quote</MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} isActive={editor.isActive('codeBlock')}>&lt;/&gt; Code</MenuButton>

      </div>

      {/* ==================== TYPING CANVAS ==================== */}
      <div className="flex-1 overflow-y-auto cursor-text bg-[#121212]">
        <div className="max-w-4xl mx-auto">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}