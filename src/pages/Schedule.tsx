import { useEffect, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { generateClient } from "aws-amplify/data";
import WeeklySchedule from '../components/WeeklySchedule';

const client = generateClient<Schema>();

const Schedule = () => {
  const [events, setEvents] = useState<Array<Schema["Event"]["type"]>>([]);

  useEffect(() => {
    client.models.Event.observeQuery().subscribe({
      next: (data) => setEvents([...data.items]),
    });
  }, []);

  function createEvent() {
    client.models.Event.create({
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
      <WeeklySchedule events={events} />
    </div>
  );
};

export default Schedule; 