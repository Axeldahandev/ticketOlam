import Event from "../schemas/Event.js";

export default async function cleanPastTickets(req, res, next) {
    try {
        const now = new Date();

        const events = await Event.find(
            { "tickets.dateSeance": { $exists: true } },
            { tickets: 1 }
        );

        let totalRemovedTickets = 0;
        let totalEventsUpdated = 0;
        let totalEventsDeleted = 0;

        for (const event of events) {
            const initialTicketCount = event.tickets.length;

            const updatedTickets = event.tickets.filter(ticket => {
                if (!ticket.dateSeance) return false; // supprimer si pas de date
                const ticketDate = new Date(ticket.dateSeance);
                return ticketDate >= now;
            });

            const removedCount = initialTicketCount - updatedTickets.length;

            if (removedCount > 0) {
                if (updatedTickets.length === 0) {
                    await Event.deleteOne({ _id: event._id });
                    console.log(`🗑️ Event ${event._id} supprimé car plus aucun ticket valide.`);
                    totalEventsDeleted++;
                } else {
                    await Event.updateOne(
                        { _id: event._id },
                        {
                            $set: { tickets: updatedTickets },
                            $currentDate: { updated_at: true }
                        }
                    );
                    console.log(`✅ Event ${event._id} : ${removedCount} ticket(s) supprimé(s).`);
                    totalEventsUpdated++;
                    totalRemovedTickets += removedCount;
                }
            }
        }

        const summaryMessage = `🎉 Nettoyage terminé : ${totalRemovedTickets} ticket(s) supprimé(s), ${totalEventsUpdated} évènement(s) mis à jour, ${totalEventsDeleted} évènement(s) supprimé(s).`;

        console.log(summaryMessage);

        if (res) {
            return res.status(200).json({
                message: summaryMessage
            });
        }

    } catch (error) {
        console.error("❌ [CLEAN PAST TICKETS] Erreur :", error);
        if (res) {
            return res.status(500).json({ error: "Erreur lors du nettoyage des tickets passés." });
        }
    }

    return next?.();
}
