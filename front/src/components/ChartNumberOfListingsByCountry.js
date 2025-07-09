import React, { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from "chart.js";
import "./ChartNumberOfListingsByCountry.css";
import API_BASE_URL from "../config/apiConfig";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const ChartNumberOfListingsByCountry = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetch(`${API_BASE_URL}/vg-listings-count-by-country`)
            .then(response => {
                if (!response.ok) throw new Error("Erreur lors du fetch");
                return response.json();
            })
            .then(json => {
                setData(json);
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });
    }, []);

    if (loading) return <div className="chart-container">Chargement des données...</div>;
    if (error) return <div className="chart-container">Erreur : {error}</div>;
    if (!data || !data.countryCounts) return <div className="chart-container">Aucune donnée disponible</div>;

    const labels = data.countryCounts.map(item => item.name);
    const listingsData = data.countryCounts.map(item => item.listings);
    const eventsData = data.countryCounts.map(item => item.events);

    const chartData = {
        labels,
        datasets: [
            {
                label: "Nombre d'évènements en vente",
                data: eventsData,
                backgroundColor: "rgba(255, 99, 132, 0.6)",
                stack: "combined",
            },
            {
                label: "Listings actifs sur Viagogo",
                data: listingsData,
                backgroundColor: "rgba(54, 162, 235, 0.6)",
                stack: "combined",
            },
        ],
    };

    const options = {
        responsive: true,
        plugins: {
            legend: {
                position: "top",
            },
            tooltip: {
                mode: "index",
                intersect: false,
            },
        },
        scales: {
            x: {
                stacked: true,
            },
            y: {
                beginAtZero: true,
                stacked: true,
            },
        },
    };

    return (
        <div className="chart-container">
            <div className="chart-title">Nombre de listings actifs sur Viagogo : {data.total}</div>
            <Bar data={chartData} options={options} />
        </div>
    );
};

export default ChartNumberOfListingsByCountry;
