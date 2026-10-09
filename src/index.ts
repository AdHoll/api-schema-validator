import "dotenv/config";
import "dotenv/config";
import cors from "cors";
import express from "express";
import path from "path";
import validatorRouter from "./routes/validator";
import apiStatusRouter from "./routes/apiStatus";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sert les fichiers statiques (public/index.html)
app.use(express.static(path.join(__dirname, "../public")));

// Préfixe '/api' pour le routeur
app.use("/api", validatorRouter);
// Routeur de la page "Statut des APIs" (Bitwarden + test token)
app.use("/api/status", apiStatusRouter);

app.listen(PORT, () => {
  console.log(`✅ Serveur prêt et disponible sur : http://localhost:${PORT}`);
});
