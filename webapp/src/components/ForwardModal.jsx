import React from 'react';

// Helper to retrieve cookie by name
const getCookie = (name) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return '';
};

// CSS Styles that dynamically map class names to Mattermost active theme preferences
const themeStyles = `
    .mm-forwarder-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.65);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .mm-forwarder-modal {
        width: 820px;
        max-height: 90vh;
        background-color: var(--center-channel-bg, #1e1e24);
        color: var(--center-channel-color, #ffffff);
        border: 1px solid var(--center-channel-color-12, rgba(127, 127, 127, 0.15)) !important;
        border-radius: 16px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.3);
        display: flex;
        flex-direction: column;
        font-family: inherit;
        overflow: hidden;
    }
    .mm-forwarder-header {
        padding: 16px 24px;
        border-bottom: 1px solid var(--center-channel-color-08, rgba(127, 127, 127, 0.1)) !important;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .mm-forwarder-header-title {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--center-channel-color, #ffffff);
    }
    .mm-forwarder-close-btn {
        background: transparent;
        border: 0;
        color: var(--center-channel-color, #ffffff);
        opacity: 0.4;
        cursor: pointer;
        font-size: 24px;
        padding: 0;
        line-height: 1;
        transition: opacity 0.2s;
    }
    .mm-forwarder-close-btn:hover {
        opacity: 1;
    }
    .mm-forwarder-body {
        padding: 24px;
        overflow-y: auto;
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 16px;
        min-height: 0;
    }
    .mm-forwarder-grid {
        display: flex;
        gap: 24px;
        height: 520px;
        min-height: 0;
    }
    .mm-forwarder-col-preview {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-height: 0;
    }
    .mm-forwarder-col-controls {
        width: 360px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        min-height: 0;
    }
    .mm-forwarder-preview-box {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        border-radius: 12px;
        padding: 2px 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        background-color: rgba(0, 0, 0, 0.01);
        border: 1px solid var(--center-channel-color-08, rgba(127, 127, 127, 0.1)) !important;
        /* Smooth gradient fade-out at the top and bottom edge (height of ~50px) */
        mask-image: linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 12%, rgba(0,0,0,1) 88%, rgba(0,0,0,0) 100%);
        -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 12%, rgba(0,0,0,1) 88%, rgba(0,0,0,0) 100%);
    }
    .mm-forwarder-preview-item-selected {
        background-color: var(--center-channel-color-04, rgba(127, 127, 127, 0.04));
        border: 1px solid var(--button-bg, #7c3aed) !important;
        border-radius: 8px;
        padding: 10px;
        cursor: pointer;
        transition: all 0.2s;
    }
    .mm-forwarder-preview-item-unselected {
        background-color: var(--center-channel-color-02, rgba(127, 127, 127, 0.02));
        border: 1px solid var(--center-channel-color-08, rgba(127, 127, 127, 0.1)) !important;
        border-radius: 8px;
        padding: 10px;
        cursor: pointer;
        opacity: 0.45;
        transition: all 0.2s;
    }
    .mm-forwarder-preview-item-unselected:hover {
        opacity: 0.85;
        background-color: var(--center-channel-color-04, rgba(127, 127, 127, 0.04));
    }
    .mm-forwarder-fullname {
        font-weight: 700;
        color: var(--button-bg, #7c3aed);
    }
    .mm-forwarder-subtext {
        font-size: 10px;
        color: var(--center-channel-color, #ffffff);
        opacity: 0.45;
    }
    .mm-forwarder-label {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--center-channel-color, #ffffff);
        opacity: 0.55;
    }
    .mm-forwarder-btn-primary {
        padding: 10px 24px;
        background: var(--button-bg, #7c3aed) !important;
        color: var(--button-color, #ffffff) !important;
        border: 0;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        transition: opacity 0.2s;
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .mm-forwarder-btn-primary:hover {
        opacity: 0.9;
    }
    .mm-forwarder-btn-primary:disabled {
        opacity: 0.3 !important;
        cursor: not-allowed;
    }
    .mm-forwarder-btn-secondary {
        background-color: var(--center-channel-color-04, rgba(127, 127, 127, 0.04));
        border: 1px solid var(--center-channel-color-12, rgba(127, 127, 127, 0.15)) !important;
        color: var(--center-channel-color, #ffffff) !important;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 28px;
        border-radius: 6px;
        cursor: pointer;
        transition: background-color 0.2s;
    }
    .mm-forwarder-btn-secondary:hover:not(:disabled) {
        background-color: var(--center-channel-color-08, rgba(127, 127, 127, 0.08)) !important;
    }
    .mm-forwarder-btn-secondary:disabled {
        opacity: 0.3 !important;
        cursor: not-allowed;
    }
    .mm-forwarder-input {
        width: 100%;
        background-color: var(--center-channel-color-04, rgba(127, 127, 127, 0.04)) !important;
        border: 1px solid var(--center-channel-color-12, rgba(127, 127, 127, 0.15)) !important;
        color: var(--center-channel-color, #ffffff) !important;
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 14px;
        box-sizing: border-box;
        transition: border-color 0.2s;
    }
    .mm-forwarder-input:focus {
        border-color: var(--button-bg, #7c3aed) !important;
        outline: none;
    }
    .mm-forwarder-divider {
        width: 1px;
        background-color: var(--center-channel-color-12, rgba(127, 127, 127, 0.15));
        align-self: stretch;
    }
    .mm-forwarder-list-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 16px;
        border-bottom: 1px solid var(--center-channel-color-04, rgba(127, 127, 127, 0.04));
        cursor: pointer;
        transition: background-color 0.2s;
    }
    .mm-forwarder-list-item:hover {
        background-color: var(--center-channel-color-08, rgba(127, 127, 127, 0.08));
    }
    .mm-forwarder-list-container {
        height: 390px; /* Lock height so list size is fixed, never pushes layout */
        overflow-y: auto;
        border: 1px solid var(--center-channel-color-08, rgba(127, 127, 127, 0.1));
        background-color: var(--center-channel-color-02, rgba(127, 127, 127, 0.02));
        border-radius: 12px;
        min-height: 0;
    }
    .mm-forwarder-header-tabs {
        display: flex;
        border-bottom: 1px solid var(--center-channel-color-08, rgba(127, 127, 127, 0.1)) !important;
        margin-bottom: 8px;
    }
    .mm-forwarder-tab-active {
        padding: 8px 16px;
        background: transparent;
        border-top: 0;
        border-left: 0;
        border-right: 0;
        border-bottom: 2px solid var(--button-bg, #7c3aed) !important;
        color: var(--center-channel-color, #ffffff) !important;
        font-weight: 600;
        font-size: 13px;
        cursor: pointer;
    }
    .mm-forwarder-tab-inactive {
        padding: 8px 16px;
        background: transparent;
        border-top: 0;
        border-left: 0;
        border-right: 0;
        border-bottom: 2px solid transparent !important;
        color: var(--center-channel-color, #ffffff) !important;
        opacity: 0.45;
        font-weight: 600;
        font-size: 13px;
        cursor: pointer;
        transition: opacity 0.2s;
    }
    .mm-forwarder-tab-inactive:hover {
        opacity: 1;
    }
    .mm-forwarder-checkbox {
        cursor: pointer;
        width: 16px;
        height: 16px;
        accent-color: var(--button-bg, #7c3aed);
    }
    .mm-forwarder-footer {
        padding: 16px 24px;
        border-top: 1px solid var(--center-channel-color-08, rgba(127, 127, 127, 0.1)) !important;
        background-color: rgba(0, 0, 0, 0.01);
        display: flex;
        justify-content: flex-end;
        gap: 12px;
    }
    .mm-forwarder-cancel-btn {
        padding: 10px 20px;
        background: transparent;
        border: 1px solid var(--center-channel-color-12, rgba(127, 127, 127, 0.15)) !important;
        color: var(--center-channel-color, #ffffff) !important;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: background-color 0.2s;
    }
    .mm-forwarder-cancel-btn:hover:not(:disabled) {
        background-color: var(--center-channel-color-08, rgba(127, 127, 127, 0.08));
    }
    .mm-forwarder-alert {
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 500;
        border: 1px solid;
    }
    .mm-forwarder-alert-success {
        background-color: rgba(16, 185, 129, 0.1);
        border-color: rgba(16, 185, 129, 0.2);
        color: #34d399;
    }
    .mm-forwarder-alert-error {
        background-color: rgba(239, 68, 68, 0.1);
        border-color: rgba(239, 68, 68, 0.2);
        color: #f87171;
    }
`;

