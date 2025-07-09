import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Dashboard from './pages/dashboard';
import Events from './pages/events';
import Listings from './pages/listings';
import Header from './components/Header';
import Actions from './pages/actions';
import ErrorsMatching from './pages/errorsMatching';

function App() {
  return (
    <Router>
      <Header />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/events" element={<Events />} />
        <Route path="/listings" element={<Listings />} />
        <Route path="/actions" element={<Actions />} />
        <Route path="/errors" element={<ErrorsMatching />} />
      </Routes>
    </Router>
  );
}

export default App;
