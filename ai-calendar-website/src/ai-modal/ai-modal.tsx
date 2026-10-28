import { X } from 'lucide-react';
import { useState } from 'react';
import './ai-modal.css';
import AI_Email_Scanner from '../components/ai-email-scanner';

function AI_assistant() {
    const [showPanel, setShowPanel] = useState(false);
    const [activeTab, setActiveTab] = useState<'' | 'scanner' | 'chat'>('');
    const [showTab, setShowTab] = useState(false);

    const openPanel = () => {
        setShowPanel(true);
    }

    const closePanel = () => {
        setShowPanel(false);
        // current bug: the modal won't close
    }

    return (
        <div>
            <button className="assistant-button" onClick={openPanel}>
                <label className="assistant-label">AI Assistant</label>
            </button>
            
            {showPanel && 
            <div className="panel-overlay">
                <div className="panel">
                    <div className="panel-header">
                        <h1 className="panel-header-label">Tabs</h1>
                        <button className='panel-close-button' onClick={closePanel}>
                            <X strokeWidth={3} size={20}/>
                        </button>
                    </div>
                    {/* Tab Navigation */}
                    {/* <div className="tabs">
                        <button 
                            className="tabs-button"
                            onClick={() => setActiveTab('scanner')}
                            
                        >
                            Email Scanner
                        </button>
                        <button className="tabs-button">
                            AI Chat Assistant
                        </button>
                    </div> */}
                    {/* Content */}
                    <AI_Email_Scanner visible = {showPanel}/>
                    
                </div>
            </div>
            }
        </div>
        
    )
}
export default AI_assistant;
