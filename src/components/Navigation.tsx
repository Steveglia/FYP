import { useAuthenticator } from '@aws-amplify/ui-react';
import { Link, useLocation, NavLink } from 'react-router-dom';
import GlobalTimeSettings from './GlobalTimeSettings';

const Navigation = () => {
  const { user, signOut } = useAuthenticator();
  const location = useLocation();

  return (
    <nav className="navigation">
      <div className="nav-left">
        <div className="nav-header">
          <h2>Welcome, {user?.signInDetails?.loginId}</h2>
        </div>
        <div className="nav-links">
          <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
            Home
          </Link>
          <Link to="/schedule" className={location.pathname === '/schedule' ? 'active' : ''}>
            Weekly Schedule
          </Link>
          <Link to="/preferences" className={location.pathname === '/preferences' ? 'active' : ''}>
            Preferences
          </Link>
          <NavLink 
            to="/courses" 
            className={({ isActive }) => isActive ? 'active' : ''}
          >
            Courses
          </NavLink>
        </div>
      </div>
      
      <div className="nav-right">
        <GlobalTimeSettings />
        <button onClick={signOut} className="sign-out-btn">Sign out</button>
      </div>
    </nav>
  );
};

export default Navigation; 