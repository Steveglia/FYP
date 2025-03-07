import { useMemo, useState } from 'react';
import type { Schema } from "../../amplify/data/resource";
import { generateWeekVector } from '../utils/scheduleUtils';
import { useAuthenticator } from '@aws-amplify/ui-react';

type Event = Schema["CalendarEvent"]["type"];

interface WeeklyScheduleProps {
  events: Event[];
  userId: string;
}

interface ScheduleEvent extends Event {
  isStart?: boolean;
  duration?: number;
}

// Update event type color mapping
const eventTypeColors = {
  WORK: '#e74c3c',    // red for work
  STUDY: '#3498db',   // blue for study
  MEETING: '#2ecc71', // green for meetings
  OTHER: '#f39c12',   // orange for other events
  default: '#95a5a6'  // grey for unknown types
};

const WeeklySchedule: React.FC<WeeklyScheduleProps> = ({ events }) => {
  const { user } = useAuthenticator();
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

  const handleGenerateStudySessions = async () => {
    if (!user) return;
    
    // Filter events for current week only
    const weekEndDate = new Date(currentWeekStart);
    weekEndDate.setDate(currentWeekStart.getDate() + 7);
    
    // Create initial availability vector (all available)
    const availabilityVector = new Array(105).fill(1);
    
    // Mark unavailable times based on events
    events.forEach(event => {
      if (event.startDate && event.endDate) {
        const startDate = new Date(event.startDate);
        const endDate = new Date(event.endDate);
        
        // Only process events within the current week
        if (startDate >= currentWeekStart && startDate < weekEndDate) {
          // Get day index (0 = Monday, 6 = Sunday)
          const day = startDate.getDay();
          const dayIndex = day === 0 ? 6 : day - 1;
          
          const startHour = startDate.getHours();
          const endHour = endDate.getHours();
          
          // Mark time slots as unavailable
          if (startHour >= 8 && startHour <= 22) {
            for (let hour = startHour; hour <= Math.min(endHour, 22); hour++) {
              if (hour >= 8 && hour <= 22) {
                const vectorIndex = (dayIndex * 15) + (hour - 8);
                availabilityVector[vectorIndex] = 0; // Mark as unavailable
              }
            }
          }
        }
      }
    });
    
    try {
      // Pass the availability vector and userId to generate the preference vector
      const preferenceVector = await generateWeekVector(availabilityVector, user.username);
      console.log('Generated preference vector:', preferenceVector);
      
      // Here you can add code to display the generated study sessions
      // or navigate to a page that shows them
      
      return preferenceVector;
    } catch (error) {
      console.error('Error generating study sessions:', error);
    }
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
                        marginTop: '2px',
                        backgroundColor: eventTypeColors[event.type as keyof typeof eventTypeColors] || eventTypeColors.default,
                        color: '#ffffff',
                        padding: '4px',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        cursor: 'pointer'
                      }}
                      title={`${event.title}\n${event.description || ''}\n${event.location || ''}\nType: ${event.type}`}
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