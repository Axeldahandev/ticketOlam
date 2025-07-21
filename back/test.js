import Event from "./src/schemas/Event.js";

async function test() {
  const eventsWithNullInfoCategoriesOrNotDoublon = await Event.find({
    $and: [
      { "tickets.infoCategories": { $exists: true, $eq: null } },
      { tickets: { $ne: [{ Doublon: true }] } }
    ]
  });

  console.log(eventsWithNullInfoCategoriesOrNotDoublon);
}

test();