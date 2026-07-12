import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { Send, Smile, Mic, Phone, Video, MoreVertical, CheckCheck, X, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ChatImageBubble, ChatFileBubble, fmtFileSize, AttachmentTypeIcon, AttachMenu, EmojiPicker } from './ChatMediaBubble';

const MAX_CHAT_FILE_MB = 25;

/* ── Avatar ── */
function Avatar({ name, role, size = 'sm' }) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const gradient = role === 'teacher'
    ? 'linear-gradient(135deg, #7c3aed, #6366f1)'
    : 'linear-gradient(135deg, #059669, #0d9488)';
  const dim = size === 'sm' ? 28 : size === 'md' ? 36 : 44;
  const font = size === 'sm' ? '11px' : size === 'md' ? '13px' : '15px';
  return (
    <div style={{
      width: dim, height: dim, borderRadius: '50%',
      background: gradient,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, color: '#fff', fontSize: font,
      flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
      userSelect: 'none',
    }}>
      {initials}
    </div>
  );
}

/* ── Typing dots ── */
function TypingIndicator({ name }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 12, animation: 'msgInLeft 0.22s ease both' }}>
      <Avatar name={name} role="student" size="sm" />
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#059669', marginBottom: 3, marginLeft: 2 }}>{name}</div>
        <div className="chat-bubble-other" style={{
          padding: '10px 14px', borderRadius: '4px 18px 18px 18px',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <span className="typing-dot" style={{ animationDelay: '0ms' }} />
          <span className="typing-dot" style={{ animationDelay: '150ms' }} />
          <span className="typing-dot" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

/* ── Single bubble ── */
function MessageBubble({ msg, isMine, isFirstInGroup, isLastInGroup }) {
  const time = new Date(msg.created_at || Date.now())
    .toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  // Spacing: more gap when switching sender, tight within same-sender group
  const marginBottom = isLastInGroup ? 12 : 2;

  // Border radius: pointed corner on the "avatar side" for the first message in a group
  const radius = isMine
    ? isFirstInGroup ? '18px 4px 18px 18px' : '18px 4px 4px 18px'
    : isFirstInGroup ? '4px 18px 18px 18px' : '4px 18px 18px 4px';

  return (
    <div style={{
      display: 'flex',
      flexDirection: isMine ? 'row-reverse' : 'row',
      alignItems: 'flex-end',
      gap: 8,
      marginBottom,
      animation: isMine ? 'msgInRight 0.22s cubic-bezier(0.34,1.4,0.64,1) both'
                        : 'msgInLeft  0.22s cubic-bezier(0.34,1.4,0.64,1) both',
    }}>
      {/* Avatar slot: fixed 28px wide so bubbles stay aligned */}
      <div style={{ width: 28, flexShrink: 0, display: 'flex', alignItems: 'flex-end' }}>
        {!isMine && isLastInGroup && (
          <Avatar name={msg.author_name} role={msg.author_role} size="sm" />
        )}
      </div>

      {/* Bubble + name */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: isMine ? 'flex-end' : 'flex-start',
        maxWidth: '68%',
      }}>
        {/* Sender name — only on first bubble in a group, for others */}
        {!isMine && isFirstInGroup && (
          <div style={{
            fontSize: 11, fontWeight: 700, marginBottom: 3, marginLeft: 4,
            color: msg.author_role === 'teacher' ? '#7c3aed' : '#059669',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            {msg.author_name || 'Unknown'}
            {msg.author_role === 'teacher' && (
              <span style={{
                fontSize: 9, fontWeight: 600, padding: '1px 5px',
                borderRadius: 99, background: 'rgba(124,58,237,0.12)', color: '#7c3aed',
              }}>TEACHER</span>
            )}
          </div>
        )}

        <div className={isMine ? 'chat-bubble-mine' : 'chat-bubble-other'}
          style={{
            padding: msg.message_type === 'image' || msg.message_type === 'file' ? 4 : '9px 13px',
            borderRadius: radius, position: 'relative',
          }}>
          {msg.message_type === 'image' ? (
            <ChatImageBubble url={msg.file_url} name={msg.file_name} mimeType={msg.mime_type} />
          ) : msg.message_type === 'file' ? (
            <ChatFileBubble url={msg.file_url} name={msg.file_name} size={msg.file_size} mimeType={msg.mime_type} />
          ) : (
            <p style={{ fontSize: 13.5, lineHeight: 1.5, wordBreak: 'break-word', margin: 0 }}>
              {msg.content}
            </p>
          )}
          {/* Time + ticks */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            gap: 3, marginTop: 4,
          }}>
            <span style={{ fontSize: 10, opacity: 0.65 }}>{time}</span>
            {isMine && <CheckCheck style={{ width: 12, height: 12, opacity: 0.7 }} />}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Date separator ── */
function DateSep({ label }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0 10px' }}>
      <span className="chat-date-chip">{label}</span>
    </div>
  );
}

function fmtDateSep(ts) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
}

/* ══════════════════════════════════════════════
   Main component
══════════════════════════════════════════════ */
export default function ChatThread({ thread, isTeacher, onSendComment, onSendMedia, posting, threadRef }) {
  const { user } = useAuth();          // get the logged-in user from context
  const myName = user?.name || '';     // display_name or name field
  const myRole = user?.role || (isTeacher ? 'teacher' : 'student');

  const [text, setText] = useState('');
  const [otherTyping, setOtherTyping] = useState(false);
  const [otherTypingName, setOtherTypingName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const typingTimer = useRef(null);

  /* scroll to bottom whenever messages change */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread?.comments, otherTyping]);

  /* pick a "typing" name from participants */
  useEffect(() => {
    if (!thread) return;
    const others = [...new Set(
      (thread.comments || [])
        .filter(c => c.author_name !== myName)
        .map(c => c.author_name)
        .filter(Boolean)
    )];
    setOtherTypingName(
      others.length > 0 ? others[0]
        : isTeacher ? 'A student' : (thread.teacher_name || 'Teacher')
    );
  }, [thread?.id, myName]);

  const handleTyping = (e) => {
    setText(e.target.value);
    // auto-grow
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {}, 1500);
  };

  const handleSend = async () => {
    if (!text.trim() || posting) return;
    const msg = text;
    setText('');
    if (inputRef.current) { inputRef.current.style.height = 'auto'; }
    await onSendComment(msg);
    setTimeout(() => {
      setOtherTyping(true);
      setTimeout(() => setOtherTyping(false), 2400);
    }, 700);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleFilePick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_CHAT_FILE_MB * 1024 * 1024) return;
    setSelectedFile(file);
    setFilePreviewUrl(file.type.startsWith('image/') ? URL.createObjectURL(file) : null);
  };

  const cancelFile = () => {
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    setSelectedFile(null);
    setFilePreviewUrl(null);
  };

  const sendFile = async () => {
    if (!selectedFile || uploadingFile || !onSendMedia) return;
    setUploadingFile(true);
    try {
      await onSendMedia(selectedFile);
      cancelFile();
    } finally { setUploadingFile(false); }
  };

  if (!thread) return null;

  const comments = thread.comments || [];

  /* Enrich messages: isMine, grouping flags, date separators */
  const enriched = [];
  let lastDate = null;

  comments.forEach((c, i) => {
    // isMine = same name OR same role when name isn't set (teacher viewing own post)
    const mine = myName
      ? c.author_name === myName
      : (isTeacher && c.author_role === 'teacher');

    const dateLabel = fmtDateSep(c.created_at || Date.now());
    if (dateLabel !== lastDate) {
      enriched.push({ type: 'date', label: dateLabel, key: `date-${i}` });
      lastDate = dateLabel;
    }

    const prevMsg = comments[i - 1];
    const nextMsg = comments[i + 1];
    const samePrev = prevMsg && prevMsg.author_name === c.author_name;
    const sameNext = nextMsg && nextMsg.author_name === c.author_name;

    enriched.push({
      type: 'msg', ...c,
      isMine: mine,
      isFirstInGroup: !samePrev,
      isLastInGroup: !sameNext,
      key: c.id || `msg-${i}`,
    });
  });

  const participants = [...new Set(comments.map(c => c.author_name).filter(Boolean))];

  return (
    <div className="chat-thread-container" style={{ display: 'flex', flexDirection: 'column', height: '78vh' }}>

      {/* ── Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
        borderRadius: '16px 16px 0 0',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        flexShrink: 0,
      }}>
        {/* Group avatar */}
        <div style={{ position: 'relative' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, color: '#fff', fontSize: 16,
          }}>
            {(thread.title || 'D')[0].toUpperCase()}
          </div>
          <span className="online-dot" style={{ position: 'absolute', bottom: 0, right: 0 }} />
        </div>
        {/* Title + sub */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {thread.title}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 1 }}>
            {participants.length > 0
              ? `${participants.length} participant${participants.length !== 1 ? 's' : ''}`
              : 'Class discussion'}
            {thread.class_name ? ` · ${thread.class_name}` : ''}
          </div>
        </div>
        {/* Action icons */}
        {[Phone, Video, MoreVertical].map((Icon, i) => (
          <button key={i} className="chat-icon-btn"><Icon style={{ width: 16, height: 16 }} /></button>
        ))}
      </div>

      {/* ── Messages ── */}
      <div
        className="chat-wallpaper"
        ref={threadRef}
        style={{ flex: 1, overflowY: 'auto', padding: '16px 14px 8px' }}
      >
        {/* Pinned opening post */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
          <span className="chat-date-chip">
            📌 {thread.teacher_name || 'Teacher'} started this discussion
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <div style={{
            maxWidth: '80%', background: 'rgba(99,102,241,0.08)',
            border: '1px solid rgba(99,102,241,0.18)',
            borderRadius: 14, padding: '12px 16px', textAlign: 'center',
          }}>
            <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text-secondary)', margin: 0 }}>
              {thread.content}
            </p>
            <span style={{ fontSize: 10, color: 'var(--text-secondary)', opacity: 0.55, display: 'block', marginTop: 6 }}>
              {new Date(thread.created_at || Date.now()).toLocaleDateString('en-US', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
              })}
            </span>
          </div>
        </div>

        {/* Empty state */}
        {comments.length === 0 && !otherTyping && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              No replies yet — be the first!
            </p>
          </div>
        )}

        {/* Messages + date separators */}
        {enriched.map(item =>
          item.type === 'date'
            ? <DateSep key={item.key} label={item.label} />
            : <MessageBubble key={item.key} msg={item} isMine={item.isMine}
                isFirstInGroup={item.isFirstInGroup} isLastInGroup={item.isLastInGroup} />
        )}

        {otherTyping && <TypingIndicator name={otherTypingName} />}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input bar ── */}
      <input ref={fileInputRef} type="file" onChange={handleFilePick} style={{ display: 'none' }} />
      <input ref={imageInputRef} type="file" accept="image/*" onChange={handleFilePick} style={{ display: 'none' }} />

      {selectedFile && (
        <div style={{
          borderTop: '1px solid var(--card-border)', background: 'var(--card-bg)',
          padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <button onClick={cancelFile} className="chat-toolbar-btn" style={{ color: '#dc2626' }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--surface-100)', borderRadius: 14, padding: '6px 10px',
            border: '1.5px solid rgba(99,102,241,0.25)', minWidth: 0,
          }}>
            {filePreviewUrl ? (
              <img src={filePreviewUrl} alt="" style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(99,102,241,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AttachmentTypeIcon mimeType={selectedFile.type} style={{ width: 15, height: 15, color: '#6366f1' }} />
              </div>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedFile.name}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>{fmtFileSize(selectedFile.size)}</div>
            </div>
          </div>
          <button onClick={sendFile} disabled={uploadingFile} className="send-btn">
            {uploadingFile
              ? <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              : <Send style={{ width: 16, height: 16 }} />}
          </button>
        </div>
      )}

      <div style={{
        borderTop: '1px solid var(--card-border)',
        background: 'var(--card-bg)',
        padding: '10px 12px',
        display: selectedFile ? 'none' : 'block',
        flexShrink: 0,
      }}>
        <div className="wa-input-pill" style={{ '--wa-accent': '#128C7E', '--wa-accent-2': '#075E54', '--wa-accent-soft': 'rgba(18,140,126,0.14)' }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button className="wa-icon-btn" onClick={() => { setAttachMenuOpen(o => !o); setEmojiOpen(false); }} title="Attach">
              <Plus style={{ width: 20, height: 20 }} />
            </button>
            <AttachMenu
              open={attachMenuOpen}
              onClose={() => setAttachMenuOpen(false)}
              onPickImage={() => imageInputRef.current?.click()}
              onPickFile={() => fileInputRef.current?.click()}
            />
          </div>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button className="wa-icon-btn" onClick={() => { setEmojiOpen(o => !o); setAttachMenuOpen(false); }} title="Emoji">
              <Smile style={{ width: 20, height: 20 }} />
            </button>
            <EmojiPicker
              open={emojiOpen}
              onClose={() => setEmojiOpen(false)}
              onPick={(e) => { setText(t => t + e); inputRef.current?.focus(); }}
            />
          </div>

          <textarea
            ref={inputRef}
            value={text}
            onChange={handleTyping}
            onKeyDown={handleKey}
            rows={1}
            placeholder={isTeacher ? 'Reply to your class' : 'Share your thoughts'}
            className="wa-input-textarea"
          />

          {text.trim() ? (
            <button key="send" className="wa-icon-btn wa-icon-send wa-icon-swap" onClick={handleSend} disabled={posting}>
              {posting
                ? <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                : <Send style={{ width: 17, height: 17 }} />}
            </button>
          ) : (
            <button key="mic" className="wa-icon-btn wa-icon-swap" title="Voice note">
              <Mic style={{ width: 20, height: 20 }} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}