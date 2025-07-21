import express from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();

router.get('/', (req, res) => {
    try {
        const filePath = path.join(process.cwd(), 'back/src/temp/errors/errors_matching_events.json');
        const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        // Pagination
        const page = parseInt(req.query.page, 10) || 1; // par défaut page 1
        const pageSize = 15;
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;

        const paginatedData = jsonData.slice(startIndex, endIndex);

        res.json({
            page,
            pageSize,
            total: jsonData.length,
            totalPages: Math.ceil(jsonData.length / pageSize),
            data: paginatedData
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erreur lors de la lecture du fichier JSON." });
    }
});

router.delete('/reset', (req, res) => {
    try {
        const filePath = path.join(process.cwd(), 'back/src/temp/errors/errors_matching_events.json');

        // Réinitialiser le fichier à un tableau JSON vide
        fs.writeFileSync(filePath, '[]', 'utf8');

        console.log("✅ Fichier errors_matching_events.json réinitialisé avec succès.");
        res.json({ message: "Le fichier a été réinitialisé avec succès." });
    } catch (error) {
        console.error("❌ Erreur lors de la réinitialisation :", error);
        res.status(500).json({ error: "Erreur lors de la réinitialisation du fichier JSON." });
    }
});

export default router;