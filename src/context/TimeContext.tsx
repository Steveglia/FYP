import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';

interface TimeContextType {
  currentTime: Date;
  useCustomTime: boolean;
  setUseCustomTime: (use: boolean) => void;
  customDate: string;
  setCustomDate: (date: string) => void;
  customTime: string;
  setCustomTime: (time: string) => void;
  getCurrentTime: () => Date;
  resetToSystemTime: () => void;
}

const TimeContext = createContext<TimeContextType | undefined>(undefined);

interface TimeProviderProps {
  children: ReactNode;
}

export const TimeProvider: React.FC<TimeProviderProps> = ({ children }) => {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [useCustomTime, setUseCustomTime] = useState<boolean>(false);
  const [customDate, setCustomDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [customTime, setCustomTime] = useState<string>(
    new Date().toTimeString().slice(0, 5)
  );

  // Update current time either from system or custom inputs
  useEffect(() => {
    if (useCustomTime && customDate && customTime) {
      try {
        const customDateTime = new Date(`${customDate}T${customTime}`);
        if (!isNaN(customDateTime.getTime())) {
          setCurrentTime(customDateTime);
        }
      } catch (error) {
        console.error('Error parsing custom date/time:', error);
        // Fall back to system time if there's an error
        setCurrentTime(new Date());
      }
    } else {
      // Set up interval to update current system time
      const intervalId = setInterval(() => {
        setCurrentTime(new Date());
      }, 60000); // Update every minute

      return () => clearInterval(intervalId);
    }
  }, [useCustomTime, customDate, customTime]);

  // Get current time (custom or system)
  const getCurrentTime = (): Date => {
    if (useCustomTime) {
      // Return the custom time
      return currentTime;
    }
    // Return the current system time
    return new Date();
  };

  // Reset to system time
  const resetToSystemTime = () => {
    setUseCustomTime(false);
    const now = new Date();
    setCurrentTime(now);
    setCustomDate(now.toISOString().split('T')[0]);
    setCustomTime(now.toTimeString().slice(0, 5));
  };

  return (
    <TimeContext.Provider
      value={{
        currentTime,
        useCustomTime,
        setUseCustomTime,
        customDate,
        setCustomDate,
        customTime, 
        setCustomTime,
        getCurrentTime,
        resetToSystemTime
      }}
    >
      {children}
    </TimeContext.Provider>
  );
};

// Hook for using the time context
export const useTimeContext = (): TimeContextType => {
  const context = useContext(TimeContext);
  
  if (context === undefined) {
    throw new Error('useTimeContext must be used within a TimeProvider');
  }
  
  return context;
}; 