import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// IndexedDB tabanlı Storage API
let dbInstance = null;

const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ProjectHubDB', 1);
    
    request.onerror = () => {
      reject(request.error);
    };
    
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects');
      }
    };
  });
};

window.storage = {
  set: async (key, value) => {
    try {
      if (!dbInstance) {
        await initDB();
      }
      return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction(['projects'], 'readwrite');
        const store = transaction.objectStore('projects');
        const request = store.put(value, key);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    } catch (error) {
      console.error('Storage set hatası:', error);
      return Promise.reject(error);
    }
  },
  get: async (key) => {
    try {
      if (!dbInstance) {
        await initDB();
      }
      return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction(['projects'], 'readonly');
        const store = transaction.objectStore('projects');
        const request = store.get(key);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          if (request.result !== undefined) {
            resolve({ value: request.result });
          } else {
            resolve(null);
          }
        };
      });
    } catch (error) {
      console.error('Storage get hatası:', error);
      return Promise.reject(error);
    }
  },
  remove: async (key) => {
    try {
      if (!dbInstance) {
        await initDB();
      }
      return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction(['projects'], 'readwrite');
        const store = transaction.objectStore('projects');
        const request = store.delete(key);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    } catch (error) {
      console.error('Storage remove hatası:', error);
      return Promise.reject(error);
    }
  }
};

// Database'i başlat
initDB().catch(err => console.error('Database başlatma hatası:', err));

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
