import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div className="home-page">
      <h1>Welcome to Your Study Planner</h1>
      <p className="intro-text">
        This application helps you manage your academic schedule and optimize your study sessions using AI-powered recommendations.
      </p>
      
      <div className="menu-grid">
        <Link to="/schedule" className="menu-item">
          <h2>Weekly Schedule</h2>
          <p>View and manage your weekly events, lectures, and study sessions</p>
        </Link>
        
        <Link to="/preferences" className="menu-item">
          <h2>Preferences</h2>
          <p>Customize your study preferences and schedule settings</p>
        </Link>
        
        <Link to="/courses" className="menu-item">
          <h2>Courses</h2>
          <p>Manage your enrolled courses and course materials</p>
        </Link>
      </div>
      
      <div className="features-section">
        <h2>Key Features</h2>
        <ul>
          <li><strong>Weekly Schedule:</strong> View and manage your academic timetable</li>
          <li><strong>Smart Study Planning:</strong> AI-optimized study session recommendations</li>
          <li><strong>Course Management:</strong> Track progress across different courses</li>
          <li><strong>Spaced Repetition:</strong> Based on scientifically-proven learning techniques</li>
        </ul>
      </div>
    </div>
  );
};

export default Home; 