// Common types for the generate study sessions function

// Config for the DFO algorithm
export interface Config {
  NUM_DAYS: number;
  HOURS_PER_DAY: number;
  TOTAL_HOURS: number;
  REQUIRED_STUDY_HOURS: number;
  MAX_DAILY_HOURS: number;
  POPULATION_SIZE: number;
  GENERATIONS: number;
  DELTA: number;
}

// Study session interface
export interface StudySession {
  day: string;
  hour: number;
}

// Formatted study session interface
export interface FormattedStudySession {
  day: string;
  startTime: string;
  endTime: string;
  course: string;
}

// Penalty details interface
export interface PenaltyDetails {
  invalidSlotCount: number;
  hoursDifference: number;
  singleHourBlockCount: number;
  twoHourBlockCount: number;
  longBlockCount: number;
  daysExceedingMaxHours: number;
}

// Bonus details interface
export interface BonusDetails {
  twoHourBlockCount: number;
  totalBonus: number;
}

// Study slot interface for logging
export interface StudySlot {
  day: string;
  hour: number;
  index?: number;
} 