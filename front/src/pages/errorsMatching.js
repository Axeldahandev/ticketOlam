import { useEffect, useState } from "react";
import "./errorsMatching.css";
import API_BASE_URL from "../config/apiConfig";

const ErrorsMatching = () => {
    const [errors, setErrors] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        const fetchErrors = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/errors?page=${page}`);
                const data = await response.json();
                setErrors(data.data);
                setTotalPages(data.totalPages);
            } catch (error) {
                console.error("Erreur lors du chargement des erreurs:", error);
            }
        };

        fetchErrors();
    }, [page]);

    const handleReset = async () => {
        // eslint-disable-next-line no-restricted-globals
        if (!confirm("⚠️ Confirmer la réinitialisation des erreurs ?")) return;
        try {
            const response = await fetch(`${API_BASE_URL}/errors/reset`, {
                method: "DELETE"
            });
            if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);
            setPage(1);
            setErrors([]);
            alert("✅ Erreurs réinitialisées avec succès.");
        } catch (err) {
            console.error(err);
            alert("❌ Erreur lors de la réinitialisation.");
        }
    };

    return (
        <div className="errors-matching-main">
        <div className="title-page">Erreurs de Matching</div>
        <button className="reset-button" onClick={handleReset}>
                Réinitialiser les erreurs
            </button>
        <table className="errors-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Event Ticketmaster</th>
                    <th>Venue</th>
                    <th>TM Categorie / Zone</th>
                    <th>Blocs VG disponibles</th>
                </tr>
            </thead>
            <tbody>
                {errors.map((error, idx) => (
                    <tr key={idx}>
                        <td>{(page - 1) * 10 + idx + 1}</td>
                        <td>{error.ticketmaster_event_name}</td>
                        <td>{error.venue}</td>
                        <td>{error.zone_label}</td>
                        <td>
                            {error.blocks && error.blocks.length > 0 ? (
                                <div className="blocks-container">
                                    {error.blocks.map((block, i) => (
                                        <span key={i} className="block-badge">
                                            {block}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <span>Aucun bloc</span>
                            )}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
        <div className="pagination">
            <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1}
            >
                Précédent
            </button>
            <span>Page {page} / {totalPages}</span>
            <button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
            >
                Suivant
            </button>
        </div>
    </div>
);
};

export default ErrorsMatching;