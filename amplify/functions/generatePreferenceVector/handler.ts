import type { Schema } from "../../data/resource";
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/api';

// Load configuration before creating the client
let outputs: any;
try {
  // Dynamically require the outputs; this will run at runtime
  outputs = require("../../../amplify_outputs.json");
  console.log('Loaded Amplify outputs successfully');
} catch (err) {
  // Handle the case where the file is not yet available
  console.log('Amplify outputs not available:', err);
  outputs = {};
}

// Make sure we have the required GraphQL configuration
if (!outputs.api) {
  console.log('Adding default API configuration');
  outputs.api = {
    GraphQL: {
      endpoint: process.env.API_ENDPOINT,
      region: process.env.REGION || 'us-east-1',
      defaultAuthMode: 'apiKey',
      apiKey: process.env.API_KEY
    }
  };
}

// Configure Amplify before generating the client
console.log('Configuring Amplify with:', JSON.stringify(outputs, null, 2));
Amplify.configure(outputs);

// Generate the client after configuration
const client = generateClient<Schema>();

export const handler: Schema["generatePreferenceVector"]["functionHandler"] = async (event) => {
  const { availabilityVector, userId } = event.arguments;
  
  // Define weekDays internally since it's always the same
  const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  try {
    const studyPreferences = await client.models.StudyPreference.list({
      filter: { owner: { eq: userId || '' } }
    });
    
    const studyPreference = studyPreferences.data[0];
    
    // Parse the availability vector from string to array
    const weekVector = availabilityVector ? 
      JSON.parse(availabilityVector) : 
      new Array(105).fill(1);
    
    // Apply preferences to available time slots
    if (studyPreference) {
      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        for (let hour = 8; hour <= 22; hour++) {
          const vectorIndex = (dayIndex * 15) + (hour - 8);
          
          // Only modify available time slots (where value is 1)
          if (weekVector[vectorIndex] === 1) {
            if (studyPreference.preferredTimeOfDay === 'MORNING') {
              if (hour >= 8 && hour <= 12) {
                weekVector[vectorIndex] = 9;
              } else if (hour > 12 && hour <= 15) {
                weekVector[vectorIndex] = 6;
              } else if (hour > 15 && hour <= 18) {
                weekVector[vectorIndex] = 4;
              } else {
                weekVector[vectorIndex] = 2;
              }
            } else if (studyPreference.preferredTimeOfDay === 'EVENING') {
              if (hour >= 18 && hour <= 22) {
                weekVector[vectorIndex] = 9;
              } else if (hour >= 15 && hour < 18) {
                weekVector[vectorIndex] = 6;
              } else if (hour >= 12 && hour < 15) {
                weekVector[vectorIndex] = 4;
              } else {
                weekVector[vectorIndex] = 2;
              }
            }
          }
        }
      }
    }

    // Log the vector
    console.log('Week Schedule Vector with Preferences:');
    weekDays.forEach((day, dayIndex) => {
      const dayVector = weekVector.slice(dayIndex * 15, (dayIndex + 1) * 15);
      console.log(`${day}:`, dayVector.join(' '));
    });

    // Convert the vector to a string
    const preferenceVectorString = JSON.stringify(weekVector);
    
    // Initialize studySessions variable
    let studySessions = null;
    
    // Generate study sessions using the preference vector
    try {
      console.log('Initiating study sessions generation for user:', userId);
      
      // Make the API call and wait for it to complete
      const result = await client.queries.generateStudySessions({
        preferenceVector: preferenceVectorString,
        userId: userId || ''
      });
      
      console.log('Successfully generated study sessions:', result);
      studySessions = result;
    } catch (error) {
      // Log the error but don't fail the function
      console.error('Error generating study sessions:', error);
    }
    
    return JSON.stringify(studySessions);
  } catch (error) {
    console.error('Error in generatePreferenceVector handler:', error);
    throw error;
  }
};