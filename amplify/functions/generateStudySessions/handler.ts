import type { Schema } from "../../data/resource";
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/api';
import { generateStudySchedule as scheduleGenerator } from './studyScheduler';

let outputs: any;
try {
  // Dynamically require the outputs; this will run at runtime
  outputs = require("../../../amplify_outputs.json");
} catch (err) {
  // Handle the case where the file is not yet available
  console.log('Amplify outputs not available:', err);
  outputs = {};
}

Amplify.configure(outputs);

const client = generateClient<Schema>();

export const handler: Schema["generateStudySessions"]["functionHandler"] = async (event) => {
  console.log('generateStudySessions handler called with arguments:', JSON.stringify(event.arguments));
  
  const { preferenceVector, userId } = event.arguments;
  
  // Define weekdays
  const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  // Parse the preference vector from string to array
  const weekVector = preferenceVector ? 
    JSON.parse(preferenceVector) : 
    new Array(105).fill(1);
  
  console.log('Parsed preference vector:', weekVector.length, 'elements');
  
  // Get user's study preferences
  console.log('Fetching study preferences for user:', userId);
  const studyPreferences = await client.models.StudyPreference.list({
    filter: { owner: { eq: userId || '' } }
  });
  
  console.log('Study preferences found:', studyPreferences.data.length);
  const studyPreference = studyPreferences.data[0];
  
  if (studyPreference) {
    console.log('Using study preferences:', JSON.stringify(studyPreference));
  } else {
    console.log('No study preferences found, using defaults');
  }
  
  // Default values if no preferences are found
  const maxHoursPerDay = studyPreference?.maxHoursPerDay || 4;
  const courses = studyPreference?.courses || [];
  
  console.log('Using maxHoursPerDay:', maxHoursPerDay);
  console.log('Available courses:', courses);
  
  // Determine which days have available slots based on preference vector
  const availableDays: string[] = [];
  
  // Check each day to see if it has available slots
  weekDays.forEach((day, dayIndex) => {
    const dayVector = weekVector.slice(dayIndex * 15, (dayIndex + 1) * 15);
    // If any slot in the day has a value > 0, consider the day available
    if (dayVector.some((value: number) => value > 0)) {
      availableDays.push(day);
    }
  });
  
  console.log('Available days for study:', availableDays);
  
  // Generate study sessions for available days using the renamed import
  console.log('Generating study sessions...');
  const generatedSessions = scheduleGenerator(availableDays);
  console.log('Generated raw sessions:', JSON.stringify(generatedSessions));
  
  // Convert the generated sessions to a format that includes course information
  const finalSessions = generatedSessions.map((session, index) => {
    // Assign courses in a round-robin fashion if available
    const courseIndex = index % courses.length;
    const course = courses.length > 0 ? courses[courseIndex] : "Study Session";
    
    // Convert 0-indexed hour to actual time (assuming 8am start)
    const startHour = session.hour + 8;
    const endHour = startHour + 1;
    
    return {
      day: session.day,
      startTime: `${startHour}:00`,
      endTime: `${endHour}:00`,
      course: course
    };
  });
  
  console.log('Final formatted sessions:', JSON.stringify(finalSessions));
  
  // Convert the array back to a JSON string before returning
  // This is necessary because the function type expects a string return value
  const result = JSON.stringify(finalSessions);
  console.log('Returning result with', finalSessions.length, 'sessions');
  return result;
};
  