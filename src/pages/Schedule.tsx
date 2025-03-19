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

  useEffect(() => {
    client.models.CalendarEvent.observeQuery().subscribe({
      next: (data) => setEvents([...data.items]),
    });
  }, []);

  return (
    <div className="schedule-page-container">
      <div className="schedule-page-header">
        <h1>Weekly Schedule</h1>
        <p className="schedule-page-description">
          View your weekly events and study sessions.
        </p>
      </div>
      
      <div className="schedule-content">
        <WeeklySchedule events={events} userId={user?.username || ''} />
      </div>
    </div>
  );
};

export default Schedule; 