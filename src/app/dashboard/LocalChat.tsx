// src/app/dashboard/LocalChat.tsx
'use client';

import { useState, useEffect, useRef } from 'react';

interface LocalChatProps {
  selectedProject: any;
  username: string;
}

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
  isEdited?: boolean;
  attachment?: string | null;
  attachmentName?: string | null;
}

export default function LocalChat({ selectedProject, username }: LocalChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  
  // Edit States
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editMessageText, setEditMessageText] = useState('');

  // Attachment States
  const [attachment, setAttachment] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // --- ACTIONS ---

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() && !attachment) return;

    const tempMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: username,
      text: newMessage.trim(),
      timestamp: new Date().toISOString(),
      attachment: attachment,
      attachmentName: attachmentName
    };

    setMessages(prev => [...prev, tempMsg]);
    
    // Clear inputs instantly
    setNewMessage('');
    setAttachment(null);
    setAttachmentName(null);
  };

  const handleDeleteMessage = (id: string) => {
    if (confirm('Are you sure you want to delete this message?')) {
      setMessages(prev => prev.filter(msg => msg.id !== id));
    }
  };

  const startEditing = (msg: ChatMessage) => {
    setEditingMessageId(msg.id);
    setEditMessageText(msg.text);
  };

  const submitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMessageText.trim()) return;

    setMessages(prev => prev.map(msg => 
      msg.id === editingMessageId 
        ? { ...msg, text: editMessageText.trim(), isEdited: true } 
        : msg
    ));
    setEditingMessageId(null);
    setEditMessageText('');
  };

  // --- ATTACHMENT HANDLING ---

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limit size to 2MB to keep P2P TCP sockets happy
    if (file.size > 2 * 1024 * 1024) {
      alert("Please select a file smaller than 2MB for local sync.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setAttachment(reader.result as string);
      setAttachmentName(file.name);
    };
    reader.readAsDataURL(file);
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col h-full bg-[#121212] border border-[#2A2A2A] rounded-sm relative animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="h-14 border-b border-[#2A2A2A] flex items-center justify-between px-6 bg-[#1A1A1A] shrink-0">
        <div>
          <h2 className="text-sm font-bold text-white">
            {selectedProject.id === 'global' ? 'Global Watercooler' : 'Project Chat'}
          </h2>
          <p className="text-[10px] text-[#A0A0A0] uppercase tracking-wider font-bold">
            End-to-End Encrypted
          </p>
        </div>
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        </span>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[#666]">
            <svg className="w-12 h-12 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-xs uppercase tracking-wider font-bold">It's quiet in here...</p>
            <p className="text-[10px] mt-1">Send a message to sync with the local network.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender === username;
            const isEditing = editingMessageId === msg.id;

            return (
              <div key={msg.id} className={`flex flex-col group ${isMe ? 'items-end' : 'items-start'}`}>
                
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-[10px] font-bold text-[#808080] uppercase tracking-wider">
                    {msg.sender}
                  </span>
                  <span className="text-[9px] text-[#4d4d4d]">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {msg.isEdited && <span className="text-[9px] text-[#0066FF] font-bold italic">(edited)</span>}
                </div>

                {/* EDIT MODE */}
                {isEditing ? (
                  <form onSubmit={submitEdit} className="flex gap-2 w-full max-w-[75%]">
                    <input 
                      autoFocus
                      type="text" 
                      value={editMessageText} 
                      onChange={(e) => setEditMessageText(e.target.value)}
                      className="flex-1 bg-[#1A1A1A] border border-[#0066FF] rounded-sm px-3 py-1.5 text-sm text-white focus:outline-none"
                    />
                    <button type="submit" className="text-xs bg-[#0066FF] text-white px-3 rounded-sm font-bold">Save</button>
                    <button type="button" onClick={() => setEditingMessageId(null)} className="text-xs text-[#666] hover:text-white px-2">Cancel</button>
                  </form>
                ) : (
                  /* NORMAL MESSAGE DISPLAY */
                  <div className="flex items-center gap-2">
                    {/* Hover Actions */}
                    {isMe && (
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEditing(msg)} className="text-[#666] hover:text-[#0066FF]" title="Edit">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button onClick={() => handleDeleteMessage(msg.id)} className="text-[#666] hover:text-red-500" title="Delete">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    )}
                    
                    {/* The Bubble */}
                    <div className={`px-4 py-2.5 rounded-lg max-w-md text-sm ${
                      isMe 
                        ? 'bg-[#0066FF] text-white rounded-tr-none shadow-sm' 
                        : 'bg-[#2A2A2A] text-[#E0E0E0] rounded-tl-none border border-[#333]'
                    }`}>
                      
                      {/* <--- NEW: DOWNLOADABLE ATTACHMENTS ---> */}
                      {msg.attachment && (
                        <div className="mb-2">
                           {msg.attachment.startsWith('data:image') ? (
                             <div className="relative group/attach inline-block">
                               <img src={msg.attachment} alt="attachment" className="rounded-sm max-w-full h-auto max-h-48 object-cover border border-[#ffffff20]" />
                               {/* Image Download Overlay */}
                               <a 
                                 href={msg.attachment} 
                                 download={msg.attachmentName || 'image-attachment'} 
                                 className="absolute bottom-2 right-2 bg-black/70 text-white p-1.5 rounded-sm opacity-0 group-hover/attach:opacity-100 transition-opacity hover:bg-black"
                                 title="Download Image"
                               >
                                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                               </a>
                             </div>
                           ) : (
                             /* File Download Button */
                             <a 
                               href={msg.attachment} 
                               download={msg.attachmentName || 'document'} 
                               className="flex items-center gap-2 bg-black/20 hover:bg-black/40 transition-colors p-2 rounded-sm border border-[#ffffff20] group/file cursor-pointer"
                               title="Download File"
                             >
                               <svg className="w-4 h-4 text-[#4DA6FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                               <span className="text-xs truncate max-w-[150px]">{msg.attachmentName}</span>
                               <svg className="w-4 h-4 ml-2 opacity-50 group-hover/file:opacity-100 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                             </a>
                           )}
                        </div>
                      )}
                      {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-[#1A1A1A] border-t border-[#2A2A2A] shrink-0">
        
        {/* Attachment Preview UI */}
        {attachment && (
          <div className="px-6 py-2 border-b border-[#2A2A2A] flex items-center justify-between bg-[#121212]">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-[#0066FF] uppercase tracking-wider bg-[#0066FF]/10 px-2 py-1 rounded-sm">Attached</span>
              <span className="text-xs text-[#E0E0E0] truncate max-w-[200px]">{attachmentName}</span>
            </div>
            <button onClick={() => { setAttachment(null); setAttachmentName(null); }} className="text-[#666] hover:text-white transition-colors">
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="p-4 flex gap-3 items-center">
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
          />
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()}
            className="text-[#666] hover:text-[#0066FF] transition-colors shrink-0"
            title="Attach a file"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
          </button>

          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a secure message..."
            className="flex-1 bg-[#0A0A0A] border border-[#333] rounded-full px-5 py-2.5 text-sm text-white focus:outline-none focus:border-[#0066FF] transition-colors"
          />
          
          <button 
            type="submit"
            disabled={!newMessage.trim() && !attachment}
            className="w-10 h-10 rounded-full bg-[#0066FF] flex items-center justify-center text-white disabled:opacity-50 disabled:bg-[#2A2A2A] hover:bg-[#0052CC] transition-colors shrink-0"
          >
            <svg className="w-4 h-4 translate-x-[-1px] translate-y-[1px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>

    </div>
  );
}