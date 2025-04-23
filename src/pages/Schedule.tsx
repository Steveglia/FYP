import { useEffect, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { generateClient } from "aws-amplify/data";
import WeeklySchedule from '../components/WeeklySchedule';
import { useAuthenticator } from '@aws-amplify/ui-react';
import './Schedule.css';

const client = generateClient<Schema>();

const Schedule = () => {
  const { user } = useAuthenticator();
  const [events, setEvents] = useState<Array<Schema["CalendarEvent"]["type"]>>([]);
  const [showUserEvents, setShowUserEvents] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  useEffect(() => {
    client.models.CalendarEvent.observeQuery().subscribe({
      next: (data) => setEvents([...data.items]),
    });
  }, []);

  const toggleUserEvents = () => {
    setIsSyncing(true);
    
    // Set a timer to simulate syncing process for 1 second
    setTimeout(() => {
      setShowUserEvents(!showUserEvents);
      setIsSyncing(false);
    }, 1000);
  };

  return (
    <div className="schedule-page-container">
      <div className="schedule-page-header">
        <div className="schedule-title-container">
          <h1>Weekly Schedule</h1>
          <p className="schedule-page-description">
            View your weekly events and study sessions.
          </p>
        </div>
        <button 
          className={`toggle-events-button ${isSyncing ? 'syncing' : ''}`}
          onClick={toggleUserEvents}
          disabled={isSyncing}
        >
          {isSyncing ? 'Syncing...' : 'Synch calendar'}
        </button>
      </div>
      
      <div className="schedule-content">
        <WeeklySchedule events={events} userId={user?.username || ''} showUserEvents={showUserEvents} />
      </div>
    </div>
  );
};

export default Schedule; 