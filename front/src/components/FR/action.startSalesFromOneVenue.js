import React, { useState, useEffect } from "react";
import "./action.startSalesFromOneVenue.css";
import API_BASE_URL from "../../config/apiConfig";

export default function ActionStartSalesFromOneVenue() {

    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [selectedFile, setSelectedFile] = useState("");
    const [response, setResponse] = useState("");

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

    const handleSubmit = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch(`${API_BASE_URL}/listings/resell-file`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fileName: selectedFile }),
            });
            if (!res.ok) throw new Error(`Erreur serveur : ${res.status}`);
            const data = await res.json();
            setResponse(data.message);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }
    return (
        <div className="workflow-container">
            <div>Lancer la mise en vente sur viagogo pour une salle précise :</div>
            <div>
            <select className="salle-input" onChange={(e) => setSelectedFile(e.target.value)} value={selectedFile} required>
                <option value="">Sélectionnez une salle</option>
                {files.map((file) => (
                    <option key={file} value={file}>{file}</option>
                ))}
            </select>
          <button type="submit" disabled={loading} className="workflow-button" onClick={handleSubmit}>{loading ? "En cours..." : "Lancer la mise en vente"}</button>
            </div>
            {response && <div className="response-message">{response}</div>}
            {error && <div className="error-message">{error}</div>}
        </div>
    )
}