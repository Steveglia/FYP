import React from 'react';

interface ScheduleNavigationProps {
  currentWeekStart: Date;
  navigateWeek: (direction: 'prev' | 'next') => void;
  handleGenerateStudySessions: () => void;
  hasGeneratedSessions: boolean;
  clearStudySessions: () => void;
}

const ScheduleNavigation: React.FC<ScheduleNavigationProps> = ({
  currentWeekStart,
  navigateWeek,
  handleGenerateStudySessions,
  hasGeneratedSessions,
  clearStudySessions
}) => {
  // Format the date in a more readable format
  const formatWeekDate = (date: Date): string => {
    return date.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  };
  
  // Calculate the end of the week
  const weekEndDate = new Date(currentWeekStart);
  weekEndDate.setDate(currentWeekStart.getDate() + 6); // Add 6 days to get to Sunday
  
  return (
    <div className="schedule-navigation">
      <button onClick={() => navigateWeek('prev')}>Previous Week</button>
      <span className="week-date-display">
        {`Week of ${formatWeekDate(currentWeekStart)}`}
      </span>
      <button onClick={() => navigateWeek('next')}>Next Week</button>
      <button 
        className="generate-sessions-btn"
        onClick={handleGenerateStudySessions}
      >
        Generate Study Sessions
      </button>
      {hasGeneratedSessions && (
        <button 
          className="clear-sessions-btn"
          onClick={clearStudySessions}
        >
          Clear Study Sessions
        </button>
      )}
    </div>
  );
};

export default ScheduleNavigation; 