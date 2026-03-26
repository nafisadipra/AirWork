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
  
  // This will hold the document when a user clicks on it to open the editor
  const [activeDoc, setActiveDoc] = useState<any>(null); 

  const fetchDocuments = async () => {
    try {
      // We will wire up the real SQLite fetch in the next step!
      const api = (window as any).electronAPI;
      const result = await api.listDocuments({ projectId: selectedProject.id });
      if (result.success && result.documents) {
        setDocuments(result.documents);
      }
    } catch (error) {
      console.error("Failed to fetch documents", error);
    }
  };

  useEffect(() => {
    if (selectedProject) fetchDocuments();
  }, [selectedProject]);

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
        fetchDocuments(); // Refresh the list
      }
    } catch (error) {
      console.error("Failed to create document", error);
    }
  };

  // If a document is open, show the Editor (Placeholder for now)
  if (activeDoc) {
    return (
      <div className="flex flex-col h-full bg-[#121212] rounded-sm border border-[#2A2A2A] animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-3 border-b border-[#2A2A2A] bg-[#1A1A1A]">
          <div className="flex items-center gap-3">
            <button onClick={() => setActiveDoc(null)} className="text-[#666] hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <h3 className="text-sm font-bold text-white">{activeDoc.title}</h3>
          </div>
          <span className="text-[10px] text-[#0066FF] font-bold uppercase tracking-wider bg-[#0066FF]/10 px-2 py-1 rounded-sm">
            Live Syncing
          </span>
        </div>
        <div className="flex-1 p-8 overflow-y-auto">
          <Editor documentId={activeDoc.id} username={username} />
        </div>
      </div>
    );
  }

  // Otherwise, show the Document List
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