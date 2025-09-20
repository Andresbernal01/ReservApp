// login.js - Sistema de autenticación para Zahara Studio (CORREGIDO)

// Función para verificar si el usuario está autenticado
function isAuthenticated() {
    const token = localStorage.getItem('zahara_auth_token');
    if (!token) return false;
    
    try {
        // Verificar si el token no ha expirado
        const payload = JSON.parse(atob(token.split('.')[1]));
        const currentTime = Math.floor(Date.now() / 1000);
        return payload.exp > currentTime;
    } catch (error) {
        console.error('Error verificando token:', error);
        return false;
    }
}

// Función para proteger páginas
function protectPage() {
    if (!isAuthenticated()) {
        // Redirigir a login si no está autenticado
        window.location.href = '/login.html';
        return false;
    }
    return true;
}

// Función para agregar token a las peticiones fetch
function getAuthHeaders() {
    const token = localStorage.getItem('zahara_auth_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

// Función para hacer peticiones autenticadas
async function authenticatedFetch(url, options = {}) {
    const defaultOptions = {
        headers: getAuthHeaders(),
        ...options
    };

    if (options.headers) {
        defaultOptions.headers = { ...defaultOptions.headers, ...options.headers };
    }

    try {
        const response = await fetch(url, defaultOptions);
        
        // Si el token ha expirado o es inválido
        if (response.status === 401) {
            logout();
            return null;
        }
        
        return response;
    } catch (error) {
        console.error('Error en petición autenticada:', error);
        throw error;
    }
}

// Función para cerrar sesión
function logout() {
    localStorage.removeItem('zahara_auth_token');
    localStorage.removeItem('zahara_user');
    window.location.href = '/login.html';
}

// Función para obtener información del usuario actual - CORREGIDA
// Función para obtener información del usuario actual - CORREGIDA
function getCurrentUser() {
    const userStr = localStorage.getItem('zahara_user');
    if (!userStr) return null;
    
    try {
      const userData = JSON.parse(userStr);
      // Eliminar la referencia al rol
      delete userData.rol;
      return userData;
    } catch (error) {
      console.error('Error parsing user data:', error);
      localStorage.removeItem('zahara_user');
      return null;
    }
  }
  
  // Verificar autenticación al cargar páginas protegidas
  document.addEventListener('DOMContentLoaded', function() {
    // Lista de páginas protegidas (eliminar admin.html si ya no es necesaria)
    const protectedPages = [
      'inicio.html'
    ];
    
    const currentPage = window.location.pathname.split('/').pop();
    
    // Si estamos en una página protegida, verificar autenticación
    if (protectedPages.includes(currentPage)) {
      if (!protectPage()) {
        return; // Salir si no está autenticado
      }
      
      // Mostrar información del usuario si existe elemento para ello
      const user = getCurrentUser();
      if (user) {
        // Actualizar elementos de la interfaz con info del usuario
        const userElements = document.querySelectorAll('.user-name');
        userElements.forEach(el => {
          el.textContent = user.nombre || user.username;
        });
      }
    }
    
    // Si estamos en login y ya está autenticado, redirigir
    if (currentPage === 'login.html' && isAuthenticated()) {
      window.location.href = '/inicio.html';
    }
  });

// Verificar autenticación al cargar páginas protegidas
document.addEventListener('DOMContentLoaded', function() {
    // Lista de páginas protegidas
    const protectedPages = [
        'admin.html',
        'inicio.html'
    ];
    
    const currentPage = window.location.pathname.split('/').pop();
    
    // Si estamos en una página protegida, verificar autenticación
    if (protectedPages.includes(currentPage)) {
        if (!protectPage()) {
            return; // Salir si no está autenticado
        }
        
        // Mostrar información del usuario si existe elemento para ello
        const user = getCurrentUser();
        if (user) {
            // Actualizar elementos de la interfaz con info del usuario
            const userElements = document.querySelectorAll('.user-name');
            userElements.forEach(el => {
                el.textContent = user.nombre || user.username;
            });
            
            // Configurar filtros según el rol del usuario
            if (currentPage === 'admin.html') {
                window.currentUserRole = user.rol; // Hacer disponible globalmente
            }
        }
    }
    
    // Si estamos en login y ya está autenticado, redirigir
    if (currentPage === 'login.html' && isAuthenticated()) {
        window.location.href = '/inicio.html';
    }
});

// Interceptar todas las peticiones a la API para agregar autenticación
(function() {
    const originalFetch = window.fetch;
    
    window.fetch = function(url, options = {}) {
        // Solo interceptar peticiones a la API que requieren autenticación
        if (url.includes('/api/') && 
            !url.includes('/api/login') && 
            !url.includes('/api/appointments/filter') && // Estas son públicas para el formulario
            !url.includes('/api/special-schedule')) {
            
            // Agregar headers de autenticación
            if (!options.headers) {
                options.headers = {};
            }
            
            const token = localStorage.getItem('zahara_auth_token');
            if (token) {
                options.headers['Authorization'] = `Bearer ${token}`;
            }
        }
        
        return originalFetch.call(this, url, options)
            .then(response => {
                // Si el token ha expirado
                if (response.status === 401 && url.includes('/api/')) {
                    logout();
                }
                return response;
            });
    };
})();