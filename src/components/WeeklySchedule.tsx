import { useMemo, useState } from 'react';
import type { Schema } from "../../amplify/data/resource";
import { generateWeekVector } from '../utils/scheduleUtils';

type Event = Schema["CalendarEvent"]["type"];

interface WeeklyScheduleProps {
  events: Event[];
}

interface ScheduleEvent extends Event {
  isStart?: boolean;
  duration?: number;
}

const WeeklySchedule: React.FC<WeeklyScheduleProps> = ({ events }) => {
  const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const hours = Array.from({ length: 15 }, (_, i) => i + 8); // 8 AM to 10 PM
  
  // Add state for current week
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    // Get Monday of current week
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  const eventsByDayAndTime = useMemo(() => {
    const schedule: { [key: string]: { [key: string]: ScheduleEvent[] } } = {};
    
    // Initialize schedule grid
    weekDays.forEach(day => {
      schedule[day] = {};
      hours.forEach(hour => {
        schedule[day][hour] = [];
      });
    });

    // Calculate week end date
    const weekEndDate = new Date(currentWeekStart);
    weekEndDate.setDate(currentWeekStart.getDate() + 7);

    events.forEach(event => {
      if (event.startDate && event.endDate) {
        const startDate = new Date(event.startDate);
        const endDate = new Date(event.endDate);

        // Only process events within the current week
        if (startDate >= currentWeekStart && startDate < weekEndDate) {
          const day = weekDays[startDate.getDay() === 0 ? 6 : startDate.getDay() - 1];
          const startHour = startDate.getHours();
          const endHour = endDate.getHours();
          
          if (startHour >= 8 && startHour <= 22) {
            for (let hour = startHour; hour <= Math.min(endHour, 22); hour++) {
              if (schedule[day][hour]) {
                const scheduleEvent: ScheduleEvent = {
                  ...event,
                  isStart: hour === startHour,
                  duration: endHour - startHour
                };
                schedule[day][hour].push(scheduleEvent);
              }
            }
          }
        }
      }
    });

    return schedule;
  }, [events, currentWeekStart]);

  // Add navigation functions
  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeekStart(prevDate => {
      const newDate = new Date(prevDate);
      newDate.setDate(prevDate.getDate() + (direction === 'next' ? 7 : -7));
      return newDate;
    });
  };

  const handleGenerateStudySessions = () => {
    return generateWeekVector(events, currentWeekStart, weekDays);
  };

  return (
    <div className="weekly-schedule">
      <div className="schedule-navigation">
        <button onClick={() => navigateWeek('prev')}>Previous Week</button>
        <span>
          {`Week of ${currentWeekStart.toLocaleDateString()}`}
        </span>
        <button onClick={() => navigateWeek('next')}>Next Week</button>
        <button 
          className="generate-sessions-btn"
          onClick={handleGenerateStudySessions}
        >
          Generate Study Sessions
        </button>
      </div>
      <div className="schedule-grid">
        <div className="time-column">
          <div className="header-cell">Time</div>
          {hours.map(hour => (
            <div key={hour} className="time-cell">
              {hour.toString().padStart(2, '0')}:00
            </div>
          ))}
        </div>
        {weekDays.map(day => (
          <div key={day} className="day-column">
            <div className="header-cell">{day}</div>
            {hours.map(hour => (
              <div key={`${day}-${hour}`} className="schedule-cell">
                {eventsByDayAndTime[day][hour]
                  .filter((event): event is ScheduleEvent => event.isStart === true)
                  .map(event => (
                    <div 
                      key={event.id} 
                      className="event-item"
                      style={{ 
                        height: `${(event.duration || 1) * 46}px`,
                        marginTop: '2px'
                      }}
                      title={`${event.title}\n${event.description}\n${event.location}`}
                    >
                      {event.title}
                    </div>
                  ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default WeeklySchedule; 