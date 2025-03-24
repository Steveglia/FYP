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
    studyDuringWork: false,
    preferredTimeOfDay: "MORNING" as "MORNING" | "AFTERNOON" | "EVENING" | "PERSONALIZE",
    personalizedVector: new Array(105).fill(4) // Default to neutral preference (4)
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [showPersonalizeGrid, setShowPersonalizeGrid] = useState(false);
  const [showFillOptions, setShowFillOptions] = useState(false);

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

          setPreferences({
            studyTime: userPrefs.studyTime ?? "4",
            maxHoursPerDay: userPrefs.maxHoursPerDay ?? 8,
            lunchBreakStart: userPrefs.lunchBreakStart ?? "12:00",
            lunchBreakDuration: userPrefs.lunchBreakDuration ?? 60,
            studyDuringWork: userPrefs.studyDuringWork ?? false,
            preferredTimeOfDay: (userPrefs.preferredTimeOfDay ?? "MORNING") as "MORNING" | "AFTERNOON" | "EVENING" | "PERSONALIZE",
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
            studyDuringWork: false,
            preferredTimeOfDay: "MORNING" as "MORNING" | "AFTERNOON" | "EVENING" | "PERSONALIZE",
            personalizedVector: new Array(105).fill(4),
            owner: user.username
          };

          const { errors: createErrors } = await client.models.StudyPreference.create({
            studyTime: defaultPrefs.studyTime,
            maxHoursPerDay: defaultPrefs.maxHoursPerDay,
            lunchBreakStart: defaultPrefs.lunchBreakStart,
            lunchBreakDuration: defaultPrefs.lunchBreakDuration,
            studyDuringWork: defaultPrefs.studyDuringWork,
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
  const handlePreferredTimeChange = (value: "MORNING" | "AFTERNOON" | "EVENING" | "PERSONALIZE") => {
    setPreferences({ ...preferences, preferredTimeOfDay: value });
    setShowPersonalizeGrid(value === "PERSONALIZE");
  };

  // Fill grid with recommended values based on preferred time of day
  const handleFillWithRecommendations = (selectedOption: 'MORNING' | 'AFTERNOON' | 'EVENING') => {
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

  const validatePreferences = () => {
    if (preferences.maxHoursPerDay <= 0 || preferences.maxHoursPerDay > 24) {
      setMessage({ type: 'error', text: 'Maximum hours per day must be between 1 and 24' });
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
          studyDuringWork: preferences.studyDuringWork,
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
          studyDuringWork: preferences.studyDuringWork,
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
            <label>Maximum Hours Per Day</label>
            <input
              type="number"
              value={preferences.maxHoursPerDay}
              onChange={(e) => setPreferences({ ...preferences, maxHoursPerDay: Number(e.target.value) })}
            />
          </div>
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={preferences.studyDuringWork}
                onChange={(e) => setPreferences({ ...preferences, studyDuringWork: e.target.checked })}
              />
              Allow Study During Work Hours
            </label>
          </div>
          <div className="form-group">
            <label>Preferred Time of Day</label>
            <select
              value={preferences.preferredTimeOfDay}
              onChange={(e) => handlePreferredTimeChange(e.target.value as "MORNING" | "AFTERNOON" | "EVENING" | "PERSONALIZE")}
            >
              <option value="MORNING">Morning</option>
              <option value="AFTERNOON">Afternoon</option>
              <option value="EVENING">Evening</option>
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