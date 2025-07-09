import React, { useState, useEffect } from 'react';
import "./listings.css";
import API_BASE_URL from "../config/apiConfig";

function Listings() {
    const [listings, setListings] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [sortBy, setSortBy] = useState("places");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalListings, setTotalListings] = useState(0);
    const [stoppedIndexes, setStoppedIndexes] = useState([]);
    const [loadingStopIndex, setLoadingStopIndex] = useState(null);

    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString("fr-FR", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        }).replace(",", " -");
    }

    const fetchListings = async () => {
        setLoading(true);
        setError("");
        try {
            const response = await fetch(`${API_BASE_URL}/listings/?page=${page}&sortBy=${sortBy}`);
            if (!response.ok) {
                throw new Error(`Erreur serveur : ${response.status}`);
            }
            const data = await response.json();
            setListings(data.listings);
            setTotalPages(data.totalPages);
            setTotalListings(data.count);
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchListings();
    }, [page, sortBy]);

    const handleSortChange = () => {
        setSortBy(prev => (prev === "places" ? "date" : "places"));
        setPage(1);
    };

    const handlePrevPage = () => {
        if (page > 1) setPage(prev => prev - 1);
    };

    const handleNextPage = () => {
        if (page < totalPages) setPage(prev => prev + 1);
    };

    function getColorClass(listing) {
        if (listing.type === "zone") {
            if (listing.nbPlaces < 40) return "text-red";
            if (listing.nbPlaces < 50) return "text-orange";
        } else if (listing.type === "category") {
            if (listing.nbPlaces < 60) return "text-red";
            if (listing.nbPlaces < 80) return "text-orange";
        }
        return "";
    }

    const handleStopListing = async (listing, index) => {
        try {
            setLoadingStopIndex(index);
            const response = await fetch(`${API_BASE_URL}/listings/stop-listing`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    eventName: listing.eventName,
                    venue: listing.venue,
                    dateSeance: listing.eventDate,
                    TMName: listing.TMName,
                    VGName: listing.VGName,
                    type: listing.type
                })
            });

            if (!response.ok) {
                throw new Error("Erreur lors de la suppression du VGListing.");
            }

            setStoppedIndexes(prev => [...prev, index]);
        } catch (error) {
            console.error(error);
            alert("Erreur lors de la suppression du VGListing.");
        } finally {
            setLoadingStopIndex(null);
        }
    };

    function shouldShowStopButton(listing) {
        if (listing.type === "zone") {
            return listing.nbPlaces < 50;
        } else if (listing.type === "category") {
            return listing.nbPlaces < 80;
        }
        return false;
    }

    return (
        <div className="listings-main">
            <div className="title-page">
                Listings actifs ({totalListings})
            </div>

            <div className="listings-controls">
                <div className="toggle-switch" onClick={handleSortChange}>
                    <div className={`toggle-slider ${sortBy === "date" ? "right" : "left"}`}></div>
                    <span className={`toggle-label ${sortBy === "places" ? "active-label" : ""}`}>Places</span>
                    <span className={`toggle-label ${sortBy === "date" ? "active-label" : ""}`}>Date</span>
                </div>

                <button 
                    className="refresh-button" 
                    onClick={fetchListings}
                    disabled={loading}
                    style={{ marginLeft: "10px" }}
                >
                    {loading ? "⏳" : "🔄 Rafraîchir"}
                </button>
            </div>

            {loading && <p>Chargement...</p>}
            {error && <p className="error-message">Erreur : {error}</p>}
            {!loading && listings.length === 0 && <p>Aucun listing trouvé.</p>}

            {!loading && listings.length > 0 && (
                <div className="listings-table-container">
                    <table className="listings-table">
                        <thead>
                            <tr>
                                <th className="fit-header">Date</th>
                                <th>Nom</th>
                                <th>Salle</th>
                                <th className="fit-header">Ville</th>
                                <th className="fit-header">Pays</th>
                                <th className="fit-header">Type</th>
                                <th className="fit-header">Nom TM</th>
                                <th className="fit-header">Nom VG</th>
                                <th className="fit-header">Places</th>
                                <th className="fit-header">Arrêt listing</th>
                            </tr>
                        </thead>
                        <tbody>
                            {listings.map((listing, index) => (
                                <tr key={index}>
                                    <td className="fit-cell">{listing.eventDate ? formatDate(listing.eventDate) : "-"}</td>
                                    <td>{listing.eventName}</td>
                                    <td>{listing.venue}</td>
                                    <td className="fit-cell">{listing.city}</td>
                                    <td className="fit-cell">{listing.country}</td>
                                    <td className="fit-cell">{listing.type}</td>
                                    <td className="fit-cell">{listing.TMName}</td>
                                    <td className="fit-cell">{listing.VGName}</td>
                                    <td className={`fit-cell ${getColorClass(listing)}`}>
                                        {listing.nbPlaces}
                                    </td>
                                    <td className="fit-cell">
                                        {shouldShowStopButton(listing) ? (
                                            stoppedIndexes.includes(index) ? (
                                                <span className="stopped-text">✅ Arrêté</span>
                                            ) : (
                                                <button
                                                    className="stop-button"
                                                    onClick={() => handleStopListing(listing, index)}
                                                    disabled={loadingStopIndex === index}
                                                >
                                                    {loadingStopIndex === index ? "⏳ ..." : "🛑 Arrêter"}
                                                </button>
                                            )
                                        ) : (
                                            ""
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="listings-pagination">
                <button onClick={handlePrevPage} disabled={page === 1} className="pagination-button">
                    ◀ Page précédente
                </button>
                <span>Page {page} / {totalPages}</span>
                <button onClick={handleNextPage} disabled={page === totalPages} className="pagination-button">
                    Page suivante ▶
                </button>
            </div>
        </div>
    );
}

export default Listings;
