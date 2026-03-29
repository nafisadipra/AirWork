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
  branchId?: string | null;         
  onMergeSuccess?: () => void;      
}

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

const Divider = () => <div className="w-px h-6 bg-[#2A2A2A] mx-1"></div>;

export default function Editor({ documentId, username, branchId, onMergeSuccess }: EditorProps) {
  const [ydoc] = useState(() => new Y.Doc());
  const [isMerging, setIsMerging] = useState(false); 
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [newVersionMsg, setNewVersionMsg] = useState('');

  const syncId = branchId || documentId;

  // ==========================================
  // P2P SYNC ENGINE & DB SAVING
  // ==========================================
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api) return;

    let saveTimeout: NodeJS.Timeout;

    const loadInitialState = async () => {
      const res = await api.loadDocument(syncId);
      if (res.success && res.state) {
        Y.applyUpdate(ydoc, new Uint8Array(res.state), 'load');
      }
      setIsLoaded(true);
    };
    loadInitialState();

    const updateHandler = (update: Uint8Array, origin: any) => {
      if (origin !== 'network' && origin !== 'load') {
        const updateArray = Array.from(update); 
        api.sendDocumentUpdate({ docId: syncId, update: updateArray });

        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
          const fullState = Array.from(Y.encodeStateAsUpdate(ydoc));
          await api.saveDocument({ docId: syncId, state: fullState });
        }, 1000); 
      }
    };
    ydoc.on('update', updateHandler);

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

      try {
        const fullState = Array.from(Y.encodeStateAsUpdate(ydoc));
        api.saveDocument({ docId: syncId, state: fullState });
      } catch (e) {}
    };
  }, [ydoc, documentId, branchId]);

  // ==========================================
  // THE EDITOR INSTANCE
  // ==========================================
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ history: false }),
      Collaboration.configure({ document: ydoc }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[500px] text-[#E0E0E0] p-4',
      },
    },
  });

  useEffect(() => {
    if (isLoaded && editor && !editor.isDestroyed) {
      setTimeout(() => {
        editor.commands.focus('end');
      }, 50);
    }
  }, [isLoaded, editor]);

  const fetchVersions = async () => {
    const api = (window as any).electronAPI;
    const res = await api.listVersions({ documentId: syncId });
    if (res.success && res.versions) setVersions(res.versions);
  };

  const handleSaveVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersionMsg.trim() || !editor) return;
    
    const api = (window as any).electronAPI;
    const fullState = Array.from(Y.encodeStateAsUpdate(ydoc));
    const currentHtml = editor.getHTML();
    
    await api.saveVersion({ 
      documentId: syncId, 
      userId: username, 
      message: newVersionMsg, 
      state: fullState,
      html: currentHtml 
    });
    
    setNewVersionMsg('');
    fetchVersions(); 
  };

  const handleRestoreVersion = async (versionId: string) => {
    if(!confirm("Are you sure? This will instantly overwrite the current document and broadcast it to everyone.")) return;
    
    const api = (window as any).electronAPI;
    const res = await api.restoreVersion({ documentId: syncId, versionId });
    
    if (res.success && res.html && editor) {
      editor.commands.setContent(res.html);
      setShowHistoryModal(false);
    } else if (res.success && !res.html) {
      alert("Could not restore. This snapshot might be from an older version of the app before we upgraded the history engine.");
    }
  };

  const handleMerge = async () => {
    if (!branchId) return;
    setIsMerging(true);
    try {
      const api = (window as any).electronAPI;
      const fullState = Array.from(Y.encodeStateAsUpdate(ydoc));
      await api.saveDocument({ docId: branchId, state: fullState });

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

  // <--- NEW: THE BRUTE FORCE OVERWRITE --->
  const handleForceOverwrite = async () => {
    if (!branchId) return;
    if(!confirm("⚠️ WARNING: This will completely overwrite and replace the Main branch with exactly what is on your screen right now. Are you sure, batman?")) return;
    
    setIsMerging(true);
    try {
      const api = (window as any).electronAPI;
      
      // Save current screen
      const fullState = Array.from(Y.encodeStateAsUpdate(ydoc));
      await api.saveDocument({ docId: branchId, state: fullState });

      // Nuke and replace main
      const res = await api.forceOverwriteBranch({ branchId, documentId });
      
      if (res.success && onMergeSuccess) {
        onMergeSuccess();
      } else {
        console.error("Overwrite failed", res.error);
        setIsMerging(false);
      }
    } catch(e) {
      console.error(e);
      setIsMerging(false);
    }
  };

  if (!editor) {
    return <div className="text-[#666] text-sm flex items-center gap-2"><span className="animate-spin text-[#0066FF]">⟳</span> Loading Editor Engine...</div>;
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#121212] border border-[#2A2A2A] rounded-md overflow-hidden shadow-lg relative">
      
      <style dangerouslySetInnerHTML={{__html: `
        .ProseMirror h1 { font-size: 2.25rem; font-weight: 800; margin-top: 1.5rem; margin-bottom: 0.5rem; color: #ffffff; line-height: 1.2; }
        .ProseMirror h2 { font-size: 1.75rem; font-weight: 700; margin-top: 1.25rem; margin-bottom: 0.5rem; color: #eeeeee; line-height: 1.3; }
        .ProseMirror h3 { font-size: 1.25rem; font-weight: 600; margin-top: 1rem; margin-bottom: 0.5rem; color: #dddddd; line-height: 1.4; }
        .ProseMirror p { margin-top: 0.5rem; margin-bottom: 0.5rem; min-height: 1rem; }
        .ProseMirror ul { list-style-type: disc; padding-left: 1.5rem; margin-top: 0.5rem; margin-bottom: 0.5rem; }
        .ProseMirror ol { list-style-type: decimal; padding-left: 1.5rem; margin-top: 0.5rem; margin-bottom: 0.5rem; }
        .ProseMirror li p { margin: 0; }
        .ProseMirror blockquote { border-left: 3px solid #0066FF; padding-left: 1rem; margin-top: 1rem; margin-bottom: 1rem; font-style: italic; color: #A0A0A0; background: rgba(0, 102, 255, 0.05); padding-top: 0.25rem; padding-bottom: 0.25rem; }
        .ProseMirror pre { background: #1A1A1A; border: 1px solid #2A2A2A; padding: 1rem; border-radius: 4px; font-family: monospace; overflow-x: auto; margin-top: 1rem; margin-bottom: 1rem; }
        .ProseMirror code { font-family: monospace; color: #4DA6FF; background: #1A1A1A; padding: 0.2rem 0.4rem; border-radius: 3px; font-size: 0.9em; }
        .ProseMirror ul[data-type="taskList"] { list-style: none; padding-left: 0; }
        .ProseMirror ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 0.5rem; margin: 0.25rem 0; }
        .ProseMirror ul[data-type="taskList"] input[type="checkbox"] { margin-top: 0.35rem; cursor: pointer; }
      `}} />

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
          
          <button 
            onClick={() => { setShowHistoryModal(true); fetchVersions(); }}
            className="px-3 py-1.5 bg-[#1A1A1A] border border-[#2A2A2A] hover:bg-[#2A2A2A] text-[#E0E0E0] hover:text-white rounded-sm text-xs font-bold uppercase tracking-wider transition-colors shadow-sm"
          >
            🕒 History
          </button>

          {branchId && (
            <>
              {/* <--- NEW: OVERWRITE BUTTON ---> */}
              <button 
                onClick={handleForceOverwrite} 
                disabled={isMerging}
                className="px-3 py-1.5 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/30 disabled:opacity-50 text-xs font-bold uppercase tracking-wider rounded-sm flex items-center gap-1.5 transition-colors shadow-sm"
                title="Completely overwrite Main with this branch"
              >
                Force Overwrite
              </button>

              <button 
                onClick={handleMerge} 
                disabled={isMerging}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:text-green-300 text-white text-xs font-bold uppercase tracking-wider rounded-sm flex items-center gap-1.5 transition-colors shadow-sm"
                title="Mathematically combine changes"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7l-2 2m2-2l2 2m4 4l2-2m-2 2l-2-2" /></svg>
                {isMerging ? 'Merging...' : 'Safe Merge'}
              </button>
            </>
          )}
        </div>

      </div>

      <div className="flex-1 overflow-y-auto cursor-text bg-[#121212]">
        <div className="max-w-4xl mx-auto">
          <EditorContent editor={editor} />
        </div>
      </div>

      {showHistoryModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#000000]/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm p-6 shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-bold text-white">Version History</h3>
                <p className="text-xs text-[#666666] uppercase font-bold tracking-widest mt-1">Save or restore snapshots</p>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="text-[#666] hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <form onSubmit={handleSaveVersion} className="mb-6 flex gap-2">
              <input 
                type="text" 
                value={newVersionMsg}
                onChange={(e) => setNewVersionMsg(e.target.value)}
                placeholder="e.g., Added System Architecture"
                className="flex-1 bg-[#121212] border border-[#2A2A2A] rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0066FF]"
              />
              <button type="submit" className="px-4 py-2 bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-bold uppercase rounded-sm transition-colors">
                Save
              </button>
            </form>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {versions.length === 0 ? (
                <div className="text-center py-8 text-[#666] text-xs font-bold uppercase tracking-wider border border-dashed border-[#2A2A2A] rounded-sm">
                  No snapshots saved yet.
                </div>
              ) : (
                versions.map(v => (
                  <div key={v.id} className="bg-[#121212] border border-[#2A2A2A] p-4 rounded-sm flex justify-between items-center group">
                    <div>
                      <p className="text-sm font-bold text-white mb-1">{v.message}</p>
                      <p className="text-[10px] text-[#808080] font-medium uppercase tracking-wider">
                        Saved by <span className="text-[#4DA6FF]">{v.creator_name || 'Unknown'}</span> on {new Date(v.created_at + 'Z').toLocaleString()}
                      </p>
                    </div>
                    <button 
                      onClick={() => handleRestoreVersion(v.id)}
                      className="px-3 py-1.5 bg-transparent border border-[#2A2A2A] text-[#666] hover:bg-yellow-500/10 hover:border-yellow-500/50 hover:text-yellow-500 rounded-sm text-[10px] font-bold uppercase tracking-wider transition-colors opacity-0 group-hover:opacity-100"
                    >
                      Restore
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}