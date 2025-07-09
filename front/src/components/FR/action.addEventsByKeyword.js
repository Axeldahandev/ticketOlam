import React, { useState } from "react";
import "./action.addEventsByKeyword.css";
import API_BASE_URL from "../../config/apiConfig";

export default function ActionAddEventsByKeyword() {
    const [keyword, setKeyword] = useState("");
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState(null);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setResponse(null);
        setError(null);
        try {
            const res = await fetch(`${API_BASE_URL}/fr/workflow_complet_ticketmaster_viagogo?keyword=${encodeURIComponent(keyword)}`);
            if (!res.ok) throw new Error(`HTTP error ${res.status}`);
            const data = await res.json();
            setResponse(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="workflow-container">
            <div >Ajouter des évènements par mot-clé :</div>
            <form onSubmit={handleSubmit} className="workflow-form">
                <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Mot-clé Ticketmaster" required className="workflow-input" />
                <button type="submit" disabled={loading} className="workflow-button">{loading ? "En cours..." : "Lancer"}</button>
            </form>
            {response && <pre className="workflow-response">{JSON.stringify(response, null, 2)}</pre>}
            {error && <div className="workflow-error">Erreur : {error}</div>}
        </div>
    );
}
