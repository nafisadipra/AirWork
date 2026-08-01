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
    type="button"
    onClick={onClick}
    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
      isActive 
        ? 'bg-zinc-950 text-white shadow-2xs' 
        : 'text-zinc-600 hover:bg-zinc-200 hover:text-zinc-950'
    }`}
  >
    {children}
  </button>
);

const Divider = () => <div className="w-px h-5 bg-zinc-300 mx-1"></div>;

export default function Editor({ documentId, username, branchId, onMergeSuccess }: EditorProps) {
  const [ydoc] = useState(() => new Y.Doc());
  const [isMerging, setIsMerging] = useState(false); 
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [newVersionMsg, setNewVersionMsg] = useState('');

  const syncId = branchId || documentId;

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
        class: 'focus:outline-none min-h-[450px] text-zinc-900 p-6 font-sans leading-relaxed',
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
    if(!confirm("Are you sure? Restoring will replace current document content.")) return;
    
    const api = (window as any).electronAPI;
    const res = await api.restoreVersion({ documentId: syncId, versionId });
    
    if (res.success && res.html && editor) {
      editor.commands.setContent(res.html);
      setShowHistoryModal(false);
    } else if (res.success && !res.html) {
      alert("Could not restore snapshot.");
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

  const handleForceOverwrite = async () => {
    if (!branchId) return;
    if(!confirm("⚠️ Overwrite Main branch with this branch content?")) return;
    
    setIsMerging(true);
    try {
      const api = (window as any).electronAPI;
      const fullState = Array.from(Y.encodeStateAsUpdate(ydoc));
      await api.saveDocument({ docId: branchId, state: fullState });

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
    return <div className="text-zinc-500 text-xs py-8 text-center font-medium">Loading editor engine...</div>;
  }

  return (
    <div className="w-full h-full flex flex-col bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-2xs relative">
      
      <style dangerouslySetInnerHTML={{__html: `
        .ProseMirror h1 { font-size: 2rem; font-weight: 800; margin-top: 1.25rem; margin-bottom: 0.5rem; color: #09090b; line-height: 1.2; }
        .ProseMirror h2 { font-size: 1.5rem; font-weight: 700; margin-top: 1rem; margin-bottom: 0.5rem; color: #18181b; line-height: 1.3; }
        .ProseMirror h3 { font-size: 1.2rem; font-weight: 600; margin-top: 0.85rem; margin-bottom: 0.5rem; color: #27272a; line-height: 1.4; }
        .ProseMirror p { margin-top: 0.4rem; margin-bottom: 0.4rem; color: #18181b; }
        .ProseMirror ul { list-style-type: disc; padding-left: 1.5rem; margin-top: 0.5rem; margin-bottom: 0.5rem; }
        .ProseMirror ol { list-style-type: decimal; padding-left: 1.5rem; margin-top: 0.5rem; margin-bottom: 0.5rem; }
        .ProseMirror blockquote { border-left: 3px solid #09090b; padding-left: 1rem; margin-top: 0.75rem; margin-bottom: 0.75rem; font-style: italic; color: #52525b; background: #f4f4f5; padding-top: 0.5rem; padding-bottom: 0.5rem; border-radius: 0 0.375rem 0.375rem 0; }
        .ProseMirror pre { background: #18181b; color: #f4f4f5; padding: 1rem; border-radius: 0.5rem; font-family: monospace; font-size: 0.85rem; margin-top: 0.75rem; margin-bottom: 0.75rem; overflow-x: auto; }
        .ProseMirror code { font-family: monospace; color: #09090b; background: #f4f4f5; border: 1px solid #e4e4e7; padding: 0.15rem 0.35rem; border-radius: 0.25rem; font-size: 0.85em; }
        .ProseMirror ul[data-type="taskList"] { list-style: none; padding-left: 0; }
        .ProseMirror ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 0.5rem; margin: 0.25rem 0; }
      `}} />

      {/* Editor Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-zinc-50 border-b border-zinc-200 sticky top-0 z-10">
        <MenuButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')}>B</MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')}><i>I</i></MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')}><u>U</u></MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')}><s>S</s></MenuButton>
        <Divider />
        <MenuButton onClick={() => editor.chain().focus().setParagraph().run()} isActive={editor.isActive('paragraph')}>P</MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })}>H1</MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })}>H2</MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive('heading', { level: 3 })}>H3</MenuButton>
        <Divider />
        <MenuButton onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={editor.isActive({ textAlign: 'left' })}>Left</MenuButton>
        <MenuButton onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={editor.isActive({ textAlign: 'center' })}>Center</MenuButton>
        <MenuButton onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={editor.isActive({ textAlign: 'right' })}>Right</MenuButton>
        <Divider />
        <MenuButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')}>• List</MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')}>1. List</MenuButton>
        <MenuButton onClick={() => (editor.chain().focus() as any).toggleTaskList().run()} isActive={editor.isActive('taskList')}>☑ Tasks</MenuButton>
        <Divider />
        <MenuButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')}>" Quote</MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} isActive={editor.isActive('codeBlock')}>&lt;/&gt; Code</MenuButton>

        <div className="ml-auto flex items-center gap-2">
          <button 
            type="button"
            onClick={() => { setShowHistoryModal(true); fetchVersions(); }}
            className="px-3 py-1.5 bg-white border border-zinc-200 hover:border-zinc-400 text-zinc-800 rounded-lg text-xs font-bold transition-all shadow-2xs"
          >
            History
          </button>

          {branchId && (
            <>
              <button 
                type="button"
                onClick={handleForceOverwrite} 
                disabled={isMerging}
                className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-300 disabled:opacity-50 text-xs font-bold rounded-lg transition-all"
              >
                Overwrite Main
              </button>

              <button 
                type="button"
                onClick={handleMerge} 
                disabled={isMerging}
                className="px-3 py-1.5 bg-zinc-950 hover:bg-black disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all shadow-2xs"
              >
                {isMerging ? 'Merging...' : 'Safe Merge'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Editor Content Box */}
      <div className="flex-1 overflow-y-auto cursor-text bg-white">
        <div className="max-w-4xl mx-auto">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* History Modal */}
      {showHistoryModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl p-6 shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-950">Version Snapshots</h3>
                <p className="text-xs text-zinc-500 font-medium">Save or restore document states</p>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="text-zinc-400 hover:text-zinc-950 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <form onSubmit={handleSaveVersion} className="mb-4 flex gap-2">
              <input 
                type="text" 
                value={newVersionMsg}
                onChange={(e) => setNewVersionMsg(e.target.value)}
                placeholder="Snapshot description..."
                className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-950"
              />
              <button type="submit" className="px-4 py-2 bg-zinc-950 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors">
                Save
              </button>
            </form>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {versions.length === 0 ? (
                <div className="text-center py-6 text-zinc-400 text-xs font-medium border border-dashed border-zinc-200 rounded-xl">
                  No snapshots saved yet.
                </div>
              ) : (
                versions.map(v => (
                  <div key={v.id} className="bg-zinc-50 border border-zinc-200 p-3 rounded-xl flex justify-between items-center">
                    <div>
                      <p className="text-xs font-bold text-zinc-900 mb-0.5">{v.message}</p>
                      <p className="text-[10px] text-zinc-500 font-mono">
                        {v.creator_name || 'User'} • {new Date(v.created_at + 'Z').toLocaleString()}
                      </p>
                    </div>
                    <button 
                      onClick={() => handleRestoreVersion(v.id)}
                      className="px-2.5 py-1 bg-white border border-zinc-200 text-zinc-900 hover:bg-zinc-950 hover:text-white rounded-lg text-xs font-bold transition-all shadow-2xs"
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