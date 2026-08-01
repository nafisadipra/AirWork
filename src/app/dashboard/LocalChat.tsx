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
  
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editMessageText, setEditMessageText] = useState('');

  const [attachment, setAttachment] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (!selectedProject) return;
    
    const loadMessages = async () => {
      try {
        const api = (window as any).electronAPI;
        const result = await api.getMessages({ projectId: selectedProject.id });
        if (result.success && result.messages) {
          setMessages(result.messages);
        }
      } catch (error) {
        console.error('[Chat] Failed to load messages:', error);
      }
    };
    
    loadMessages();
  }, [selectedProject]);

  useEffect(() => {
    const api = (window as any).electronAPI;
    
    if (api && api.onSyncMessage) {
      const unsubscribe = api.onSyncMessage(async () => {
        if (!selectedProject) return;
        
        try {
          const result = await api.getMessages({ projectId: selectedProject.id });
          if (result.success && result.messages) {
            setMessages(result.messages);
          }
        } catch (error) {
          console.error('[Chat] Failed to refresh messages:', error);
        }
      });
      
      return () => unsubscribe?.();
    }
  }, [selectedProject]);

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
        await api.sendMessage({
            id: messageId,
            projectId: selectedProject.id,
            sender: username,
            text: newMessage.trim(),
            attachment: attachment,
            attachmentName: attachmentName,
            timestamp: new Date().toISOString()
        });
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

  return (
    <div className="flex flex-col h-full relative animate-in fade-in duration-150">
      
      {/* Header */}
      <div className="h-14 border-b border-zinc-200 flex items-center justify-between shrink-0 mb-3 px-1">
        <div>
          <h2 className="text-base font-bold text-zinc-950">
            {selectedProject.id === 'global' ? 'Global Watercooler' : 'Project Chat'}
          </h2>
          <p className="text-[10px] text-zinc-500 font-mono">
            Signal Protocol Encrypted P2P
          </p>
        </div>
        <span className="flex h-2.5 w-2.5 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
        </span>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto px-1 space-y-4 pb-3 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-400">
            <svg className="w-12 h-12 mb-3 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-xs uppercase tracking-widest font-bold text-zinc-400">No Messages</p>
            <p className="text-[11px] text-zinc-400 mt-1">Start a conversation with local peers.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender === username;
            const isEditing = editingMessageId === msg.id;

            return (
              <div key={msg.id} className={`flex flex-col group ${isMe ? 'items-end' : 'items-start'}`}>
                
                <div className="flex items-baseline gap-2 mb-1 px-1">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    {getDisplayName(msg.sender)}
                  </span>
                  <span className="text-[9px] font-mono text-zinc-400">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {msg.isEdited && <span className="text-[9px] text-zinc-400 font-mono italic">(edited)</span>}
                </div>

                {isEditing ? (
                  <form onSubmit={submitEdit} className="flex gap-2 w-full max-w-[75%]">
                    <input 
                      autoFocus
                      type="text" 
                      value={editMessageText} 
                      onChange={(e) => setEditMessageText(e.target.value)}
                      className="flex-1 bg-zinc-50 border border-zinc-950 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none"
                    />
                    <button type="submit" className="text-xs bg-zinc-950 text-white px-3.5 rounded-xl font-bold">Save</button>
                    <button type="button" onClick={() => setEditingMessageId(null)} className="text-xs text-zinc-500 hover:text-zinc-950 px-1">Cancel</button>
                  </form>
                ) : (
                  <div className="flex items-center gap-2">
                    {isMe && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEditing(msg)} className="p-1 text-zinc-400 hover:text-zinc-950 rounded-md" title="Edit">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button onClick={() => handleDeleteMessage(msg.id)} className="p-1 text-zinc-400 hover:text-zinc-950 rounded-md" title="Delete">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    )}
                    
                    <div className={`px-4 py-3 max-w-md text-xs leading-relaxed ${
                      isMe 
                        ? 'bg-zinc-950 text-white rounded-2xl rounded-tr-xs shadow-2xs font-medium' 
                        : 'bg-zinc-100 text-zinc-950 rounded-2xl rounded-tl-xs border border-zinc-200 font-medium'
                    }`}>
                      
                      {msg.attachment && (
                        <div className="mb-2">
                           {msg.attachment.startsWith('data:image') ? (
                             <div className="relative group/attach inline-block">
                               <img src={msg.attachment} alt="attachment" className="rounded-lg max-w-full h-auto max-h-48 object-cover border border-zinc-200 shadow-2xs" />
                               <a 
                                 href={msg.attachment} 
                                 download={msg.attachmentName || 'image-attachment'} 
                                 className="absolute bottom-2 right-2 bg-zinc-950/80 text-white p-1.5 rounded-lg opacity-0 group-hover/attach:opacity-100 transition-opacity"
                                 title="Download Image"
                               >
                                 <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                               </a>
                             </div>
                           ) : (
                             <a 
                               href={msg.attachment} 
                               download={msg.attachmentName || 'document'} 
                               className={`flex items-center gap-2.5 p-2.5 rounded-lg border transition-colors group/file ${isMe ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}
                               title="Download File"
                             >
                               <div className="p-1.5 rounded bg-zinc-800 text-white font-bold text-[9px] uppercase">
                                 FILE
                               </div>
                               <span className="text-xs font-semibold truncate max-w-[150px]">{msg.attachmentName}</span>
                               <svg className="w-3.5 h-3.5 ml-auto opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
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
      <div className="shrink-0 pt-2 px-1">
        {attachment && (
          <div className="px-4 py-2 mb-2 border border-zinc-200 rounded-xl flex items-center justify-between bg-zinc-50">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold text-white bg-zinc-950 px-2 py-0.5 rounded">ATTACHMENT</span>
              <span className="text-xs font-medium text-zinc-900 truncate max-w-[180px]">{attachmentName}</span>
            </div>
            <button onClick={() => { setAttachment(null); setAttachmentName(null); }} className="text-zinc-400 hover:text-zinc-950 p-1">
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
          />
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()}
            className="w-10 h-10 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-700 hover:text-zinc-950 hover:bg-zinc-200 transition-colors shrink-0"
            title="Attach file"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
          </button>

          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type encrypted P2P message..."
            className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-xs font-medium text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-950 transition-all"
          />
          
          <button 
            type="submit"
            disabled={!newMessage.trim() && !attachment}
            className="w-10 h-10 rounded-xl bg-zinc-950 flex items-center justify-center text-white shadow-2xs disabled:opacity-40 hover:bg-black transition-all shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>

    </div>
  );
}