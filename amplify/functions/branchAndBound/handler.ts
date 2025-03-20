import type { Schema } from "../../data/resource";
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/api';

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

// Standard week days for reference
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Constants for the schedule setup
const HOURS_PER_DAY = 15; // From 8:00 to 22:00 (15 hours)
const NUM_DAYS = 7; // 7 days a week
const TOTAL_SLOTS = HOURS_PER_DAY * NUM_DAYS; // 105 slots in total
const START_HOUR = 8; // Start at 8:00

// Interface for the scheduling problem configuration
interface SchedulingConfig {
  // Configuration parameters
  requiredHours: number;     // Total number of hours to schedule
  maxDailyHours: number;     // Maximum hours per day
  timeLimit: number;         // Time limit in milliseconds
  // Scheduling preferences
  preferTwoHourBlocks: boolean;  // Prefer 2-hour blocks
  penalizeSingleHourBlocks: boolean; // Penalize single hour blocks
  penalizeLongBlocks: boolean;   // Penalize blocks longer than 2 hours
}

// Node in the branch and bound tree
class SchedulingNode {
  level: number;              // Level of node in the decision tree (corresponds to timeslot index)
  selectedHours: number;      // Number of hours selected so far
  totalValue: number;         // Total preference value accumulated
  bound: number;              // Upper bound on maximum achievable value
  schedule: boolean[];        // The schedule (true = selected slot)

  constructor(level: number, selectedHours: number, totalValue: number, schedule: boolean[]) {
    this.level = level;
    this.selectedHours = selectedHours;
    this.totalValue = totalValue;
    this.bound = 0;
    this.schedule = schedule;
  }
}

/**
 * Branch and Bound Algorithm for Scheduling Problem
 */
class SchedulingBranchAndBound {
  private preferences: number[];      // Preference value for each timeslot
  private config: SchedulingConfig;   // Configuration parameters
  private bestValue: number;          // Best solution value found
  private bestSchedule: boolean[];    // Best schedule found
  private startTime: number;          // Start time of algorithm

  constructor(preferences: number[], config: SchedulingConfig) {
    this.preferences = preferences;
    this.config = config;
    this.bestValue = 0;
    this.bestSchedule = Array(TOTAL_SLOTS).fill(false);
    this.startTime = 0;
  }

  /**
   * Calculate the upper bound on the maximum achievable value
   */
  private calculateBound(node: SchedulingNode): number {
    // If we've already selected all required hours, return current value
    if (node.selectedHours >= this.config.requiredHours) {
      return node.totalValue;
    }

    // Create a list of remaining slots and their values
    const remainingSlots: { index: number; value: number }[] = [];
    for (let i = node.level + 1; i < TOTAL_SLOTS; i++) {
      // Only include valid slots (preference > 0)
      if (this.preferences[i] > 0) {
        remainingSlots.push({ index: i, value: this.preferences[i] });
      }
    }

    // Sort by preference value in descending order
    remainingSlots.sort((a, b) => b.value - a.value);

    // Calculate upper bound by adding the highest value slots
    let bound = node.totalValue;
    let hoursNeeded = this.config.requiredHours - node.selectedHours;
    
    // Early termination if not enough slots remain
    if (remainingSlots.length < hoursNeeded) {
      return -Infinity; // This branch can't produce a valid solution
    }
    
    for (const slot of remainingSlots) {
      if (hoursNeeded <= 0) break;
      
      bound += slot.value;
      hoursNeeded--;
    }

    return bound;
  }

