import { useMemo, useState } from 'react';
import type { Schema } from "../../amplify/data/resource";
import { useAuthenticator } from '@aws-amplify/ui-react';
import { generateClient } from 'aws-amplify/api';

type Event = Schema["CalendarEvent"]["type"];
const client = generateClient<Schema>();

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
  
  // Add state for generated study sessions
  const [generatedStudySessions, setGeneratedStudySessions] = useState<Event[]>([]);
  
  // Combine regular events with generated study sessions
  const allEvents = useMemo(() => {
    return [...events, ...generatedStudySessions];
  }, [events, generatedStudySessions]);

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

    allEvents.forEach(event => {
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
  }, [allEvents, currentWeekStart, weekDays, hours]);

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
      // Call generatePreferenceVector directly
      const result = await client.queries.generatePreferenceVector({
        availabilityVector: JSON.stringify(availabilityVector),
        userId: user.username
      });
      
      console.log('Raw API response:', result);
      
      if (result.data) {
        try {
          // Log the raw data for debugging
          console.log('Raw data type:', typeof result.data);
          console.log('Raw data:', result.data);
          
          let studySessions;
          
          try {
            // Try to parse the data as JSON
            const parsedData = JSON.parse(result.data);
            console.log('Parsed data:', parsedData);
            
            if (parsedData && typeof parsedData === 'object') {
              // The data appears to be in parsedData.data as a string
              if (parsedData.data && typeof parsedData.data === 'string') {
                try {
                  // Parse the nested JSON string
                  studySessions = JSON.parse(parsedData.data);
                  console.log('Parsed nested data:', studySessions);
                } catch (nestedError) {
                  console.error('Error parsing nested data:', nestedError);
                  createTestStudySessions();
                  return;
                }
              } else if (Array.isArray(parsedData)) {
                studySessions = parsedData;
              } else {
                // If we can't find an array, create test sessions
                console.error('Could not find array in parsed data:', parsedData);
                createTestStudySessions();
                return;
              }
            } else {
              studySessions = parsedData;
            }
          } catch (jsonError) {
            console.error('Error parsing JSON:', jsonError);
            // If it's not valid JSON, use the raw data
            studySessions = result.data;
          }
          
          // If we have study sessions and they're an array, process them
          if (Array.isArray(studySessions)) {
            // Convert the study sessions to Event objects
            const studyEvents: Event[] = studySessions.map((session, index) => {
              // Get the day of week
              const dayMap: {[key: string]: number} = {
                'Monday': 0,
                'Tuesday': 1,
                'Wednesday': 2,
                'Thursday': 3,
                'Friday': 4,
                'Saturday': 5,
                'Sunday': 6
              };
              
              const dayIndex = dayMap[session.day];
              
              // Parse the time strings
              const [startHour, startMinute] = session.startTime.split(':').map(Number);
              const [endHour, endMinute] = session.endTime.split(':').map(Number);
              
              // Create date objects for the current week
              const startDate = new Date(currentWeekStart);
              startDate.setDate(currentWeekStart.getDate() + dayIndex);
              startDate.setHours(startHour, startMinute || 0, 0, 0);
              
              const endDate = new Date(currentWeekStart);
              endDate.setDate(currentWeekStart.getDate() + dayIndex);
              endDate.setHours(endHour, endMinute || 0, 0, 0);
              
              const now = new Date().toISOString();
              
              return {
                id: `study-${Date.now()}-${index}`,
                title: `Study: ${session.course || 'General'}`,
                description: `Study session for ${session.course || 'general topics'}`,
                type: 'STUDY',
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                createdAt: now,
                updatedAt: now
              };
            });
            
            console.log('Created study events:', studyEvents);
            
            if (studyEvents.length > 0) {
              // Update state with the generated study sessions
              setGeneratedStudySessions(studyEvents);
            } else {
              console.log('No study sessions returned, using fallback');
              createTestStudySessions();
            }
          } else {
            console.error('Study sessions is not an array:', studySessions);
            createTestStudySessions();
          }
        } catch (error) {
          console.error('Error processing study sessions:', error);
          createTestStudySessions();
        }
      } else {
        console.error('No data returned from API');
        createTestStudySessions();
      }
    } catch (error) {
      console.error('Error generating study sessions:', error);
      createTestStudySessions();
    }
  };

  // Add this helper function outside the main function
  function createTestStudySessions() {
    const testStudySessions: Event[] = [];
    
    // Create one study session for each weekday at different times
    for (let dayIndex = 0; dayIndex < 5; dayIndex++) {
      const startDate = new Date(currentWeekStart);
      startDate.setDate(currentWeekStart.getDate() + dayIndex);
      startDate.setHours(10 + dayIndex, 0, 0, 0); // Different hour each day
      
      const endDate = new Date(startDate);
      endDate.setHours(startDate.getHours() + 2, 0, 0, 0); // 2-hour sessions
      
      const now = new Date().toISOString();
      
      testStudySessions.push({
        id: `study-test-${dayIndex}`,
        title: `Test Study Session ${dayIndex + 1}`,
        description: 'Test generated study session',
        type: 'STUDY',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        createdAt: now,
        updatedAt: now
      });
    }
    
    console.log('Created test study events as fallback:', testStudySessions);
    
    // Update state with the test study sessions
    setGeneratedStudySessions(testStudySessions);
  }

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
        {generatedStudySessions.length > 0 && (
          <button 
            className="clear-sessions-btn"
            onClick={() => setGeneratedStudySessions([])}
          >
            Clear Study Sessions
          </button>
        )}
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