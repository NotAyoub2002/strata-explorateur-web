import { useState, useEffect, useRef } from 'react';
import { Folder, FileText, Trash2, Home, ChevronRight, UploadCloud, FolderPlus, Download, Edit2, Search } from 'lucide-react';

function App() {
  // États de l'application
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [currentFolder, setCurrentFolder] = useState('root');
  const [history, setHistory] = useState([{ id: 'root', name: 'Racine' }]); 
  const [searchQuery, setSearchQuery] = useState(''); // Nouvel état pour la recherche
  
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const fileInputRef = useRef(null);

  // Chargement et navigation
  const loadContent = async (folderId = 'root') => {
    try {
      const response = await fetch(`http://localhost:3000/api/folders/${folderId}`);
      const data = await response.json();
      setFolders(data.folders || []);
      setFiles(data.files || []);
      setCurrentFolder(folderId);
      setSearchQuery(''); // Réinitialise la recherche quand on change de dossier
    } catch (error) {
      console.error("Erreur de connexion:", error);
    }
  };

  useEffect(() => {
    loadContent('root');
  }, []);

  const handleNavigate = (folderId, folderName) => {
    setHistory([...history, { id: folderId, name: folderName }]);
    loadContent(folderId);
  };

  const handleJumpToHistory = (index) => {
    const newHistory = history.slice(0, index + 1);
    setHistory(newHistory);
    loadContent(newHistory[newHistory.length - 1].id);
  };

  // Gestion des dossiers
  const handleCreateFolder = async () => {
    const folderName = prompt("Nom du nouveau dossier :");
    if (!folderName) return;
    
    try {
      const response = await fetch('http://localhost:3000/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: folderName,
          parent_id: currentFolder === 'root' ? null : currentFolder
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        alert(errorData.error || "Une erreur est survenue lors de la création.");
        return; 
      }

      loadContent(currentFolder);
    } catch (error) {
      console.error("Erreur de création:", error);
      alert("Impossible de contacter le serveur.");
    }
  };

  const handleDeleteFolder = async (id, event) => {
    event.stopPropagation();
    if (!window.confirm("Es-tu sûr de vouloir supprimer ce dossier ainsi que tout son contenu ?")) return;

    try {
      await fetch(`http://localhost:3000/api/folders/${id}`, { method: 'DELETE' });
      loadContent(currentFolder);
    } catch (error) {
      console.error("Erreur de suppression du dossier:", error);
    }
  };

  // Gestion des fichiers
  const processUpload = async (file) => {
    if (!file) return;
    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', file);
    if (currentFolder !== 'root') {
      formData.append('folder_id', currentFolder);
    }

    try {
      await fetch('http://localhost:3000/api/files', { method: 'POST', body: formData });
      await loadContent(currentFolder); 
    } catch (error) {
      console.error("Erreur d'upload:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    processUpload(file);
  };

  const handleDeleteFile = async (id, event) => {
    event.stopPropagation();
    if (!window.confirm("Es-tu sûr de vouloir supprimer ce fichier ?")) return;
    
    try {
      await fetch(`http://localhost:3000/api/files/${id}`, { method: 'DELETE' });
      loadContent(currentFolder);
    } catch (error) {
      console.error("Erreur de suppression:", error);
    }
  };

  const handleDownloadFile = (id, event) => {
    event.stopPropagation();
    window.open(`http://localhost:3000/api/files/${id}/download`, '_blank');
  };

  const handleRename = async (id, type, currentName) => {
    const newName = prompt("Entrez le nouveau nom :", currentName);
    
    if (!newName || newName === currentName) return; 

    try {
      const response = await fetch(`http://localhost:3000/api/${type}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName })
      });

      if (response.ok) {
        loadContent(currentFolder);
      } else {
        const errorData = await response.json();
        alert(`Erreur du serveur : ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      console.error("Erreur de connexion :", error);
    }
  };

  // Gestion du glisser-déposer
  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      const item = e.dataTransfer.items[0].webkitGetAsEntry();
      if (item && item.isDirectory) {
        alert("L'upload de dossiers entiers n'est pas supporté pour ce prototype. Veuillez glisser des fichiers individuels.");
        return; 
      }
    }

    const file = e.dataTransfer.files[0];
    if (file) processUpload(file);
  };

  // Utilitaires de formatage
  const formatSize = (bytes) => {
    if (!bytes) return '--';
    const mb = bytes / (1024 * 1024);
    return mb < 1 ? (bytes / 1024).toFixed(1) + ' Ko' : mb.toFixed(1) + ' Mo';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '--';
    return new Date(dateString).toLocaleDateString('fr-CA', { 
      year: 'numeric', month: 'short', day: 'numeric' 
    });
  };

  // Logique de filtrage pour la barre de recherche
  const filteredFolders = folders.filter(folder => 
    folder.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const filteredFiles = files.filter(file => 
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Rendu de l'interface
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-200 p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        
        <header className="mb-8 border-b border-gray-800 pb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <Folder className="text-blue-500" size={32} /> Strata Explorer
            </h1>
            <p className="text-sm text-gray-400 mt-2">Explorateur de fichiers sécurisé</p>
          </div>
          
          <div className="flex gap-4">
            <button 
              onClick={handleCreateFolder}
              disabled={isUploading}
              className="bg-[#1a1a1a] hover:bg-gray-800 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-medium transition-colors border border-gray-700 cursor-pointer flex items-center gap-2"
            >
              <FolderPlus size={18} /> Nouveau dossier
            </button>

            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
            <button 
              onClick={() => fileInputRef.current.click()}
              disabled={isUploading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-2"
            >
              {isUploading ? (
                <>
                  <UploadCloud className="animate-bounce" size={18} /> Upload en cours...
                </>
              ) : (
                <>
                  <UploadCloud size={18} /> Uploader un fichier
                </>
              )}
            </button>
          </div>
        </header>
        
        <main 
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`bg-[#111111] rounded-xl p-6 min-h-[500px] transition-all duration-200 border-2 ${
            isDragging ? 'border-blue-500 bg-[#1a1c23]' : 'border-gray-800'
          }`}
        >
          {isDragging && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 rounded-xl pointer-events-none">
              <p className="text-2xl font-bold text-blue-400 flex items-center gap-3">
                <UploadCloud size={32} /> Glissez le fichier ici
              </p>
            </div>
          )}
          
          {/* Section Navigation et Recherche */}
          <div className="flex flex-col md:flex-row gap-4 mb-8 relative z-20">
            {/* Fil d'ariane (Breadcrumb) */}
            <div className="flex items-center flex-wrap gap-2 bg-[#1a1a1a] p-3 rounded-lg border border-gray-800 text-sm flex-1">
              {history.map((step, index) => (
                <div key={step.id} className="flex items-center gap-2">
                  <button 
                    onClick={() => handleJumpToHistory(index)}
                    className={`flex items-center gap-2 transition-colors cursor-pointer ${
                      index === history.length - 1 ? 'text-white font-medium' : 'text-gray-500 hover:text-blue-400'
                    }`}
                  >
                    {step.id === 'root' && <Home size={16} />}
                    <span>{step.name}</span>
                  </button>
                  {index < history.length - 1 && <ChevronRight size={16} className="text-gray-600" />}
                </div>
              ))}
            </div>

            {/* Barre de recherche */}
            <div className="relative md:max-w-xs w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={18} className="text-gray-500" />
              </div>
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-[#1a1a1a] border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors text-sm"
              />
            </div>
          </div>

          {filteredFiles.length === 0 && filteredFolders.length === 0 ? (
            <div className="flex h-full items-center justify-center mt-32 relative z-20">
              <p className="text-gray-500 text-center flex flex-col items-center gap-3">
                {searchQuery ? (
                  <>
                    <Search size={48} className="opacity-20" />
                    Aucun résultat pour "{searchQuery}"
                  </>
                ) : (
                  <>
                    <Folder size={48} className="opacity-20" />
                    Aucun fichier ni dossier ici.<br/>
                    <span className="text-sm">Glissez-déposez un document pour commencer.</span>
                  </>
                )}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative z-20">
              
              {filteredFolders.map(folder => (
                <div 
                  key={folder.id} 
                  onClick={() => handleNavigate(folder.id, folder.name)}
                  className="p-4 border border-gray-700 rounded-lg flex justify-between items-center bg-[#222222] hover:border-blue-500/50 hover:bg-[#2a2a2a] transition-all cursor-pointer group"
                >
                  <div className="flex items-center overflow-hidden">
                    <Folder className="text-blue-400 mr-3 flex-shrink-0" size={24} fill="currentColor" fillOpacity={0.2} />
                    <span className="truncate text-sm font-bold text-white">{folder.name}</span>
                  </div>
                  
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRename(folder.id, 'folders', folder.name);
                      }}
                      className="text-yellow-500 hover:text-yellow-400 p-2 rounded hover:bg-yellow-500/10 transition-colors cursor-pointer"
                      title="Renommer le dossier"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={(e) => handleDeleteFolder(folder.id, e)}
                      className="text-red-500 hover:text-red-400 p-2 rounded hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="Supprimer le dossier"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}

              {filteredFiles.map(file => (
                <div key={file.id} className="p-4 border border-gray-800 rounded-lg flex flex-col bg-[#1a1a1a] hover:border-gray-600 transition-all group">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center overflow-hidden">
                      <FileText className="text-gray-400 mr-3 flex-shrink-0" size={24} />
                      <span className="truncate text-sm font-medium text-gray-200" title={file.name}>{file.name}</span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRename(file.id, 'files', file.name);
                        }}
                        className="text-yellow-500 hover:text-yellow-400 p-1.5 rounded hover:bg-yellow-500/10 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                        title="Renommer le fichier"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={(e) => handleDownloadFile(file.id, e)}
                        className="text-blue-500 hover:text-blue-400 p-1.5 rounded hover:bg-blue-500/10 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                        title="Télécharger le fichier"
                      >
                        <Download size={16} />
                      </button>
                      <button 
                        onClick={(e) => handleDeleteFile(file.id, e)}
                        className="text-red-500 hover:text-red-400 p-1.5 rounded hover:bg-red-500/10 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                        title="Supprimer le fichier"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-800/50 text-xs text-gray-500">
                    <span>{formatSize(file.size)}</span>
                    <span>{formatDate(file.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;