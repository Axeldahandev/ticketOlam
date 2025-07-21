import React, { useState, useEffect } from "react";
import "./events.css";
import EventDetailsModal from "../components/EventDetailsModal.js";
import API_BASE_URL from "../config/apiConfig";

function Events() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [salle, setSalle] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalEvents, setTotalEvents] = useState(0);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [selectedEventsCheckbox, setSelectedEventsCheckbox] = useState([]);
    
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
            search,
            salle
          });
      
          const response = await fetch(`${API_BASE_URL}/events/list?${params.toString()}`);
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

    // Ajouter / retirer id dans le tableau de sélection
    const toggleSelectEventCheckbox = (eventId) => {
        setSelectedEventsCheckbox(prev => {
            if (prev.includes(eventId)) {
                // retirer id
                return prev.filter(id => id !== eventId);
            } else {
                // ajouter id
                return [...prev, eventId];
            }
        });
    };

    // Toggle tout sélectionner / désélectionner
    const toggleSelectAllCheckbox = () => {
        if (selectedEventsCheckbox.length === events.length) {
            setSelectedEventsCheckbox([]); // désélectionner tout
        } else {
            setSelectedEventsCheckbox(events.map(ev => ev.event_id)); // sélectionner tout
        }
    };

    // Checkbox "tout sélectionner" est cochée si tous les events sont sélectionnés
    const allSelectedCheckbox = events.length > 0 && selectedEventsCheckbox.length === events.length;

    // Checkbox "tout sélectionner" est indéterminée si certains mais pas tous sont sélectionnés
    const isIndeterminateCheckbox = selectedEventsCheckbox.length > 0 && selectedEventsCheckbox.length < events.length;

    const handleDeleteSelectedEvents = async () => {
        const confirmDelete = window.confirm("Voulez-vous vraiment supprimer les évènements sélectionnés ? \n Cette action est irréversible. \n\n ⚠️ Ne pas oublier de supprimer les listings viagogo correspondants.");
        if (!confirmDelete) return;

        try {
            const response = await fetch(`${API_BASE_URL}/events/delete`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ eventIds: selectedEventsCheckbox }),
            });

            if (!response.ok) {
                throw new Error(`Erreur serveur : ${response.status}`);
            }

            const result = await response.json();
            console.log(result);

            // Filtrer la liste locale pour retirer les événements supprimés
            setEvents(prevEvents => prevEvents.filter(ev => !selectedEventsCheckbox.includes(ev.event_id)));

            // Réinitialiser la sélection
            setSelectedEventsCheckbox([]);

            fetchEvents();
        } catch (error) {
            console.error("Erreur suppression:", error);
            setError(error.message || "Erreur lors de la suppression");
        }
    };

    return (
        <div className="events-main">
            <div className="title-page">Liste des événements ({totalEvents})</div>

            <div className="events-controls">
                <form onSubmit={handleSearchSubmit} className="search-form">
                    <input
                        type="text"
                        placeholder="Nom de l'évènement..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="search-input"
                    />
                    <input
                        type="text"
                        placeholder="Nom de la salle..."
                        value={salle}
                        onChange={(e) => setSalle(e.target.value)}
                        className="search-input"
                    />
                    <button type="submit" className="search-button">🔍 Rechercher</button>
                </form>
            </div>
            <button className="delete-button" disabled={selectedEventsCheckbox.length === 0} onClick={handleDeleteSelectedEvents}>Supprimer les évènements sélectionnés</button>

            {loading && <p>Chargement...</p>}
            {error && <p className="error-message">Erreur : {error}</p>}
            {!loading && events.length === 0 && <p>Aucun événement trouvé.</p>}

            {!loading && events.length > 0 && (
                <div className="events-table-container">
                    <table className="events-table">
                        <thead>
                            <tr>
                                <th className="fit-header">
                                <input
                                    type="checkbox"
                                    checked={allSelectedCheckbox}
                                    ref={input => {
                                        if (input) input.indeterminate = isIndeterminateCheckbox;
                                    }}
                                    onChange={toggleSelectAllCheckbox}
                                    />
                                </th>
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
                                    <td className="fit-cell">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedEventsCheckbox.includes(event.event_id)}
                                            onChange={() => toggleSelectEventCheckbox(event.event_id)}
                                        />
                                    </td>
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
