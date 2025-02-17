import { useMemo } from 'react';
import type { Schema } from "../../amplify/data/resource";

type Event = Schema["Event"]["type"];

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

  const eventsByDayAndTime = useMemo(() => {
    const schedule: { [key: string]: { [key: string]: ScheduleEvent[] } } = {};
    
    weekDays.forEach(day => {
      schedule[day] = {};
      hours.forEach(hour => {
        schedule[day][hour] = [];
      });
    });

    events.forEach(event => {
      if (event.startDate && event.endDate) {
        const startDate = new Date(event.startDate);
        const endDate = new Date(event.endDate);
        const day = weekDays[startDate.getDay() === 0 ? 6 : startDate.getDay() - 1];
        const startHour = startDate.getHours();
        const endHour = endDate.getHours();
        
        // Only process events that fall within our display hours
        if (startHour >= 8 && startHour <= 22) {
          // Add event to each hour slot it spans
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
    });

    return schedule;
  }, [events]);

  return (
    <div className="weekly-schedule">
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