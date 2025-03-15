# Core module for study schedule optimization using multiple algorithms
from config import StudyScheduleConfig
from preferences_generator import PreferencesGenerator
from fitness_evaluator import FitnessEvaluator
from schedule_visualizer import ScheduleVisualizer
from genetic_algorithm import GeneticAlgorithm
from DFO_Best import DFO_Best
from DFO_Neighbour import DFO_Neighbour
from island_model import IslandModel
from hill_climber_algorithm import HillClimberAlgorithm

class StudySchedule:
    """Main class that coordinates schedule optimization using multiple algorithms"""
    
    def __init__(self):
        """Initialize system components including algorithms and evaluators"""
        # Set up configuration and preferences
        self.config = StudyScheduleConfig()
        # preferences_generator = PreferencesGenerator(self.config)
        # self.preferences = preferences_generator.create_realistic_preferences()
        self.preferences = ([
        [ 0,  0,  0, -1, -1,  9,  1,  3,  7,  7,  2,  2],
        [ 0,  0,  3,  9,  8,  9, -1, -1, -1, -1,  1,  2],
        [ 1,  2,  0, -1, -1,  9,  3,  1,  8,  9,  2,  1],
        [ 1,  2,  0,  7,  9,  9, -1, -1, -1, -1,  0,  0],
        [ 0,  1,  3, -1, -1,  8,  3,  1,  8,  9,  0,  1]
        ])
        # Initialize fitness evaluation
        self.fitness_evaluator = FitnessEvaluator(self.config, self.preferences)
        
        # Set up optimization algorithms
        self.hill_climber_algorithm = HillClimberAlgorithm(self.config, self.fitness_evaluator)
        self.island_model = IslandModel(self.config, self.fitness_evaluator, self.hill_climber_algorithm)
        self.ga = GeneticAlgorithm(self.config, self.fitness_evaluator, self.hill_climber_algorithm)
        self.dfoBest = DFO_Best(self.config, self.fitness_evaluator)
        self.dfoNeighbour = DFO_Neighbour(self.config, self.fitness_evaluator)
        
        # Initialize visualization
        self.visualizer = ScheduleVisualizer(self.config, self.preferences)

    def optimize(self):
        """Run all optimization algorithms and return their results"""
        results = {}
        
        # Run each algorithm
        ga_solution, ga_fitness = self.ga.run()
        results['Genetic Algorithm'] = (ga_solution, ga_fitness)
        
        dfo_best_solution, dfo_best_fitness = self.dfoBest.run()
        results['DFO Best'] = (dfo_best_solution, dfo_best_fitness)
        
        dfo_neighbour_solution, dfo_neighbour_fitness = self.dfoNeighbour.run()
        results['DFO Neighbour'] = (dfo_neighbour_solution, dfo_neighbour_fitness)
        
        island_solution, island_fitness = self.island_model.run()
        results['Island Model'] = (island_solution, island_fitness)
        
        return results

    def visualize(self, solution, algorithm_name="Study Schedule"):
        """Create visualization for a given schedule solution"""
        self.visualizer.plot_schedule(solution, algorithm_name=algorithm_name)