  /**
   * Check if the schedule is valid considering scheduling constraints
   */
  private isValidSchedule(schedule: boolean[]): boolean {
    // Check if total hours is correct
    const totalHours = schedule.reduce((sum, selected) => sum + (selected ? 1 : 0), 0);
    if (totalHours !== this.config.requiredHours) {
      return false;
    }

    // Check daily hour constraints
    for (let day = 0; day < NUM_DAYS; day++) {
      const dayStart = day * HOURS_PER_DAY;
      const dayEnd = dayStart + HOURS_PER_DAY;
      
      let dailyHours = 0;
      for (let hour = dayStart; hour < dayEnd; hour++) {
        if (schedule[hour]) {
          dailyHours++;
        }
      }
      
      if (dailyHours > this.config.maxDailyHours) {
        return false;
      }
    }

    // Check for invalid slots (preference <= 0)
    for (let i = 0; i < schedule.length; i++) {
      if (schedule[i] && this.preferences[i] <= 0) {
        console.log(`Invalid slot selected: index ${i} with preference ${this.preferences[i]}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate the value of a schedule, including bonuses and penalties
   */
  private calculateScheduleValue(schedule: boolean[]): number {
    let value = 0;
    
    // Base value from preferences
    for (let i = 0; i < schedule.length; i++) {
      if (schedule[i]) {
        value += this.preferences[i];
      }
    }
    
    // Apply bonuses and penalties for block lengths
    if (this.config.preferTwoHourBlocks || 
        this.config.penalizeSingleHourBlocks || 
        this.config.penalizeLongBlocks) {
      
      for (let day = 0; day < NUM_DAYS; day++) {
        const dayStart = day * HOURS_PER_DAY;
        const dayEnd = dayStart + HOURS_PER_DAY;
        
        let blockLength = 0;
        for (let hour = dayStart; hour < dayEnd; hour++) {
          if (schedule[hour]) {
            blockLength++;
          } else if (blockLength > 0) {
            // Apply block length adjustments
            if (blockLength === 1 && this.config.penalizeSingleHourBlocks) {
              value -= 30; // Penalty for single hour blocks
            } else if (blockLength === 2 && this.config.preferTwoHourBlocks) {
              value += 20; // Bonus for ideal 2-hour blocks
            } else if (blockLength > 2 && this.config.penalizeLongBlocks) {
              value -= (blockLength - 2) * 40; // Penalty for blocks longer than 2 hours
            }
            blockLength = 0;
          }
        }
        
        // Check last block of the day
        if (blockLength > 0) {
          if (blockLength === 1 && this.config.penalizeSingleHourBlocks) {
            value -= 30;
          } else if (blockLength === 2 && this.config.preferTwoHourBlocks) {
            value += 20;
          } else if (blockLength > 2 && this.config.penalizeLongBlocks) {
            value -= (blockLength - 2) * 40;
          }
        }
      }
    }
    
    return value;
  }

  /**
   * Execute the branch and bound algorithm
   */
  public solve(): { schedule: boolean[], value: number, selectedHours: number, executionTimeMs: number } {
    this.startTime = Date.now();
    this.bestValue = 0;
    
    // Create a queue to store live nodes of the search tree
    const queue: SchedulingNode[] = [];
    
    // Create the root node and calculate its bound
    const rootSchedule = Array(TOTAL_SLOTS).fill(false);
    const root = new SchedulingNode(-1, 0, 0, rootSchedule);
    root.bound = this.calculateBound(root);
    queue.push(root);

    // Loop until queue is empty or time limit is reached
    while (queue.length > 0 && (Date.now() - this.startTime) < this.config.timeLimit) {
      // Find the node with the best bound
      let maxIndex = 0;
      for (let i = 1; i < queue.length; i++) {
        if (queue[i].bound > queue[maxIndex].bound) {
          maxIndex = i;
        }
      }

      // Extract the node with best bound
      const node = queue.splice(maxIndex, 1)[0];

      // If the bound of the current node is less than the best value so far,
      // then we can prune this branch
      if (node.bound <= this.bestValue) {
        continue;
      }

      // If we've reached a leaf node or the last time slot
      if (node.level >= TOTAL_SLOTS - 1) {
        // If this is a valid schedule and better than our current best, update best
        if (this.isValidSchedule(node.schedule)) {
          const scheduleValue = this.calculateScheduleValue(node.schedule);
          if (scheduleValue > this.bestValue) {
            this.bestValue = scheduleValue;
            this.bestSchedule = [...node.schedule];
          }
        }
        continue;
      }

      // Increment level to consider the next time slot
      const nextLevel = node.level + 1;
      
      // Check if we can include this time slot (valid preference and not exceeding requirements)
      if (this.preferences[nextLevel] > 0 && node.selectedHours < this.config.requiredHours) {
        // Check if adding this slot would exceed daily hour limits
        const day = Math.floor(nextLevel / HOURS_PER_DAY);
        const dayStart = day * HOURS_PER_DAY;
        const dayEnd = dayStart + HOURS_PER_DAY;
        
        let dailyHours = 0;
        for (let hour = dayStart; hour < dayEnd; hour++) {
          if (hour <= node.level && node.schedule[hour]) {
            dailyHours++;
          }
        }
        
        if (dailyHours < this.config.maxDailyHours) {
          // Create a child node where the time slot is included
          const includeSchedule = [...node.schedule];
          includeSchedule[nextLevel] = true;
          
          const includeNode = new SchedulingNode(
            nextLevel,
            node.selectedHours + 1,
            node.totalValue + this.preferences[nextLevel],
            includeSchedule
          );
          
          // If we've selected all required hours, check if this schedule is valid
          if (includeNode.selectedHours === this.config.requiredHours) {
            if (this.isValidSchedule(includeNode.schedule)) {
              const scheduleValue = this.calculateScheduleValue(includeNode.schedule);
              if (scheduleValue > this.bestValue) {
                this.bestValue = scheduleValue;
                this.bestSchedule = [...includeNode.schedule];
              }
            }
          } else {
            // Calculate the bound and add to the queue if promising
            includeNode.bound = this.calculateBound(includeNode);
            if (includeNode.bound > this.bestValue) {
              queue.push(includeNode);
            }
          }
        }
      }
      
      // Create a child node where the time slot is excluded
      const excludeSchedule = [...node.schedule];
      const excludeNode = new SchedulingNode(
        nextLevel,
        node.selectedHours,
        node.totalValue,
        excludeSchedule
      );
      
      // Calculate the bound and add to the queue if promising
      excludeNode.bound = this.calculateBound(excludeNode);
      if (excludeNode.bound > this.bestValue) {
        queue.push(excludeNode);
      }
    }

    return {
      schedule: this.bestSchedule,
      value: this.bestValue,
      selectedHours: this.bestSchedule.reduce((sum, selected) => sum + (selected ? 1 : 0), 0),
      executionTimeMs: Date.now() - this.startTime
    };
  }
}

/**
 * Convert boolean schedule to time slots
 */
function scheduleToTimeSlots(schedule: boolean[]): { day: string; hour: number }[] {
  const timeSlots: { day: string; hour: number }[] = [];
  
  for (let i = 0; i < schedule.length; i++) {
    if (schedule[i]) {
      const dayIndex = Math.floor(i / HOURS_PER_DAY);
      const day = WEEKDAYS[dayIndex];
      const hourOffset = i % HOURS_PER_DAY;
      const hour = START_HOUR + hourOffset;
      timeSlots.push({ day, hour });
    }
  }
  
  return timeSlots;
}

/**
 * Pretty print the schedule for debugging
 */
function prettyPrintSchedule(schedule: boolean[], preferences: number[]): string {
  let output = '';
  
  for (let day = 0; day < NUM_DAYS; day++) {
    output += `${WEEKDAYS[day]}:\n`;
    output += '   | ';
    
    for (let h = 0; h < HOURS_PER_DAY; h++) {
      const hour = START_HOUR + h;
      output += `${hour}`.padStart(2, '0') + ' | ';
    }
    
    output += '\n   | ';
    
    for (let h = 0; h < HOURS_PER_DAY; h++) {
      const index = day * HOURS_PER_DAY + h;
      output += (schedule[index] ? 'X' : ' ').padEnd(2, ' ') + ' | ';
    }
    
    output += '\n   | ';
    
    for (let h = 0; h < HOURS_PER_DAY; h++) {
      const index = day * HOURS_PER_DAY + h;
      output += (preferences[index] + '').padEnd(2, ' ') + ' | ';
    }
    
    output += '\n\n';
  }
  
  return output;
}

/**
 * Lambda handler function
 */
export const handler = async (event: any) => {
  try {
    console.log('Received event:', JSON.stringify(event, null, 2));
    
    // Log more details about the event structure to debug
    console.log('Event type:', typeof event);
    console.log('Event keys:', Object.keys(event));
    
    // Handle AppSync event structure
    const isAppSyncEvent = event.typeName && event.fieldName && event.arguments;
    if (isAppSyncEvent) {
      console.log('Detected AppSync event structure');
      event = event.arguments;
    }
    
    if (event.arguments) {
      console.log('Arguments type:', typeof event.arguments);
      console.log('Arguments keys:', Object.keys(event.arguments));
      console.log('preferenceVector exists:', 'preferenceVector' in event.arguments);
      console.log('preferenceVector type:', typeof event.arguments.preferenceVector);
      
      // If we're in an AppSync context, use the event.arguments structure
      if (typeof event.arguments.preferenceVector === 'string') {
        event = event.arguments;
        console.log('Detected AppSync event, reassigned event to event.arguments');
      }
    }
    
    // Extract preference vector and configuration from the event
    let preferences: number[] = [];
    
    // More detailed logging about what's in the event
    console.log('After potential reassignment:');
    console.log('Event type:', typeof event);
    console.log('Event keys:', Object.keys(event));
    console.log('preferenceVector exists:', 'preferenceVector' in event);
    console.log('preferenceVector type:', typeof event.preferenceVector);
    
    // Check if the preference vector is a string (JSON) or already an array
    if (typeof event.preferenceVector === 'string') {
      try {
        console.log('Attempting to parse preferenceVector string');
        preferences = JSON.parse(event.preferenceVector);
        console.log('Successfully parsed preferenceVector, length:', preferences.length);
      } catch (e: any) {
        console.error('Error parsing preference vector:', e);
        const errorResponse = {
          error: "Invalid preference vector format",
          details: e.message,
          receivedValue: event.preferenceVector.substring(0, 100) + '...' // Show a snippet of what was received
        };
        
        // Return in the correct format based on event source
        if (isAppSyncEvent) {
          return JSON.stringify({ error: "Invalid preference vector format" });
        }
        
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "Invalid preference vector format" })
        };
      }
    } else if (Array.isArray(event.preferenceVector)) {
      console.log('preferenceVector is already an array');
      preferences = event.preferenceVector;
    } else if (Array.isArray(event.preferences)) {
      console.log('Using event.preferences instead');
      preferences = event.preferences;
    } else {
      console.error('No preference vector found in event:', JSON.stringify({
        hasPreferenceVector: 'preferenceVector' in event,
        preferenceVectorType: typeof event.preferenceVector,
        hasPreferences: 'preferences' in event,
        preferencesType: typeof event.preferences
      }));
      
      // Return in the correct format based on event source
      if (isAppSyncEvent) {
        return JSON.stringify({ error: "No preference vector provided" });
      }
      
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No preference vector provided" })
      };
    }
    
    // Print preference vector analysis
    console.log('Preference vector analysis:');
    console.log(`Total slots: ${preferences.length}`);
    console.log(`Available slots (preference > 0): ${preferences.filter(p => p > 0).length}`);
    console.log(`Unavailable slots (preference <= 0): ${preferences.filter(p => p <= 0).length}`);
    
    // Analysis of preference values distribution
    const valueDistribution: Record<number, number> = {};
    preferences.forEach(value => {
      valueDistribution[value] = (valueDistribution[value] || 0) + 1;
    });
    console.log('Preference value distribution:', valueDistribution);
    
    // Daily analysis
    console.log('Daily slot availability:');
    for (let day = 0; day < NUM_DAYS; day++) {
      const dayStart = day * HOURS_PER_DAY;
      const daySlots = preferences.slice(dayStart, dayStart + HOURS_PER_DAY);
      const availableDaySlots = daySlots.filter(p => p > 0).length;
      console.log(`${WEEKDAYS[day]}: ${availableDaySlots} available slots out of ${HOURS_PER_DAY}`);
    }
    
    // Validate that there are enough non-zero slots to satisfy requiredHours
    const availableSlots = preferences.filter(p => p > 0).length;
    const requiredHours = event.requiredHours || 14;
    
    if (availableSlots < requiredHours) {
      console.warn(`Not enough available slots (${availableSlots}) to satisfy required hours (${requiredHours})`);
      
      // Return in the correct format based on event source
      if (isAppSyncEvent) {
        return JSON.stringify({ timeSlots: [] });
      }
      
      return {
        statusCode: 200,
        body: JSON.stringify({ timeSlots: [] })
      };
    }
    
    const config: SchedulingConfig = {
      requiredHours: requiredHours,
      maxDailyHours: event.maxDailyHours || 4,  // Default to max 4 hours per day
      timeLimit: event.timeLimit || 10000,      // Default 10 seconds
      preferTwoHourBlocks: event.preferTwoHourBlocks !== false,
      penalizeSingleHourBlocks: event.penalizeSingleHourBlocks !== false,
      penalizeLongBlocks: event.penalizeLongBlocks !== false
    };

    // Validate input
    if (preferences.length === 0) {
      console.error('Empty preference vector');
      // Return in the correct format based on event source
      if (isAppSyncEvent) {
        return JSON.stringify({ error: "Empty preference vector" });
      }
      
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Empty preference vector" })
      };
    }
    
    if (config.requiredHours <= 0) {
      console.error('Invalid required hours:', config.requiredHours);
      // Return in the correct format based on event source
      if (isAppSyncEvent) {
        return JSON.stringify({ error: "Invalid required hours" });
      }
      
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid required hours" })
      };
    }
    
    // Ensure preferences vector matches expected size (105 slots for 15 hours x 7 days)
    if (preferences.length !== TOTAL_SLOTS) {
      console.error(`Preference vector length mismatch: ${preferences.length} !== ${TOTAL_SLOTS}`);
      
      // Return in the correct format based on event source
      if (isAppSyncEvent) {
        return JSON.stringify({ error: `Preference vector length mismatch` });
      }
      
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `Preference vector length mismatch` })
      };
    }

    console.log('Starting branch and bound scheduling algorithm');
    console.log(`Required hours: ${config.requiredHours}, Max daily hours: ${config.maxDailyHours}`);
    
    // Run the branch and bound algorithm
    const scheduler = new SchedulingBranchAndBound(preferences, config);
    const result = scheduler.solve();

    // Convert the schedule to time slots
    const timeSlots = scheduleToTimeSlots(result.schedule);
    
    // Generate a pretty print of the schedule for debugging
    const scheduleDisplay = prettyPrintSchedule(result.schedule, preferences);
    console.log('Generated Schedule:');
    console.log(scheduleDisplay);

    // IMPORTANT CHANGE: Return only the time slots in a simple format
    // This is the key fix - we're ensuring the response is a simple JSON string 
    // containing the timeSlots array directly
    
    // Simply return timeSlots for AppSync
    if (isAppSyncEvent) {
      console.log('Returning timeSlots for AppSync');
      return JSON.stringify({ timeSlots });
    }
    
    // For API Gateway
    console.log('Returning timeSlots via API Gateway format');
    return {
      statusCode: 200,
      body: JSON.stringify({ timeSlots })
    };
    
  } catch (error: any) {
    console.error('Error executing branch and bound scheduler:', error);
    
    // For AppSync events, return error directly
    if (event.typeName && event.fieldName) {
      console.log('Returning direct error for AppSync');
      return JSON.stringify({ error: error.message || "Internal server error" });
    }
    
    // For API Gateway, wrap error with statusCode and body
    console.log('Returning statusCode/body error for API Gateway');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Internal server error" })
    };
  }
}; 