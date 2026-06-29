import React from 'react';

// Helper to retrieve cookie by name
const getCookie = (name) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return '';
};

const ForwardModal = ({ postId, store, onClose }) => {
    const [channels, setChannels] = React.useState([]);
    const [users, setUsers] = React.useState([]);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [activeTab, setActiveTab] = React.useState('channels'); // 'channels' or 'users'
    const [selectedChannels, setSelectedChannels] = React.useState({});
    const [selectedUsers, setSelectedUsers] = React.useState({});
    
    const [numMessages, setNumMessages] = React.useState(1);
    const [skipMessages, setSkipMessages] = React.useState(0);

    // Live preview states
    const [previewPosts, setPreviewPosts] = React.useState({});
    const [previewOrder, setPreviewOrder] = React.useState([]);
    const [loading, setLoading] = React.useState(false);
    const [statusMessage, setStatusMessage] = React.useState(null);

    React.useEffect(() => {
        const loadData = async () => {
            try {
                const state = store.getState();
                const teamId = state.entities.teams.currentTeamId;
                const currentUserId = state.entities.users.currentUserId;

                // 1. Fetch joined channels
                const channelsResp = await fetch(`/api/v4/users/me/teams/${teamId}/channels`);
                const channelsData = await channelsResp.json();

                // 2. Fetch team users (excluding current user)
                const usersResp = await fetch(`/api/v4/users?in_team=${teamId}&per_page=200`);
                const usersData = await usersResp.json();

                setChannels(Array.isArray(channelsData) ? channelsData : []);
                setUsers(Array.isArray(usersData) ? usersData.filter(u => u.id !== currentUserId) : []);

                // 3. Fetch channel posts for the preview
                const postResp = await fetch(`/api/v4/posts/${postId}`);
                const postData = await postResp.json();
                const channelId = postData.channel_id;

                const postsResp = await fetch(`/api/v4/channels/${channelId}/posts?page=0&per_page=30`);
                const postsData = await postsResp.json();

                if (postsData && Array.isArray(postsData.order)) {
                    setPreviewPosts(postsData.posts || {});
                    setPreviewOrder(postsData.order);
                    
                    // Align skip index to the selected post position if possible
                    const idx = postsData.order.indexOf(postId);
                    if (idx !== -1) {
                        setSkipMessages(idx);
                    }
                }
            } catch (err) {
                console.error("Failed to load targets or preview:", err);
            }
        };
        loadData();
    }, [postId, store]);

    const handleCheckboxChange = (id, type) => {
        if (type === 'channel') {
            setSelectedChannels(prev => ({
                ...prev,
                [id]: !prev[id]
            }));
        } else {
            setSelectedUsers(prev => ({
                ...prev,
                [id]: !prev[id]
            }));
        }
    };

    const handleForward = async () => {
        const finalChannels = Object.keys(selectedChannels).filter(id => selectedChannels[id]);
        const finalUsers = Object.keys(selectedUsers).filter(id => selectedUsers[id]);

        if (finalChannels.length === 0 && finalUsers.length === 0) {
            setStatusMessage({ type: 'error', text: 'Please select at least one destination.' });
            return;
        }

        setLoading(true);
        setStatusMessage(null);

        const csrfToken = getCookie('MMCSRF');

        try {
            const resp = await fetch('/plugins/com.exakarya.message-forwarder/forward', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    post_id: postId,
                    num_messages: parseInt(numMessages, 10),
                    skip_messages: parseInt(skipMessages, 10),
                    destination_channels: finalChannels,
                    destination_users: finalUsers
                })
            });

            if (resp.ok) {
                setStatusMessage({ type: 'success', text: 'Messages forwarded successfully!' });
                setTimeout(() => {
                    onClose();
                }, 1500);
            } else {
                const txt = await resp.text();
                setStatusMessage({ type: 'error', text: `Forwarding failed: ${txt || resp.statusText}` });
            }
        } catch (err) {
            setStatusMessage({ type: 'error', text: `Network error: ${err.message}` });
        } finally {
            setLoading(false);
        }
    };

    // Filter lists by search query & ONLY keep Public/Private channels (ignoring DM/GM hashes)
    const filteredChannels = channels.filter(c =>
        (c.type === 'O' || c.type === 'P') &&
        ((c.display_name && c.display_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
         (c.name && c.name.toLowerCase().includes(searchQuery.toLowerCase())))
    );

    const filteredUsers = users.filter(u =>
        (u.username && u.username.toLowerCase().includes(searchQuery.toLowerCase())) ||
        ((u.first_name || u.last_name) && `${u.first_name} ${u.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const getUsername = (userId) => {
        const u = users.find(user => user.id === userId);
        if (u) return u.username;
        const state = store.getState();
        if (state.entities.users.currentUserId === userId) {
            return state.entities.users.profiles[userId]?.username || 'me';
        }
        return 'user_' + userId.slice(0, 4);
    };

    // Get the slice of posts that will be forwarded
    const num = parseInt(numMessages, 10) || 1;
    const skip = parseInt(skipMessages, 10) || 0;
    const selectedSlice = previewOrder.slice(skip, skip + num);

    // Centered modal styling objects with blur backdrop
    const modalOverlayStyle = {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeIn 0.25s ease-out'
    };

    const containerStyle = {
        width: '520px',
        maxHeight: '90vh',
        backgroundColor: '#1E1E24',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '20px',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
        display: 'flex',
        flexDirection: 'column',
        color: '#FFFFFF',
        fontFamily: 'Inter, sans-serif',
        overflow: 'hidden',
    };

    const headerStyle = {
        padding: '18px 24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    };

    const titleStyle = {
        margin: 0,
        fontSize: '18px',
        fontWeight: '600',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    };

    const closeButtonStyle = {
        background: 'none',
        border: 'none',
        color: 'rgba(255, 255, 255, 0.4)',
        cursor: 'pointer',
        fontSize: '22px',
        padding: 0,
        lineHeight: 1,
        transition: 'color 0.2s',
    };

    const bodyStyle = {
        padding: '24px',
        overflowY: 'auto',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
    };

    const rowStyle = {
        display: 'flex',
        gap: '16px'
    };

    const formGroupStyle = {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
    };

    const labelStyle = {
        fontSize: '12px',
        fontWeight: '600',
        textTransform: 'uppercase',
        color: 'rgba(255, 255, 255, 0.5)',
        letterSpacing: '0.5px'
    };

    const inputNumberStyle = {
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        padding: '10px 12px',
        color: '#FFFFFF',
        fontSize: '14px',
        outline: 'none',
        transition: 'border-color 0.2s',
        width: '100%',
        boxSizing: 'border-box'
    };

    const searchInputStyle = {
        ...inputNumberStyle,
        padding: '12px 16px',
        borderRadius: '12px'
    };

    const tabsContainerStyle = {
        display: 'flex',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        marginBottom: '10px'
    };

    const getTabStyle = (tabName) => ({
        padding: '12px 20px',
        cursor: 'pointer',
        fontWeight: '600',
        fontSize: '14px',
        borderBottom: activeTab === tabName ? '2px solid #7C3AED' : '2px solid transparent',
        color: activeTab === tabName ? '#FFFFFF' : 'rgba(255, 255, 255, 0.4)',
        transition: 'all 0.2s',
        background: 'none',
        borderLeft: 'none',
        borderRight: 'none',
        borderTop: 'none'
    });

    const listStyle = {
        maxHeight: '150px',
        overflowY: 'auto',
        border: '1px solid rgba(255, 255, 255, 0.04)',
        borderRadius: '12px',
        backgroundColor: 'rgba(255, 255, 255, 0.02)'
    };

    const itemStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 16px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
        cursor: 'pointer',
        transition: 'background-color 0.2s'
    };

    const checkboxStyle = {
        cursor: 'pointer',
        width: '18px',
        height: '18px',
        accentColor: '#7C3AED',
        borderRadius: '4px'
    };

    const itemNameStyle = {
        fontSize: '14px',
        fontWeight: '500'
    };

    // Live preview styling
    const previewContainerStyle = {
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        padding: '10px',
        maxHeight: '160px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
    };

    const previewItemStyle = {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        borderRadius: '8px',
        padding: '8px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px'
    };

    const previewAuthorStyle = {
        fontSize: '11px',
        fontWeight: '700',
        color: '#A78BFA'
    };

    const previewMsgStyle = {
        fontSize: '13px',
        color: '#E5E7EB',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word'
    };

    const footerStyle = {
        padding: '20px 24px',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '12px',
        backgroundColor: '#16161A'
    };

    const cancelButtonStyle = {
        padding: '12px 20px',
        backgroundColor: 'transparent',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        color: '#FFFFFF',
        borderRadius: '10px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '500',
        transition: 'background-color 0.2s'
    };

    const submitButtonStyle = {
        padding: '12px 24px',
        background: 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)',
        border: 'none',
        color: '#FFFFFF',
        borderRadius: '10px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '600',
        boxShadow: '0 4px 12px rgba(124, 58, 237, 0.25)',
        transition: 'opacity 0.2s',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    };

    const alertStyle = (type) => ({
        padding: '12px 16px',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: '500',
        backgroundColor: type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
        border: type === 'success' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
        color: type === 'success' ? '#34D399' : '#F87171'
    });

    return (
        <div style={modalOverlayStyle} onClick={onClose}>
            <div style={containerStyle} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div style={headerStyle}>
                    <h3 style={titleStyle}>
                        <span>🔄</span> Forward Message(s)
                    </h3>
                    <button style={closeButtonStyle} onClick={onClose} aria-label="Close">
                        &times;
                    </button>
                </div>

                {/* Body */}
                <div style={bodyStyle}>
                    {/* Range config */}
                    <div style={rowStyle}>
                        <div style={formGroupStyle}>
                            <label style={labelStyle}>Messages to Forward</label>
                            <input
                                type="number"
                                min="1"
                                max="50"
                                style={inputNumberStyle}
                                value={numMessages}
                                onChange={(e) => setNumMessages(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            />
                        </div>
                        <div style={formGroupStyle}>
                            <label style={labelStyle}>Newest to Skip</label>
                            <input
                                type="number"
                                min="0"
                                style={inputNumberStyle}
                                value={skipMessages}
                                onChange={(e) => setSkipMessages(Math.max(0, parseInt(e.target.value, 10) || 0))}
                            />
                        </div>
                    </div>

                    {/* Messages Selection Preview */}
                    {selectedSlice.length > 0 && (
                        <div style={formGroupStyle}>
                            <label style={labelStyle}>Selected Messages Preview ({selectedSlice.length})</label>
                            <div style={previewContainerStyle}>
                                {selectedSlice.map(pid => {
                                    const post = previewPosts[pid];
                                    if (!post) return null;
                                    return (
                                        <div key={pid} style={previewItemStyle}>
                                            <div style={previewAuthorStyle}>@{getUsername(post.user_id)}</div>
                                            <div style={previewMsgStyle}>{post.message || '*[File Attachment / Image]*'}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Search */}
                    <input
                        type="text"
                        placeholder="Search channels or users..."
                        style={searchInputStyle}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />

                    {/* Tabs */}
                    <div>
                        <div style={tabsContainerStyle}>
                            <button style={getTabStyle('channels')} onClick={() => setActiveTab('channels')}>
                                Channels
                            </button>
                            <button style={getTabStyle('users')} onClick={() => setActiveTab('users')}>
                                Users / DMs
                            </button>
                        </div>

                        {/* List */}
                        <div style={listStyle}>
                            {activeTab === 'channels' ? (
                                filteredChannels.length === 0 ? (
                                    <div style={{ padding: '16px', color: 'rgba(255,255,255,0.3)', fontSize: '14px', textAlign: 'center' }}>
                                        No channels found
                                    </div>
                                ) : (
                                    filteredChannels.map(c => (
                                        <div key={c.id} style={itemStyle} onClick={() => handleCheckboxChange(c.id, 'channel')}>
                                            <input
                                                type="checkbox"
                                                style={checkboxStyle}
                                                checked={!!selectedChannels[c.id]}
                                                onChange={() => {}}
                                            />
                                            <span style={itemNameStyle}>~{c.display_name || c.name}</span>
                                        </div>
                                    ))
                                )
                            ) : (
                                filteredUsers.length === 0 ? (
                                    <div style={{ padding: '16px', color: 'rgba(255,255,255,0.3)', fontSize: '14px', textAlign: 'center' }}>
                                        No users found
                                    </div>
                                ) : (
                                    filteredUsers.map(u => (
                                        <div key={u.id} style={itemStyle} onClick={() => handleCheckboxChange(u.id, 'user')}>
                                            <input
                                                type="checkbox"
                                                style={checkboxStyle}
                                                checked={!!selectedUsers[u.id]}
                                                onChange={() => {}}
                                            />
                                            <span style={itemNameStyle}>@{u.username} ({u.first_name} {u.last_name})</span>
                                        </div>
                                    ))
                                )
                            )}
                        </div>
                    </div>

                    {/* Alert Message */}
                    {statusMessage && (
                        <div style={alertStyle(statusMessage.type)}>
                            {statusMessage.text}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={footerStyle}>
                    <button style={cancelButtonStyle} onClick={onClose} disabled={loading}>
                        Cancel
                    </button>
                    <button style={submitButtonStyle} onClick={handleForward} disabled={loading}>
                        {loading ? 'Forwarding...' : 'Forward'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ForwardModal;
