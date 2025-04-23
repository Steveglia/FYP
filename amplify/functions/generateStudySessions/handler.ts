import type { Schema } from "../../data/resource";
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/api';
import outputs from "../../../amplify_outputs.json"

// Import the restructured components
import { Config } from './types';
import { FitnessEvaluator } from './models/FitnessEvaluator';
import { DFOBest } from './models/DFOBest';
import { formatStudySessions } from './utils/formatters';
import { verifyStudySessions, extractStudySlots } from './utils/validators';
import { getAvailableDays, createConfig } from './utils/preferences';

Amplify.configure(outputs);

const client = generateClient<Schema>();

/**
 * Handler function for generating study sessions
 * This function takes a preference vector and user ID, then generates optimized study sessions
 * based on the user's preferences and availability.
 */
export const handler: Schema["generateStudySessions"]["functionHandler"] = async (event) => {
  console.log('generateStudySessions handler called with arguments:', JSON.stringify(event.arguments));
  
  const { preferenceVector, userId } = event.arguments;
  console.log('preferenceVector:', preferenceVector);
  
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
  const courses = studyPreference?.courses?.filter(course => typeof course === 'string') || [];
  // Use the user's study time preference or default to 16 hours
  const totalStudyHours = studyPreference?.studyTime ? Number(studyPreference.studyTime) : 16;
  
  console.log('Using maxHoursPerDay:', maxHoursPerDay);
  console.log('Using totalStudyHours:', totalStudyHours);
  console.log('Available courses:', courses);
  
  // Determine which days have available slots based on preference vector
  const availableDays = getAvailableDays(weekDays, weekVector);
  console.log('Available days for study:', availableDays);
  
  // Increase the penalties to discourage single-hour blocks and long blocks
  const SINGLE_HOUR_BLOCK_PENALTY = 50; // Increased from 30
  const LONG_BLOCK_PENALTY = 80;        // Increased from 40
  const TWO_HOUR_BLOCK_BONUS = 30;      // Bonus for ideal 2-hour blocks
  
  // Configure the DFO algorithm
  const config = createConfig(availableDays, totalStudyHours, maxHoursPerDay);
  console.log('DFO configuration:', JSON.stringify(config, null, 2));
  
  console.log('Penalty configuration:');
  console.log(`  - Single hour block penalty: ${SINGLE_HOUR_BLOCK_PENALTY}`);
  console.log(`  - Long block penalty: ${LONG_BLOCK_PENALTY}`);
  console.log(`  - Two hour block bonus: ${TWO_HOUR_BLOCK_BONUS}`);
  
  // Create a fitness evaluator with the preference vector and penalties
  const fitnessEvaluator = new FitnessEvaluator(
    config, 
    weekVector, 
    SINGLE_HOUR_BLOCK_PENALTY,
    LONG_BLOCK_PENALTY,
    TWO_HOUR_BLOCK_BONUS
  );
  
  // Create and run the DFO algorithm with hill climbing
  console.log('Running DFO algorithm with hill climbing to generate study sessions...');
  const dfo = new DFOBest(config, fitnessEvaluator);
  const [bestSolution, bestFitness] = dfo.run();
  
  console.log('DFO algorithm completed with fitness:', bestFitness);
  
  // Format the study sessions for display on the calendar
  const formattedSessions = formatStudySessions(
    availableDays,
    bestSolution,
    config.HOURS_PER_DAY,
    courses
  );
  
  console.log('Formatted study sessions:', JSON.stringify(formattedSessions, null, 2));
  
  // Extract and log the study slots in a more readable format
  const studySlots = extractStudySlots(bestSolution, config.HOURS_PER_DAY, availableDays);
  console.log('Study slots:', JSON.stringify(studySlots, null, 2));
  
  // Verify that no unavailable slots have been selected
  const verification = verifyStudySessions(bestSolution, weekVector, config.HOURS_PER_DAY, availableDays);
  
  if (verification.unavailableSlotSelected) {
    console.error('WARNING: Study sessions were scheduled during unavailable time slots:', 
      JSON.stringify(verification.unavailableSlots, null, 2));
  } else {
    console.log('Verification successful: No study sessions were scheduled during unavailable time slots');
  }
  
  // Return the formatted sessions as a JSON string
  return JSON.stringify(formattedSessions);
};
  