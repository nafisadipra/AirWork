'use client';

import { useState, useEffect } from 'react';
import Editor from './Editor';

interface DocumentsProps {
  selectedProject: any;
  username: string;
}

export default function Documents({ selectedProject, username }: DocumentsProps) {
  const [documents, setDocuments] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  
  const [activeDoc, setActiveDoc] = useState<any>(null); 

  const [branches, setBranches] = useState<any[]>([]);
  const [activeBranch, setActiveBranch] = useState<any>(null);
  const [isBranching, setIsBranching] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');

  const [showExportModal, setShowExportModal] = useState(false);

  const fetchDocuments = async () => {
    try {
      const api = (window as any).electronAPI;
      const result = await api.listDocuments({ projectId: selectedProject.id });
      if (result.success && result.documents) {
        setDocuments(result.documents);
      }
    } catch (error) {
      console.error("Failed to fetch documents", error);
    }
  };

  const fetchBranches = async (docId: string) => {
    try {
      const api = (window as any).electronAPI;
      const result = await api.listBranches({ documentId: docId });
      if (result.success && result.branches) {
        setBranches(result.branches);
      }
    } catch (error) {
      console.error("Failed to fetch branches", error);
    }
  };

  useEffect(() => {
    if (selectedProject) fetchDocuments();
  }, [selectedProject]);

  useEffect(() => {
    if (activeDoc) {
      fetchBranches(activeDoc.id);
      setActiveBranch(null); 
    }
  }, [activeDoc]);

  useEffect(() => {
    const api = (window as any).electronAPI;
    
    if (api && api.onSyncMessage) {
      const unsubscribe = api.onSyncMessage(async () => {
        if (activeDoc) {
          fetchBranches(activeDoc.id);
        } else {
          fetchDocuments();
        }
      });
      
      return () => unsubscribe?.();
    }
  }, [activeDoc]);

  useEffect(() => {
    const api = (window as any).electronAPI;
    
    const handleSync = () => {
      if (selectedProject) {
        fetchDocuments();
        if (activeDoc) {
          fetchBranches(activeDoc.id);
        }
      }
    };

    if (api && api.onSyncRefresh) {
      const unsubscribe = api.onSyncRefresh(handleSync);
      return () => unsubscribe?.();
    }
  }, [selectedProject, activeDoc]);

  const handleCreateDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocTitle.trim()) return;

    try {
      const api = (window as any).electronAPI;
      const result = await api.createDocument({ 
        projectId: selectedProject.id,
        title: newDocTitle,
        type: 'shared'
      });

      if (result.success) {
        setNewDocTitle('');
        setIsCreating(false);
        fetchDocuments(); 
      }
    } catch (error) {
      console.error("Failed to create document", error);
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim() || !activeDoc) return;

    try {
      const api = (window as any).electronAPI;
      const result = await api.createBranch({
        documentId: activeDoc.id,
        branchName: newBranchName.trim(),
        userId: username
      });

      if (result.success) {
        setNewBranchName('');
        setIsBranching(false);
        fetchBranches(activeDoc.id);
        setActiveBranch({ id: result.branchId, branch_name: newBranchName.trim() });
      }
    } catch (error) {
      console.error("Failed to create branch", error);
    }
  };

  const handleDeleteBranch = async () => {
    if (!activeBranch) return;
    if (!confirm(`Are you sure you want to permanently delete the branch "${activeBranch.branch_name}"?`)) return;

    try {
      const api = (window as any).electronAPI;
      const res = await api.deleteBranch({ branchId: activeBranch.id });
      if (res.success) {
        setActiveBranch(null); 
        fetchBranches(activeDoc.id); 
      }
    } catch(e) {
      console.error("Failed to delete branch", e);
    }
  };

  const handleDownloadDoc = () => {
    const editorElement = document.querySelector('.ProseMirror');
    if (!editorElement) return;

    const header = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>${activeDoc.title}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #000; }
          h1, h2, h3 { color: #333; }
          ul, ol { margin-left: 20px; }
          blockquote { border-left: 4px solid #ccc; padding-left: 10px; color: #666; }
        </style>
      </head>
      <body>
    `;
    const footer = "</body></html>";
    const sourceHTML = header + editorElement.innerHTML + footer;

    const blob = new Blob(['\ufeff', sourceHTML], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeDoc.title}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = async () => {
    const editorElement = document.querySelector('.ProseMirror');
    if (!editorElement) return;

    try {
      const api = (window as any).electronAPI;
      await api.exportPdf({ html: editorElement.innerHTML, title: activeDoc.title });
    } catch (e) {
      console.error("Failed to export PDF", e);
    }
  };

  if (activeDoc) {
    return (
      <div className="flex flex-col h-full bg-white rounded-xl border border-zinc-200 animate-in fade-in duration-150 relative">
        <div className="flex items-center justify-between p-3 border-b border-zinc-200 bg-zinc-50 rounded-t-xl">
          <div className="flex items-center gap-3">
            <button onClick={() => setActiveDoc(null)} className="p-1.5 text-zinc-500 hover:text-zinc-950 transition-colors rounded-lg hover:bg-zinc-200/50">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            
            <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-lg px-3 py-1.5 shadow-2xs">
              <svg className="w-3.5 h-3.5 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7l-2 2m2-2l2 2m4 4l2-2m-2 2l-2-2" /></svg>
              <select
                className="bg-transparent text-xs font-bold text-zinc-900 focus:outline-none cursor-pointer"
                value={activeBranch ? activeBranch.id : 'main'}
                onChange={(e) => {
                  if (e.target.value === 'main') setActiveBranch(null);
                  else setActiveBranch(branches.find(b => b.id === e.target.value));
                }}
              >
                <option value="main" className="bg-white">main</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id} className="bg-white">{b.branch_name}</option>
                ))}
              </select>
            </div>
            
            {activeBranch && (
              <button onClick={handleDeleteBranch} className="text-zinc-400 hover:text-zinc-950 transition-colors" title="Delete Branch">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            )}
            
            {!isBranching ? (
              <button onClick={() => setIsBranching(true)} className="text-[10px] font-bold text-zinc-600 hover:text-zinc-950 uppercase tracking-wider transition-colors ml-1">
                + Branch
              </button>
            ) : (
              <form onSubmit={handleCreateBranch} className="flex items-center gap-1.5 ml-1">
                <input 
                  autoFocus
                  type="text" 
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="Branch name..."
                  className="bg-white border border-zinc-300 rounded-md px-2 py-1 text-xs text-zinc-900 focus:outline-none focus:border-zinc-950 w-28"
                />
                <button type="submit" className="text-[10px] bg-zinc-950 text-white px-2.5 py-1 rounded-md font-bold uppercase">Save</button>
                <button type="button" onClick={() => setIsBranching(false)} className="text-[10px] text-zinc-500 hover:text-zinc-950 font-bold uppercase">Cancel</button>
              </form>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {activeBranch && (
              <span className="text-[10px] font-mono font-bold text-zinc-700 uppercase tracking-wider bg-zinc-200 border border-zinc-300 px-2 py-0.5 rounded-md">
                Isolated Branch
              </span>
            )}
            <span className="text-[10px] font-mono font-bold text-white uppercase tracking-wider bg-zinc-950 px-2 py-0.5 rounded-md">
              Sync Active
            </span>

            <div className="border-l border-zinc-300 pl-3 ml-1">
              <button 
                onClick={() => setShowExportModal(true)} 
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950 hover:bg-black text-white rounded-lg text-xs font-bold transition-all shadow-2xs"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Export
              </button>
            </div>
          </div>
        </div>
        
        <div className="flex-1 p-6 overflow-y-auto">
          <Editor 
            key={activeBranch ? activeBranch.id : activeDoc.id} 
            documentId={activeDoc.id} 
            branchId={activeBranch ? activeBranch.id : null}
            username={username} 
            onMergeSuccess={() => {
              alert(`Merged successfully! Switching to main branch.`);
              setActiveBranch(null); 
              fetchBranches(activeDoc.id);
            }}
          />
        </div>

        {/* EXPORT MODAL */}
        {showExportModal && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center bg-zinc-950/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm bg-white border border-zinc-200 rounded-2xl p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-5">
                <div>
                  <h3 className="text-base font-bold text-zinc-950">Export Document</h3>
                  <p className="text-xs text-zinc-500 font-medium">Select output file format</p>
                </div>
                <button onClick={() => setShowExportModal(false)} className="text-zinc-400 hover:text-zinc-950 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              
              <div className="space-y-2.5">
                <button 
                  onClick={() => { handleDownloadDoc(); setShowExportModal(false); }}
                  className="w-full flex items-center gap-3.5 p-3.5 bg-zinc-50 border border-zinc-200 hover:border-zinc-950 rounded-xl transition-all group text-left"
                >
                  <div className="w-9 h-9 bg-zinc-950 text-white rounded-lg flex items-center justify-center font-bold text-xs">
                    DOC
                  </div>
                  <div>
                    <div className="text-xs font-bold text-zinc-950">Microsoft Word (.doc)</div>
                    <div className="text-[10px] text-zinc-500 font-medium">Editable offline document</div>
                  </div>
                </button>

                <button 
                  onClick={() => { handleDownloadPdf(); setShowExportModal(false); }}
                  className="w-full flex items-center gap-3.5 p-3.5 bg-zinc-50 border border-zinc-200 hover:border-zinc-950 rounded-xl transition-all group text-left"
                >
                  <div className="w-9 h-9 bg-zinc-800 text-white rounded-lg flex items-center justify-center font-bold text-xs">
                    PDF
                  </div>
                  <div>
                    <div className="text-xs font-bold text-zinc-950">Adobe PDF (.pdf)</div>
                    <div className="text-[10px] text-zinc-500 font-medium">Standard read-only format</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-bold text-zinc-950">Project Documents</h2>
          <p className="text-xs text-zinc-500 font-medium">Encrypted real-time collaborative document editor</p>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="bg-zinc-950 hover:bg-black text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-2xs"
        >
          + New Document
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleCreateDoc} className="mb-5 bg-zinc-50 p-4 border border-zinc-200 rounded-xl flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">Document Title</label>
            <input 
              autoFocus
              type="text" 
              value={newDocTitle} 
              onChange={(e) => setNewDocTitle(e.target.value)} 
              placeholder="e.g. Architecture Blueprint" 
              className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs font-medium text-zinc-900 focus:outline-none focus:border-zinc-950" 
            />
          </div>
          <button type="button" onClick={() => setIsCreating(false)} className="px-3 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-950">Cancel</button>
          <button type="submit" className="px-4 py-2 bg-zinc-950 text-white text-xs font-bold rounded-lg hover:bg-black">Create</button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pb-2">
        {documents.length === 0 && !isCreating ? (
          <div className="col-span-full py-12 text-center border border-dashed border-zinc-200 rounded-xl text-zinc-400 text-xs font-medium">
            No documents created yet. Click "+ New Document" to begin.
          </div>
        ) : (
          documents.map(doc => (
            <div 
              key={doc.id} 
              onClick={() => setActiveDoc(doc)}
              className="bg-white border border-zinc-200 p-4 rounded-xl cursor-pointer hover:border-zinc-400 transition-all shadow-2xs hover:shadow-xs group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-900 group-hover:bg-zinc-950 group-hover:text-white transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
              </div>
              <h3 className="text-xs font-bold text-zinc-950 mb-1 truncate">{doc.title}</h3>
              <p className="text-[10px] text-zinc-400 font-mono">
                Updated {new Date(doc.updated_at + 'Z').toLocaleDateString()}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}