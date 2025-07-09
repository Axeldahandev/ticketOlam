import React, { useState, useEffect } from "react";
import "./events.css";
import EventDetailsModal from "../components/EventDetailsModal.js";
import API_BASE_URL from "../config/apiConfig";

function Events() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalEvents, setTotalEvents] = useState(0);
    const [selectedEvent, setSelectedEvent] = useState(null);

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString("fr-FR", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        }).replace(",", " -");
    };

    const fetchEvents = async () => {
        setLoading(true);
        setError("");
        try {
            const params = new URLSearchParams({
                page,
                search
            });

            const response = await fetch(`${API_BASE_URL}/events/list?${params}`);
            if (!response.ok) throw new Error(`Erreur serveur : ${response.status}`);
            const data = await response.json();

            setEvents(data.events);
            setTotalPages(data.totalPages);
            setTotalEvents(data.totalEvents);
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEvents();
    }, [page]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        setPage(1);
        fetchEvents();
    };


    return (
        <div className="events-main">
            <div className="title-page">Liste des événements ({totalEvents})</div>

            <div className="events-controls">
                <form onSubmit={handleSearchSubmit} className="search-form">
                    <input
                        type="text"
                        placeholder="Rechercher par nom..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="search-input"
                    />
                    <button type="submit" className="search-button">🔍</button>
                </form>
            </div>

            {loading && <p>Chargement...</p>}
            {error && <p className="error-message">Erreur : {error}</p>}
            {!loading && events.length === 0 && <p>Aucun événement trouvé.</p>}

            {!loading && events.length > 0 && (
                <div className="events-table-container">
                    <table className="events-table">
                        <thead>
                            <tr>
                                <th className="fit-header">Date</th>
                                <th>Nom</th>
                                <th>Salle</th>
                                <th className="fit-header">Ville</th>
                                <th className="fit-header">Pays</th>
                                <th className="fit-header">Nb dates</th>
                                <th className="fit-header">Détails</th>
                                <th className="fit-header">En vente</th>
                            </tr>
                        </thead>
                        <tbody>
                            {events.map((event, index) => (
                                <tr key={index}>
                                    <td className="fit-cell">{event.date}</td>
                                    <td>{event.event_name}</td>
                                    <td>{event.venue.name}</td>
                                    <td className="fit-cell">{event.venue.city}</td>
                                    <td className="fit-cell">{event.venue.country}</td>
                                    <td className="fit-cell" style={{ textAlign: "center" }}>{event.dates_count}</td>
                                    <td className="center-cell">
                                        <button className="details-button" onClick={() => setSelectedEvent(event.event_id)}>
                                            <i className="fas fa-info-circle"></i>
                                        </button>
                                    </td>
                                    <td className="center-cell">
                                        {event.onsale && (
                                            <div className="onsale-pin" />
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="listings-pagination">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="pagination-button">
                    ◀ Précédent
                </button>
                <span>Page {page} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="pagination-button">
                    Suivant ▶
                </button>
            </div>

            <EventDetailsModal
                eventId={selectedEvent}
                onClose={() => setSelectedEvent(null)}
            />

        </div>

        
    );
}

export default Events;
