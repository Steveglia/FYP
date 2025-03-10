import { useEffect, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { generateClient } from "aws-amplify/data";
import WeeklySchedule from '../components/WeeklySchedule';
import { useAuthenticator } from '@aws-amplify/ui-react';

const client = generateClient<Schema>();

const Schedule = () => {
  const { user } = useAuthenticator();
  const [events, setEvents] = useState<Array<Schema["CalendarEvent"]["type"]>>([]);

  useEffect(() => {
    client.models.CalendarEvent.observeQuery().subscribe({
      next: (data) => setEvents([...data.items]),
    });
  }, []);

  function createEvent() {
    client.models.CalendarEvent.create({
      title: window.prompt("Event title") || "",
      description: window.prompt("Event description") || "",
      startDate: window.prompt("Start date") || "",
      endDate: window.prompt("End date") || "",
      location: window.prompt("Location") || "",
    });
  }

  return (
    <div className="schedule-page">
      <h1>Weekly Schedule</h1>
      <button onClick={createEvent}>+ New Event</button>
      <WeeklySchedule events={events} userId={user?.username || ''} />
    </div>
  );
};

export default Schedule; 