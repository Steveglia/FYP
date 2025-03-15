import React from 'react';

interface ScheduleNavigationProps {
  currentWeekStart: Date;
  navigateWeek: (direction: 'prev' | 'next') => void;
  handleGenerateStudySessions: () => void;
  handleRegenerateStudySessions: () => void;
  hasGeneratedSessions: boolean;
  hasAcceptedSessions: boolean;
  clearStudySessions: () => void;
  handleAcceptAllSessions: () => void;
  isLoading: boolean;
  loadingType: 'generate' | 'accept' | 'regenerate' | null;
}

const ScheduleNavigation: React.FC<ScheduleNavigationProps> = ({
  currentWeekStart,
  navigateWeek,
  handleGenerateStudySessions,
  handleRegenerateStudySessions,
  hasGeneratedSessions,
  hasAcceptedSessions,
  clearStudySessions,
  handleAcceptAllSessions,
  isLoading,
  loadingType
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
  
  // Get loading text based on loading type
  const getLoadingText = () => {
    switch (loadingType) {
      case 'generate':
        return 'Generating...';
      case 'accept':
        return 'Accepting...';
      case 'regenerate':
        return 'Regenerating...';
      default:
        return 'Loading...';
    }
  };
  
  return (
    <div className="schedule-navigation">
      <button 
        className="nav-arrow-btn prev-btn" 
        onClick={() => navigateWeek('prev')}
        title="Previous Week"
        disabled={isLoading}
      >
        &#8592;
      </button>
      <span className="week-date-display">
        {`Week of ${formatWeekDate(currentWeekStart)}`}
      </span>
      <button 
        className="nav-arrow-btn next-btn" 
        onClick={() => navigateWeek('next')}
        title="Next Week"
        disabled={isLoading}
      >
        &#8594;
      </button>
      
      {hasAcceptedSessions ? (
        <button 
          className="action-btn regenerate-btn"
          onClick={handleRegenerateStudySessions}
          title="Delete existing sessions and generate new ones"
          disabled={isLoading}
        >
          Re-generate Sessions
        </button>
      ) : (
        <button 
          className="action-btn generate-btn"
          onClick={handleGenerateStudySessions}
          disabled={isLoading}
        >
          Generate Sessions
        </button>
      )}
      
      {hasGeneratedSessions && (
        <>
          <button 
            className="action-btn accept-btn"
            onClick={handleAcceptAllSessions}
            disabled={isLoading}
          >
            Accept All
          </button>
          <button 
            className="action-btn clear-btn"
            onClick={clearStudySessions}
            disabled={isLoading}
          >
            Clear
          </button>
        </>
      )}
      
      {isLoading && (
        <>
          <div className="loading-spinner"></div>
          <span className="loading-text">{getLoadingText()}</span>
        </>
      )}
    </div>
  );
};

export default ScheduleNavigation; 