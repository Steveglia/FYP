import React from 'react';
import { ScheduleEvent, weekDays, hours } from './types';
import { calculateEventHeight, getEventColor } from './utils';

interface ScheduleGridProps {
  eventsByDayAndTime: { [key: string]: { [key: string]: ScheduleEvent[] } };
}

const ScheduleGrid: React.FC<ScheduleGridProps> = ({ eventsByDayAndTime }) => {
  // Function to format event title for display
  const formatEventTitle = (event: ScheduleEvent): string => {
    return event.title || 'Untitled Event';
  };

  // Function to generate tooltip content
  const generateTooltip = (event: ScheduleEvent): string => {
    const parts = [
      event.title,
      event.description || '',
      event.location || '',
      `Type: ${event.isLecture ? 'LECTURE' : event.type}`
    ];
    
    return parts.filter(Boolean).join('\n');
  };

  return (
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
                      height: calculateEventHeight(event),
                      marginTop: '2px',
                      backgroundColor: getEventColor(event),
                      color: '#ffffff',
                      padding: '4px',
                      borderRadius: '4px',
                      overflow: 'hidden',
                      cursor: 'pointer'
                    }}
                    title={generateTooltip(event)}
                  >
                    {formatEventTitle(event)}
                  </div>
                ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default ScheduleGrid; 