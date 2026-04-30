// src/app/dashboard/LocalChat.tsx
'use client';

import { useState, useEffect, useRef } from 'react';

interface LocalChatProps {
  selectedProject: any;
  username: string;
  members?: any[]; 
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

export default function LocalChat({ selectedProject, username, members }: LocalChatProps) {
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

  const getDisplayName = (senderUsername: string) => {
    if (!members) return senderUsername;
    const member = members.find(m => m.username === senderUsername);
    return member?.nickname || senderUsername;
  };

  // Load messages when project changes
  useEffect(() => {
    if (!selectedProject) return;
    
    const loadMessages = async () => {
      try {
        const api = (window as any).electronAPI;
        const result = await api.getMessages({ projectId: selectedProject.id });
        if (result.success && result.messages) {
          setMessages(result.messages);
          console.log(`[Chat] Loaded ${result.messages.length} messages`);
        }
      } catch (error) {
        console.error('[Chat] Failed to load messages:', error);
      }
    };
    
    loadMessages();
  }, [selectedProject]);

  // Listen for P2P sync events
  useEffect(() => {
    const api = (window as any).electronAPI;
    
    if (api && api.onSyncMessage) {
      const unsubscribe = api.onSyncMessage(async () => {
        if (!selectedProject) return;
        
        try {
          const result = await api.getMessages({ projectId: selectedProject.id });
          if (result.success && result.messages) {
            setMessages(result.messages);
            console.log('[Chat] Refreshed messages from P2P sync');
          }
        } catch (error) {
          console.error('[Chat] Failed to refresh messages:', error);
        }
      });
      
      return () => unsubscribe?.();
    }
  }, [selectedProject]);

  // --- ACTIONS ---

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() && !attachment) return;

    const messageId = Date.now().toString();
    
    const tempMsg: ChatMessage = {
        id: messageId,
        sender: username,
        text: newMessage.trim(),
        timestamp: new Date().toISOString(),
        attachment: attachment,
        attachmentName: attachmentName
    };

    setMessages(prev => [...prev, tempMsg]);
    
    try {
        const api = (window as any).electronAPI;
        const result = await api.sendMessage({
            id: messageId,
            projectId: selectedProject.id,
            sender: username,
            text: newMessage.trim(),
            attachment: attachment,
            attachmentName: attachmentName,
            timestamp: new Date().toISOString()
        });
        
        if (!result.success) {
            console.error('[Chat] Failed to send message:', result.error);
        } else {
            console.log('[Chat] Message sent successfully');
        }
    } catch (error) {
        console.error('[Chat] Error sending message:', error);
    }
    
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

