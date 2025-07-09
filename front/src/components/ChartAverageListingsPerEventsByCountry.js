import React, { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Tooltip,
    Legend,
} from "chart.js";
import "./ChartAverageListingsPerEventsByCountry.css";
import API_BASE_URL from "../config/apiConfig";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const ChartAverageListingsPerEventsByCountry = () => {
    const [chartData, setChartData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetch(`${API_BASE_URL}/vg-listings-count-by-country`)
            .then((response) => {
                if (!response.ok) throw new Error("Erreur lors du fetch");
                return response.json();
            })
            .then((json) => {
                if (!json || !json.countryCounts || !Array.isArray(json.countryCounts)) {
                    setError("Données manquantes ou invalides dans la réponse");
                    setLoading(false);
                    return;
                }

                const labels = json.countryCounts.map(item => item.name);
                const dataValues = json.countryCounts.map(item => {
                    const avg = item.events > 0 ? (item.listings / item.events) : 0;
                    return parseFloat(avg.toFixed(2));
                });

                const preparedData = {
                    labels: labels,
                    datasets: [
                        {
                            label: "Listings moyens par évènement en vente",
                            data: dataValues,
                            backgroundColor: "rgba(54, 162, 235, 0.6)",
                            borderColor: "rgba(54, 162, 235, 1)",
                            borderWidth: 1,
                        },
                    ],
                };

                setChartData(preparedData);
                setLoading(false);
            })
            .catch((err) => {
                setError(err.message);
                setLoading(false);
            });
    }, []);

    if (loading) return <div className="chart-container">Chargement des données...</div>;
    if (error) return <div className="chart-container">Erreur : {error}</div>;

    return (
        <div className="chart-container">
            <div className="chart-title">
                Listings actifs moyens par évènement en vente sur Viagogo
            </div>
            <Bar
                data={chartData}
                options={{
                    responsive: true,
                    plugins: {
                        legend: { display: false },
                        tooltip: { mode: 'index', intersect: false },
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: { display: true, text: "Listings" },
                            ticks: { stepSize: 1 },
                        },
                        x: {
                            title: { display: true, text: "Pays" },
                        }
                    },
                }}
            />
        </div>
    );
};

export default ChartAverageListingsPerEventsByCountry;
