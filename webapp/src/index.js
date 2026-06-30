import React from 'react';
import ForwardModal from './components/ForwardModal';

class Plugin {
    initialize(registry, store) {
        let openModalFn = () => {};

        // Register the action on post's hover options menu
        registry.registerPostDropdownMenuAction(
            '📎 Forward Message(s)',
            (postId) => {
                if (openModalFn) {
                    openModalFn(postId);
                }
            }
        );

        // Root component wrapper that responds to menu trigger
        const ConnectedForwardModal = () => {
            const [state, setState] = React.useState({ show: false, postId: '' });

            React.useEffect(() => {
                openModalFn = (postId) => {
                    setState({ show: true, postId });
                };
                return () => {
                    openModalFn = null;
                };
            }, []);

            if (!state.show) {
                return null;
            }

            return (
                <ForwardModal
                    postId={state.postId}
                    store={store}
                    onClose={() => setState({ show: false, postId: '' })}
                />
            );
        };

        registry.registerRootComponent(ConnectedForwardModal);
    }
}

window.registerPlugin('com.rivestudy.message-forwarder', new Plugin());
