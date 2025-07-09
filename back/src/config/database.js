import mongoose from "mongoose";

const connectDatabase = async () => {
  try {
    await mongoose.connect("mongodb+srv://admin:admin@tov2.yu8mw.mongodb.net/prod?retryWrites=true&w=majority&appName=TOV2" );
    console.log("✅ OK - Connecté à la base de données MongoDB");
  } catch (err) {
    console.error("❌ KO - Connexion à la base de données MongoDB :", err.message);
    process.exit(1); // Stop tout si échec connexion
  }
};

export default connectDatabase;