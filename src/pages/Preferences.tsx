import { useEffect, useState } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

const Preferences = () => {
  const { user } = useAuthenticator();
  const [preferences, setPreferences] = useState({
    studyTime: "4",
    maxHoursPerDay: 8,
    lunchBreakStart: "12:00",
    lunchBreakDuration: 60,
    studyDuringWork: false,
    preferredStartTime: "09:00",
    preferredEndTime: "17:00"
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    async function loadPreferences() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const response = await client.models.StudyPreference.list({
          filter: { owner: { eq: user.username } }
        });
        
        if (response.data.length > 0) {
          const userPrefs = response.data[0];
          setPreferences({
            studyTime: userPrefs.studyTime ?? "4",
            maxHoursPerDay: userPrefs.maxHoursPerDay ?? 8,
            lunchBreakStart: userPrefs.lunchBreakStart ?? "12:00",
            lunchBreakDuration: userPrefs.lunchBreakDuration ?? 60,
            studyDuringWork: userPrefs.studyDuringWork ?? false,
            preferredStartTime: userPrefs.preferredStartTime ?? "09:00",
            preferredEndTime: userPrefs.preferredEndTime ?? "17:00"
          });
        }
      } catch (error) {
        console.error("Error loading preferences:", error);
        setMessage({ type: 'error', text: 'Failed to load preferences. Please try again.' });
      } finally {
        setLoading(false);
      }
    }

    loadPreferences();
  }, [user]);

  const validatePreferences = () => {
    if (Number(preferences.studyTime) <= 0) {
      setMessage({ type: 'error', text: 'Study time must be greater than 0' });
      return false;
    }
    if (preferences.maxHoursPerDay <= 0 || preferences.maxHoursPerDay > 24) {
      setMessage({ type: 'error', text: 'Maximum hours per day must be between 1 and 24' });
      return false;
    }
    if (preferences.lunchBreakDuration <= 0) {
      setMessage({ type: 'error', text: 'Lunch break duration must be greater than 0' });
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setMessage({ type: 'error', text: 'Please log in to save preferences' });
      return;
    }

    if (!validatePreferences()) {
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await client.models.StudyPreference.list({
        filter: { owner: { eq: user.username } }
      });

      if (response.data.length > 0) {
        const existingPref = response.data[0];
        await client.models.StudyPreference.update({
          id: existingPref.id,
          studyTime: preferences.studyTime,
          maxHoursPerDay: preferences.maxHoursPerDay,
          lunchBreakStart: preferences.lunchBreakStart,
          lunchBreakDuration: preferences.lunchBreakDuration,
          studyDuringWork: preferences.studyDuringWork,
          preferredStartTime: preferences.preferredStartTime,
          preferredEndTime: preferences.preferredEndTime,
          owner: user.username
        });
        setMessage({ type: 'success', text: 'Preferences saved successfully!' });
      }
    } catch (error) {
      console.error("Error saving preferences:", error);
      setMessage({ type: 'error', text: 'Failed to save preferences. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return <div className="preferences-page">Please log in to view and edit preferences.</div>;
  }

  if (loading) {
    return <div className="preferences-page">Loading preferences...</div>;
  }

  return (
    <div className="preferences-page">
      <h1>Study Preferences</h1>
      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}
      <form className="preferences-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Daily Study Time (hours)</label>
          <input
            type="number"
            min="1"
            max="24"
            value={preferences.studyTime}
            onChange={(e) => setPreferences({ ...preferences, studyTime: e.target.value })}
          />
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
          <label>Lunch Break Start</label>
          <input
            type="time"
            value={preferences.lunchBreakStart}
            onChange={(e) => setPreferences({ ...preferences, lunchBreakStart: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label>Lunch Break Duration (minutes)</label>
          <input
            type="number"
            value={preferences.lunchBreakDuration}
            onChange={(e) => setPreferences({ ...preferences, lunchBreakDuration: Number(e.target.value) })}
          />
        </div>
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={preferences.studyDuringWork}
              onChange={(e) => setPreferences({ ...preferences, studyDuringWork: e.target.checked })}
            />
            Allow Study During Work Hours
          </label>
        </div>
        <div className="form-group">
          <label>Preferred Start Time</label>
          <input
            type="time"
            value={preferences.preferredStartTime}
            onChange={(e) => setPreferences({ ...preferences, preferredStartTime: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label>Preferred End Time</label>
          <input
            type="time"
            value={preferences.preferredEndTime}
            onChange={(e) => setPreferences({ ...preferences, preferredEndTime: e.target.value })}
          />
        </div>
        <button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
      </form>
    </div>
  );
};

export default Preferences; 