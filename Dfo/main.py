# Main entry point for the study schedule optimization system
from study_schedule import StudySchedule
from tqdm import tqdm
import time

def main():
    """Main function that runs multiple optimization algorithms and compares their results"""
    # Initialize optimizer with configuration and preferences
    study_schedule = StudySchedule()
    
    # Run all optimization algorithms
    results = {}
    algorithms = ['Genetic Algorithm', 'DFO Best', 'DFO Neighbour', 'Island Model']
    
    print("\nRunning Optimization Algorithms:")
    with tqdm(total=len(algorithms), desc="Progress", ncols=100) as pbar:
        # Run each algorithm
        for algo in algorithms:
            pbar.set_description(f"Running {algo}")
            if algo == 'Genetic Algorithm':
                solution, fitness = study_schedule.ga.run()
            elif algo == 'DFO Best':
                solution, fitness = study_schedule.dfoBest.run()
            elif algo == 'DFO Neighbour':
                solution, fitness = study_schedule.dfoNeighbour.run()
            else:  # Island Model
                solution, fitness = study_schedule.island_model.run()
            
            results[algo] = (solution, fitness)
            pbar.update(1)
            time.sleep(0.1)  # Small delay to show progress
    
    # Print results from each algorithm
    print("\nOptimization Results:")
    print("=" * 50)
    
    # Collect solutions and fitness scores
    solutions = {}
    fitness_scores = {}
    
    for algo_name, (solution, fitness) in results.items():
        print(f"\n{algo_name} Algorithm:")
        print("-" * 30)
        print(f"Fitness Score: {fitness:.2f}")
        print("\nVisualizing schedule...")
        study_schedule.visualize(solution, f"{algo_name} Algorithm Solution")
        print("=" * 50)
        
        # Store solutions and fitness scores for comparison
        solutions[algo_name] = solution
        fitness_scores[algo_name] = fitness
    
    # Show algorithm differences
    print("\nGenerating algorithm comparison visualization...")
    study_schedule.visualizer.plot_algorithm_differences(solutions, fitness_scores)
    
    # Find best overall solution
    best_algo = max(results.items(), key=lambda x: x[1][1])
    print(f"\nBest Overall Algorithm: {best_algo[0]}")
    print(f"Best Overall Fitness: {best_algo[1][1]:.2f}")

if __name__ == "__main__":
    main()
