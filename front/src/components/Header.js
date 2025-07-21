import React from 'react';
import { Link } from 'react-router-dom';
import './Header.css';

function Header() {
  return (
    <header className="header-bar">
      <Link to="/" className="header-link"><button className="header-btn">Tableau de bord</button></Link>
      <Link to="/events" className="header-link"><button className="header-btn">Événements</button></Link>
      <Link to="/listings" className="header-link"><button className="header-btn">Listings</button></Link>
      <Link to="/waiting-listings" className="header-link"><button className="header-btn">Listings en attente</button></Link>
      <Link to="/actions" className="header-link"><button className="header-btn">Actions</button></Link>
      <Link to="/errors" className="header-link"><button className="header-btn">Erreurs de matching</button></Link>
    </header>
  );
}

export default Header; 