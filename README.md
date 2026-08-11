# Strata Explorer — Test Technique

Un explorateur de documents web full-stack permettant de naviguer, structurer et gérer des fichiers via une interface intuitive. Développé dans le cadre du test technique pour la compagnie Strata.

## 1. Stack Technique

* **Frontend :** React 19 + Vite
* **Style & UI :** Tailwind CSS + lucide-react
* **Backend :** Node.js + Express.js
* **Base de données & Stockage :** Supabase (PostgreSQL + Storage)

## 2. Schéma de la base de données

**Table `folders` (Dossiers)**
* `id` (uuid, Primary Key)
* `name` (text, non null)
* `parent_id` (uuid, Foreign Key vers `folders.id`)
* `created_at` (timestamp)

**Table `files` (Fichiers)**
* `id` (uuid, Primary Key)
* `name` (text, non null)
* `size` (integer, taille en octets)
* `storage_path` (text, chemin dans le bucket)
* `folder_id` (uuid, Foreign Key vers `folders.id`)
* `created_at` (timestamp)

## 3. Instructions de lancement

### Configuration du Backend
1. Ouvrir un terminal dans le dossier `strata-backend`.
2. Installer les dépendances : `npm install`.
3. Créer un fichier `.env` basé sur le `.env.example` et y insérer les clés `SUPABASE_URL` et `SUPABASE_KEY`.
4. Démarrer le serveur : `npm run dev` (tourne sur le port 3000).

### Configuration du Frontend
1. Ouvrir un terminal dans le dossier `strata-frontend`.
2. Installer les dépendances : `npm install`.
3. Démarrer l'application : `npm run dev`.

## 4. Améliorations futures (V2)

Si du temps supplémentaire était alloué à ce projet, voici les axes d'amélioration prioritaires :

1. **Architecture Backend :** Séparer le fichier `server.js` en adoptant un pattern Routes/Contrôleurs.
2. **Migration TypeScript :** Typer les requêtes de l'API et les propriétés des composants React pour une meilleure sécurité lors de la compilation.
3. **Fonctionnalités avancées :** Ajout d'une barre de recherche globale récursive et d'une fonctionnalité pour renommer dynamiquement les éléments.