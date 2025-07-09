// ChartNumberEventsByCountry.js
import React, { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from "chart.js";
import "./ChartNumberEventsByCountry.css";
import API_BASE_URL from "../config/apiConfig";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const ChartNumberEventsByCountry = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/events-count-in-database`)
      .then((response) => {
        if (!response.ok) throw new Error("Erreur réseau");
        return response.json();
      })
      .then((json) => {
        setData(json);
      })
      .catch((err) => {
        setError(err.message);
      });
  }, []);

  if (error) {
    return <div className="chart-container">Erreur: {error}</div>;
  }

  if (!data) {
    return <div className="chart-container">Chargement des données...</div>;
  }

  const chartData = {
    labels: data.byCountry.map(item => item.country),
    datasets: [
      {
        label: "Évènements",
        data: data.byCountry.map(item => item.count),
        backgroundColor: "rgba(54, 162, 235, 0.6)",
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Pays',
        },
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Nombre d\'évènements en base de données',
        },
      },
    },
  };

  return (
    <div className="chart-container">
      <div className="chart-title">Nombre d'événements en base de données : {data.total}</div>
      <Bar data={chartData} options={options} />
    </div>
  );
};

export default ChartNumberEventsByCountry;