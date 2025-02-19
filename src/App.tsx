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
import './App.css';

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
        preferredStartTime: "09:00",
        preferredEndTime: "17:00",
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
    console.log('File exists');
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
        console.log('File created');
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

  return (
    <div className="app">
      <Navigation />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/preferences" element={<Preferences />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
