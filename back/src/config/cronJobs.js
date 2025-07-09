import cron from 'node-cron';
import daily_scraping_fr from '../controllers/FR/D_DAILY/daily_scraping_fr.js';
import cleanPastTickets from '../services/clean_past_tickets.js';
import fetchTicketmasterEventsJPlus10 from '../controllers/FR/A_ADD/fetchTicketmasterEventsJPlus10.js';
import sale_tickets_on_viagogo_from_json_files from '../controllers/FR/C_SELL/sale_tickets_on_viagogo_from_json_files.js';
import processFirstScrapingForEvents from '../controllers/FR/A_ADD/processFirstScrapingForEvents.js';
import extractListOfNewListings from '../controllers/FR/B_CHECK/extractListOfNewListings.js';


cron.schedule('0 6,12,18 * * *', async () => {
    console.log("\n");
    console.log("|-------------------------------------------------------------------|");
    console.log("| >>> CRON - DAILY - Scraping quotidien des évènements en vente <<< |");
    console.log("|-------------------------------------------------------------------|");
    console.log("\n");

    console.log(new Date());
    await daily_scraping_fr();

    console.log("\n");
    console.log("|--------------------------------------------------------------|");
    console.log("| >>> FIN DE L'EXÉCUTION DU WORKFLOW DE SCRAPING QUOTIDIEN <<< |");
    console.log("|--------------------------------------------------------------|");

}, {
    timezone: "Europe/Paris"
});

cron.schedule('30 0 * * *', async () => {
    console.log("\n");
    console.log("|------------------------------------------------------------------------|");
    console.log("| >>> CRON - DAILY - Ajout des évènements depuis Ticketmaster à J+10 <<< |");
    console.log("|------------------------------------------------------------------------|");
    console.log(new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" }));
    console.log("\n");

    try {
        console.log("▶️ Étape 1 : fetchTicketmasterEventsJPlus10");
        await fetchTicketmasterEventsJPlus10();
        console.log("✅ Étape 1 terminée\n");
    } catch (error) {
    }

    try {
        console.log("▶️ Étape 2 : processFirstScrapingForEvents");
        await processFirstScrapingForEvents();
        console.log("✅ Étape 2 terminée\n");
    } catch (error) {
    }

    try {
        console.log("▶️ Étape 3 : extractListOfNewListings");
        await extractListOfNewListings();
        console.log("✅ Étape 3 terminée\n");
    } catch (error) {
    }

    try {
        console.log("▶️ Étape 4 : sale_tickets_on_viagogo_from_json_files");
        await sale_tickets_on_viagogo_from_json_files();
        console.log("✅ Étape 4 terminée\n");
    } catch (error) {
    }

    console.log("\n");
    console.log("|---------------------------------------------------------------------|");
    console.log("| >>> FIN DE L'EXÉCUTION DU WORKFLOW D'AJOUT D'ÉVÈNEMENTS À J+10 <<<  |");
    console.log("|---------------------------------------------------------------------|");
    console.log(new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" }));
    console.log("\n");

}, {
    timezone: "Europe/Paris"
});

cron.schedule('0 0 * * *', async () => {
    console.log(new Date());
    console.log("\n");
    console.log("|----------------------------------------------------------|");
    console.log("| >>> CRON - DAILY - Suppression des évènements passés <<< |");
    console.log("|----------------------------------------------------------|");
    console.log("\n");

    console.log(new Date());
    await cleanPastTickets();

    console.log("\n");
    console.log("|-----------------------------------------------------------------------------|");
    console.log("| >>> FIN DE L'EXÉCUTION DU WORKFLOW DE SUPPRESSION DES ÉVÈNEMENTS PASSÉS <<< |");
    console.log("|-----------------------------------------------------------------------------|");

}, {
    timezone: "Europe/Paris"
});
