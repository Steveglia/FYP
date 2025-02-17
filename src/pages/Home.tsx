import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div className="home-page">
      <h1>Welcome to Your Event Manager</h1>
      <div className="menu-grid">
        <Link to="/schedule" className="menu-item">
          <h2>Weekly Schedule</h2>
          <p>View and manage your weekly events</p>
        </Link>
        <Link to="/preferences" className="menu-item">
          <h2>Preferences</h2>
          <p>Customize your application settings</p>
        </Link>
      </div>
    </div>
  );
};

export default Home; 