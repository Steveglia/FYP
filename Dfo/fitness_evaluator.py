import numpy as np
from typing import List

class FitnessEvaluator:
    """Handles fitness calculation"""
    def __init__(self, config, preferences):
        self.config = config
        # Convert preferences to numpy array for efficient calculations
        self.preferences = np.array(preferences).flatten()

    def calculate_fitness(self, solution):
        solution_array = np.array(solution, dtype=float)
        
        # Calculate base reward from preferences
        reward = sum(self.preferences[i] * solution_array[i] * 50
                    for i in range(len(solution_array)))
        
        # Calculate and subtract penalties
        penalties = self._calculate_penalties(solution)
        return reward - penalties

    def _calculate_penalties(self, solution: List[int]) -> float:
        penalties = 0
        solution_array = np.array(solution)
        
        # ====== HARD CONSTRAINTS ======
        # 1. No study sessions at invalid time slots (preference <= 0)
        invalid_slots = np.where(self.preferences <= 0)[0]
        invalid_slot_count = np.sum(solution_array[invalid_slots])
        if invalid_slot_count > 0:
            penalties += invalid_slot_count * 1000
            
        # 2. Total study hours must match config
        total_study_hours = np.sum(solution_array)
        hours_difference = abs(total_study_hours - self.config.REQUIRED_STUDY_HOURS)
        if hours_difference > 0:
            penalties += hours_difference * 1000
                
        # ====== SOFT CONSTRAINTS ======
        # 1. Study block constraints
        for day in range(self.config.NUM_DAYS):
            daily_schedule = solution[day * self.config.HOURS_PER_DAY:
                                   (day + 1) * self.config.HOURS_PER_DAY]
            block_length = 0
            for hour in daily_schedule:
                if hour == 1:
                    block_length += 1
                elif block_length > 0:
                    if block_length == 1:
                        # Single hour blocks are discouraged
                        penalties += 30
                    elif block_length > 2:
                        # Longer blocks get progressively higher penalties
                        excess_length = block_length - 2
                        penalties += excess_length * 40
                    block_length = 0
            # Check last block of the day
            if block_length > 0:
                if block_length == 1:
                    penalties += 30
                elif block_length > 2:
                    excess_length = block_length - 2
                    penalties += excess_length * 40

        # 2. Maximum daily hours constraint
        daily_hours = solution_array.reshape(self.config.NUM_DAYS, 
                                          self.config.HOURS_PER_DAY).sum(axis=1)
        for hours in daily_hours:
            if hours > self.config.MAX_DAILY_HOURS:
                excess = hours - self.config.MAX_DAILY_HOURS
                penalties += excess * 100
                
        return penalties