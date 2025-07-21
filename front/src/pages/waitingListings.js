import React, { useState, useEffect } from "react";
import API_BASE_URL from "../config/apiConfig";
import "./waitingListings.css";

function Modal({ isOpen, onClose, children }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        {children}
        <button className="btn modal-close-btn" onClick={onClose}>
          Fermer
        </button>
      </div>
    </div>
  );
}

function WaitingListings() {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedListing, setSelectedListing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchFiles = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_BASE_URL}/events/listing-files`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!res.ok) throw new Error(`Erreur serveur : ${res.status}`);
        const data = await res.json();
        const sortedFiles = (data.files || []).sort((a, b) => a.localeCompare(b));
        setFiles(sortedFiles);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchFiles();
  }, []);

  const fetchEventsInFile = async (fileName) => {
    setLoading(true);
    setError("");
    setSelectedEvent(null);
    try {
      const res = await fetch(`${API_BASE_URL}/events/events-from-file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: fileName }),
      });
      if (!res.ok) throw new Error(`Erreur serveur : ${res.status}`);
      const data = await res.json();
      const sortedEvents = (data.events || []).sort((a, b) => a.event_name.localeCompare(b.event_name));
      setEvents(sortedEvents);
      setSelectedFile(fileName);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="waiting-listings-main">
      <div className="title-page">Listings en attente de mise en vente</div>

      {loading && <p className="info-text">Chargement...</p>}
      {error && <p className="error-text">Erreur : {error}</p>}

      {!loading && !error && !selectedFile && (
        <div>
          <h2 className="section-title">Fichiers de listings (salles)</h2>
          {files.length === 0 ? (
            <p className="info-text">Aucun fichier trouvé.</p>
          ) : (
            <ul className="file-list">
              {files.map((file, idx) => (
                <li key={idx}>
                  <button
                    className="btn file-btn"
                    onClick={() => fetchEventsInFile(file)}
                  >
                    {file}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!loading && !error && selectedFile && !selectedEvent && (
        <div>
          <button
            className="btn back-btn"
            onClick={() => {
              setSelectedFile(null);
              setEvents([]);
              setSelectedEvent(null);
            }}
          >
            ← Retour aux fichiers
          </button>

          <h2 className="section-title">Fichier : {selectedFile}</h2>

          {events.length === 0 ? (
            <p className="info-text">Aucun événement dans ce fichier.</p>
          ) : (
            <ul className="event-list">
              {events.map((event, idx) => (
                <li key={idx}>
                  <button
                    className="btn event-btn"
                    onClick={() => setSelectedEvent(event)}
                  >
                    {event.event_name} -{" "}
                    {new Date(event.date_seance).toLocaleString("fr-FR", {
                      timeZone: "Europe/Paris",
                    })}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!loading && !error && selectedEvent && (
        <div style={{ width: "80%", margin: "0 auto" }}>
          <button
            className="btn back-btn"
            onClick={() => setSelectedEvent(null)}
          >
            ← Retour aux événements
          </button>

          <div className="event-details">
            <h3>{selectedEvent.event_name}</h3>
            <p>
              <strong>Date:</strong>{" "}
              {new Date(selectedEvent.date_seance).toLocaleString("fr-FR", {
                timeZone: "Europe/Paris",
              })}
            </p>
            <p>
              <strong>URL:</strong>{" "}
              <a
                href={selectedEvent.ticketmaster_url}
                target="_blank"
                rel="noreferrer"
                className="link"
              >
                {selectedEvent.ticketmaster_url}
              </a>
            </p>
            <p>
              <strong>Salle:</strong> {selectedEvent.venue.name}
            </p>

            {selectedEvent.listings && selectedEvent.listings.length > 0 ? (
              <table className="listings-table">
                <thead>
                  <tr>
                    <th>Zone</th>
                    <th>Nombre de places</th>
                    <th>Prix</th>
                    <th>Prix revente</th>
                    <th>Marge (€)</th>
                    <th>Devise</th>
                    <th>Date de séance</th>
                    <th>Type</th>
                    <th>Lister manuellement</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedEvent.listings.map((listing, i) => (
                    <tr key={i}>
                      <td>{listing.zone_label}</td>
                      <td>{listing.nbPlaces}</td>
                      <td>{listing.price}</td>
                      <td>{listing.listingPrice}</td>
                      <td>{(listing.listingPrice - listing.price).toFixed(2)}</td>
                      <td>{listing.devise}</td>
                      <td>
                        {new Date(listing.date_seance).toLocaleString("fr-FR", {
                          timeZone: "Europe/Paris",
                        })}
                      </td>
                      <td>{listing.type}</td>
                      <td>
                        <button
                          className="btn"
                          style={{ display: "flex", justifyContent: "center" }}
                          onClick={() => setSelectedListing(listing)}
                        >
                          Lister sur viagogo
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="info-text">Aucun listing en attente pour cet événement.</p>
            )}
          </div>
        </div>
      )}

      <Modal
        isOpen={!!selectedListing}
        onClose={() => setSelectedListing(null)}
      >
        {selectedListing && (
          <div>
            <h3>Détails du listing</h3>
            <p>
              <strong>Zone:</strong> {selectedListing.zone_label}
            </p>
            <p>
              <strong>Nombre de places:</strong> {selectedListing.nbPlaces}
            </p>
            <p>
              <strong>Prix initial:</strong> {selectedListing.price} {selectedListing.devise}
            </p>
            <p>
              <strong>Prix revente:</strong> {selectedListing.listingPrice} {selectedListing.devise}
            </p>
            <p>
              <strong>Marge:</strong> {(selectedListing.listingPrice - selectedListing.price).toFixed(2)} {selectedListing.devise}
            </p>
            <p>
              <strong>Date de séance:</strong>{" "}
              {new Date(selectedListing.date_seance).toLocaleString("fr-FR", {
                timeZone: "Europe/Paris",
              })}
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default WaitingListings;