  // Note: Outer borders removed because dashboard.tsx handles the card wrap
  return (
    <div className="flex flex-col h-full relative animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="h-16 border-b border-neutral-100 flex items-center justify-between shrink-0 mb-4 px-2">
        <div>
          <h2 className="text-lg font-bold text-black">
            {selectedProject.id === 'global' ? 'Global Watercooler' : 'Project Chat'}
          </h2>
          <p className="text-[11px] text-neutral-500 uppercase tracking-wider font-bold mt-0.5">
            End-to-End Encrypted
          </p>
        </div>
        <span className="flex h-3 w-3 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4caf50] opacity-50"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-[#2e7d32]"></span>
        </span>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-2 space-y-6 pb-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-neutral-400">
            <svg className="w-16 h-16 mb-4 opacity-30 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-sm uppercase tracking-widest font-bold text-neutral-400">It's quiet in here...</p>
            <p className="text-xs mt-2 font-medium">Send a message to sync with the local network.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender === username;
            const isEditing = editingMessageId === msg.id;

            return (
              <div key={msg.id} className={`flex flex-col group ${isMe ? 'items-end' : 'items-start'}`}>
                
                <div className="flex items-baseline gap-2 mb-1.5 px-1">
                  <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                    {getDisplayName(msg.sender)}
                  </span>
                  <span className="text-[10px] text-neutral-400 font-medium">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {msg.isEdited && <span className="text-[10px] text-[#0066FF] font-bold italic">(edited)</span>}
                </div>

                {/* EDIT MODE */}
                {isEditing ? (
                  <form onSubmit={submitEdit} className="flex gap-2 w-full max-w-[75%]">
                    <input 
                      autoFocus
                      type="text" 
                      value={editMessageText} 
                      onChange={(e) => setEditMessageText(e.target.value)}
                      className="flex-1 bg-[#f4f5f8] border border-[#0066FF] rounded-2xl px-4 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                    <button type="submit" className="text-sm bg-[#0066FF] text-white px-4 rounded-full font-bold shadow-sm">Save</button>
                    <button type="button" onClick={() => setEditingMessageId(null)} className="text-sm text-neutral-500 hover:text-black px-2 font-medium">Cancel</button>
                  </form>
                ) : (
                  /* NORMAL MESSAGE DISPLAY */
                  <div className="flex items-center gap-3">
                    {/* Hover Actions */}
                    {isMe && (
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEditing(msg)} className="p-1.5 text-neutral-400 hover:text-[#0066FF] hover:bg-blue-50 rounded-full transition-colors" title="Edit">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button onClick={() => handleDeleteMessage(msg.id)} className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors" title="Delete">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    )}
                    
                    {/* The Bubble */}
                    <div className={`px-5 py-3.5 max-w-md text-sm font-medium leading-relaxed ${
                      isMe 
                        ? 'bg-[#0066FF] text-white rounded-[24px] rounded-tr-sm shadow-sm' 
                        : 'bg-[#f4f5f8] text-black rounded-[24px] rounded-tl-sm border border-neutral-100'
                    }`}>
                      
                      {/* DOWNLOADABLE ATTACHMENTS */}
                      {msg.attachment && (
                        <div className="mb-3">
                           {msg.attachment.startsWith('data:image') ? (
                             <div className="relative group/attach inline-block">
                               <img src={msg.attachment} alt="attachment" className="rounded-xl max-w-full h-auto max-h-56 object-cover border border-black/5 shadow-sm" />
                               <a 
                                 href={msg.attachment} 
                                 download={msg.attachmentName || 'image-attachment'} 
                                 className="absolute bottom-2 right-2 bg-black/50 backdrop-blur-md text-white p-2 rounded-full opacity-0 group-hover/attach:opacity-100 transition-opacity hover:bg-black/70"
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
                               className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors group/file ${isMe ? 'bg-black/10 border-white/20 hover:bg-black/20' : 'bg-white border-neutral-200 hover:border-neutral-300 shadow-sm'}`}
                               title="Download File"
                             >
                               <div className={`p-2 rounded-lg ${isMe ? 'bg-white/20' : 'bg-[#e8f2ff] text-[#0066FF]'}`}>
                                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                               </div>
                               <span className="text-sm font-semibold truncate max-w-[160px]">{msg.attachmentName}</span>
                               <svg className={`w-4 h-4 ml-2 opacity-50 group-hover/file:opacity-100 transition-opacity ${isMe ? 'text-white' : 'text-neutral-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
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
      <div className="shrink-0 pt-4 px-2">
        
        {/* Attachment Preview UI */}
        {attachment && (
          <div className="px-6 py-3 mb-3 border border-neutral-200 rounded-2xl flex items-center justify-between bg-white shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold text-[#0066FF] uppercase tracking-wider bg-[#e8f2ff] px-2.5 py-1 rounded-sm">Attached</span>
              <span className="text-sm font-medium text-black truncate max-w-[200px]">{attachmentName}</span>
            </div>
            <button onClick={() => { setAttachment(null); setAttachmentName(null); }} className="text-neutral-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-full transition-colors">
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex gap-3 items-center">
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
          />
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()}
            className="w-12 h-12 rounded-full bg-[#f4f5f8] border border-neutral-100 flex items-center justify-center text-neutral-500 hover:text-[#0066FF] hover:border-blue-100 transition-colors shrink-0 shadow-sm"
            title="Attach a file"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
          </button>

          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a secure message..."
            className="flex-1 bg-[#f4f5f8] border border-neutral-100 rounded-full px-6 py-3.5 text-sm font-medium text-black placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-200 focus:bg-white transition-all shadow-sm"
          />
          
          <button 
            type="submit"
            disabled={!newMessage.trim() && !attachment}
            className="w-12 h-12 rounded-full bg-[#0066FF] flex items-center justify-center text-white shadow-md disabled:opacity-50 disabled:bg-neutral-300 disabled:shadow-none hover:bg-blue-700 transition-all shrink-0"
          >
            <svg className="w-5 h-5 translate-x-[-1px] translate-y-[1px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>

    </div>
  );
}