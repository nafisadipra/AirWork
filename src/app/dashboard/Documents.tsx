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

  // <--- NEW: STATE FOR OUR BEAUTIFUL EXPORT POPUP --->
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

  // Listen for P2P sync events to refresh documents
useEffect(() => {
    const api = (window as any).electronAPI;
    
    if (api && api.onSyncMessage) {
        const unsubscribe = api.onSyncMessage(async () => {
            if (activeDoc) {
                // If viewing a doc, refresh branches
                fetchBranches(activeDoc.id);
            } else {
                // If viewing list, refresh documents
                fetchDocuments();
            }
            console.log('[Docs] Refreshed from P2P sync');
        });
        
        return () => unsubscribe?.();
    }
}, [activeDoc]);

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
      <div className="flex flex-col h-full bg-[#121212] rounded-sm border border-[#2A2A2A] animate-in fade-in zoom-in-95 duration-200 relative">
        <div className="flex items-center justify-between p-3 border-b border-[#2A2A2A] bg-[#1A1A1A]">
          <div className="flex items-center gap-3">
            <button onClick={() => setActiveDoc(null)} className="text-[#666] hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            
            <div className="flex items-center gap-2 bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm px-2 py-1">
              <svg className="w-3.5 h-3.5 text-[#4DA6FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7l-2 2m2-2l2 2m4 4l2-2m-2 2l-2-2" /></svg>
              <select
                className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
                value={activeBranch ? activeBranch.id : 'main'}
                onChange={(e) => {
                  if (e.target.value === 'main') setActiveBranch(null);
                  else setActiveBranch(branches.find(b => b.id === e.target.value));
                }}
              >
                <option value="main" className="bg-[#1A1A1A]">main</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id} className="bg-[#1A1A1A]">{b.branch_name}</option>
                ))}
              </select>
            </div>
            
            {activeBranch && (
              <button onClick={handleDeleteBranch} className="text-[#666] hover:text-red-500 transition-colors ml-1" title="Delete Branch">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            )}
            
            {!isBranching ? (
              <button onClick={() => setIsBranching(true)} className="text-[10px] font-bold text-[#666] hover:text-[#4DA6FF] uppercase tracking-wider transition-colors ml-2">
                + New Branch
              </button>
            ) : (
              <form onSubmit={handleCreateBranch} className="flex items-center gap-1 ml-2">
                <input 
                  autoFocus
                  type="text" 
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="Branch name..."
                  className="bg-[#1A1A1A] border border-[#0066FF] rounded-sm px-2 py-0.5 text-xs text-white focus:outline-none w-24"
                />
                <button type="submit" className="text-[10px] bg-[#0066FF] text-white px-2 py-0.5 rounded-sm font-bold uppercase">Create</button>
                <button type="button" onClick={() => setIsBranching(false)} className="text-[10px] text-[#666] hover:text-white px-1 font-bold uppercase">Cancel</button>
              </form>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {activeBranch && (
              <span className="text-[10px] text-yellow-500 font-bold uppercase tracking-wider bg-yellow-500/10 px-2 py-1 rounded-sm border border-yellow-500/20">
                Isolated Draft
              </span>
            )}
            <span className="text-[10px] text-[#0066FF] font-bold uppercase tracking-wider bg-[#0066FF]/10 px-2 py-1 rounded-sm">
              Live Syncing
            </span>

            {/* <--- NEW: SINGLE EXPORT BUTTON TO TRIGGER MODAL ---> */}
            <div className="flex items-center gap-2 border-l border-[#2A2A2A] pl-4 ml-2">
              <button 
                onClick={() => setShowExportModal(true)} 
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2A2A2A] hover:bg-[#333] text-[#E0E0E0] hover:text-white rounded-sm text-[10px] font-bold uppercase tracking-wider transition-colors shadow-sm"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Export
              </button>
            </div>
          </div>
        </div>
        
        <div className="flex-1 p-8 overflow-y-auto">
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

        {/* ==================== EXPORT POPUP MODAL ==================== */}
        {showExportModal && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center bg-[#000000]/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm p-6 shadow-2xl zoom-in-95 animate-in duration-200">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-bold text-white">Export Document</h3>
                  <p className="text-xs text-[#666666] uppercase tracking-widest font-bold mt-1">Select File Format</p>
                </div>
                <button onClick={() => setShowExportModal(false)} className="text-[#666] hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              
              <div className="space-y-3">
                <button 
                  onClick={() => { handleDownloadDoc(); setShowExportModal(false); }}
                  className="w-full flex items-center gap-4 p-4 bg-[#121212] border border-[#2A2A2A] hover:border-[#0066FF] hover:bg-[#0066FF]/5 rounded-sm transition-all group"
                >
                  <div className="w-10 h-10 bg-[#0066FF]/10 text-[#0066FF] rounded-sm flex items-center justify-center group-hover:bg-[#0066FF] group-hover:text-white transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-bold text-white mb-0.5">Microsoft Word (.doc)</div>
                    <div className="text-[10px] text-[#808080] font-medium">Editable offline document</div>
                  </div>
                </button>

                <button 
                  onClick={() => { handleDownloadPdf(); setShowExportModal(false); }}
                  className="w-full flex items-center gap-4 p-4 bg-[#121212] border border-[#2A2A2A] hover:border-red-500 hover:bg-red-500/5 rounded-sm transition-all group"
                >
                  <div className="w-10 h-10 bg-red-500/10 text-red-500 rounded-sm flex items-center justify-center group-hover:bg-red-500 group-hover:text-white transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-bold text-white mb-0.5">Adobe PDF (.pdf)</div>
                    <div className="text-[10px] text-[#808080] font-medium">Standard read-only format</div>
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
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-sm font-bold text-[#E0E0E0] uppercase tracking-wider">Project Documents</h2>
        <button 
          onClick={() => setIsCreating(true)}
          className="bg-[#0066FF] text-white text-xs font-bold uppercase px-3 py-1.5 rounded-sm hover:bg-[#0052CC] transition-colors"
        >
          + New Document
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleCreateDoc} className="mb-6 bg-[#121212] p-4 border border-[#0066FF] rounded-sm flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-[#666] uppercase mb-1">Document Title</label>
            <input 
              autoFocus
              type="text" 
              value={newDocTitle} 
              onChange={(e) => setNewDocTitle(e.target.value)} 
              placeholder="e.g. System Architecture Notes" 
              className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-[#4DA6FF]" 
            />
          </div>
          <button type="button" onClick={() => setIsCreating(false)} className="px-3 py-2 text-xs font-bold text-[#666] hover:text-white uppercase">Cancel</button>
          <button type="submit" className="px-4 py-2 bg-[#0066FF] text-white text-xs font-bold uppercase rounded-sm">Create</button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pb-4">
        {documents.length === 0 && !isCreating ? (
          <div className="col-span-full py-12 text-center border border-dashed border-[#2A2A2A] rounded-sm text-[#666] text-xs font-bold uppercase tracking-wider">
            No documents found. Create one to start collaborating.
          </div>
        ) : (
          documents.map(doc => (
            <div 
              key={doc.id} 
              onClick={() => setActiveDoc(doc)}
              className="bg-[#121212] border border-[#2A2A2A] p-4 rounded-sm cursor-pointer hover:border-[#4DA6FF] transition-colors group"
            >
              <div className="flex items-start justify-between mb-4">
                <svg className="w-6 h-6 text-[#0066FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              <h3 className="text-sm font-bold text-white mb-1 truncate">{doc.title}</h3>
              <p className="text-[10px] text-[#666] uppercase font-bold tracking-wider">
                Updated {new Date(doc.updated_at + 'Z').toLocaleDateString()}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}