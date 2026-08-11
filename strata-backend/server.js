require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Configuration et initialisation
const PORT = process.env.PORT || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const STORAGE_BUCKET = 'documents';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Erreur : les variables SUPABASE_URL et SUPABASE_KEY doivent être définies dans .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const app = express();

app.use(cors());
app.use(express.json());

// Configuration de l'upload en mémoire (50 Mo max)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Utilitaires
function sanitizeFileName(fileName) {
  return path.basename(fileName).replace(/[^\w.\-() ]/g, '_');
}

function buildStoragePath(folderId, originalName) {
  const prefix = folderId || 'root';
  const uniqueId = crypto.randomUUID();
  return `${prefix}/${uniqueId}-${sanitizeFileName(originalName)}`;
}

async function getDescendantFolderIds(folderId) {
  const descendantIds = [];
  const queue = [folderId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    const { data: children, error } = await supabase
      .from('folders')
      .select('id')
      .eq('parent_id', currentId);

    if (error) throw error;

    for (const child of children) {
      descendantIds.push(child.id);
      queue.push(child.id);
    }
  }

  return descendantIds;
}

function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Le fichier dépasse la taille maximale autorisée (50 Mo).' });
    }
    return res.status(400).json({ error: err.message });
  }
  return next(err);
}

// API : Gestion des dossiers

// GET /api/folders/:id — Récupère le contenu d'un dossier
app.get('/api/folders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const isRoot = id === 'root';

    if (!isRoot) {
      const { data: folder, error: folderError } = await supabase
        .from('folders')
        .select('id, name, parent_id, created_at')
        .eq('id', id)
        .maybeSingle();

      if (folderError) throw folderError;
      if (!folder) return res.status(404).json({ error: 'Dossier introuvable.' });
    }

    let foldersQuery = supabase
      .from('folders')
      .select('id, name, parent_id, created_at')
      .order('name', { ascending: true });

    foldersQuery = isRoot
      ? foldersQuery.is('parent_id', null)
      : foldersQuery.eq('parent_id', id);

    const { data: folders, error: foldersError } = await foldersQuery;
    if (foldersError) throw foldersError;

    let filesQuery = supabase
      .from('files')
      .select('id, name, size, storage_path, folder_id, created_at')
      .order('name', { ascending: true });

    filesQuery = isRoot
      ? filesQuery.is('folder_id', null)
      : filesQuery.eq('folder_id', id);

    const { data: files, error: filesError } = await filesQuery;
    if (filesError) throw filesError;

    return res.json({
      folderId: isRoot ? null : id,
      folders: folders ?? [],
      files: files ?? [],
    });
  } catch (error) {
    console.error('GET /api/folders/:id —', error.message);
    return res.status(500).json({ error: 'Impossible de récupérer le contenu du dossier.' });
  }
});

// POST /api/folders — Crée un nouveau dossier
app.post('/api/folders', async (req, res) => {
  try {
    const { name, parent_id: parentId = null } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Le nom du dossier est obligatoire.' });
    }

    const trimmedName = name.trim();

    if (parentId) {
      const { data: parentFolder, error: parentError } = await supabase
        .from('folders')
        .select('id')
        .eq('id', parentId)
        .maybeSingle();

      if (parentError) throw parentError;
      if (!parentFolder) return res.status(404).json({ error: 'Le dossier parent est introuvable.' });
    }

    let duplicateQuery = supabase
      .from('folders')
      .select('id')
      .eq('name', trimmedName);

    if (parentId) {
      duplicateQuery = duplicateQuery.eq('parent_id', parentId);
    } else {
      duplicateQuery = duplicateQuery.is('parent_id', null);
    }

    const { data: existingFolder, error: duplicateError } = await duplicateQuery.maybeSingle();
    
    if (duplicateError) throw duplicateError;
    if (existingFolder) {
      return res.status(409).json({ error: 'Un dossier avec ce nom existe déjà à cet emplacement.' });
    }

    const { data: newFolder, error: insertError } = await supabase
      .from('folders')
      .insert({ name: trimmedName, parent_id: parentId })
      .select('id, name, parent_id, created_at')
      .single();

    if (insertError) throw insertError;

    return res.status(201).json(newFolder);
  } catch (error) {
    console.error('POST /api/folders —', error.message);
    return res.status(500).json({ error: 'Impossible de créer le dossier.' });
  }
});

