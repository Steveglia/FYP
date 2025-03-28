import { useAuthenticator } from '@aws-amplify/ui-react';
import { Link, useLocation, NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';

const Navigation = () => {
  const { user, signOut } = useAuthenticator();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const offset = window.scrollY;
      if (offset > 10) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    
    // Clean up the event listener when component unmounts
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <nav className={`navigation ${scrolled ? 'scrolled' : ''}`}>
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
        <Link to="/reviews" className={location.pathname === '/reviews' ? 'active' : ''}>
          Review Sessions
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
        <NavLink 
          to="/personal-learning" 
          className={({ isActive }) => isActive ? 'active' : ''}
        >
          Personal Learning
        </NavLink>
        <NavLink 
          to="/focus-coefficient" 
          className={({ isActive }) => isActive ? 'active' : ''}
        >
          Focus Settings
        </NavLink>
      </div>
      <button onClick={signOut} className="sign-out-btn">Sign out</button>
    </nav>
  );
};

export default Navigation; 