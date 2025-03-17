import React, { useState } from 'react';
import { ScheduleEvent, weekDays, hours } from './types';
import { calculateEventHeight, getEventColor } from './utils';

interface ScheduleGridProps {
  eventsByDayAndTime: { [key: string]: { [key: string]: ScheduleEvent[] } };
  onEventDrop?: (event: ScheduleEvent, newDay: string, newHour: number) => void;
}

const ScheduleGrid: React.FC<ScheduleGridProps> = ({ eventsByDayAndTime, onEventDrop }) => {
  // State to track which cell is being dragged over
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);
  // State to track which event is being dragged
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null);
  // State to track invalid drop targets
  const [invalidDropTarget, setInvalidDropTarget] = useState<string | null>(null);

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

  // Check if a cell already has events (excluding the currently dragged event)
  const cellHasEvents = (day: string, hour: number, excludeEventId: string | null): boolean => {
    if (!eventsByDayAndTime[day]) {
      return false;
    }
    
    // Check the target hour for events that start in this cell
    if (eventsByDayAndTime[day][hour]) {
      const eventsStartingInCell = eventsByDayAndTime[day][hour].filter(
        event => event.id !== excludeEventId && event.isStart === true
      );
      
      if (eventsStartingInCell.length > 0) {
        return true;
      }
    }
    
    // Also check for events that span across this hour
    // We need to check all hours before the current one
    for (let h = 8; h < hour; h++) {
      if (eventsByDayAndTime[day][h]) {
        // Find events that start in a previous hour and extend to or beyond the current hour
        const spanningEvents = eventsByDayAndTime[day][h].filter(event => {
          if (event.id === excludeEventId || !event.isStart) {
            return false;
          }
          
          // Check if this event spans to or beyond our target hour
          if (event.startDate && event.endDate) {
            // Create date objects that preserve the local time
            const endDate = new Date(event.endDate);
            
            // Calculate the event's end hour and minutes in local time
            const endHour = endDate.getHours();
            const endMinutes = endDate.getMinutes();
            
            // If end time is exactly on the hour (e.g., 16:00), the slot from 16:00-17:00 
            // should be available for new events
            if (endHour === hour && endMinutes === 0) {
              return false; // Event ends exactly at the start of this hour, so slot is available
            }
            
            // Check if the event spans into our target hour (must end after the hour starts)
            const spansIntoHour = endHour > hour || (endHour === hour && endMinutes > 0);
            
            return spansIntoHour;
          }
          
          return false;
        });
        
        if (spanningEvents.length > 0) {
          return true;
        }
      }
    }
    
    return false;
  };

  // Check if a cell has spanning events (events that started in previous hours)
  const cellHasSpanningEvents = (day: string, hour: number, excludeEventId: string | null): boolean => {
    if (!eventsByDayAndTime[day]) {
      return false;
    }
    
    // Check for events that span across this hour
    for (let h = 8; h < hour; h++) {
      if (eventsByDayAndTime[day][h]) {
        // Find events that start in a previous hour and extend to or beyond the current hour
        const spanningEvents = eventsByDayAndTime[day][h].filter(event => {
          if (event.id === excludeEventId || !event.isStart) {
            return false;
          }
          
          // Check if this event spans to or beyond our target hour
          if (event.startDate && event.endDate) {
            // Create date objects that preserve the local time
            const endDate = new Date(event.endDate);
            
            // Calculate the event's end hour and minutes in local time
            const endHour = endDate.getHours();
            const endMinutes = endDate.getMinutes();
            
            // If end time is exactly on the hour (e.g., 16:00), the slot from 16:00-17:00 
            // should be available for new events
            if (endHour === hour && endMinutes === 0) {
              return false; // Event ends exactly at the start of this hour, so slot is available
            }
            
            // Check if the event spans into our target hour (must end after the hour starts)
            const spansIntoHour = endHour > hour || (endHour === hour && endMinutes > 0);
            
            return spansIntoHour;
          }
          
          return false;
        });
        
        if (spanningEvents.length > 0) {
          return true;
        }
      }
    }
    
    return false;
  };

  // Check if a cell has events ending exactly at this hour
  const hasEventEndingExactlyAtHour = (day: string, hour: number, excludeEventId: string | null): boolean => {
    if (!eventsByDayAndTime[day]) {
      return false;
    }
    
    // Check all previous hours for events that end exactly at this hour
    for (let h = 8; h < hour; h++) {
      if (eventsByDayAndTime[day][h]) {
        const eventsEndingAtHour = eventsByDayAndTime[day][h].filter(event => {
          if (event.id === excludeEventId || !event.isStart) {
            return false;
          }
          
          if (event.endDate) {
            // Parse the ISO date string to get the correct local time
            const endDate = new Date(event.endDate);
            
            // Get the local hour and minutes
            const endHour = endDate.getHours();
            const endMinutes = endDate.getMinutes();
            
            // Check if the event ends exactly at the start of our target hour
            return endHour === hour && endMinutes === 0;
          }
          
          return false;
        });
        
        if (eventsEndingAtHour.length > 0) {
          return true;
        }
      }
    }
    
    return false;
  };

  // Handle drag start
  const handleDragStart = (event: React.DragEvent, scheduleEvent: ScheduleEvent) => {
    // Only allow dragging study sessions that are accepted
    if (scheduleEvent.type !== 'STUDY' || !scheduleEvent.isAcceptedStudySession) {
      event.preventDefault();
      return;
    }
    
    // Set the data to be transferred
    event.dataTransfer.setData('application/json', JSON.stringify({
      id: scheduleEvent.id,
      event: scheduleEvent
    }));
    
    // Set the drag effect
    event.dataTransfer.effectAllowed = 'move';
    
    // Set the dragging event ID
    setDraggingEventId(scheduleEvent.id || null);
  };
  
  // Handle drag over
  const handleDragOver = (event: React.DragEvent, day: string, hour: number) => {
    // Check if the cell already has events
    const hasEvents = cellHasEvents(day, hour, draggingEventId);
    
    if (hasEvents) {
      // If the cell has events, set it as an invalid drop target
      setInvalidDropTarget(`${day}-${hour}`);
      // Don't prevent default to disallow drop
      return;
    } else {
      // Clear invalid drop target if it was set
      if (invalidDropTarget === `${day}-${hour}`) {
        setInvalidDropTarget(null);
      }
    }
    
    // Prevent default to allow drop
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    
    // Set the drag over cell
    setDragOverCell(`${day}-${hour}`);
  };
  
  // Handle drag leave
  const handleDragLeave = () => {
    // Clear the drag over cell
    setDragOverCell(null);
  };
  
  // Handle drag end
  const handleDragEnd = () => {
    // Clear the dragging event ID, drag over cell, and invalid drop target
    setDraggingEventId(null);
    setDragOverCell(null);
    setInvalidDropTarget(null);
  };
  
  // Handle drop
  const handleDrop = (event: React.DragEvent, day: string, hour: number) => {
    event.preventDefault();
    
    // Check if the cell already has events
    const hasEvents = cellHasEvents(day, hour, draggingEventId);
    
    if (hasEvents) {
      // Don't allow drop if the cell already has events
      console.log(`Cannot drop onto cell ${day}-${hour} because it already has events`);
      return;
    }
    
    // Clear the drag over cell and dragging event ID
    setDragOverCell(null);
    setDraggingEventId(null);
    setInvalidDropTarget(null);
    
    try {
      // Get the dragged event data
      const data = JSON.parse(event.dataTransfer.getData('application/json'));
      const draggedEvent = data.event as ScheduleEvent;
      
      // Call the callback with the event and new position
      if (onEventDrop && draggedEvent) {
        onEventDrop(draggedEvent, day, hour);
      }
    } catch (error) {
      console.error('Error handling drop:', error);
    }
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
          {hours.map(hour => {
            const cellKey = `${day}-${hour}`;
            const isInvalidDropTarget = invalidDropTarget === cellKey;
            const isDragOver = dragOverCell === cellKey;
            const hasEvents = cellHasEvents(day, hour, draggingEventId);
            const hasSpanningEvents = cellHasSpanningEvents(day, hour, draggingEventId);
            const hasEventEndingAtHour = hasEventEndingExactlyAtHour(day, hour, draggingEventId);
            
            // Set tooltip based on whether dragging is happening and cell status
            let cellTooltip = '';
            if (draggingEventId) {
              cellTooltip = hasEvents 
                ? 'This time slot already has an event scheduled' 
                : 'Drop here to reschedule';
            }
            
            // Determine if this cell should have the spanning event visual indicator
            const shouldShowSpanningIndicator = hasSpanningEvents && 
              !eventsByDayAndTime[day][hour].some(e => e.isStart) && 
              !hasEventEndingAtHour;
            
            return (
              <div 
                key={cellKey} 
                className={`schedule-cell 
                  ${isDragOver ? 'drag-over' : ''} 
                  ${isInvalidDropTarget ? 'invalid-drop-target' : ''} 
                  ${shouldShowSpanningIndicator ? 'has-spanning-event' : ''}`}
                onDragOver={(e) => handleDragOver(e, day, hour)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, day, hour)}
                title={cellTooltip}
              >
                {eventsByDayAndTime[day][hour]
                  .filter((event): event is ScheduleEvent => event.isStart === true)
                  .map(event => (
                    <div 
                      key={event.id} 
                      className={`event-item ${event.isAcceptedStudySession ? 'accepted-study' : ''} ${draggingEventId === event.id ? 'dragging' : ''}`}
                      style={{ 
                        height: calculateEventHeight(event),
                        backgroundColor: event.isAcceptedStudySession ? '#4caf50' : getEventColor(event),
                        color: '#ffffff',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        cursor: event.type === 'STUDY' && event.isAcceptedStudySession ? 'grab' : 'pointer'
                      }}
                      title={generateTooltip(event)}
                      draggable={event.type === 'STUDY' && event.isAcceptedStudySession}
                      onDragStart={(e) => handleDragStart(e, event)}
                      onDragEnd={handleDragEnd}
                    >
                      {formatEventTitle(event)}
                    </div>
                  ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default ScheduleGrid; 