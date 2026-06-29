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
    
    // Preview states
    const [previewPosts, setPreviewPosts] = React.useState([]);
    const [previewOrder, setPreviewOrder] = React.useState([]);
    const [anchorIdx, setAnchorIdx] = React.useState(-1);
    const [startIdx, setStartIdx] = React.useState(-1); // Oldest boundary index in order array
    const [endIdx, setEndIdx] = React.useState(-1);     // Newest boundary index in order array
    
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
                setChannels(Array.isArray(channelsData) ? channelsData : []);

                // 2. Fetch team users (excluding current user)
                const usersResp = await fetch(`/api/v4/users?in_team=${teamId}&per_page=200`);
                const usersData = await usersResp.json();
                setUsers(Array.isArray(usersData) ? usersData.filter(u => u.id !== currentUserId) : []);

                // 3. Fetch post context and channel posts for preview
                const postResp = await fetch(`/api/v4/posts/${postId}`);
                const postData = await postResp.json();
                const channelId = postData.channel_id;

                const postsResp = await fetch(`/api/v4/channels/${channelId}/posts?page=0&per_page=30`);
                const postsData = await postsResp.json();

                if (postsData && Array.isArray(postsData.order)) {
                    setPreviewPosts(postsData.posts || {});
                    setPreviewOrder(postsData.order);
                    
                    const idx = postsData.order.indexOf(postId);
                    if (idx !== -1) {
                        setAnchorIdx(idx);
                        setStartIdx(idx); // Initially just the clicked post
                        setEndIdx(idx);
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

    // Range controls (index 0 is newest, higher index is older)
    const adjustOlder = (delta) => {
        if (anchorIdx === -1) return;
        setStartIdx(prev => {
            const next = prev + delta;
            return Math.max(anchorIdx, Math.min(next, previewOrder.length - 1));
        });
    };

    const adjustNewer = (delta) => {
        if (anchorIdx === -1) return;
        setEndIdx(prev => {
            const next = prev - delta; // delta is positive, so moving towards newest (index 0) decreases index
            return Math.min(anchorIdx, Math.max(next, 0));
        });
    };

    const handleItemClick = (idx) => {
        if (anchorIdx === -1) return;
        if (idx > anchorIdx) {
            // Clicked an older message
            setStartIdx(idx);
        } else if (idx < anchorIdx) {
            // Clicked a newer message
            setEndIdx(idx);
        } else {
            // Clicked anchor, reset bounds
            setStartIdx(anchorIdx);
            setEndIdx(anchorIdx);
        }
    };

    const getUsername = (userId) => {
        const u = users.find(user => user.id === userId);
        if (u) return u.username;
        const state = store.getState();
        if (state.entities.users.currentUserId === userId) {
            return state.entities.users.profiles[userId]?.username || 'me';
        }
        return 'user_' + userId.slice(0, 4);
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
        
        // Map UI indexes to Go backend logic:
        const num = startIdx - endIdx + 1;
        const skip = endIdx;

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
                    num_messages: num,
                    skip_messages: skip,
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

    // Filter lists by search query
    const filteredChannels = channels.filter(c =>
        (c.display_name && c.display_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.name && c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const filteredUsers = users.filter(u =>
        (u.username && u.username.toLowerCase().includes(searchQuery.toLowerCase())) ||
        ((u.first_name || u.last_name) && `${u.first_name} ${u.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    // Premium styling objects - aligned to the right, darker overlay, no background blur
    const modalOverlayStyle = {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)', // Darker background layer, no blur
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end', // Aligned on the right side
        paddingRight: '30px',
        animation: 'fadeIn 0.2s ease-out'
    };

    const containerStyle = {
        width: '380px', // Compact width
        maxHeight: '90vh',
        backgroundColor: '#1E1E24',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '16px',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        color: '#FFFFFF',
        fontFamily: 'Inter, sans-serif',
        overflow: 'hidden',
    };

    const headerStyle = {
        padding: '14px 18px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    };

    const titleStyle = {
        margin: 0,
        fontSize: '16px',
        fontWeight: '600',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
    };

    const closeButtonStyle = {
        background: 'none',
        border: 'none',
        color: 'rgba(255, 255, 255, 0.4)',
        cursor: 'pointer',
        fontSize: '20px',
        padding: 0,
        lineHeight: 1,
        transition: 'color 0.2s',
    };

    const bodyStyle = {
        padding: '16px',
        overflowY: 'auto',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
    };

    const labelStyle = {
        fontSize: '11px',
        fontWeight: '600',
        textTransform: 'uppercase',
        color: 'rgba(255, 255, 255, 0.5)',
        letterSpacing: '0.5px'
    };

    const searchInputStyle = {
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '10px',
        padding: '10px 14px',
        color: '#FFFFFF',
        fontSize: '13px',
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box'
    };

    const tabsContainerStyle = {
        display: 'flex',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        marginBottom: '10px'
    };

    const getTabStyle = (tabName) => ({
        padding: '10px 16px',
        cursor: 'pointer',
        fontWeight: '600',
        fontSize: '13px',
        borderBottom: activeTab === tabName ? '2px solid #7C3AED' : '2px solid transparent',
        color: activeTab === tabName ? '#FFFFFF' : 'rgba(255, 255, 255, 0.4)',
        transition: 'all 0.2s',
        background: 'none',
        borderLeft: 'none',
        borderRight: 'none',
        borderTop: 'none'
    });

    const listStyle = {
        maxHeight: '160px',
        overflowY: 'auto',
        border: '1px solid rgba(255, 255, 255, 0.04)',
        borderRadius: '10px',
        backgroundColor: 'rgba(255, 255, 255, 0.02)'
    };

    const itemStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 12px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
        cursor: 'pointer',
        transition: 'background-color 0.2s'
    };

    const checkboxStyle = {
        cursor: 'pointer',
        width: '16px',
        height: '16px',
        accentColor: '#7C3AED',
        borderRadius: '4px'
    };

    const itemNameStyle = {
        fontSize: '13px',
        fontWeight: '500'
    };

    // Range preview board styles
    const previewBoardStyle = {
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
    };

    const controlRowStyle = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 12px',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
    };

    const controlRowBottomStyle = {
        ...controlRowStyle,
        borderBottom: 'none',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)'
    };

    const btnGroupStyle = {
        display: 'flex',
        gap: '4px'
    };

    const miniBtnStyle = (colorClass) => ({
        padding: '4px 8px',
        backgroundColor: colorClass === 'plus' ? 'rgba(124, 58, 237, 0.15)' : 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '6px',
        color: colorClass === 'plus' ? '#A78BFA' : '#E5E7EB',
        fontSize: '11px',
        fontWeight: 'bold',
        cursor: 'pointer',
        outline: 'none',
        transition: 'all 0.15s'
    });

    const scrollPreviewStyle = {
        maxHeight: '180px',
        overflowY: 'auto',
        padding: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
    };

    const getPreviewItemStyle = (isSelected, isAnchor) => ({
        padding: '8px 10px',
        borderRadius: '8px',
        border: isAnchor ? '1.5px solid #7C3AED' : isSelected ? '1px solid rgba(124, 58, 237, 0.3)' : '1px solid transparent',
        backgroundColor: isAnchor ? 'rgba(124, 58, 237, 0.22)' : isSelected ? 'rgba(124, 58, 237, 0.1)' : 'transparent',
        opacity: isSelected ? 1 : 0.4,
        transition: 'all 0.2s',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        cursor: 'pointer'
    });

    const previewAuthorStyle = {
        fontSize: '11px',
        fontWeight: '700',
        color: 'rgba(255, 255, 255, 0.7)'
    };

    const previewMsgStyle = {
        fontSize: '12px',
        color: '#FFFFFF',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word'
    };

    const footerStyle = {
        padding: '14px 18px',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '10px',
        backgroundColor: '#16161A'
    };

    const cancelButtonStyle = {
        padding: '10px 16px',
        backgroundColor: 'transparent',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        color: '#FFFFFF',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: '500',
        transition: 'background-color 0.2s'
    };

    const submitButtonStyle = {
        padding: '10px 20px',
        background: 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)',
        border: 'none',
        color: '#FFFFFF',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: '600',
        boxShadow: '0 4px 12px rgba(124, 58, 237, 0.25)',
        transition: 'opacity 0.2s',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
    };

    const alertStyle = (type) => ({
        padding: '10px 14px',
        borderRadius: '8px',
        fontSize: '13px',
        fontWeight: '500',
        backgroundColor: type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
        border: type === 'success' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
        color: type === 'success' ? '#34D399' : '#F87171'
    });

    const renderPreviewPosts = () => {
        if (previewOrder.length === 0) return null;
        const chronoOrder = [...previewOrder].reverse();

        return chronoOrder.map(pid => {
            const post = previewPosts[pid];
            if (!post || post.type !== '') return null;
            
            const idxInOrder = previewOrder.indexOf(pid);
            const isSelected = idxInOrder >= endIdx && idxInOrder <= startIdx;
            const isAnchor = idxInOrder === anchorIdx;

            return (
                <div 
                    key={pid} 
                    style={getPreviewItemStyle(isSelected, isAnchor)}
                    onClick={() => handleItemClick(idxInOrder)}
                >
                    <div style={previewAuthorStyle}>@{getUsername(post.user_id)}</div>
                    <div style={previewMsgStyle}>{post.message || '*[Attachment]*'}</div>
                </div>
            );
        });
    };

    return (
        <div style={modalOverlayStyle} onClick={onClose}>
            <div style={containerStyle} onClick={(e) => e.stopPropagation()}>
                <div style={headerStyle}>
                    <h3 style={titleStyle}>
                        <span>🔄</span> Forward Message(s)
                    </h3>
                    <button style={closeButtonStyle} onClick={onClose} aria-label="Close">
                        &times;
                    </button>
                </div>

                <div style={bodyStyle}>
                    <div style={formGroupStyle}>
                        <label style={labelStyle}>Selected Messages ({startIdx - endIdx + 1})</label>
                        <div style={previewBoardStyle}>
                            <div style={controlRowStyle}>
                                <span style={{fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold'}}>Older Messages (Above)</span>
                                <div style={btnGroupStyle}>
                                    <button style={miniBtnStyle('plus')} onClick={() => adjustOlder(1)}>+1</button>
                                    <button style={miniBtnStyle('plus')} onClick={() => adjustOlder(5)}>+5</button>
                                    <button style={miniBtnStyle('minus')} onClick={() => adjustOlder(-1)} disabled={startIdx <= anchorIdx}>-1</button>
                                    <button style={miniBtnStyle('minus')} onClick={() => adjustOlder(-5)} disabled={startIdx <= anchorIdx}>-5</button>
                                </div>
                            </div>

                            <div style={scrollPreviewStyle}>
                                {renderPreviewPosts()}
                            </div>

                            <div style={controlRowBottomStyle}>
                                <span style={{fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold'}}>Newer Messages (Below)</span>
                                <div style={btnGroupStyle}>
                                    <button style={miniBtnStyle('minus')} onClick={() => adjustNewer(-1)} disabled={endIdx >= anchorIdx}>-1</button>
                                    <button style={miniBtnStyle('minus')} onClick={() => adjustNewer(-5)} disabled={endIdx >= anchorIdx}>-5</button>
                                    <button style={miniBtnStyle('plus')} onClick={() => adjustNewer(1)}>+1</button>
                                    <button style={miniBtnStyle('plus')} onClick={() => adjustNewer(5)}>+5</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <input
                        type="text"
                        placeholder="Search channels or users..."
                        style={searchInputStyle}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />

                    <div>
                        <div style={tabsContainerStyle}>
                            <button style={getTabStyle('channels')} onClick={() => setActiveTab('channels')}>
                                Channels
                            </button>
                            <button style={getTabStyle('users')} onClick={() => setActiveTab('users')}>
                                Users / DMs
                            </button>
                        </div>

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

                    {statusMessage && (
                        <div style={alertStyle(statusMessage.type)}>
                            {statusMessage.text}
                        </div>
                    )}
                </div>

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