const ForwardModal = ({ postId, store, onClose }) => {
    const [channels, setChannels] = React.useState([]);
    const [users, setUsers] = React.useState([]);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [activeTab, setActiveTab] = React.useState('channels'); // 'channels' or 'users'
    const [selectedChannels, setSelectedChannels] = React.useState({});
    const [selectedUsers, setSelectedUsers] = React.useState({});
    
    // Toggle state: Map of postID -> boolean (trigger postId is checked by default)
    const [selectedPosts, setSelectedPosts] = React.useState({ [postId]: true });
    const [lastClickedId, setLastClickedId] = React.useState(postId);

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

    const togglePostSelection = (id) => {
        setSelectedPosts(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
        setLastClickedId(id);
    };

    // Auto-scroll logic: centers on postId on load, and scrolls lastClickedId into view upon list expansion
    React.useEffect(() => {
        if (lastClickedId) {
            setTimeout(() => {
                const el = document.getElementById(`post-card-${lastClickedId}`);
                if (el) {
                    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }
            }, 100);
        }
    }, [lastClickedId]);

    const handleForward = async () => {
        const finalChannels = Object.keys(selectedChannels).filter(id => selectedChannels[id]);
        const finalUsers = Object.keys(selectedUsers).filter(id => selectedUsers[id]);

        if (finalChannels.length === 0 && finalUsers.length === 0) {
            setStatusMessage({ type: 'error', text: 'Please select at least one destination.' });
            return;
        }

        const selectedIds = Object.keys(selectedPosts).filter(id => selectedPosts[id]);
        if (selectedIds.length === 0) {
            setStatusMessage({ type: 'error', text: 'Please select at least one message to forward.' });
            return;
        }

        // Sort selectedIds in chronological order (oldest first).
        // Since previewOrder is newest to oldest, we sort based on b's index - a's index in previewOrder.
        selectedIds.sort((a, b) => {
            const idxA = previewOrder.indexOf(a);
            const idxB = previewOrder.indexOf(b);
            return idxB - idxA;
        });

        setLoading(true);
        setStatusMessage(null);
        const csrfToken = getCookie('MMCSRF');

        try {
            const resp = await fetch('/plugins/com.rivestudy.message-forwarder/forward', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    post_ids: selectedIds,
                    destination_channels: finalChannels,
                    destination_users: finalUsers
                })
            });

            if (resp.ok) {
                setStatusMessage({ type: 'success', text: 'Messages forwarded successfully! Redirecting...' });
                
                // Redirect to target destination client-side
                try {
                    const state = store.getState();
                    const teamId = state.entities.teams.currentTeamId;
                    const currentTeam = state.entities.teams.teams[teamId];
                    const teamName = currentTeam ? currentTeam.name : '';
                    
                    if (window.browserHistory && teamName) {
                        if (finalChannels.length > 0) {
                            const firstChanId = finalChannels[0];
                            const targetChannel = channels.find(c => c.id === firstChanId);
                            if (targetChannel) {
                                window.browserHistory.push(`/${teamName}/channels/${targetChannel.name}`);
                            }
                        } else if (finalUsers.length > 0) {
                            const firstUserId = finalUsers[0];
                            const targetUser = users.find(u => u.id === firstUserId);
                            if (targetUser) {
                                window.browserHistory.push(`/${teamName}/messages/@${targetUser.username}`);
                            }
                        }
                    }
                } catch (navErr) {
                    console.error("Navigation error:", navErr);
                }

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

    const getUserDisplayName = (postUserId) => {
        const u = users.find(user => user.id === postUserId);
        const state = store.getState();
        const currentUserId = state.entities.users.currentUserId;
        
        let fullName = '';
        let username = '';
        
        if (u) {
            fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim();
            username = `@${u.username}`;
        } else if (currentUserId === postUserId) {
            const profile = state.entities.users?.profiles?.[postUserId];
            if (profile) {
                fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
                username = `@${profile.username}`;
            } else {
                username = '@me';
            }
        }
        
        return {
            fullName: fullName || username || ('user_' + (postUserId ? postUserId.slice(0, 4) : 'unknown')),
            username: fullName ? username : ''
        };
    };

    // Extract image file IDs if post contains image attachments
    const getImageFileIds = (post) => {
        if (!post || !post.file_ids || post.file_ids.length === 0) return [];
        if (post.metadata && post.metadata.file_infos) {
            return post.metadata.file_infos
                .filter(info => info.mime_type && info.mime_type.startsWith('image/'))
                .map(info => info.id);
        }
        return post.file_ids; // Fallback: try rendering all attachments
    };

    // Selected count
    const selectedCount = Object.keys(selectedPosts).filter(id => selectedPosts[id]).length;

    // Filter the preview box messages dynamically centered on the current selection bounds.
    // Ensure there are always at least 5 messages visible above the oldest selection
    // and 5 messages visible below the newest selection.
    const selectedIds = Object.keys(selectedPosts).filter(id => selectedPosts[id]);
    const selectedIndices = selectedIds
        .map(id => previewOrder.indexOf(id))
        .filter(idx => idx !== -1);

    let startIdx = 0;
    let endIdx = previewOrder.length;

    if (selectedIndices.length > 0) {
        const minSelectedIdx = Math.min(...selectedIndices);
        const maxSelectedIdx = Math.max(...selectedIndices);
        
        startIdx = Math.max(0, minSelectedIdx - 3);
        // +4 to include maxSelectedIdx + 3 in slice (exclusive boundary)
        endIdx = Math.min(previewOrder.length, maxSelectedIdx + 4);
    } else {
        // Fallback if nothing is selected (defaults around target postId)
        const idx = previewOrder.indexOf(postId);
        if (idx !== -1) {
            startIdx = Math.max(0, idx - 3);
            endIdx = Math.min(previewOrder.length, idx + 4);
        }
    }

    // Render loaded posts chronologically (oldest first at top, newest at bottom)
    const postsToRender = [...previewOrder.slice(startIdx, endIdx)].reverse();

    return (
        <div className="mm-forwarder-overlay" onClick={onClose}>
            <style dangerouslySetInnerHTML={{ __html: themeStyles }} />
            <div className="mm-forwarder-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="mm-forwarder-header">
                    <h3 className="mm-forwarder-header-title">
                        <span>🔄</span> Forward Message(s)
                    </h3>
                    <button className="mm-forwarder-close-btn" onClick={onClose} aria-label="Close">
                        &times;
                    </button>
                </div>

                {/* Body */}
                <div className="mm-forwarder-body">
                    <div className="mm-forwarder-grid" style={{ display: 'flex', gap: '24px', height: '460px', minHeight: 0 }}>
                        
                        {/* Left Side: Message Preview (Longer preview, click card to toggle) */}
                        <div className="mm-forwarder-col-preview" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
                            <label className="mm-forwarder-label">
                                Select Messages to Forward ({selectedCount} selected)
                            </label>
                            
                            {/* Preview Box */}
                            <div className="mm-forwarder-preview-box">
                                {postsToRender.length === 0 ? (
                                    <div className="text-center py-8 mm-forwarder-subtext" style={{ fontSize: '13px' }}>
                                        Loading messages...
                                    </div>
                                ) : (
                                    postsToRender.map(pid => {
                                        const post = previewPosts[pid];
                                        if (!post) return null;
                                        const { fullName, username } = getUserDisplayName(post.user_id);
                                        const timeString = new Date(post.create_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                        const isSelected = !!selectedPosts[pid];
                                        const imageFileIds = getImageFileIds(post);

                                        return (
                                            <div 
                                                key={pid} 
                                                id={`post-card-${pid}`}
                                                className={isSelected ? 'mm-forwarder-preview-item-selected' : 'mm-forwarder-preview-item-unselected'}
                                                onClick={() => togglePostSelection(pid)}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                                    <input
                                                        type="checkbox"
                                                        className="mm-forwarder-checkbox"
                                                        checked={isSelected}
                                                        onChange={() => {}} // handled by card onClick
                                                        style={{ marginTop: '2px' }}
                                                    />
                                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <span className="mm-forwarder-fullname" style={isSelected ? {} : { color: 'var(--center-channel-color, #ffffff)' }}>{fullName}</span>
                                                                {username && <span className="mm-forwarder-subtext">{username}</span>}
                                                            </div>
                                                            <span className="mm-forwarder-subtext">{timeString}</span>
                                                        </div>
                                                        <div style={{ fontSize: '12px', lineHeight: '1.4', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                                            {post.message || (post.file_ids && post.file_ids.length > 0 ? '' : '*[Empty Message]*')}
                                                        </div>
                                                        
                                                        {/* Image Previews */}
                                                        {imageFileIds.length > 0 && (
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }} onClick={(e) => e.stopPropagation()}>
                                                                {imageFileIds.map(fid => (
                                                                    <img
                                                                        key={fid}
                                                                        src={`/api/v4/files/${fid}/thumbnail`}
                                                                        alt="Attachment Preview"
                                                                        style={{
                                                                            maxWidth: '100%',
                                                                            maxHeight: '100px',
                                                                            borderRadius: '6px',
                                                                            objectFit: 'contain',
                                                                            border: '1px solid rgba(255, 255, 255, 0.08)'
                                                                        }}
                                                                    />
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Vertical Divider */}
                        <div className="mm-forwarder-divider"></div>

                        {/* Right Side: Destinations Selector */}
                        <div className="mm-forwarder-col-controls" style={{ width: '360px', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0 }}>
                            <label className="mm-forwarder-label">
                                Forward Destinations
                            </label>
                            
                            <input
                                type="text"
                                placeholder="Search channels or users..."
                                className="mm-forwarder-input"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />

                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                                <div className="mm-forwarder-header-tabs" style={{ display: 'flex' }}>
                                    <button 
                                        className={activeTab === 'channels' ? 'mm-forwarder-tab-active' : 'mm-forwarder-tab-inactive'}
                                        onClick={() => setActiveTab('channels')}
                                    >
                                        Channels
                                    </button>
                                    <button 
                                        className={activeTab === 'users' ? 'mm-forwarder-tab-active' : 'mm-forwarder-tab-inactive'}
                                        onClick={() => setActiveTab('users')}
                                    >
                                        Users / DMs
                                    </button>
                                </div>

                                {/* Scrollable list with locked height to prevent screen overflow */}
                                <div className="mm-forwarder-list-container">
                                    {activeTab === 'channels' ? (
                                        filteredChannels.length === 0 ? (
                                            <div className="text-center py-8 mm-forwarder-subtext" style={{ fontSize: '12px' }}>
                                                No channels found
                                            </div>
                                        ) : (
                                            filteredChannels.map(c => (
                                                <div key={c.id} className="mm-forwarder-list-item" onClick={() => handleCheckboxChange(c.id, 'channel')}>
                                                    <input
                                                        type="checkbox"
                                                        className="mm-forwarder-checkbox"
                                                        checked={!!selectedChannels[c.id]}
                                                        onChange={() => {}}
                                                    />
                                                    <span style={{ fontSize: '13px', fontWeight: '500' }}>~{c.display_name || c.name}</span>
                                                </div>
                                            ))
                                        )
                                    ) : (
                                        filteredUsers.length === 0 ? (
                                            <div className="text-center py-8 mm-forwarder-subtext" style={{ fontSize: '12px' }}>
                                                No users found
                                            </div>
                                        ) : (
                                            filteredUsers.map(u => (
                                                <div key={u.id} className="mm-forwarder-list-item" onClick={() => handleCheckboxChange(u.id, 'user')}>
                                                    <input
                                                        type="checkbox"
                                                        className="mm-forwarder-checkbox"
                                                        checked={!!selectedUsers[u.id]}
                                                        onChange={() => {}}
                                                    />
                                                    <span style={{ fontSize: '13px', fontWeight: '500' }}>@{u.username} ({u.first_name} {u.last_name})</span>
                                                </div>
                                            ))
                                        )
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Alert Message */}
                    {statusMessage && (
                        <div className={`mm-forwarder-alert ${statusMessage.type === 'success' ? 'mm-forwarder-alert-success' : 'mm-forwarder-alert-error'}`}>
                            {statusMessage.text}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="mm-forwarder-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button className="mm-forwarder-cancel-btn" onClick={onClose} disabled={loading}>
                        Cancel
                    </button>
                    <button className="mm-forwarder-btn-primary" onClick={handleForward} disabled={loading}>
                        {loading ? 'Forwarding...' : 'Forward'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ForwardModal;
