import React from 'react';
import ReactDOM from 'react-dom';
import ForwardModal from '../src/components/ForwardModal';

// Intercept window.fetch to mock Mattermost server endpoints
const originalFetch = window.fetch;
window.fetch = async (url, options) => {
    console.log('Mock Fetch Request:', url, options);
    
    if (url.includes('/api/v4/users/me/teams/')) {
        // Return list of channels
        return new Response(JSON.stringify([
            { id: 'chan-1', name: 'town-square', display_name: 'Town Square', type: 'O' },
            { id: 'chan-2', name: 'off-topic', display_name: 'Off-Topic', type: 'O' },
            { id: 'chan-3', name: 'private-group', display_name: 'Security Secrets', type: 'P' },
            { id: 'chan-4', name: 'direct-user', display_name: 'direct-user', type: 'D' }, // ignore DM hash
        ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    
    if (url.includes('/api/v4/users?')) {
        // Return team users
        return new Response(JSON.stringify([
            { id: 'user-1', username: 'alice', first_name: 'Alice', last_name: 'Smith' },
            { id: 'user-2', username: 'bob', first_name: 'Bob', last_name: 'Jones' },
            { id: 'user-3', username: 'charlie', first_name: 'Charlie', last_name: 'Brown' },
            { id: 'user-4', username: 'me-id', first_name: 'Current', last_name: 'User' },
        ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (url.includes('/api/v4/posts/')) {
        // Return the source post
        return new Response(JSON.stringify({
            id: 'post-target',
            channel_id: 'chan-1',
            message: 'Hello, this is the trigger post!',
            user_id: 'user-1',
            create_at: Date.now() - 1000 * 60 * 10
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (url.includes('/posts?page=0&per_page=30')) {
        // Return a mock order and posts map
        const order = [
            'post-newest',
            'post-2',
            'post-target',
            'post-3',
            'post-oldest'
        ];
        const posts = {
            'post-newest': { id: 'post-newest', message: 'Just joined the channel! Any updates?', user_id: 'user-3', create_at: Date.now() },
            'post-2': { id: 'post-2', message: 'Yes, check the trigger post below.', user_id: 'user-2', create_at: Date.now() - 1000 * 60 * 5 },
            'post-target': { id: 'post-target', message: 'Hello, this is the trigger post! Check out this image: 🌄', user_id: 'user-1', create_at: Date.now() - 1000 * 60 * 10 },
            'post-3': { id: 'post-3', message: 'Can you forward this to the team?', user_id: 'user-2', create_at: Date.now() - 1000 * 60 * 15 },
            'post-oldest': { id: 'post-oldest', message: 'Meeting starts at 10 AM.', user_id: 'user-3', create_at: Date.now() - 1000 * 60 * 20 }
        };
        return new Response(JSON.stringify({ order, posts }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (url.includes('/forward')) {
        try {
            const body = JSON.parse(options.body);
            console.log('Forward payload received:', body);
        } catch(e) {}
        
        return new Response(JSON.stringify({ status: 'OK' }), { status: 200 });
    }

    return originalFetch(url, options);
};

const mockStore = {
    getState: () => ({
        entities: {
            teams: { currentTeamId: 'mock-team-id' },
            users: {
                currentUserId: 'me-id',
                profiles: { 'me-id': { username: 'current_user' } }
            }
        }
    })
};

const SandboxApp = () => {
    const [isOpen, setIsOpen] = React.useState(true);
    
    if (!isOpen) {
        return (
            <div className="flex flex-col items-center gap-4 text-center">
                <p className="text-white/60 text-lg">ForwardModal has been closed.</p>
                <button 
                    onClick={() => setIsOpen(true)}
                    className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors cursor-pointer border-0 font-medium shadow-lg shadow-violet-600/10"
                >
                    Reopen Modal
                </button>
            </div>
        );
    }
    
    return (
        <ForwardModal 
            postId="post-target" 
            store={mockStore} 
            onClose={() => setIsOpen(false)} 
        />
    );
};

ReactDOM.render(<SandboxApp />, document.getElementById('root'));
