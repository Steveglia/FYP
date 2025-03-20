import type { Schema } from "../../data/resource";
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/api';

let outputs: any;
try {
  outputs = require("../../../amplify_outputs.json");
} catch (err) {
  console.log('Amplify outputs not available:', err);
  outputs = {};
}

// Use the outputs directly - they already have the correct structure
Amplify.configure(outputs);

const client = generateClient<Schema>();

export const handler: Schema["generatePreferenceVector"]["functionHandler"] = async (event) => {
  const { availabilityVector, userId, mode } = event.arguments;
  
  // Define weekDays internally since it's always the same
  const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
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
          } else if (studyPreference.preferredTimeOfDay === 'AFTERNOON') {
            if (hour >= 12 && hour <= 17) {
              weekVector[vectorIndex] = 9;
            } else if ((hour >= 17 && hour <= 19) || (hour >= 10 && hour < 12)) {
              weekVector[vectorIndex] = 6;
            } else if ((hour >= 8 && hour < 10) || (hour > 19 && hour <= 20)) {
              weekVector[vectorIndex] = 4;
            } else {
              // Very early (before 8) or very late (after 20) hours
              weekVector[vectorIndex] = 2;
            }
          } else if (studyPreference.preferredTimeOfDay === 'PERSONALIZE' && studyPreference.personalizedVector) {
            try {
              // Parse the personalized vector from the stored JSON string
              const personalizedVector = JSON.parse(studyPreference.personalizedVector);
              
              // Use the personalized preference value, but only for available time slots
              if (personalizedVector && Array.isArray(personalizedVector) && personalizedVector.length === 105) {
                // If the personalized value is 0, this time slot is unavailable
                if (personalizedVector[vectorIndex] === 0) {
                  weekVector[vectorIndex] = 0; // Mark as unavailable
                  console.log(`Marking slot ${vectorIndex} (Day ${dayIndex + 1}, Hour ${hour}) as unavailable (0) based on user preference`);
                } else {
                  weekVector[vectorIndex] = personalizedVector[vectorIndex];
                  console.log(`Setting slot ${vectorIndex} (Day ${dayIndex + 1}, Hour ${hour}) to preference value ${personalizedVector[vectorIndex]}`);
                }
              } else {
                console.error('Invalid personalizedVector structure:', personalizedVector);
              }
            } catch (error) {
              console.error('Error parsing personalizedVector:', error);
              // In case of error, keep the slot available but with neutral preference
              weekVector[vectorIndex] = 4;
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
  
  // Check mode parameter to determine which action to take
  const operationMode = mode || 'STUDY'; // Default to STUDY for backward compatibility
  
  console.log(`Operating in ${operationMode} mode for user: ${userId}`);
  
  // For LEARNING mode, just return the preference vector
  if (operationMode === 'LEARNING') {
    console.log('Returning preference vector for personal learning optimization');
    return preferenceVectorString;
  }
  
  // For STUDY mode or default, generate study sessions
  try {
    console.log('Initiating study sessions generation for user:', userId);
    
    // Make the API call and wait for it to complete
    const result = await client.queries.generateStudySessions({
      preferenceVector: preferenceVectorString,
      userId: userId || ''
    });
    
    console.log('Successfully generated study sessions:', result);
    return JSON.stringify(result);
  } catch (error) {
    // Log the error but don't fail the function
    console.error('Error generating study sessions:', error);
    // Return the preference vector as fallback
    return preferenceVectorString;
  }
};