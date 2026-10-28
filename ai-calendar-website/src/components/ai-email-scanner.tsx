// cite: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
import { useState } from 'react';
import './ai-email-scanner.css';
import { ChevronLeft } from 'lucide-react';

type EmailProps = {
    visible: boolean;
    // onClose: () => void;
}

// for gmail authorization: window.postMessage event type is a standard DOM MessageEvent (cite: Gemini)
// 
type MessageEvent = {
    origin: string;
    data: any;
}

type Email = {
    id: string,
    from?: string,
    to?: string,
    subject?: string,
    start?: string,
    end?: string,
    body?: string,
    snippet?: string
}

type AnalyzedEvent = {
    title: string,
    start_date?: string,
    start_time?: string,
    end_date?: string,
    end_time?: string,
    location?: string,
    description?: string,
    emailId: string,
    confidence?: number;
}
// shows the AI Email modal with its content
export const AI_Email_Scanner = ({ visible }: EmailProps) => {
    const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'analyzing' | 'done'>('idle');
    const [gmailConnected, setGmailConnected] = useState(false);
    const [scanError, setScanError] = useState('');
    //need to have a list of events that were fetched and analyzed to show on the modal
    const [events, setEvents] = useState<any[]>([]);

    // connect gmail (only authenticates one gmail for testing purposes and saving tokens)
    const connectGmail = async () => {
        setScanError('');

        try {
            // obtain the URL from backend server
            const response = await fetch('http://localhost:3001/api/auth/gmail/url');
            if (!response.ok) {
                throw new Error(`Backend error: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();

            if (!data.authURL) {
                throw new Error('No auth URL received from backend server');
            }

            // open the Gmail auth in popup
            const popup = window.open(
                data.authURL,
                'Gmail Auth',
                'width=600, height=700, scrollbars=yes'
            );

            if (!popup) {
                throw new Error('Popup was blocked. Allow popups for this site.');
            }

            // need a event listener handler to verify the popup successively connects the gmail
            const handleMessage = (event: MessageEvent) => {
                // have a list of allowed origins (to account for backend and frontend urls)
                const allowedOrigins = [
                    'http://localhost:5173/',
                    'http://localhost:3001',
                    window.location.origin
                ]
                // security check: verify event.origin is in allowedOrigins
                if (!allowedOrigins.includes(event.origin)) {
                    console.log('Origin of message error');
                    return;
                }

                // Verify if the message received is a success message
                if (event.data.type === 'gmail-auth-success') {
                    setGmailConnected(true);
                    scanEmails();

                    //remove event listener
                    window.removeEventListener('message', handleMessage);
                }
            }
            console.log('Call handleMessage function');
            // attaches an event handler to a HTML elem
            window.addEventListener('message', handleMessage);

            //close the popup
            const popupCloses = setInterval(() => {
                // when the popup closes, clean up the listener (to prevent memory leaks)
                window.removeEventListener('message', handleMessage);
                clearInterval(popupCloses);
            }, 100000);
        }
        catch (error) {
            setScanError('Failed to connect Gmail');
            console.log(error);
        }
    };

    // will scan recent emails
    const scanEmails = async () => {
        console.log('gmail successfully connected');
        setScanStatus('scanning');
        setScanError('');

        try {
            console.log('Fetching emails from gmail');
            // fetch defaults to a GET request;
            // want to send the max number of emails that I want to fetch
            const response = await fetch('http://localhost:3001/api/emails/fetch', {
                method: 'POST',
                headers: { "Content-Type": "application/json"},
                body: JSON.stringify({ maxResult: 1 })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData || 'Failed to fetch emails');
            }
            // obtain the list of emails
            const { emails } = await response.json();
            console.log(`Received ${emails.length} emails that were fetched`);

            //check if null was returned or 0 emails were returned
            if (!emails || emails.length === 0) {
                //since there are no emails to analyze, just stop scanning
                setScanStatus('done');
                setEvents([]);
                return;
            }
            // if there emails that were returned, needs to be analyzed
            analyze(emails);
        }
        catch (error) {
            console.log('Scan error: ', error);
            setScanError('Failed to scan emails');
            setScanStatus('idle'); //restart
        }
    };

    const analyze = async (emails: Email[]) => {
        setScanStatus('analyzing');
        setScanError('');
        console.log('Now analyzing fetched emails');

        try {
            const response = await fetch('http://localhost:3001/api/emails/analyze', {
                method: 'POST',
                headers: { "Content-type": "application/json"},
                body: JSON.stringify({ emails })
            })

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData || 'Failed to analyze emails');
            }

            const result = await response.json();
            const analyzedEvents = result?.events || [];

            console.log(`Found ${analyzedEvents.length} events`);
            setEvents(analyzedEvents);
            setScanStatus('done');
        }
        catch (error) {
            setScanError('Gmail Analyzation Error');
            console.log('Gemini Error: ', error);
        }
    }

    //Add Analyzed Event to Supabase
    const addEvent = async (event: AnalyzedEvent) => {
        // must send this specific event to backend (so backend can formulate and add to Supabase)
        try {
            console.log('Adding Event to Supabase');
            
            const response = await fetch('http://localhost:3001/api/events/add', {
                method: 'POST',
                headers: { "Content-Type": "application/json"},
                body: JSON.stringify({ event }) //input the specified event into Supabase with Backend
            })
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error (errorData.error || 'Failed to add event to database');
            }

            // Must remove card from events array
            setEvents(prev => prev.filter(e => e.emailID != event.emailId));
        }
        catch (error) {
            // means specific event is invalid
            console.error('Invalid event: ', error);
            setScanError('Failed to add this event');
        }
        // current bug: successfully inserts row into Supabase but need to clarify timestamp
    }

    return (
        <div className="modal">
            <div className="header">
                <label className="title">Email Scanner</label>
                <button onClick={() => visible = false}>
                    <ChevronLeft />
                </button>
            </div>
            
            <div className="content">
                
                {scanError && (
                    <div>{scanError}</div>
                )}

                {scanStatus === 'idle' && !gmailConnected && (
                    <div className='idle-center'>
                        <p>Scan your emails for calendar events, meetings, deadlines, etc.</p>
                        <button
                        className="connect-gmail-button"
                        onClick={connectGmail}
                        >
                            Connect Email & Scan
                        </button>

                        <p className="scan-hint">Will scan your recent emails for calendar events</p>
                    </div>
                )}
                {(scanStatus === 'scanning' || scanStatus === 'analyzing') && (
                    <div className="loading-overlay">
                        <div className="spinner"></div>
                        <p className="scan-hint">
                            {scanStatus === 'scanning' ? 'Scanning your emails...' : 'Analyzing emails...'}
                        </p>
                    </div>
                )}
                {scanStatus === 'done' && events.length > 0 && (
                    <div className="results">
                        <div className="results-header">
                            <h4>Found {events.length} events</h4>
                            <button onClick={() => scanEmails()} className="scan-again-button">
                                Scan Again
                            </button>
                        </div>
                        {events.map((event, index) => (
                            // maps all the events found from Gemini API
                            <div key={index} className="event-card">
                                {/* header */}
                                <div className="event-card-header">
                                    <h5>{event.title}</h5>
                                    <span className="confidence">{event.confidence}/10</span>
                                </div>
                                {/* Body */}
                                <div className="event-details">
                                    {/* Start Time */}
                                    <p>{event.start_date}{event.start_time && `at ${event.start_time}`}</p>
                                    {event.location && (
                                        <p>{event.location}</p>
                                    )}
                                    {event.description && (
                                        <p>{event.description}</p>
                                    )}
                                </div>
                                {/* Accept Event */}
                                <div className="buttons-area">
                                    <button className="add-event-button" onClick={() => addEvent(event)}>+ Add</button>
                                    <button>Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
export default AI_Email_Scanner;