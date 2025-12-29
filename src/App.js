import React, { useState, useEffect } from 'react';
import { Upload, FolderOpen, Download, Clock, Search, Moon, Sun, Code, FileText, Trash2 } from 'lucide-react';

export default function ProjectHub() {
  const [darkMode, setDarkMode] = useState(true);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    tags: [],
    files: []
  });

  // Persistent storage'dan projeleri yükle
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const result = await window.storage.get('projects-list');
      if (result) {
        setProjects(JSON.parse(result.value));
      }
    } catch (error) {
      console.log('İlk kullanım veya proje bulunamadı');
    }
  };

  const saveProjects = async (updatedProjects) => {
    try {
      await window.storage.set('projects-list', JSON.stringify(updatedProjects));
      setProjects(updatedProjects);
    } catch (error) {
      console.error('Projeler kaydedilemedi:', error);
      alert('Projeler kaydedilirken bir hata oluştu');
    }
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    const filePromises = files.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve({
            name: file.webkitRelativePath || file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
            isFolder: file.webkitRelativePath ? true : false,
            content: event.target.result // Base64 encoded content
          });
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(filePromises).then(fileData => {
      setNewProject({ ...newProject, files: fileData });
    });
  };

  const handleCreateProject = async () => {
    if (!newProject.name) {
      alert('Proje adı gerekli!');
      return;
    }

    try {
      const project = {
        id: Date.now().toString(),
        ...newProject,
        createdAt: new Date().toISOString(),
        versions: [{
          id: 1,
          date: new Date().toISOString(),
          files: newProject.files
        }],
        platform: navigator.platform,
        lastAccessed: new Date().toISOString()
      };

      const updatedProjects = [...projects, project];
      await saveProjects(updatedProjects);
      setShowUploadModal(false);
      setNewProject({ name: '', description: '', tags: [], files: [] });
      alert('Proje başarıyla oluşturuldu!');
    } catch (error) {
      console.error('Proje oluşturma hatası:', error);
      alert('Proje oluşturulurken bir hata oluştu: ' + error.message);
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (window.confirm('Bu projeyi silmek istediğinize emin misiniz?')) {
      const updatedProjects = projects.filter(p => p.id !== projectId);
      await saveProjects(updatedProjects);
      if (selectedProject?.id === projectId) {
        setSelectedProject(null);
      }
    }
  };

  const addTag = (tag) => {
    if (tag && !newProject.tags.includes(tag)) {
      setNewProject({ ...newProject, tags: [...newProject.tags, tag] });
    }
  };

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const downloadFile = (file) => {
    const link = document.createElement('a');
    link.href = file.content;
    link.download = file.name.split('/').pop(); // Sadece dosya adını al
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAllAsZip = async (project) => {
    try {
      // JSZip kütüphanesini dinamik olarak yükle
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      
      script.onload = async () => {
        try {
          const JSZip = window.JSZip;
          const zip = new JSZip();

          // Tüm dosyaları zip'e ekle
          project.files.forEach(file => {
            if (file.content) {
              // Base64'ten binary data'ya çevir
              const base64Data = file.content.split(',')[1];
              zip.file(file.name, base64Data, { base64: true });
            }
          });

          // ZIP dosyasını oluştur ve indir
          const content = await zip.generateAsync({ type: 'blob' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(content);
          link.download = `${project.name}.zip`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);
          alert('Dosyalar başarıyla indirildi!');
        } catch (error) {
          console.error('ZIP oluşturulurken hata:', error);
          alert('ZIP dosyası oluşturulurken bir hata oluştu: ' + error.message);
        }
      };

      script.onerror = () => {
        alert('ZIP kütüphanesi yüklenemedi');
      };

      document.head.appendChild(script);
    } catch (error) {
      console.error('İndirme hatası:', error);
      alert('İndirme sırasında bir hata oluştu: ' + error.message);
    }
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Header */}
      <header className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b sticky top-0 z-10`}>
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Code className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">ProjeHub</h1>
              <p className="text-sm text-gray-500">Her platformdan erişilebilir projeler</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-lg ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
            >
              <Upload className="w-4 h-4" />
              Yeni Proje
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Search Bar */}
        <div className={`mb-6 relative ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg p-4 shadow`}>
          <Search className="absolute left-7 top-7 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Proje ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 rounded-lg ${
              darkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'
            } focus:outline-none focus:ring-2 focus:ring-blue-500`}
          />
        </div>

        {/* Projects Grid */}
        {filteredProjects.length === 0 ? (
          <div className="text-center py-20">
            <FolderOpen className="w-20 h-20 mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Henüz proje yok</h3>
            <p className="text-gray-500 mb-6">İlk projenizi oluşturarak başlayın</p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
            >
              Proje Oluştur
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                className={`${
                  darkMode ? 'bg-gray-800 hover:bg-gray-750' : 'bg-white hover:bg-gray-50'
                } rounded-lg p-6 shadow-lg cursor-pointer transition-all hover:scale-105`}
                onClick={() => setSelectedProject(project)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                      <FileText className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{project.name}</h3>
                      <p className="text-sm text-gray-500">{project.files.length} dosya</p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProject(project.id);
                    }}
                    className="text-red-500 hover:text-red-600 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                <p className="text-sm text-gray-400 mb-4 line-clamp-2">{project.description}</p>
                
                <div className="flex flex-wrap gap-2 mb-4">
                  {project.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {formatDate(project.createdAt)}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
                      {project.platform}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto`}>
            <h2 className="text-2xl font-bold mb-6">Yeni Proje Oluştur</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Proje Adı *</label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  className={`w-full px-4 py-2 rounded-lg ${
                    darkMode ? 'bg-gray-700' : 'bg-gray-100'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  placeholder="Proje adını girin"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Açıklama</label>
                <textarea
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  className={`w-full px-4 py-2 rounded-lg ${
                    darkMode ? 'bg-gray-700' : 'bg-gray-100'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  rows="3"
                  placeholder="Projenizi tanımlayın"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Etiketler</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        addTag(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className={`flex-1 px-4 py-2 rounded-lg ${
                      darkMode ? 'bg-gray-700' : 'bg-gray-100'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    placeholder="Etiket ekle (Enter'a basın)"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {newProject.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm flex items-center gap-2"
                    >
                      {tag}
                      <button
                        onClick={() => setNewProject({
                          ...newProject,
                          tags: newProject.tags.filter((_, i) => i !== idx)
                        })}
                        className="hover:text-red-400"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Dosyalar ve Klasörler</label>
                <div className={`border-2 border-dashed ${
                  darkMode ? 'border-gray-600' : 'border-gray-300'
                } rounded-lg p-8 text-center`}>
                  <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  
                  {/* Dosya Seçimi */}
                  <input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  
                  {/* Klasör Seçimi */}
                  <input
                    type="file"
                    webkitdirectory=""
                    directory=""
                    onChange={handleFileUpload}
                    className="hidden"
                    id="folder-upload"
                  />
                  
                  <div className="flex gap-3 justify-center mb-2">
                    <label
                      htmlFor="file-upload"
                      className="cursor-pointer px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
                    >
                      📄 Dosya Seç
                    </label>
                    <label
                      htmlFor="folder-upload"
                      className="cursor-pointer px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition"
                    >
                      📁 Klasör Seç
                    </label>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">veya dosyaları buraya sürükleyin</p>
                </div>
                {newProject.files.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Toplam: {newProject.files.length} dosya</span>
                      <span className="text-sm text-gray-500">
                        {formatFileSize(newProject.files.reduce((acc, f) => acc + f.size, 0))}
                      </span>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {newProject.files.map((file, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center justify-between p-3 ${
                            darkMode ? 'bg-gray-700' : 'bg-gray-100'
                          } rounded-lg`}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {file.isFolder ? (
                              <FolderOpen className="w-4 h-4 text-purple-400 flex-shrink-0" />
                            ) : (
                              <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
                            )}
                            <span className="text-sm truncate">{file.name}</span>
                          </div>
                          <span className="text-xs text-gray-500 ml-2 flex-shrink-0">{formatFileSize(file.size)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCreateProject}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
              >
                Proje Oluştur
              </button>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setNewProject({ name: '', description: '', tags: [], files: [] });
                }}
                className={`px-4 py-2 ${
                  darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
                } rounded-lg font-medium transition`}
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Project Detail Modal */}
      {selectedProject && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto`}>
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-3xl font-bold mb-2">{selectedProject.name}</h2>
                <p className="text-gray-500">{selectedProject.description}</p>
              </div>
              <button
                onClick={() => setSelectedProject(null)}
                className="text-gray-500 hover:text-gray-400 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className={`${darkMode ? 'bg-gray-700' : 'bg-gray-100'} p-4 rounded-lg`}>
                <div className="text-sm text-gray-500 mb-1">Oluşturulma</div>
                <div className="font-semibold">{formatDate(selectedProject.createdAt)}</div>
              </div>
              <div className={`${darkMode ? 'bg-gray-700' : 'bg-gray-100'} p-4 rounded-lg`}>
                <div className="text-sm text-gray-500 mb-1">Platform</div>
                <div className="font-semibold">{selectedProject.platform}</div>
              </div>
              <div className={`${darkMode ? 'bg-gray-700' : 'bg-gray-100'} p-4 rounded-lg`}>
                <div className="text-sm text-gray-500 mb-1">Dosya Sayısı</div>
                <div className="font-semibold">{selectedProject.files.length} dosya</div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">Etiketler</h3>
              <div className="flex flex-wrap gap-2">
                {selectedProject.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">Dosyalar ({selectedProject.files.length})</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {selectedProject.files.map((file, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-4 ${
                      darkMode ? 'bg-gray-700' : 'bg-gray-100'
                    } rounded-lg`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {file.isFolder ? (
                        <FolderOpen className="w-5 h-5 text-purple-400 flex-shrink-0" />
                      ) : (
                        <FileText className="w-5 h-5 text-blue-400 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{file.name}</div>
                        <div className="text-sm text-gray-500">{formatFileSize(file.size)}</div>
                      </div>
                    </div>
                    <button className="p-2 text-blue-500 hover:text-blue-600 flex-shrink-0" onClick={() => downloadFile(file)}>
                      <Download className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button 
                onClick={() => downloadAllAsZip(selectedProject)}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Tümünü İndir (ZIP)
              </button>
              <button
                onClick={() => setSelectedProject(null)}
                className={`px-4 py-2 ${
                  darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
                } rounded-lg font-medium transition`}
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}