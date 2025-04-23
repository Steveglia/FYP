import { Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { generateClient } from 'aws-amplify/data';
import { getUrl, uploadData } from 'aws-amplify/storage';
import type { Schema } from '../amplify/data/resource';
import Navigation from './components/Navigation';
import Home from './pages/Home';
import Schedule from './pages/Schedule';
import Preferences from './pages/Preferences';
import ReviewSessions from './pages/ReviewSessions';
import CourseSelection from './components/CourseSelection';
import PersonalLearning from './components/PersonalLearning';
import FocusCoefficient from './pages/FocusCoefficient';
import './App.css';
import './components/CourseSelection.css';

const client = generateClient<Schema>();

async function initializeStudyPreference(userId: string) {
  try {
    const existingPrefs = await client.models.StudyPreference.list({
      filter: { owner: { eq: userId } }
    });

    if (existingPrefs.data.length === 0) {
      await client.models.StudyPreference.create({
        studyTime: "4",           // No longer used in UI, kept for compatibility
        maxHoursPerDay: 8,
        lunchBreakStart: "12:00", // No longer used in UI, kept for compatibility
        lunchBreakDuration: 60,   // No longer used in UI, kept for compatibility
        preferredTimeOfDay: "MORNING",
        owner: userId
      });
    }
  } catch (error) {
    console.error("Error initializing study preferences:", error);
    throw error;
  }
}

async function checkAndCreateUserFile(userId: string) {
  const fileName = `${userId}.json`;

  try {
    // Try to get the file URL - this will throw if file doesn't exist
    await getUrl({
      key: fileName
    });
  } catch (error: any) {
    if (error.name === 'StorageError') {
      // File doesn't exist, create it
      try {
        await uploadData({
          key: fileName,
          data: JSON.stringify({ events: [] }),
          options: {
            contentType: 'application/json'
          }
        });
      } catch (uploadError) {
        console.error('Error creating file:', uploadError);
        throw uploadError;
      }
    } else {
      console.error('Error checking file:', error);
      throw error;
    }
  }
}

function App() {
  const { user } = useAuthenticator();
  const [preferencesInitialized, setPreferencesInitialized] = useState(false);

  useEffect(() => {
    if (user && !preferencesInitialized) {
      initializeStudyPreference(user.username)
        .then(() => {
          setPreferencesInitialized(true);
          return checkAndCreateUserFile(user.username);
        })
        .catch((error) => console.error("Failed to initialize preferences or check file:", error));
    }
  }, [user, preferencesInitialized]);

  const handleCoursesChange = async (selectedCourses: string[]) => {
    console.log('Selected courses:', selectedCourses);
    
    if (user) {
      try {
        // First, get the existing preferences
        const { data: preferences } = await client.models.StudyPreference.list({
          filter: { owner: { eq: user.username } }
        });
        
        if (preferences.length > 0) {
          // Calculate recommended study hours (8 per course, capped at 60)
          const recommendedHours = Math.min(selectedCourses.length * 8, 60).toString();
          
          // Only update studyTime if there's a big change in course count
          const currentStudyTime = preferences[0].studyTime ? Number(preferences[0].studyTime) : 0;
          const suggestedStudyTime = Number(recommendedHours);
          
          // Update study time if it's a significant change (more than 2 courses difference)
          const significantChange = Math.abs(suggestedStudyTime - currentStudyTime) >= 16;
          
          if (significantChange) {
            // Update the study time as well
            await client.models.StudyPreference.update({
              id: preferences[0].id,
              studyTime: recommendedHours
            });
            
            console.log(`Updated study time to ${recommendedHours} hours based on ${selectedCourses.length} courses`);
          }
        }
      } catch (error) {
        console.error("Error updating study time:", error);
      }
    }
  };

  return (
    <div className="app">
      <Navigation />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/reviews" element={<ReviewSessions />} />
          <Route path="/preferences" element={<Preferences />} />
          <Route path="/courses" element={<CourseSelection onCoursesChange={handleCoursesChange} />} />
          <Route path="/personal-learning" element={<PersonalLearning />} />
          <Route path="/focus-coefficient" element={<FocusCoefficient />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