// DELETE /api/folders/:id — Supprime un dossier et tout son contenu
app.delete('/api/folders/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (id === 'root') {
      return res.status(400).json({ error: 'Impossible de supprimer la racine.' });
    }

    const { data: folder, error: folderError } = await supabase
      .from('folders')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (folderError) throw folderError;
    if (!folder) return res.status(404).json({ error: 'Dossier introuvable.' });

    const descendantIds = await getDescendantFolderIds(id);
    const allFolderIds = [id, ...descendantIds];

    const { data: filesToDelete, error: filesError } = await supabase
      .from('files')
      .select('id, storage_path')
      .in('folder_id', allFolderIds);

    if (filesError) throw filesError;

    if (filesToDelete && filesToDelete.length > 0) {
      const storagePaths = filesToDelete.map((file) => file.storage_path);
      const { error: storageError } = await supabase.storage.from(STORAGE_BUCKET).remove(storagePaths);
      if (storageError) throw storageError;

      const fileIds = filesToDelete.map((file) => file.id);
      const { error: deleteFilesError } = await supabase.from('files').delete().in('id', fileIds);
      if (deleteFilesError) throw deleteFilesError;
    }

    const foldersToDelete = [...descendantIds.reverse(), id];
    const { error: deleteFoldersError } = await supabase.from('folders').delete().in('id', foldersToDelete);
    if (deleteFoldersError) throw deleteFoldersError;

    return res.json({
      message: 'Dossier supprimé avec succès.',
      deletedFolderId: id,
      deletedFilesCount: filesToDelete?.length ?? 0,
      deletedFoldersCount: allFolderIds.length,
    });
  } catch (error) {
    console.error('DELETE /api/folders/:id —', error.message);
    return res.status(500).json({ error: 'Impossible de supprimer le dossier.' });
  }
});

// API : Gestion des fichiers

// POST /api/files — Upload un fichier et enregistre ses métadonnées
app.post('/api/files', upload.single('file'), handleMulterError, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni.' });

    const folderId = req.body.folder_id || null;

    if (folderId) {
      const { data: targetFolder, error: folderError } = await supabase
        .from('folders')
        .select('id')
        .eq('id', folderId)
        .maybeSingle();

      if (folderError) throw folderError;
      if (!targetFolder) return res.status(404).json({ error: 'Le dossier de destination est introuvable.' });
    }

    const originalName = req.file.originalname;
    const storagePath = buildStoragePath(folderId, originalName);

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: newFile, error: insertError } = await supabase
      .from('files')
      .insert({
        name: sanitizeFileName(originalName),
        size: req.file.size,
        storage_path: storagePath,
        folder_id: folderId,
      })
      .select('id, name, size, storage_path, folder_id, created_at')
      .single();

    if (insertError) {
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
      throw insertError;
    }

    return res.status(201).json(newFile);
  } catch (error) {
    console.error('POST /api/files —', error.message);
    return res.status(500).json({ error: 'Impossible d\'uploader le fichier.' });
  }
});

// DELETE /api/files/:id — Supprime un fichier
app.delete('/api/files/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: file, error: fetchError } = await supabase
      .from('files')
      .select('id, storage_path')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!file) return res.status(404).json({ error: 'Fichier introuvable.' });

    const { error: storageError } = await supabase.storage.from(STORAGE_BUCKET).remove([file.storage_path]);
    if (storageError) throw storageError;

    const { error: deleteError } = await supabase.from('files').delete().eq('id', id);
    if (deleteError) throw deleteError;

    return res.json({ message: 'Fichier supprimé avec succès.', deletedFileId: id });
  } catch (error) {
    console.error('DELETE /api/files/:id —', error.message);
    return res.status(500).json({ error: 'Impossible de supprimer le fichier.' });
  }
});

// GET /api/files/:id/download — Génère un lien de téléchargement sécurisé
app.get('/api/files/:id/download', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: file, error: fetchError } = await supabase
      .from('files')
      .select('storage_path')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!file) return res.status(404).json({ error: 'Fichier introuvable.' });

    const { data: storageData, error: storageError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(file.storage_path, 60, { download: true });

    if (storageError) throw storageError;

    return res.redirect(storageData.signedUrl);
  } catch (error) {
    console.error('GET /api/files/:id/download —', error.message);
    return res.status(500).json({ error: 'Impossible de télécharger le fichier.' });
  }
});

// PUT /api/folders/:id — Renomme un dossier
app.put('/api/folders/:id', async (req, res) => {
  const { id } = req.params;
  const { newName } = req.body;
  
  const { data, error } = await supabase
      .from('folders')
      .update({ name: newName })
      .eq('id', id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// PUT /api/files/:id — Renomme un fichier
app.put('/api/files/:id', async (req, res) => {
  const { id } = req.params;
  const { newName } = req.body;
  
  const { data, error } = await supabase
      .from('files')
      .update({ name: newName })
      .eq('id', id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// Middlewares globaux

app.use((req, res) => {
  res.status(404).json({ error: 'Route introuvable.' });
});

app.use((err, req, res, next) => {
  console.error('Erreur non gérée —', err.message);
  res.status(500).json({ error: 'Erreur interne du serveur.' });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});