import { useEffect, useState } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import './Preferences.css';

const client = generateClient<Schema>();

// Define preference values and their colors
const PREFERENCE_VALUES = [0, 2, 4, 6, 9];
const PREFERENCE_COLORS = {
  0: '#ff4d4d', // Vivid red
  2: '#ff9966', // Orange-red
  4: '#ffcc66', // Yellow
  6: '#99cc66', // Light green
  9: '#4dcc4d', // Vivid green
};

// Time and day labels for the grid
const HOURS = ['8am', '9am', '10am', '11am', '12pm', '1pm', '2pm', '3pm', '4pm', '5pm', '6pm', '7pm', '8pm', '9pm', '10pm'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const Preferences = () => {
  const { user } = useAuthenticator();
  const [preferences, setPreferences] = useState({
    studyTime: "4",
    maxHoursPerDay: 8,
    lunchBreakStart: "12:00",
    lunchBreakDuration: 60,
    preferredTimeOfDay: "MORNING" as "MORNING" | "AFTERNOON" | "EVENING" | "CIRCADIAN" | "PERSONALIZE",
    personalizedVector: new Array(105).fill(4) // Default to neutral preference (4)
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [showPersonalizeGrid, setShowPersonalizeGrid] = useState(false);
  const [showFillOptions, setShowFillOptions] = useState(false);
  const [userCourses, setUserCourses] = useState<string[]>([]);

  useEffect(() => {
    async function loadPreferences() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data: preferences, errors } = await client.models.StudyPreference.list({
          filter: { owner: { eq: user.username } }
        });

        if (errors) {
          throw new Error('Failed to load preferences');
        }

        if (preferences.length > 0) {
          const userPrefs = preferences[0];
          const personalizedVectorData = userPrefs.personalizedVector ? 
            JSON.parse(userPrefs.personalizedVector) : 
            new Array(105).fill(4);

          // Store courses in state for use in suggested study hours
          if (userPrefs.courses) {
            const validCourses = userPrefs.courses.filter((course): course is string => course !== null);
            setUserCourses(validCourses);
          }

          setPreferences({
            studyTime: userPrefs.studyTime ?? "4",
            maxHoursPerDay: userPrefs.maxHoursPerDay ?? 8,
            lunchBreakStart: userPrefs.lunchBreakStart ?? "12:00",
            lunchBreakDuration: userPrefs.lunchBreakDuration ?? 60,
            preferredTimeOfDay: (userPrefs.preferredTimeOfDay ?? "MORNING") as "MORNING" | "AFTERNOON" | "EVENING" | "CIRCADIAN" | "PERSONALIZE",
            personalizedVector: personalizedVectorData
          });

          // Show personalize grid if that option is selected
          setShowPersonalizeGrid(userPrefs.preferredTimeOfDay === "PERSONALIZE");
        } else {
          const defaultPrefs = {
            studyTime: "4",
            maxHoursPerDay: 8,
            lunchBreakStart: "12:00",
            lunchBreakDuration: 60,
            preferredTimeOfDay: "MORNING" as "MORNING" | "AFTERNOON" | "EVENING" | "CIRCADIAN" | "PERSONALIZE",
            personalizedVector: new Array(105).fill(4),
            owner: user.username
          };

          const { errors: createErrors } = await client.models.StudyPreference.create({
            studyTime: defaultPrefs.studyTime,
            maxHoursPerDay: defaultPrefs.maxHoursPerDay,
            lunchBreakStart: defaultPrefs.lunchBreakStart,
            lunchBreakDuration: defaultPrefs.lunchBreakDuration,
            preferredTimeOfDay: defaultPrefs.preferredTimeOfDay,
            personalizedVector: JSON.stringify(defaultPrefs.personalizedVector),
            owner: defaultPrefs.owner
          });
          
          if (createErrors) {
            throw new Error('Failed to create preferences');
          }

          setPreferences(defaultPrefs);
        }
      } catch (error) {
        console.error("Error loading preferences:", error);
        setMessage({ type: 'error', text: 'Failed to load preferences' });
      } finally {
        setLoading(false);
      }
    }

    loadPreferences();
  }, [user]);

  // Handle toggling preference values in the grid
  const handleCellToggle = (index: number) => {
    const newVector = [...preferences.personalizedVector];
    const currentValue = newVector[index];
    
    // Find the next value in the cycle
    const currentValueIndex = PREFERENCE_VALUES.indexOf(currentValue);
    const nextValueIndex = (currentValueIndex + 1) % PREFERENCE_VALUES.length;
    newVector[index] = PREFERENCE_VALUES[nextValueIndex];
    
    setPreferences({
      ...preferences,
      personalizedVector: newVector
    });
  };

  // Reset personalized preferences to default (neutral) values
  const handleResetPersonalizedPreferences = () => {
    if (window.confirm('Are you sure you want to reset all personalized preferences to neutral values?')) {
      setPreferences({
        ...preferences,
        personalizedVector: new Array(105).fill(4) // Reset to neutral preference (4)
      });
      setMessage({ type: 'success', text: 'Personalized preferences have been reset' });
    }
  };

  // Handle preference time of day selection
  const handlePreferredTimeChange = (value: "MORNING" | "AFTERNOON" | "EVENING" | "CIRCADIAN" | "PERSONALIZE") => {
    setPreferences({ ...preferences, preferredTimeOfDay: value });
    setShowPersonalizeGrid(value === "PERSONALIZE");
  };

  // Fill grid with recommended values based on preferred time of day
  const handleFillWithRecommendations = (selectedOption: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'CIRCADIAN') => {
    const newVector = [...preferences.personalizedVector];
    
    // Apply the selected preference pattern
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      for (let hour = 8; hour <= 22; hour++) {
        const vectorIndex = (dayIndex * 15) + (hour - 8);
        
        if (selectedOption === 'MORNING') {
          if (hour >= 8 && hour <= 12) {
            newVector[vectorIndex] = 9;
          } else if (hour > 12 && hour <= 15) {
            newVector[vectorIndex] = 6;
          } else if (hour > 15 && hour <= 18) {
            newVector[vectorIndex] = 4;
          } else {
            newVector[vectorIndex] = 2;
          }
        } else if (selectedOption === 'EVENING') {
          if (hour >= 18 && hour <= 22) {
            newVector[vectorIndex] = 9;
          } else if (hour >= 15 && hour < 18) {
            newVector[vectorIndex] = 6;
          } else if (hour >= 12 && hour < 15) {
            newVector[vectorIndex] = 4;
          } else {
            newVector[vectorIndex] = 2;
          }
        } else if (selectedOption === 'AFTERNOON') {
          if (hour >= 12 && hour <= 17) {
            newVector[vectorIndex] = 9;
          } else if ((hour >= 17 && hour <= 19) || (hour >= 10 && hour < 12)) {
            newVector[vectorIndex] = 6;
          } else if ((hour >= 8 && hour < 10) || (hour > 19 && hour <= 20)) {
            newVector[vectorIndex] = 4;
          } else {
            newVector[vectorIndex] = 2;
          }
        } else if (selectedOption === 'CIRCADIAN') {
          // Define values for circadian cycles
          const U = 0;  // Unavailable
          const L = 2;  // Low Preference
          const N = 4;  // Neutral
          const P = 6;  // Preferred
          const H = 9;  // Highly Preferred
          
          // For Monday through Friday (0-4)
          if (dayIndex <= 4) {
            if (hour >= 8 && hour <= 11) { // 8am-11am
              newVector[vectorIndex] = [P, H, H, H][hour - 8] || H;
            } else if (hour === 12) { // 12pm
              newVector[vectorIndex] = H;
            } else if (hour >= 13 && hour <= 16) { // 1pm-4pm
              newVector[vectorIndex] = [N, L, P, H][hour - 13] || N;
            } else if (hour >= 17 && hour <= 19) { // 5pm-7pm
              newVector[vectorIndex] = [H, N, N][hour - 17] || N;
            } else { // 8pm-10pm
              newVector[vectorIndex] = [L, U, U][hour - 20] || L;
            }
          } 
          // For Saturday (5)
          else if (dayIndex === 5) {
            if (hour === 8) { // 8am
              newVector[vectorIndex] = N;
            } else if (hour >= 9 && hour <= 11) { // 9am-11am
              newVector[vectorIndex] = [P, H, H][hour - 9] || H;
            } else if (hour === 12) { // 12pm
              newVector[vectorIndex] = H;
            } else if (hour >= 13 && hour <= 16) { // 1pm-4pm
              newVector[vectorIndex] = [N, L, L, N][hour - 13] || L;
            } else if (hour >= 17 && hour <= 19) { // 5pm-7pm
              newVector[vectorIndex] = [P, H, N][hour - 17] || N;
            } else { // 8pm-10pm
              newVector[vectorIndex] = [N, L, U][hour - 20] || L;
            }
          } 
          // For Sunday (6)
          else if (dayIndex === 6) {
            if (hour === 8) { // 8am
              newVector[vectorIndex] = N;
            } else if (hour >= 9 && hour <= 11) { // 9am-11am
              newVector[vectorIndex] = [P, H, H][hour - 9] || H;
            } else if (hour === 12) { // 12pm
              newVector[vectorIndex] = N;
            } else if (hour >= 13 && hour <= 16) { // 1pm-4pm
              newVector[vectorIndex] = [L, L, L, N][hour - 13] || L;
            } else if (hour >= 17 && hour <= 18) { // 5pm-6pm
              newVector[vectorIndex] = [P, N][hour - 17] || N;
            } else { // 7pm-10pm
              newVector[vectorIndex] = [N, L, L, U][hour - 19] || L;
            }
          }
        }
      }
    }
    
    setPreferences({
      ...preferences,
      personalizedVector: newVector
    });
    
    setMessage({ 
      type: 'success', 
      text: `Grid filled with ${selectedOption.toLowerCase()} preference pattern` 
    });
    
    // Close the dropdown
    setShowFillOptions(false);
  };

  // Function to suggest study hours based on number of courses
  const suggestStudyHours = () => {
    if (userCourses.length === 0) {
      setMessage({ 
        type: 'error', 
        text: 'No courses selected. Please select courses in the Course Selection page first.' 
      });
      return;
    }
    
    // Calculate 8 hours per course
    const suggestedHours = Math.min(userCourses.length * 8, 60); // Cap at 60 hours
    
    setPreferences(prev => ({ 
      ...prev, 
      studyTime: suggestedHours.toString() 
    }));
    
    setMessage({ 
      type: 'success', 
      text: `Suggested ${suggestedHours} hours of study based on ${userCourses.length} course${userCourses.length === 1 ? '' : 's'} (8 hours per course)` 
    });
  };

  const validatePreferences = () => {
    const studyTimeNumber = Number(preferences.studyTime);
    if (isNaN(studyTimeNumber) || studyTimeNumber <= 0 || studyTimeNumber > 60) {
      setMessage({ type: 'error', text: 'Weekly study hours must be between 1 and 60' });
      return false;
    }
    
    // Check if the study hours are too low based on course count (less than 5 per course)
    if (userCourses.length > 0 && studyTimeNumber < userCourses.length * 5) {
      setMessage({ 
        type: 'error', 
        text: `${studyTimeNumber} hours seems low for ${userCourses.length} course${userCourses.length === 1 ? '' : 's'}. Consider using the "Suggest Hours" button for a recommended value.` 
      });
      return false;
    }
    
    if (preferences.maxHoursPerDay <= 0 || preferences.maxHoursPerDay > 24) {
      setMessage({ type: 'error', text: 'Maximum hours per day must be between 1 and 24' });
      return false;
    }
    // Check that max hours per day doesn't exceed weekly hours
    if (preferences.maxHoursPerDay > studyTimeNumber) {
      setMessage({ 
        type: 'error', 
        text: 'Maximum hours per day cannot exceed total weekly study hours' 
      });
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !validatePreferences()) return;

    setSaving(true);
    setMessage(null);

    try {
      const { data: existingPrefs, errors: listErrors } = await client.models.StudyPreference.list({
        filter: { owner: { eq: user.username } }
      });

      if (listErrors) {
        throw new Error('Failed to check existing preferences');
      }

      let result;
      if (existingPrefs.length > 0) {
        const { data: updatedPrefs, errors: updateErrors } = await client.models.StudyPreference.update({
          id: existingPrefs[0].id,
          studyTime: preferences.studyTime,
          maxHoursPerDay: preferences.maxHoursPerDay,
          lunchBreakStart: preferences.lunchBreakStart,
          lunchBreakDuration: preferences.lunchBreakDuration,
          preferredTimeOfDay: preferences.preferredTimeOfDay,
          personalizedVector: JSON.stringify(preferences.personalizedVector),
          owner: user.username
        });

        if (updateErrors) {
          throw new Error('Failed to update preferences');
        }
        result = updatedPrefs;
      } else {
        const { data: newPrefs, errors: createErrors } = await client.models.StudyPreference.create({
          studyTime: preferences.studyTime,
          maxHoursPerDay: preferences.maxHoursPerDay,
          lunchBreakStart: preferences.lunchBreakStart,
          lunchBreakDuration: preferences.lunchBreakDuration,
          preferredTimeOfDay: preferences.preferredTimeOfDay,
          personalizedVector: JSON.stringify(preferences.personalizedVector),
          owner: user.username
        });

        if (createErrors) {
          throw new Error('Failed to create preferences');
        }
        result = newPrefs;
      }

      setMessage({ type: 'success', text: 'Preferences saved successfully!' });
      console.log('Saved preferences:', result);
    } catch (error) {
      console.error("Error saving preferences:", error);
      setMessage({ type: 'error', text: 'Failed to save preferences' });
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="preferences-page">
        <div className="preferences-header">
          <h1>Study Preferences</h1>
          <p className="page-description">
            Customize your study preferences to optimize your learning schedule.
          </p>
        </div>
        <div className="message error">Please log in to view and edit preferences.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="preferences-page">
        <div className="preferences-header">
          <h1>Study Preferences</h1>
          <p className="page-description">
            Customize your study preferences to optimize your learning schedule.
          </p>
        </div>
        <div className="loading-indicator">
          <span className="loading-spinner"></span>
          <span className="loading-text">Loading your preferences...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="preferences-page">
      <div className="preferences-header">
        <h1>Study Preferences</h1>
        <p className="page-description">
          Customize your study preferences to optimize your learning schedule.
        </p>
      </div>
      
      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}
      
      <div className="preferences-container">
        <div className="group-header">
          <h3>General Settings</h3>
          <p className="group-description">
            Configure your basic study preferences to customize how your study schedule is generated.
          </p>
        </div>
        
        <form className="preferences-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Weekly Study Hours</label>
            <div className="input-with-button">
              <input
                type="number"
                min="1"
                max="60"
                value={preferences.studyTime}
                onChange={(e) => setPreferences({ ...preferences, studyTime: e.target.value })}
              />
              <button 
                type="button" 
                className="suggest-button"
                onClick={suggestStudyHours}
              >
                Suggest Hours
              </button>
            </div>
            <small className="form-help-text">Number of study hours to generate each week (8 hours per course recommended)</small>
          </div>
          <div className="form-group">
            <label>Maximum Hours Per Day</label>
            <input
              type="number"
              value={preferences.maxHoursPerDay}
              onChange={(e) => setPreferences({ ...preferences, maxHoursPerDay: Number(e.target.value) })}
            />
          </div>
          <div className="form-group">
            <label>Preferred Time of Day</label>
            <select
              value={preferences.preferredTimeOfDay}
              onChange={(e) => handlePreferredTimeChange(e.target.value as "MORNING" | "AFTERNOON" | "EVENING" | "CIRCADIAN" | "PERSONALIZE")}
            >
              <option value="MORNING">Morning</option>
              <option value="AFTERNOON">Afternoon</option>
              <option value="EVENING">Evening</option>
              <option value="CIRCADIAN">Circadian Cycles</option>
              <option value="PERSONALIZE">Personalize</option>
            </select>
          </div>
          
          <button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </form>
      </div>

      {showPersonalizeGrid && (
        <div className="preference-grid-container">
          <div className="group-header">
            <h3>Customize Schedule</h3>
            <p className="group-description">
              Click on cells to cycle through preference levels. Red indicates unavailable times, while green indicates highly preferred study times.
            </p>
          </div>

          <div className="preference-grid">
            <div className="day-labels">
              <div className="corner-cell"></div>
              {DAYS.map((day, i) => (
                <div key={`day-${i}`} className="day-label">{day}</div>
              ))}
            </div>

            {HOURS.map((hour, hourIndex) => (
              <div key={`hour-${hourIndex}`} className="hour-row">
                <div className="hour-label">{hour}</div>
                {DAYS.map((_, dayIndex) => {
                  const cellIndex = (dayIndex * 15) + hourIndex;
                  const preferenceValue = preferences.personalizedVector[cellIndex];
                  return (
                    <div
                      key={`cell-${cellIndex}`}
                      className="preference-cell"
                      style={{ backgroundColor: PREFERENCE_COLORS[preferenceValue as keyof typeof PREFERENCE_COLORS] }}
                      onClick={() => handleCellToggle(cellIndex)}
                    >
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="preference-legend">
            <div className="legend-title">Preference Levels:</div>
            {PREFERENCE_VALUES.map(value => (
              <div key={`legend-${value}`} className="legend-item">
                <div 
                  className="legend-color" 
                  style={{ backgroundColor: PREFERENCE_COLORS[value as keyof typeof PREFERENCE_COLORS] }}
                ></div>
                <div className="legend-label">
                  {value === 0 ? 'Unavailable (0)' :
                   value === 2 ? 'Low Preference (2)' :
                   value === 4 ? 'Neutral (4)' :
                   value === 6 ? 'Preferred (6)' :
                   'Highly Preferred (9)'}
                </div>
              </div>
            ))}
          </div>

          <div className="reset-container">
            <button 
              type="button" 
              onClick={handleResetPersonalizedPreferences}
              className="reset-button"
            >
              Reset All to Neutral
            </button>
            <div className="fill-dropdown-container">
              <button 
                type="button" 
                onClick={() => setShowFillOptions(!showFillOptions)}
                className="fill-button"
              >
                Fill with Recommendations
              </button>
              {showFillOptions && (
                <>
                  <div className="overlay" onClick={() => setShowFillOptions(false)}></div>
                  <div className="fill-dropdown-menu">
                    <div 
                      className="fill-dropdown-item" 
                      onClick={() => handleFillWithRecommendations('MORNING')}
                    >
                      <div className="preference-pattern">
                        <span className="pattern-indicator high"></span>
                        <span className="pattern-indicator medium"></span>
                        <span className="pattern-indicator low"></span>
                        <span className="pattern-indicator very-low"></span>
                      </div>
                      <span>Morning Preference</span>
                    </div>
                    <div 
                      className="fill-dropdown-item" 
                      onClick={() => handleFillWithRecommendations('AFTERNOON')}
                    >
                      <div className="preference-pattern">
                        <span className="pattern-indicator low"></span>
                        <span className="pattern-indicator medium"></span>
                        <span className="pattern-indicator high"></span>
                        <span className="pattern-indicator low"></span>
                      </div>
                      <span>Afternoon Preference</span>
                    </div>
                    <div 
                      className="fill-dropdown-item" 
                      onClick={() => handleFillWithRecommendations('EVENING')}
                    >
                      <div className="preference-pattern">
                        <span className="pattern-indicator very-low"></span>
                        <span className="pattern-indicator low"></span>
                        <span className="pattern-indicator medium"></span>
                        <span className="pattern-indicator high"></span>
                      </div>
                      <span>Evening Preference</span>
                    </div>
                    <div 
                      className="fill-dropdown-item" 
                      onClick={() => handleFillWithRecommendations('CIRCADIAN')}
                    >
                      <div className="preference-pattern">
                        <span className="pattern-indicator medium"></span>
                        <span className="pattern-indicator high"></span>
                        <span className="pattern-indicator low"></span>
                        <span className="pattern-indicator high"></span>
                      </div>
                      <span>Circadian Cycles</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Preferences; 