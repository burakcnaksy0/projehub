import React, { useState, useEffect } from 'react';
import { Upload, FolderOpen, Download, Clock, Search, Moon, Sun, FileText, Trash2, LogOut } from 'lucide-react';
import { supabase } from './supabaseClient';
import ProjeHubLogo from './components/ProjeHubLogo';
import Login from './Login';

export default function ProjectHub() {
  const [session, setSession] = useState(null);
  const [darkMode, setDarkMode] = useState(true);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    tags: [],
    files: []
  });

  // Session kontrolü
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Persistent storage'dan projeleri yükle
  useEffect(() => {
    if (session) {
      loadProjectsFromSupabase();
    }
  }, [session]);

  const loadProjectsFromSupabase = async () => {
    try {
      // Projeleri çek
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (projectsError) throw projectsError;

      // Her proje için dosyaları çek
      const projectsWithFiles = await Promise.all(
        projectsData.map(async (project) => {
          const { data: filesData, error: filesError } = await supabase
            .from('project_files')
            .select('*')
            .eq('project_id', project.id);

          if (filesError) throw filesError;

          return {
            ...project,
            createdAt: project.created_at,
            tags: project.tags || [],
            files: filesData || []
          };
        })
      );

      setProjects(projectsWithFiles);
    } catch (error) {
      console.error('Projeler yüklenirken hata:', error);
    }
  };

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
    setProjects(updatedProjects);
  };

  const handleFileUpload = (e, isUpdate = false) => {
    const files = Array.from(e.target.files || []);

    if (files.length === 0) return;

    processFiles(files).then(fileData => {
      const validFiles = fileData.filter(f => !f.error);

      if (isUpdate && selectedProject) {
        handleAddFilesToProject(validFiles);
      } else {
        if (validFiles.length > 0) {
          setNewProject(prev => ({ ...prev, files: [...prev.files, ...validFiles] }));
        }
      }
    });

    e.target.value = '';
  };

  // Görsel sıkıştırma fonksiyonu
  const compressImage = async (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Max boyut 1024px olsun (oranı koru)
          const MAX_SIZE = 1024;
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // JPEG olarak %70 kalitede sıkıştır
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(compressedDataUrl);
        };
        img.src = event.target.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  };

  const processFiles = (files) => {
    const filePromises = files.map(file => {
      return new Promise(async (resolve) => {
        try {
          const isFolder = file.webkitRelativePath ? true : false;
          if (isFolder) {
            resolve({
              name: file.webkitRelativePath || file.name,
              size: file.size,
              type: file.type || 'application/x-directory',
              lastModified: file.lastModified,
              isFolder: true,
              content: null
            });
          } else {
            // Eğer görsel ise sıkıştır
            if (file.type.startsWith('image/')) {
              const compressedContent = await compressImage(file);
              if (compressedContent) {
                // Base64 boyutunu hesapla (yaklaşık)
                const sizeInBytes = Math.ceil((compressedContent.length - 'data:image/jpeg;base64,'.length) * 3 / 4);
                resolve({
                  name: file.name,
                  size: sizeInBytes,
                  type: 'image/jpeg', // Artık jpeg oldu
                  lastModified: Date.now(),
                  isFolder: false,
                  content: compressedContent
                });
                return;
              }
            }

            // Görsel değilse veya sıkıştırma başarısızsa normal oku
            const reader = new FileReader();
            reader.onload = (event) => {
              try {
                resolve({
                  name: file.webkitRelativePath || file.name,
                  size: file.size,
                  type: file.type || 'application/octet-stream',
                  lastModified: file.lastModified,
                  isFolder: false,
                  content: event.target.result
                });
              } catch (error) {
                console.error('Dosya okuma hatası:', file.name, error);
                resolve({ name: file.name, error: true, errorMessage: error.message });
              }
            };
            reader.onerror = (error) => {
              console.error('Dosya okuma başarısız:', file.name, error);
              resolve({ name: file.name, error: true, errorMessage: 'Okuma hatası' });
            };
            reader.readAsDataURL(file);
          }
        } catch (error) {
          console.error('Promise hatası:', file.name, error);
          resolve({ name: file.name, error: true, errorMessage: error.message });
        }
      });
    });
    return Promise.all(filePromises);
  };

  const handleAddFilesToProject = async (newFiles) => {
    if (!selectedProject || newFiles.length === 0) return;

    setIsUpdating(true);
    try {
      // Parçalı yükleme yap
      const BATCH_SIZE = 3;
      for (let i = 0; i < newFiles.length; i += BATCH_SIZE) {
        const batch = newFiles.slice(i, i + BATCH_SIZE);
        const filesData = batch.map(file => ({
          project_id: selectedProject.id,
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          is_folder: file.isFolder,
          content: file.content || null,
          last_modified: file.lastModified
        }));

        const { error } = await supabase
          .from('project_files')
          .insert(filesData);

        if (error) {
          console.error('Paket yükleme hatası:', error);
          throw error;
        }
      }

      // Refresh project data
      const { data: updatedFiles } = await supabase
        .from('project_files')
        .select('*')
        .eq('project_id', selectedProject.id);

      // Update local state
      const updatedProject = { ...selectedProject, files: updatedFiles || [] };
      setSelectedProject(updatedProject);

      // Update global projects list
      setProjects(prev => prev.map(p => p.id === selectedProject.id ? updatedProject : p));

      alert(`${newFiles.length} dosya eklendi!`);
    } catch (error) {
      console.error('Dosya ekleme hatası:', error);
      alert('Dosyalar eklenirken hata oluştu: ' + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProject.name) {
      alert('Proje adı gerekli!');
      return;
    }

    try {
      // Projeyi kaydet
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .insert([
          {
            name: newProject.name,
            description: newProject.description,
            tags: newProject.tags,
            platform: navigator.platform,
            user_id: session.user.id
          }
        ])
        .select()
        .single();

      if (projectError) throw projectError;

      // Dosyaları kaydet (content olmayan dosyaları NULL olarak kaydet)
      // Dosyaları parçalar halinde kaydet (her seferinde 5 dosya)
      if (newProject.files.length > 0) {
        const BATCH_SIZE = 5;
        const filesToUpload = newProject.files;

        for (let i = 0; i < filesToUpload.length; i += BATCH_SIZE) {
          const batch = filesToUpload.slice(i, i + BATCH_SIZE);

          const filesData = batch.map(file => ({
            project_id: projectData.id,
            name: file.name,
            size: file.size,
            type: file.type || 'application/octet-stream',
            is_folder: file.isFolder,
            content: file.content || null,
            last_modified: file.lastModified
          }));

          const { error: batchError } = await supabase
            .from('project_files')
            .insert(filesData);

          if (batchError) {
            console.error('Dosya paketi yükleme hatası:', batchError);
            alert(`Bazı dosyalar yüklenemedi: ${batchError.message}`);
            // Devam et, diğer paketleri dene
          }
        }
      }

      // Projeleri yeniden yükle
      await loadProjectsFromSupabase();

      setShowUploadModal(false);
      setNewProject({ name: '', description: '', tags: [], files: [] });
      alert('Proje başarıyla oluşturuldu! 🎉');
    } catch (error) {
      console.error('Proje oluşturulurken hata:', error);
      alert('Proje oluşturulamadı: ' + error.message);
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (window.confirm('Bu projeyi silmek istediğinize emin misiniz?')) {
      try {
        // Supabase'den sil (dosyalar CASCADE ile otomatik silinir)
        const { error } = await supabase
          .from('projects')
          .delete()
          .eq('id', projectId);

        if (error) throw error;

        // Local state'i güncelle
        const updatedProjects = projects.filter(p => p.id !== projectId);
        setProjects(updatedProjects);

        if (selectedProject?.id === projectId) {
          setSelectedProject(null);
        }

        alert('Proje silindi! 🗑️');
      } catch (error) {
        console.error('Proje silinirken hata:', error);
        alert('Proje silinemedi: ' + error.message);
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
    if (!file.content) {
      console.warn('Bu dosyanın içeriği kaydedilmemiş:', file.name);
      // Mobilde kaydedilemeyen dosyalar için sessiz şekilde hata dön
      return;
    }
    try {
      const link = document.createElement('a');
      link.href = file.content;
      link.download = file.name.split('/').pop();

      if (document.body.appendChild) {
        document.body.appendChild(link);
      }
      link.click();
      if (document.body.removeChild) {
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('İndirme hatası:', error);
      window.open(file.content, '_blank');
    }
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

  if (!session) {
    return <Login />;
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Header */}
      <header className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b sticky top-0 z-10 safe-area-top`}>
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-0">
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-3">
              <ProjeHubLogo />
              <div>
                <h1 className="text-xl sm:text-2xl font-bold">ProjeHub</h1>
                <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">Her platformdan erişilebilir projeler</p>
              </div>
            </div>
            {/* Mobile-only menu items could go here if needed */}
          </div>

          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-lg ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'} active:scale-95 transition-transform`}
              title={darkMode ? "Aydınlık Mod" : "Karanlık Mod"}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              className={`p-2 rounded-lg ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-red-400' : 'bg-gray-100 hover:bg-gray-200 text-red-600'} active:scale-95 transition-transform`}
              title="Çıkış Yap"
            >
              <LogOut className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all active:scale-95 text-sm sm:text-base"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden xs:inline">Yeni</span> Proje
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
            className={`w-full pl-10 pr-4 py-2 rounded-lg ${darkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'
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
                className={`${darkMode ? 'bg-gray-800 hover:bg-gray-750' : 'bg-white hover:bg-gray-50'
                  } rounded-lg p-6 shadow-lg cursor-pointer transition-all hover:scale-105`}
                onClick={() => setSelectedProject(project)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg break-all line-clamp-1">{project.name}</h3>
                      <p className="text-sm text-gray-500">{project.files.length} dosya</p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProject(project.id);
                    }}
                    className="text-red-500 hover:text-red-600 p-2 -mr-2 active:scale-95 transition-transform"
                  >
                    <Trash2 className="w-5 h-5" />
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
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-0 sm:p-4 overflow-y-auto">
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} sm:rounded-xl p-4 sm:p-6 w-full max-w-2xl min-h-screen sm:min-h-0 overflow-y-auto`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Yeni Proje Oluştur</h2>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-gray-500 sm:hidden p-2"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Proje Adı *</label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  className={`w-full px-4 py-2 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  placeholder="Proje adını girin"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Açıklama</label>
                <textarea
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  className={`w-full px-4 py-2 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'
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
                    className={`flex-1 px-4 py-2 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'
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
                <div className={`border-2 border-dashed ${darkMode ? 'border-gray-600' : 'border-gray-300'
                  } rounded-lg p-8 text-center`}>
                  <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />

                  {/* Dosya/Galeri Seçimi */}
                  <input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                    accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
                  />

                  {/* Kamera ile Fotoğraf Çekme (Sadece Mobil) */}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="camera-upload"
                  />

                  {/* Klasör Seçimi (Sadece Desktop) */}
                  <input
                    type="file"
                    webkitdirectory=""
                    directory=""
                    onChange={handleFileUpload}
                    className="hidden"
                    id="folder-upload"
                    multiple
                  />

                  <div className="flex flex-col sm:flex-row gap-3 justify-center mb-2">
                    <label
                      htmlFor="file-upload"
                      className="cursor-pointer px-4 py-3 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Upload className="w-5 h-5" />
                      <span className="sm:hidden">Galeri / Dosya</span>
                      <span className="hidden sm:inline">Dosya Seç</span>
                    </label>
                    <label
                      htmlFor="camera-upload"
                      className="cursor-pointer px-4 py-3 sm:py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition active:scale-95 flex items-center justify-center gap-2 sm:hidden"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Fotoğraf Çek
                    </label>
                    <label
                      htmlFor="folder-upload"
                      className="cursor-pointer px-4 py-3 sm:py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition active:scale-95 flex items-center justify-center gap-2 hidden sm:flex"
                    >
                      <FolderOpen className="w-5 h-5" />
                      Klasör Seç
                    </label>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    <span className="sm:hidden">📱 Galeriden seç veya kamera ile çek</span>
                    <span className="hidden sm:inline">Dosya veya klasör seçebilirsiniz</span>
                  </p>
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
                          className={`flex items-center justify-between p-3 ${darkMode ? 'bg-gray-700' : 'bg-gray-100'
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
                className={`px-4 py-2 ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
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
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-0 sm:p-4 overflow-y-auto">
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} sm:rounded-xl p-4 sm:p-6 w-full max-w-4xl min-h-screen sm:min-h-0 overflow-y-auto`}>
            <div className="flex items-start justify-between mb-6">
              <div className="pr-8">
                <h2 className="text-2xl sm:text-3xl font-bold mb-2 break-all">{selectedProject.name}</h2>
                <p className="text-gray-500 text-sm sm:text-base">{selectedProject.description}</p>
              </div>
              <button
                onClick={() => setSelectedProject(null)}
                className="text-gray-500 hover:text-gray-400 text-3xl p-2 active:scale-95"
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
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Dosyalar ({selectedProject.files.length})</h3>
                <div className="flex gap-2">
                  {/* Galeri/Dosya Seçimi */}
                  <input
                    type="file"
                    id="update-file-upload"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, true)}
                    disabled={isUpdating}
                    accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
                  />
                  {/* Kamera */}
                  <input
                    type="file"
                    id="update-camera-upload"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, true)}
                    disabled={isUpdating}
                  />
                  <label
                    htmlFor="update-file-upload"
                    className={`flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium cursor-pointer transition ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Upload className="w-4 h-4" />
                    <span className="hidden sm:inline">{isUpdating ? 'Yükleniyor...' : 'Dosya Ekle'}</span>
                    <span className="sm:hidden">Galeri</span>
                  </label>
                  <label
                    htmlFor="update-camera-upload"
                    className={`flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium cursor-pointer transition sm:hidden ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="sm:hidden">Kamera</span>
                  </label>
                </div>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {selectedProject.files.map((file, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-4 ${darkMode ? 'bg-gray-700' : 'bg-gray-100'
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
                        <div className="text-sm text-gray-500">
                          {formatFileSize(file.size)}
                          {!file.content && !file.is_folder && (
                            <span className="ml-2 text-orange-400">📵 İçerik yok</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      className={`p-2 flex-shrink-0 ${file.content
                        ? 'text-blue-500 hover:text-blue-600 cursor-pointer'
                        : 'text-gray-400 cursor-not-allowed opacity-50'
                        }`}
                      onClick={() => file.content && downloadFile(file)}
                      disabled={!file.content}
                      title={file.content ? 'İndir' : 'Bu dosyanın içeriği kaydedilmemiş'}
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => downloadAllAsZip(selectedProject)}
                className="flex-1 px-4 py-3 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition active:scale-95 flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Tümünü İndir (ZIP)
              </button>
              <button
                onClick={() => setSelectedProject(null)}
                className={`px-4 py-3 sm:py-2 ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
                  } rounded-lg font-medium transition active:scale-95`}
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