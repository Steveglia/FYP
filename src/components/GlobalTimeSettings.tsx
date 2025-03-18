import React, { useState } from 'react';
import { useTimeContext } from '../context/TimeContext';
import './GlobalTimeSettings.css';

const GlobalTimeSettings: React.FC = () => {
  const { 
    currentTime, 
    useCustomTime, 
    setUseCustomTime, 
    customDate, 
    setCustomDate, 
    customTime, 
    setCustomTime,
    resetToSystemTime
  } = useTimeContext();
  
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggleCustomTime = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUseCustomTime(e.target.checked);
  };

  const formatCurrentTime = () => {
    return currentTime.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="global-time-settings">
      <div className="time-display" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="current-time">
          <span className="time-label">Current Time:</span>
          <span className={`time-value ${useCustomTime ? 'custom-time-active' : ''}`}>
            {formatCurrentTime()}
          </span>
        </div>
        <button className="toggle-button">
          {isExpanded ? '▲' : '▼'}
        </button>
      </div>

      {isExpanded && (
        <div className="time-settings-panel">
          <div className="custom-time-toggle">
            <label>
              <input
                type="checkbox"
                checked={useCustomTime}
                onChange={handleToggleCustomTime}
              />
              <span>Use custom time</span>
            </label>
          </div>

          <div className="time-settings-description">
            This setting changes the time for the entire application. 
            All dates, deadlines, and scheduling will be based on this time.
            Useful for testing future dates or simulating different timeframes.
          </div>

          {useCustomTime && (
            <div className="custom-time-inputs">
              <div className="input-group">
                <label htmlFor="global-custom-date">Date:</label>
                <input
                  type="date"
                  id="global-custom-date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label htmlFor="global-custom-time">Time:</label>
                <input
                  type="time"
                  id="global-custom-time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                />
              </div>
              <button 
                className="reset-time-button"
                onClick={resetToSystemTime}
              >
                Reset to System Time
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GlobalTimeSettings; 