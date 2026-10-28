/* Creates an CalendarEvents Component*/
import { useState, useEffect } from 'react';
import { db } from '../database/db';
import FullCalendar from '@fullcalendar/react'
import interactionPlugin from '@fullcalendar/interaction'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import './calendar.css';
import Modal from 'react-modal';

if (typeof window !== 'undefined') {
    Modal.setAppElement('#root');
}

interface CalendarEvents {
	id?:string;
	title: string;
	start: string;
	end?: string;
	location?: string;
	description?: string;
}

interface EventDate {
    id?: string;
    title: string;
    start_time: string;
    end_time: string;
    location: string;
    description: string;
}

function Calendar() {
        // Will store all the events within the calendar events table
        const [events, setEvents] = useState<CalendarEvents[]>([]);
        const [loading, setIsLoading] = useState(true);
        // Will store the new event (from adding/editing an event)
        const [newEvent, setNewEvent] = useState<EventDate>({
            id: undefined,
            title: '',
            start_time: '',
            end_time: '',
            location: '',
            description: ''
        });
        const [showModal, setShowModal] = useState(false);


        // will fetch all the calendar events and store in 'setEvents' list
        const fetchCalEvents = async () => {
        const {data, error} = await db
            .from('cal_events')
            .select('*')
            .order('start_time', {ascending: true});
        if (error) {
            console.error('Error fetching the calendar events', error);
        } 
        else if (data) { 
            const formattedEvents = data.map((event: any) => ({
                id: event.id,
                title: event.title,
                start: event.start_time,
                end: event.end_time,
                location: event.location,
                description: event.description
        }));
            setEvents(formattedEvents);
        }
            setIsLoading(false);
        };

        //Will fetch the calender events  
        useEffect(() => {
            fetchCalEvents();
        }, []);

        //When a user clicks to create a new event (needed for dateClick)
        const newEventClick = (event: any) => {
            setNewEvent({
                id: undefined,
                title: '',
                start_time: event.dateStr,
                end_time: event.dateStr,
                location: '',
                description: ''
            });
            setShowModal(true);
        }


        // When a user clicks on an event (to edit; needed for eventClick)
        const editEventClick = (event: EventDate) => {
            //finds event that was clicked
            const cur = events.find(eve => eve.id === event.id)
            //updates the new event
            if (cur) {
                setNewEvent({
                    id: cur.id || undefined,
                    title: cur.title,
                    start_time: cur.start,
                    end_time: cur.end || cur.start,
                    location: cur.location || '',
                    description: cur.description || ''
                });
                setShowModal(true);
            }
        } 

        //insert new event into the database, then call fetchCalEvents
        const updateEvents = async () => {
            //Required: the event title
            if (!newEvent.title) {
                alert('Please enter an event title')
                return;
            }
            //obtain new event
            const newEventData = {
                title: newEvent.title,
                start_time: newEvent.start_time,
                end_time: newEvent.end_time,
                location: newEvent.location,
                description: newEvent.description
            }
            if (newEvent.id) {
                //Insert into Supabase database
                const { error } = await db
                    .from('cal_events')
                    .update(newEventData)
                    .eq('id', newEvent.id);

                if (error) {
                    console.error('Error saving new event', error);
                }else {
                    setShowModal(false);
                    fetchCalEvents();
                }
            }else {
                const { error } = await db
                    .from('cal_events')
                    .insert([newEventData]);
                if (error) {
                    alert('Failed to save event');
                    console.log(newEventData)
                }
                else {
                    setShowModal(false);
                    fetchCalEvents();
                }
            }
        }

    const deleteEvent = async () => {
        if (!newEvent.id) return; //event doesn't exist

        const { error } = await db
            .from('cal_events')
            .delete()
            .eq('id', newEvent.id)
        if (error) {
            alert('Failed to delete event');
        }else {
            setShowModal(false);
            fetchCalEvents();
        }
    };

    if (loading) {
        return <div>Loading Calendar...</div>
    }
    const closeModal = () => {
        setShowModal(false);
    }

    return (
        <div className="calendar-container">
            <div className="calendar-header">
                <h1>AI Calendar Assistant</h1>
                <button className="add-event-button"
                    onClick={() => {
                        setNewEvent({
                            id: undefined,
                            title: '',
                            start_time: new Date().toISOString(),
                            end_time: new Date().toISOString(),
                            location: '',
                            description: ''
                        });
                        setShowModal(true);
                    }}
                >
                    + Add New Event
                </button>
            </div>
            {/* @ts-ignore - confusion with FullCalendar props */}
            <FullCalendar
                plugins={[interactionPlugin, dayGridPlugin, timeGridPlugin]}
                headerToolbar={{
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth, timeGridWeek, timeGridDay'
                }}
                editable={true}
                selectable={true}
                events={events}
                dateClick={newEventClick}
                eventClick={editEventClick}
            />
            {/* React Modal */}
            <Modal
                isOpen={showModal}
                onRequestClose={closeModal}
                contentLabel={newEvent.id ? "Edit Event": "Add New Event"}
                shouldCloseOnOverlayClick={true}
                shouldCloseOnEsc={true}
                overlayClassName="modal-overlay"
                className="modal-content"
            >
                <div className="modal-header">
                    <h2 className="title">{newEvent.id ? "Edit Event": "Add New Event"}</h2>
                    <button className="modal-close-button" onClick={closeModal}>x</button>
                </div>
                <div className="modal-body">
                    <div className="modal-group">
                        <label>Event Title <span className="red-star">*</span></label>
                        <input type="text" value={newEvent.title} 
                        onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                        placeholder="Meeting with the team"
                        />
                    </div>

                    <div className="modal-group">
                        <label>Start Time <span className="red-star">*</span></label>
                        <input type="datetime-local"
                        value={newEvent.start_time}
                        onChange={(e) => setNewEvent({...newEvent, start_time: e.target.value})}
                        />
                    </div>

                    <div className="modal-group">
                        <label>End Time <span className="red-star">*</span></label>
                        <input type="datetime-local"
                        value={newEvent.end_time}
                        onChange={(e) => setNewEvent({...newEvent, end_time: e.target.value})}
                        />
                    </div>

                <div className="modal-group">
                    <label>Location</label>
                    <input type="text"
                    value={newEvent.location}
                    onChange={(e) => setNewEvent({...newEvent, location: e.target.value})}
                    placeholder='Address or Zoom link'
                    />
                </div>
                <div className='modal-group'>
                     <label>Description</label>
                     <textarea value={newEvent.description}
                     onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                     placeholder="Additional details..."
                     />
                </div>
            </div>
            <div className='modal-footer'>
                <button className="save-button" onClick={updateEvents}>
                    Save
                </button>
                {newEvent.id && (
                    <button onClick={deleteEvent}>
                        Delete
                    </button>
                )}
            </div>
        </Modal>
    </div>
    )
}

export default Calendar;