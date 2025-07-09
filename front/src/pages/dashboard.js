import React from 'react';
import ChartNumberEventsByCountry from '../components/ChartNumberEventsByCountry';
import ChartNumberOfListingsByCountry from '../components/ChartNumberOfListingsByCountry';
import ChartAverageListingsPerEventsByCountry from '../components/ChartAverageListingsPerEventsByCountry';
import './dashboard.css';

function Dashboard() {
  return (
    <div className="dashboard-main">
      <div className="title-page">
        Tableau de bord
      </div>
      <div className="dashboard-line-charts">
        <ChartNumberEventsByCountry />
        <ChartNumberOfListingsByCountry />
      </div>
      <div className="dashboard-line-charts">
        <ChartAverageListingsPerEventsByCountry />
      </div>
    </div>
  );
}

export default Dashboard;
