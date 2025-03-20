import React from 'react';

interface ScheduleNavigationProps {
  currentWeekStart: Date;
  onNavigate: (direction: 'prev' | 'next') => void;
  formatWeekDate: (date: Date) => string;
}

const ScheduleNavigation: React.FC<ScheduleNavigationProps> = ({
  currentWeekStart,
  onNavigate,
  formatWeekDate
}) => {
  // Calculate the end of the week
  const weekEndDate = new Date(currentWeekStart);
  weekEndDate.setDate(currentWeekStart.getDate() + 6); // Add 6 days to get to Sunday
  
  return (
    <div className="schedule-navigation">
      <button 
        className="nav-arrow-btn prev-btn" 
        onClick={() => onNavigate('prev')}
        title="Previous Week"
      >
        &#8592;
      </button>
      <span className="week-date-display">
        {`Week of ${formatWeekDate(currentWeekStart)}`}
      </span>
      <button 
        className="nav-arrow-btn next-btn" 
        onClick={() => onNavigate('next')}
        title="Next Week"
      >
        &#8594;
      </button>
    </div>
  );
};

export default ScheduleNavigation; 