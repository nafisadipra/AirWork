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

// <--- NEW: ADDED BRANCH PROPS --->
interface EditorProps {
  documentId: string;
  username: string;
  branchId?: string | null;         
  onMergeSuccess?: () => void;      
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

export default function Editor({ documentId, username, branchId, onMergeSuccess }: EditorProps) {
  const [ydoc] = useState(() => new Y.Doc());
  const [isMerging, setIsMerging] = useState(false); 

  // ==========================================
  // P2P SYNC ENGINE & DB SAVING
  // ==========================================
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api) return;

    const syncId = branchId || documentId;
    let saveTimeout: NodeJS.Timeout;

    // 1. LOAD FROM DATABASE
    const loadInitialState = async () => {
      const res = await api.loadDocument(syncId);
      if (res.success && res.state) {
        Y.applyUpdate(ydoc, new Uint8Array(res.state), 'load');
      }
    };
    loadInitialState();

    // 2. SEND TO NETWORK & SAVE TO DATABASE
    const updateHandler = (update: Uint8Array, origin: any) => {
      if (origin !== 'network' && origin !== 'load') {
        const updateArray = Array.from(update); 
        api.sendDocumentUpdate({ docId: syncId, update: updateArray });

        // Debounce save
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
          const fullState = Array.from(Y.encodeStateAsUpdate(ydoc));
          await api.saveDocument({ docId: syncId, state: fullState });
        }, 1000); 
      }
    };
    ydoc.on('update', updateHandler);

    // 3. RECEIVE FROM NETWORK
    const removeListener = api.onDocumentUpdate((data: { docId: string, update: number[] }) => {
      if (data.docId === syncId) {
        const updateBinary = new Uint8Array(data.update); 
        Y.applyUpdate(ydoc, updateBinary, 'network'); 
      }
    });

    return () => {
      ydoc.off('update', updateHandler);
      if (removeListener) removeListener();
      clearTimeout(saveTimeout);
    };
  }, [ydoc, documentId, branchId]);
  // ==========================================

  // <--- NEW: FORCE SAVE BEFORE MERGE --->
  const handleMerge = async () => {
    if (!branchId) return;
    setIsMerging(true);
    try {
      const api = (window as any).electronAPI;
      
      // FORCE SAVE: Instantly grab the current math and save it to SQLite!
      const fullState = Array.from(Y.encodeStateAsUpdate(ydoc));
      await api.saveDocument({ docId: branchId, state: fullState });

      // NOW MERGE
      const res = await api.mergeBranch({ branchId, documentId });
      
      if (res.success && onMergeSuccess) {
        onMergeSuccess();
      } else {
        console.error("Merge failed", res.error);
        setIsMerging(false);
      }
    } catch(e) {
      console.error(e);
      setIsMerging(false);
    }
  };

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
        class: 'prose prose-invert prose-sm sm:prose-base max-w-none focus:outline-none min-h-[500px] text-[#E0E0E0] p-4',
      },
    },
  });

  if (!editor) {
    return <div className="text-[#666] text-sm flex items-center gap-2"><span className="animate-spin text-[#0066FF]">⟳</span> Loading Editor Engine...</div>;
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#121212] border border-[#2A2A2A] rounded-md overflow-hidden shadow-lg">
      
      <div className="flex flex-wrap items-center gap-1 p-2 bg-[#0A0A0A] border-b border-[#2A2A2A] sticky top-0 z-10">
        
        <MenuButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')}>B</MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')}><i>I</i></MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')}><u>U</u></MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')}><s>S</s></MenuButton>
        
        <Divider />

        <MenuButton onClick={() => editor.chain().focus().setParagraph().run()} isActive={editor.isActive('paragraph')}>¶</MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })}>H1</MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })}>H2</MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive('heading', { level: 3 })}>H3</MenuButton>

        <Divider />

        <MenuButton onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={editor.isActive({ textAlign: 'left' })}>↤ Left</MenuButton>
        <MenuButton onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={editor.isActive({ textAlign: 'center' })}>↔ Center</MenuButton>
        <MenuButton onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={editor.isActive({ textAlign: 'right' })}>Right ↦</MenuButton>

        <Divider />

        <MenuButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')}>• List</MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')}>1. List</MenuButton>
        <MenuButton onClick={() => (editor.chain().focus() as any).toggleTaskList().run()} isActive={editor.isActive('taskList')}>☑ Tasks</MenuButton>
        
        <Divider />

        <MenuButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')}>" Quote</MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} isActive={editor.isActive('codeBlock')}>&lt;/&gt; Code</MenuButton>

        <div className="ml-auto flex items-center gap-2">
          {branchId && (
            <button 
              onClick={handleMerge} 
              disabled={isMerging}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:text-green-300 text-white text-xs font-bold uppercase tracking-wider rounded-sm flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7l-2 2m2-2l2 2m4 4l2-2m-2 2l-2-2" /></svg>
              {isMerging ? 'Merging...' : 'Merge into Main'}
            </button>
          )}
        </div>

      </div>

      <div className="flex-1 overflow-y-auto cursor-text bg-[#121212]">
        <div className="max-w-4xl mx-auto">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}