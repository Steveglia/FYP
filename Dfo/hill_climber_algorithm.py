import numpy as np
from typing import List, Tuple, Set
import random

class HillClimberAlgorithm:
    """True hill climbing algorithm implementation for study schedule optimization"""
    def __init__(self, config, fitness_evaluator):
        self.config = config
        self.fitness_evaluator = fitness_evaluator
        self.preferences = fitness_evaluator.preferences
        
        # Hill climbing parameters
        self.max_iterations = 5  # Maximum iterations without improvement
        self.max_neighbors = 2  # Maximum neighbors to evaluate per iteration
        
    def optimize(self, solution: List[int]) -> List[int]:
        """Optimize solution using hill climbing algorithm"""
        current_solution = np.array(solution)
        current_fitness = self.fitness_evaluator.calculate_fitness(current_solution)
        
        iterations_without_improvement = 0
        while iterations_without_improvement < self.max_iterations:
            # Generate and evaluate neighbors
            best_neighbor = None
            best_neighbor_fitness = current_fitness
            
            # Generate multiple neighbors and evaluate them
            neighbors = self._generate_neighbors(current_solution)
            for neighbor in neighbors:
                neighbor_fitness = self.fitness_evaluator.calculate_fitness(neighbor)
                if neighbor_fitness > best_neighbor_fitness:
                    best_neighbor = neighbor
                    best_neighbor_fitness = neighbor_fitness
            
            # If no better neighbor found, we're at a local optimum
            if best_neighbor is None:
                iterations_without_improvement += 1
                continue
            
            # Move to the best neighbor
            current_solution = best_neighbor
            current_fitness = best_neighbor_fitness
            iterations_without_improvement = 0
        
        return current_solution.tolist()
    
    def _generate_neighbors(self, solution: np.ndarray) -> List[np.ndarray]:
        """Generate valid neighbor solutions through various move operations"""
        neighbors = []
        solution_hours = np.sum(solution)
        
        for _ in range(self.max_neighbors):
            neighbor = solution.copy()
            move_type = random.choice(['swap', 'block_swap', 'shift'])
            
            if move_type == 'swap':
                # Swap two hours (one 1 and one 0)
                ones = np.where(neighbor == 1)[0]
                zeros = np.where(neighbor == 0)[0]
                if len(ones) > 0 and len(zeros) > 0:
                    one_idx = random.choice(ones)
                    zero_idx = random.choice(zeros)
                    neighbor[one_idx] = 0
                    neighbor[zero_idx] = 1
            
            elif move_type == 'block_swap':
                # Swap two blocks of hours
                schedule = neighbor.reshape(self.config.NUM_DAYS, self.config.HOURS_PER_DAY)
                day1, day2 = random.sample(range(self.config.NUM_DAYS), 2)
                
                # Find study blocks in both days
                blocks1 = self._find_blocks(schedule[day1])
                blocks2 = self._find_blocks(schedule[day2])
                
                if blocks1 and blocks2:
                    block1 = random.choice(blocks1)
                    block2 = random.choice(blocks2)
                    
                    # Swap the blocks if they're the same size
                    if len(block1) == len(block2):
                        temp = schedule[day1, block1].copy()
                        schedule[day1, block1] = schedule[day2, block2]
                        schedule[day2, block2] = temp
                        neighbor = schedule.flatten()
            
            else:  # shift
                # Shift a study hour to an adjacent position
                schedule = neighbor.reshape(self.config.NUM_DAYS, self.config.HOURS_PER_DAY)
                day = random.randrange(self.config.NUM_DAYS)
                ones = np.where(schedule[day] == 1)[0]
                
                if len(ones) > 0:
                    hour_idx = random.choice(ones)
                    if hour_idx > 0 and schedule[day, hour_idx-1] == 0:
                        schedule[day, hour_idx] = 0
                        schedule[day, hour_idx-1] = 1
                    elif hour_idx < self.config.HOURS_PER_DAY-1 and schedule[day, hour_idx+1] == 0:
                        schedule[day, hour_idx] = 0
                        schedule[day, hour_idx+1] = 1
                    neighbor = schedule.flatten()
            
            # Only add the neighbor if it maintains the required study hours
            if np.sum(neighbor) == solution_hours:
                neighbors.append(neighbor)
        
        return neighbors
    
    def _find_blocks(self, day_schedule: np.ndarray) -> List[List[int]]:
        """Find continuous blocks of study hours in a day"""
        blocks = []
        current_block = []
        
        for i, hour in enumerate(day_schedule):
            if hour == 1:
                current_block.append(i)
            elif current_block:
                blocks.append(current_block)
                current_block = []
        
        if current_block:
            blocks.append(current_block)
        
        return blocks
