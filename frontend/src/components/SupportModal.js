import { useState, useEffect, useRef } from 'react';
import './SupportModal.css';
import { db, ref, push, set, onValue, update } from '../firebaseConfig';

const SupportModal = ({ isOpen, onClose, initialMessage, initialCategory, initialUtr, initialAmount, initialTab }) => {
    const [activeTab, setActiveTab] = useState('ticket'); // Default tab to ticket / drop message as requested
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [sending, setSending] = useState(false);
    const chatEndRef = useRef(null);

    // Ticket form state
    const [category, setCategory] = useState('Deposit Not Credited');
    const [subject, setSubject] = useState('');
    const [utr, setUtr] = useState('');
    const [amount, setAmount] = useState('');
    const [proof, setProof] = useState('');
    const [ticketMessage, setTicketMessage] = useState('');
    const [ticketSubmitting, setTicketSubmitting] = useState(false);
    const [ticketSuccess, setTicketSuccess] = useState('');
    const [userTickets, setUserTickets] = useState([]);

    const storedUser = JSON.parse(localStorage.getItem('ctg_user') || '{}');
    const userId = storedUser.id || storedUser._id || 'guest';
    const userName = storedUser.fullName || storedUser.mobile || 'User';
    const userEmail = storedUser.email || storedUser.mobile || 'No Email';

    useEffect(() => {
        if (isOpen) {
            if (initialMessage) {
                setInputText(initialMessage);
                setTicketMessage(initialMessage);
            }
            if (initialCategory) {
                setCategory(initialCategory);
                setSubject(`${initialCategory} - Ref: ${initialUtr || 'Pending'}`);
            }
            if (initialUtr) setUtr(initialUtr);
            if (initialAmount) setAmount(String(initialAmount));
            if (initialTab) {
                setActiveTab(initialTab);
            } else if (initialMessage && !initialCategory) {
                setActiveTab('chat');
            }
        }
    }, [isOpen, initialMessage, initialCategory, initialUtr, initialAmount, initialTab]);

    // Load Live Chat messages from Firebase realtime
    useEffect(() => {
        if (!isOpen) return;
        const chatRef = ref(db, `chats/${userId}/messages`);
        const unsub = onValue(chatRef, (snap) => {
            const d = snap.val();
            if (d) {
                const arr = Object.entries(d)
                    .map(([id, v]) => ({ id, ...v }))
                    .sort((a, b) => a.createdAt - b.createdAt);
                setMessages(arr);
            } else {
                setMessages([{
                    id: 'welcome',
                    sender: 'admin',
                    senderName: '95 CLUB Support',
                    text: `Hello ${userName}! 👋 Welcome to 95 CLUB Support. How can we help you today?\n\n• Deposit/Withdrawal issues\n• Account problems\n• Game queries`,
                    createdAt: Date.now(),
                    read: true,
                }]);
            }
        });
        return unsub;
    }, [isOpen, userId, userName]);

    // Load User's Submitted Support Tickets from Firebase
    useEffect(() => {
        if (!isOpen) return;
        const ticketsRef = ref(db, 'supportMessages');
        const unsub = onValue(ticketsRef, (snap) => {
            const data = snap.val();
            if (data) {
                const arr = Object.entries(data)
                    .map(([id, v]) => ({ id, ...v }))
                    .filter(t => t.userId === userId)
                    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                setUserTickets(arr);
            } else {
                setUserTickets([]);
            }
        });
        return unsub;
    }, [isOpen, userId]);

    // Mark messages as read & scroll to bottom
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        if (!isOpen) return;
        messages.forEach(msg => {
            if (msg.sender === 'admin' && !msg.read && msg.id !== 'welcome') {
                update(ref(db, `chats/${userId}/messages/${msg.id}`), { read: true });
            }
        });
    }, [messages, isOpen]);

    const handleSend = async (e) => {
        e.preventDefault();
        const text = inputText.trim();
        if (!text || sending) return;
        setSending(true);
        setInputText('');
        try {
            const msgRef = push(ref(db, `chats/${userId}/messages`));
            const msgData = {
                sender: 'user',
                senderName: userName,
                userId,
                text,
                createdAt: Date.now(),
                read: false,
            };
            await set(msgRef, msgData);
            await update(ref(db, `chats/${userId}`), {
                userId,
                userName,
                mobile: storedUser.mobile || '',
                lastMessage: text,
                lastAt: Date.now(),
                unreadAdmin: (messages.filter(m => m.sender === 'user' && !m.read).length + 1),
                status: 'open',
            });
        } catch (err) {
            console.error('Chat send error:', err);
        }
        setSending(false);
    };

    // Submit structured support ticket with proof & details
    const handleSubmitTicket = async (e) => {
        e.preventDefault();
        if (!ticketMessage.trim()) return;
        setTicketSubmitting(true);
        setTicketSuccess('');
        try {
            const ticketRef = push(ref(db, 'supportMessages'));
            const payload = {
                userId,
                userName,
                userEmail,
                category,
                subject: subject.trim() || category,
                utr: utr.trim() || '—',
                amount: amount.trim() ? Number(amount) : '—',
                proof: proof.trim() || '—',
                message: ticketMessage.trim(),
                status: 'open',
                createdAt: Date.now(),
            };
            await set(ticketRef, payload);
            setTicketSuccess('✅ Support Message & Proof Submitted Successfully! Admin will review and reply.');
            setSubject('');
            setUtr('');
            setAmount('');
            setProof('');
            setTicketMessage('');
            setTimeout(() => setTicketSuccess(''), 4000);
        } catch (err) {
            console.error('Ticket submission error:', err);
        }
        setTicketSubmitting(false);
    };

    const faqs = [
        { q: 'How long does deposit take?', a: 'Deposits via UPI are credited within 1-5 minutes automatically.' },
        { q: 'How to withdraw money?', a: 'Go to Wallet → Withdraw, enter amount & UPI/Bank details. Payouts in 15-30 mins.' },
        { q: 'Minimum deposit amount?', a: 'Minimum deposit is ₹100. First deposit gets bonus!' },
        { q: 'How to claim referral earnings?', a: 'Share your referral code from the Referral tab. Commission credited instantly on every bet.' },
        { q: 'Deposit is locked, what to do?', a: 'Submit a ticket with UTR proof in Drop Message tab or contact live support.' },
    ];

    const fmtTime = (ts) => ts ? new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
    const unreadCount = messages.filter(m => m.sender === 'admin' && !m.read).length;

    if (!isOpen) return null;

    return (
        <div className="support-overlay" onClick={onClose}>
            <div className="support-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="support-header">
                    <div className="support-header-title">
                        <span className="support-badge">👑 95 CLUB</span>
                        <span>Customer Support</span>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 6px #22c55e' }} />
                    </div>
                    <button className="support-close-btn" onClick={onClose}>✕</button>
                </div>

                {/* Tabs */}
                <div className="support-tabs">
                    <button className={`support-tab ${activeTab === 'ticket' ? 'active' : ''}`} onClick={() => setActiveTab('ticket')}>
                        📩 Drop Message
                    </button>
                    <button className={`support-tab ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>
                        💬 Live Chat {unreadCount > 0 && <span style={{ background: '#ef4444', color: '#fff', borderRadius: 999, padding: '0 5px', fontSize: '0.65rem', marginLeft: 4, fontWeight: 800 }}>{unreadCount}</span>}
                    </button>
                    <button className={`support-tab ${activeTab === 'contact' ? 'active' : ''}`} onClick={() => setActiveTab('contact')}>
                        📱 Channels
                    </button>
                    <button className={`support-tab ${activeTab === 'faq' ? 'active' : ''}`} onClick={() => setActiveTab('faq')}>
                        ❓ FAQ
                    </button>
                </div>

                {/* Body */}
                <div className="support-body">

                    {/* ── DROP MESSAGE / SUBMIT PROOF TICKET ── */}
                    {activeTab === 'ticket' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {ticketSuccess && (
                                <div style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80', padding: '10px 14px', borderRadius: 12, fontSize: '0.82rem', fontWeight: 700 }}>
                                    {ticketSuccess}
                                </div>
                            )}

                            <form onSubmit={handleSubmitTicket} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#dde4ff', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    📌 Submit Support Ticket / Proof
                                </div>

                                <div>
                                    <label style={{ fontSize: '0.72rem', color: '#8899cc', display: 'block', marginBottom: 4 }}>Select Problem Category *</label>
                                    <select
                                        value={category}
                                        onChange={e => setCategory(e.target.value)}
                                        style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: '#121722', color: '#fff', fontSize: '0.85rem' }}
                                    >
                                        <option value="Deposit Not Credited">💳 Deposit Not Credited (UTR Problem)</option>
                                        <option value="Withdrawal Not Received">💸 Withdrawal Not Received</option>
                                        <option value="UPI ID Change Request">📱 UPI ID Change Request</option>
                                        <option value="Password / Login Problem">🔒 Password / Account Problem</option>
                                        <option value="Other Query">❓ Other Support Query</option>
                                    </select>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                    <div>
                                        <label style={{ fontSize: '0.72rem', color: '#8899cc', display: 'block', marginBottom: 4 }}>Transaction UTR / Ref ID</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. 328910481239"
                                            value={utr}
                                            onChange={e => setUtr(e.target.value)}
                                            style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '0.82rem' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.72rem', color: '#8899cc', display: 'block', marginBottom: 4 }}>Amount (₹)</label>
                                        <input
                                            type="number"
                                            placeholder="e.g. 500"
                                            value={amount}
                                            onChange={e => setAmount(e.target.value)}
                                            style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '0.82rem' }}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label style={{ fontSize: '0.72rem', color: '#8899cc', display: 'block', marginBottom: 4 }}>Proof Details / Screenshot Reference Link</label>
                                    <input
                                        type="text"
                                        placeholder="Paste UTR screenshot link / proof reference"
                                        value={proof}
                                        onChange={e => setProof(e.target.value)}
                                        style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '0.82rem' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ fontSize: '0.72rem', color: '#8899cc', display: 'block', marginBottom: 4 }}>Problem Description *</label>
                                    <textarea
                                        rows={3}
                                        placeholder="Describe your problem in detail..."
                                        value={ticketMessage}
                                        onChange={e => setTicketMessage(e.target.value)}
                                        required
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '0.85rem', resize: 'none' }}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={ticketSubmitting || !ticketMessage.trim()}
                                    style={{ width: '100%', padding: '11px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#22c55e,#10b981)', color: '#0b130e', fontWeight: 900, fontSize: '0.88rem', cursor: 'pointer' }}
                                >
                                    {ticketSubmitting ? '⏳ Submitting...' : '📩 Submit Ticket to Admin'}
                                </button>
                            </form>

                            {/* User Submitted Tickets List */}
                            <div style={{ marginTop: 8 }}>
                                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#dde4ff', marginBottom: 8 }}>
                                    📋 My Support Tickets ({userTickets.length})
                                </div>
                                {userTickets.length === 0 ? (
                                    <div style={{ textAlign: 'center', color: '#6677aa', fontSize: '0.78rem', padding: '12px 0' }}>
                                        No tickets submitted yet
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
                                        {userTickets.map(t => (
                                            <div key={t.id} style={{ background: 'rgba(15,22,50,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '10px 12px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#a78bfa' }}>{t.category}</span>
                                                    <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: '0.62rem', fontWeight: 800, background: t.status === 'resolved' ? 'rgba(34,197,94,0.15)' : t.status === 'replied' ? 'rgba(96,165,250,0.15)' : 'rgba(251,191,36,0.15)', color: t.status === 'resolved' ? '#4ade80' : t.status === 'replied' ? '#60a5fa' : '#fbbf24' }}>
                                                        {t.status === 'resolved' ? '✅ Resolved' : t.status === 'replied' ? '💬 Replied' : '🕐 Open'}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '0.78rem', color: '#dde4ff', marginBottom: 3 }}>{t.message}</div>
                                                {(t.utr !== '—' || t.amount !== '—') && (
                                                    <div style={{ fontSize: '0.68rem', color: '#6677aa', fontFamily: 'monospace' }}>
                                                        {t.utr !== '—' && `UTR: ${t.utr} `}
                                                        {t.amount !== '—' && `Amount: ₹${t.amount}`}
                                                    </div>
                                                )}
                                                {t.reply && (
                                                    <div style={{ marginTop: 6, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, padding: '6px 10px', fontSize: '0.75rem', color: '#c4b5fd' }}>
                                                        💬 <strong>Admin Reply:</strong> {t.reply}
                                                    </div>
                                                )}
                                                <div style={{ fontSize: '0.62rem', color: '#445577', marginTop: 4 }}>{fmtTime(t.createdAt)}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── LIVE CHAT ── */}
                    {activeTab === 'chat' && (
                        <div className="support-chat-container">
                            <div className="support-chat-messages">
                                {messages.map((m) => (
                                    <div key={m.id} className={`support-msg ${m.sender === 'user' ? 'user' : 'bot'}`}>
                                        {m.sender !== 'user' && (
                                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#22c55e,#10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', flexShrink: 0, marginRight: 6, alignSelf: 'flex-end' }}>🎰</div>
                                        )}
                                        <div>
                                            {m.sender !== 'user' && <div style={{ fontSize: '0.65rem', color: '#6677aa', marginBottom: 3, fontWeight: 600 }}>95 CLUB Admin</div>}
                                            <div className="support-msg-bubble" style={{ whiteSpace: 'pre-line' }}>{m.text}</div>
                                            <div style={{ fontSize: '0.6rem', color: '#6677aa', marginTop: 3, textAlign: m.sender === 'user' ? 'right' : 'left' }}>
                                                {fmtTime(m.createdAt)} {m.sender === 'user' && (m.read ? '✓✓' : '✓')}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div ref={chatEndRef} />
                            </div>
                            <form className="support-chat-input-row" onSubmit={handleSend}>
                                <input
                                    type="text"
                                    placeholder="Type your message..."
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    className="support-input"
                                    disabled={sending}
                                />
                                <button type="submit" className="support-send-btn" disabled={sending || !inputText.trim()}>
                                    {sending ? '...' : '➤'}
                                </button>
                            </form>
                        </div>
                    )}

                    {/* ── CHANNELS ── */}
                    {activeTab === 'contact' && (
                        <div className="support-channels-list">
                            <a href="https://t.me/61clubsupport" target="_blank" rel="noopener noreferrer" className="support-channel-card telegram">
                                <div className="support-channel-icon">✈️</div>
                                <div className="support-channel-info"><h4>Official Telegram Support</h4><p>@61clubsupport • 24/7 Online</p></div>
                                <span className="support-channel-arrow">›</span>
                            </a>
                            <a href="https://wa.me/919876543210?text=Hello%2061%20CLUB%20Support" target="_blank" rel="noopener noreferrer" className="support-channel-card whatsapp">
                                <div className="support-channel-icon">📞</div>
                                <div className="support-channel-info"><h4>WhatsApp Support</h4><p>+91 98765 43210 • Instant Response</p></div>
                                <span className="support-channel-arrow">›</span>
                            </a>
                            <a href="mailto:support@61club.com" className="support-channel-card email">
                                <div className="support-channel-icon">✉️</div>
                                <div className="support-channel-info"><h4>Email Support</h4><p>support@61club.com</p></div>
                                <span className="support-channel-arrow">›</span>
                            </a>
                        </div>
                    )}

                    {/* ── FAQ ── */}
                    {activeTab === 'faq' && (
                        <div className="support-faq-list">
                            {faqs.map((f, i) => (
                                <div key={i} className="support-faq-item">
                                    <h4 className="support-faq-q">Q: {f.q}</h4>
                                    <p className="support-faq-a">{f.a}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SupportModal;
