import { Router } from "express";
import fetchTicketmasterEventsByKeywordFromApi from "../controllers/FR/A_ADD/fetchTicketmasterEventsByKeywordFromApi.js";
import fetchTicketmasterEventsJPlus10 from "../controllers/FR/A_ADD/fetchTicketmasterEventsJPlus10.js";
import processFirstScrapingForEvents from "../controllers/FR/A_ADD/processFirstScrapingForEvents.js";
import extractListOfNewListings from "../controllers/FR/B_CHECK/extractListOfNewListings.js";
import sale_tickets_on_viagogo_from_json_files from "../controllers/FR/C_SELL/sale_tickets_on_viagogo_from_json_files.js";
import daily_scraping_fr from "../controllers/FR/D_DAILY/daily_scraping_fr.js";

const router = Router();

// Helper pour format hh:mm:ss
function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

const startTimer = (req, res, next) => {
    req._startTime = Date.now();

    console.log("|------------------------------------------|");
    console.log("| >>> DÉBUT DE L'EXECUTION DU WORKFLOW <<< |");
    console.log("|------------------------------------------|");

    next();
};

// ----------------------------------------------------------------------------------------------------------------
// A_ADD
// ----------------------------------------------------------------------------------------------------------------

// Middleware 1
const middlewareA1Keyword = async (req, res, next) => {
    console.log("\n");
    console.log("------------------------------------------------------------------------");
    console.log(">>> A1 - Récupération des évènements depuis Ticketmaster par keyword <<<");
    console.log("------------------------------------------------------------------------");
    console.log("\n");
    await fetchTicketmasterEventsByKeywordFromApi(req, res, next);
    next();
};

const middlewareA1JPlus10 = async (req, res, next) => {
    console.log("\n");
    console.log("-------------------------------------------------------------------");
    console.log(">>> A1 - Récupération des évènements depuis Ticketmaster à J+10 <<<");
    console.log("-------------------------------------------------------------------");
    console.log("\n");
    await fetchTicketmasterEventsJPlus10(req, res, next);
    next();
};
// Middleware 2
const middlewareA2 = async (req, res, next) => {
    console.log("\n");
    console.log("|---------------------------------------------------------------------|");
    console.log("| >>> A2 - Premier scraping des évènements sans places récupérées <<< |");
    console.log("|---------------------------------------------------------------------|");
    console.log("\n");
    await processFirstScrapingForEvents(req, res, next);
};

// ----------------------------------------------------------------------------------------------------------------
// B_CHECK
// ----------------------------------------------------------------------------------------------------------------


// Middleware 1
const middlewareB1 = async (req, res, next) => {
    console.log("\n");
    console.log("|---------------------------------------------------|");
    console.log("| >>> B1 - Extraction et formatage des listings <<< |");
    console.log("|---------------------------------------------------|");
    console.log("\n");
    await extractListOfNewListings(req, res, next);
};

// ----------------------------------------------------------------------------------------------------------------
// C_SELL
// ----------------------------------------------------------------------------------------------------------------

// Middleware 1
const middlewareC1 = async (req, res, next) => {
    console.log("\n");
    console.log("|----------------------------------------|");
    console.log("| >>> C1 - Mise en vente sur Viagogo <<< |");
    console.log("|----------------------------------------|");
    console.log("\n");
    await sale_tickets_on_viagogo_from_json_files(req, res, next);
    next();
};

const finalController = (req, res) => {
    const execTimeMs = Date.now() - (req._startTime || Date.now());

    console.log("\n");
    console.log("|-------------------------------------------------------------|");
    console.log("| >>> FIN DE L'EXÉCUTION DU WORKFLOW D'AJOUT D'EVENEMENTS <<< |");
    console.log("|-------------------------------------------------------------|");

    res.status(200).json({
        state: "Success",
        message: `Toutes les étapes du workflow sont terminées.`,
        evenements_ajoutes: req.addedEvents,
        evenements_avec_places_recuperees: req.scrapedEvents,
        fichier_listings_viagogo: req.listings_file,
        totalListingsCount: req.totalListingsCount,
        totalVGListed: req.totalVGListed,
        duration: formatDuration(execTimeMs)
    });
};

router.get(
    "/workflow_complet_ticketmaster_viagogo",  // Route unique
    startTimer,                // Timer début
    middlewareA1Keyword,               // Ajout des events depuis Ticketmaster
    middlewareA2,               // Premier scraping
    middlewareB1,               // Extraction/listing/filtrage
    middlewareC1,               // Mise en vente sur Viagogo
    finalController            // Controller final (à adapter si tu veux toute la synthèse à la fin)
  );

  router.get(
    "/workflow_complet_ticketmaster_viagogo_J_plus_10",  // Route unique
    startTimer,                // Timer début
    middlewareA1JPlus10,               // Ajout des events depuis Ticketmaster
    middlewareA2,               // Premier scraping
    middlewareB1,               // Extraction/listing/filtrage
    middlewareC1,               // Mise en vente sur Viagogo
    finalController            // Controller final (à adapter si tu veux toute la synthèse à la fin)
  );


// ----------------------------------------------------------------------------------------------------------------
// D_DAILY
// ----------------------------------------------------------------------------------------------------------------

const dailyScrapingMiddleware = async (req, res, next) => {
    console.log("\n");
    console.log("------------------------------------------------------------");
    console.log(">>> DAILY - Scraping quotidien des évènements en vente <<<");
    console.log("------------------------------------------------------------");
    console.log("\n");
    await daily_scraping_fr(req, res, next);
    next();
};

const finalDailyScrapingController = (req, res) => {
    const execTimeMs = Date.now() - (req._startTime || Date.now());

    console.log("\n");
    console.log("|-------------------------------------------------------------|");
    console.log("| >>> FIN DE L'EXÉCUTION DU WORKFLOW DE SCRAPING QUOTIDIEN <<< |");
    console.log("|-------------------------------------------------------------|");

    res.status(200).json({
        state: "Success",
        message: `Toutes les étapes du workflow sont terminées.`,

        duration: formatDuration(execTimeMs)
    });
};

router.get(
    "/daily_scraping_onsale_events",  // Route unique
    startTimer,                // Timer début
    dailyScrapingMiddleware,            // Controller de scraping quotidien
    finalDailyScrapingController            // Controller final (à adapter si tu veux toute la synthèse à la fin)
  );

export default router;
