import React, { useEffect, useState } from "react";
import "./EventDetailsModal.css";
import API_BASE_URL from "../config/apiConfig";

function EventDetailsModal({ eventId, onClose }) {
    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [expandedTickets, setExpandedTickets] = useState([]); // gestion des expansions

    useEffect(() => {
        if (!eventId) return;

        document.body.style.overflow = "hidden";

        const fetchEvent = async () => {
            setLoading(true);
            setError("");
            try {
                const response = await fetch(`${API_BASE_URL}/events/${eventId}`);
                if (!response.ok) throw new Error(`Erreur serveur : ${response.status}`);
                const data = await response.json();
                setEvent(data);
            } catch (err) {
                console.error(err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchEvent();

        return () => {
            document.body.style.overflow = "";
        };
    }, [eventId]);

    const toggleTicketDetails = (idx) => {
        setExpandedTickets((prev) =>
            prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
        );
    };

    if (!eventId) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close-button" onClick={onClose}>✖</button>
                {loading && <p>Chargement...</p>}
                {error && <p className="error-message">Erreur : {error}</p>}

                {event && (
                    <>
                        <h2>{event.name}</h2>
                        <p><strong>Salle :</strong> {event.venue?.name} ({event.venue?.city}, {event.venue?.country})</p>

                        <p>
                            <strong>Classifications :</strong> {event.classifications?.segment} / {event.classifications?.genre} / {event.classifications?.subgenre}
                        </p>

                        <p>
                            <strong>Site :</strong>{" "}
                            <a href={event.website_url} target="_blank" rel="noopener noreferrer">
                                Ouvrir sur Ticketmaster
                            </a>
                        </p>

                        <p><strong>Créé le :</strong> {new Date(event.created_at).toLocaleString("fr-FR")}</p>
                        <p><strong>Mis à jour le :</strong> {new Date(event.updated_at).toLocaleString("fr-FR")}</p>

                        {event.tickets && event.tickets.length > 0 && (
                            <div>
                                <h4>Dates :</h4>
                                {event.tickets.map((ticket, idx) => (
                                    <div key={idx} className="ticket-section">
                                        <p
                                        onClick={() => toggleTicketDetails(idx)}
                                        style={{
                                            cursor: "pointer",
                                            fontWeight: "bold",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between", // ajoute pour push à droite
                                            padding: "8px 16px",             // padding horizontal propre
                                            backgroundColor: "#f9fafb",      // léger fond
                                            borderRadius: "6px"
                                        }}
                                    >
                                        <span>📅 {new Date(ticket.dateSeance).toLocaleString("fr-FR", {
                                            day: "2-digit", month: "short", year: "numeric",
                                            hour: "2-digit", minute: "2-digit"
                                        })}</span>
                                        <span style={{ fontSize: "14px", color: "#2563eb" }}>
                                            {expandedTickets.includes(idx) ? "▲ Masquer" : "▼ Voir détails"}
                                        </span>
                                    </p>

                                    {expandedTickets.includes(idx) && (
    <div className="categories-details" style={{ padding: "0 10px" }}>
        {ticket.infoCategories?.map((cat, catIdx) => (
            <div key={catIdx} style={{ marginBottom: "20px" }}>
                <p style={{
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: "15px",
                    background: "#f3f4f6",
                    padding: "8px 12px",
                    borderRadius: "4px"
                }}>
                    <span>🪑 {cat.llgCatPl} - {cat.nbPlaces} places - {cat.priceMin}€</span>
                    {cat.VGListing && (
                        <span
                            title="Listing Viagogo actif"
                            style={{
                                display: "inline-block",
                                width: "12px",
                                height: "12px",
                                borderRadius: "50%",
                                backgroundColor: "#16a34a",
                                flexShrink: 0
                            }}
                        ></span>
                    )}
                </p>
                <table style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "13px",
                    marginTop: "8px",
                    background: "white",
                    borderRadius: "4px",
                    overflow: "hidden"
                }}>
                    <thead>
                        <tr style={{ background: "#f9fafb" }}>
                            <th style={{ textAlign: "left", padding: "8px", width: "60%" }}>📍 Zone</th>
                            <th style={{ textAlign: "center", padding: "8px", width: "20%" }}>Nb places</th>
                            <th style={{ textAlign: "center", padding: "8px", width: "20%" }}>VG</th>
                        </tr>
                    </thead>
                    <tbody>
                        {cat.zones?.map((zone, zoneIdx) => (
                            <tr key={zoneIdx} style={{ borderTop: "1px solid #e5e7eb" }}>
                                <td style={{ padding: "6px 8px" }}>{zone.llczone}</td>
                                <td style={{ textAlign: "center", padding: "6px 8px" }}>{zone.nbplaces}</td>
                                <td style={{ textAlign: "center", padding: "6px 8px" }}>
                                    {zone.VGListing && (
                                        <span
                                            title="Listing Viagogo actif"
                                            style={{
                                                display: "inline-block",
                                                width: "10px",
                                                height: "10px",
                                                borderRadius: "50%",
                                                backgroundColor: "#16a34a"
                                            }}
                                        ></span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        ))}
    </div>
)}

                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default EventDetailsModal;
