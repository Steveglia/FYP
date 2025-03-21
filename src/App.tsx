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
        studyTime: "4",
        maxHoursPerDay: 8,
        lunchBreakStart: "12:00",
        lunchBreakDuration: 60,
        studyDuringWork: false,
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

  const handleCoursesChange = (selectedCourses: string[]) => {
    console.log('Selected courses:', selectedCourses);
    // You can handle the selected courses here, e.g., save to state or send to an API
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
