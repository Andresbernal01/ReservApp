require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Configuración Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const JWT_SECRET = process.env.JWT_SECRET || 'zahara_secret_key_2024';

console.log('Iniciando servidor...');

// Probar conexión Supabase
(async () => {
  const { data, error } = await supabase.from('appointments').select('count').limit(1);
  if (error) {
    console.error('Error conectando con Supabase:', error);
  } else {
    console.log('Conexión a Supabase exitosa');
  }
})();

// NUEVO: Middleware para identificar barbería
// Reemplaza el middleware identifyBarberia con este debug completo
const identifyBarberia = async (req, res, next) => {
  let barberia = null;
  const host = req.get('host');
  
  console.log('=== DEBUG MIDDLEWARE ===');
  console.log('URL completa:', req.url);
  console.log('Query completo:', req.query);
  console.log('Host:', host);
  console.log('req.query.barberia:', req.query.barberia);
  
  try {
      // Método 1: Por subdomain (zahara.tudominio.com)
      if (host.includes('.tudominio.com')) {
          console.log('Método 1: Buscando por subdomain');
          const slug = host.split('.')[0];
          const { data } = await supabase
              .from('barberias')
              .select('*')
              .eq('slug', slug)
              .eq('activa', true)
              .single();
          barberia = data;
          console.log('Resultado método 1:', barberia);
      }
      
      // Método 2: Por parámetro en desarrollo (localhost:3000?barberia=zahara)
      if (!barberia && req.query.barberia) {
          console.log('Método 2: Buscando por parámetro:', req.query.barberia);
          const { data, error } = await supabase
              .from('barberias')
              .select('*')
              .eq('slug', req.query.barberia)
              .eq('activa', true)
              .single();
          
          console.log('Query result data:', data);
          console.log('Query result error:', error);
          barberia = data;
      }
      
      // Fallback a barbería por defecto (primera activa)
      if (!barberia) {
          console.log('Método 3: Fallback - Buscando primera barbería activa');
          const { data, error } = await supabase
              .from('barberias')
              .select('*')
              .eq('activa', true)
              .limit(1)
              .single();
          
          console.log('Fallback result data:', data);
          console.log('Fallback result error:', error);
          barberia = data;
      }
      
      if (!barberia) {
          console.log('ERROR: No se encontró ninguna barbería');
          return res.status(404).json({ error: 'Barbería no encontrada' });
      }
      
      console.log('Barbería final seleccionada:', {
          id: barberia.id,
          nombre: barberia.nombre,
          slug: barberia.slug
      });
      
      req.barberia = barberia;
      next();
  } catch (error) {
      console.error('Error identificando barbería:', error);
      res.status(500).json({ error: 'Error del servidor' });
  }
};

// Middleware de autenticación (sin cambios)
const verifyAuth = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ success: false, message: 'Token no proporcionado' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token inválido' });
  }
};

// ====== RUTAS DE PÁGINAS ======

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

const requireAuth = (req, res, next) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
};

app.get('/admin', requireAuth);
app.get('/inicio', requireAuth);

// ====== AUTENTICACIÓN ======

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Usuario y contraseña son requeridos' 
    });
  }

  try {
    const { data: barbero, error } = await supabase
      .from('barberos')
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .single();

    if (error || !barbero) {
      return res.status(401).json({ 
        success: false, 
        message: 'Credenciales incorrectas' 
      });
    }

    const token = jwt.sign(
      { 
        id: barbero.id, 
        username: barbero.username,
        nombre: barbero.nombre,
        barbero_id: barbero.id,
        barberia_id: barbero.barberia_id
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ 
      success: true, 
      message: 'Inicio de sesión exitoso',
      token,
      user: JSON.stringify({
        id: barbero.id,
        username: barbero.username,
        nombre: barbero.nombre,
        barbero_id: barbero.id,
        barberia_id: barbero.barberia_id
      })
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor' 
    });
  }
});

// ====== NUEVA RUTA: Configuración de Barbería ======

app.get('/api/barberia/config', identifyBarberia, async (req, res) => {
    try {
        res.json({
            id: req.barberia.id,
            nombre: req.barberia.nombre,
            slug: req.barberia.slug,
            logo_url: req.barberia.logo_url,
            colores_tema: req.barberia.colores_tema
        });
    } catch (error) {
        console.error('Error obteniendo config barbería:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// ====== API DE BARBEROS (MODIFICADA) ======

// Reemplaza temporalmente el endpoint de barberos para debug
app.get('/api/barberos', identifyBarberia, async (req, res) => {
  try {
    console.log('=== DEBUG BARBEROS ===');
    console.log('Host:', req.get('host'));
    console.log('Query barberia:', req.query.barberia);
    console.log('Barberia identificada:', {
      id: req.barberia.id,
      nombre: req.barberia.nombre,
      slug: req.barberia.slug
    });

    const { data, error } = await supabase
      .from('barberos')
      .select('id, nombre, barberia_id')
      .eq('barberia_id', req.barberia.id)
      .eq('activo', true)
      .neq('nombre', 'admin');

    console.log('Barberos encontrados:', data);
    console.log('Error:', error);

    if (error) {
      console.error('Error obteniendo barberos:', error);
      return res.status(500).json({ error: 'Error al obtener barberos' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error en GET barberos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener servicios por barbero (aplicar middleware)
app.get('/api/barberos/:id/servicios', identifyBarberia, async (req, res) => {
  const { id } = req.params;
  
  try {
    // Verificar que el barbero pertenece a la barbería
    const { data: barbero, error: barberoError } = await supabase
      .from('barberos')
      .select('nombre')
      .eq('id', id)
      .eq('barberia_id', req.barberia.id)
      .single();

    if (barberoError || !barbero) {
      return res.status(404).json({ error: 'Barbero no encontrado en esta barbería' });
    }

    // Obtener servicios desde la base de datos
    const { data: servicios, error } = await supabase
      .from('servicios')
      .select('id, nombre, descripcion, imagen_url')
      .eq('barbero_id', id)
      .eq('activo', true)
      .order('nombre');

    if (error) {
      console.error('Error obteniendo servicios:', error);
      return res.status(500).json({ error: 'Error al obtener servicios' });
    }

    // Formatear para compatibilidad con el frontend
    const serviciosFormateados = servicios.map(servicio => ({
      value: servicio.nombre,
      text: servicio.nombre,
      image: servicio.imagen_url || "img/default-service.jpg"
    }));

    res.json(serviciosFormateados);

  } catch (error) {
    console.error('Error en GET servicios:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ====== API DE CITAS (MODIFICADA) ======

// Crear cita (incluir barbería)
app.post('/api/appointments', identifyBarberia, async (req, res) => {
  const { nombre, apellido, telefono, fecha, hora, servicio, barbero_id } = req.body;

  try {
    // Verificar si ya existe una cita para esa fecha, hora y barbero EN LA MISMA BARBERÍA
    const { data: existingAppointments, error: checkError } = await supabase
      .from('appointments')
      .select('*')
      .eq('fecha', fecha)
      .eq('hora', hora)
      .eq('barbero_id', barbero_id)
      .eq('barberia_id', req.barberia.id); // VERIFICAR EN LA BARBERÍA ACTUAL

    if (checkError) {
      console.error('Error verificando citas:', checkError);
      return res.status(500).json({ message: 'Error en el servidor al verificar citas' });
    }

    if (existingAppointments.length > 0) {
      return res.status(400).json({ message: 'Ya existe una cita para esta fecha y hora, intenta otra hora' });
    }

    // Insertar nueva cita CON barberia_id
    const { data, error } = await supabase
      .from('appointments')
      .insert([{ 
        nombre, 
        apellido, 
        telefono, 
        fecha, 
        hora, 
        servicio, 
        barbero_id,
        barberia_id: req.barberia.id // INCLUIR BARBERÍA
      }]);

    if (error) {
      console.error('Error creando cita:', error);
      return res.status(500).json({ message: 'Error al agendar la cita' });
    }

    res.status(201).json({ message: 'Cita agendada correctamente' });
  } catch (error) {
    console.error('Error en POST appointments:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Obtener citas (protegida y filtrada por barbería del usuario autenticado)
app.get('/api/appointments', verifyAuth, async (req, res) => {
  try {
    let query = supabase
      .from('appointments')
      .select(`
        *,
        barberos!inner(id, nombre)
      `);
    
    // Filtrar por barbería del usuario autenticado
    query = query.eq('barberia_id', req.user.barberia_id);
    // Solo sus propias citas
    query = query.eq('barbero_id', req.user.barbero_id);
    
    const { data, error } = await query.order('fecha', { ascending: true }).order('hora', { ascending: true });
    
    if (error) {
      console.error('Error obteniendo citas:', error);
      return res.status(500).json({ error: 'Error al obtener las citas' });
    }
    
    // Transformar datos para mantener compatibilidad con el frontend
    const transformedData = data.map(appointment => ({
      ...appointment,
      barbero: appointment.barberos.nombre
    }));
    
    res.json(transformedData);
  } catch (error) {
    console.error('Error en GET appointments:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Filtrar citas por fecha (público - aplicar middleware de barbería)
app.get('/api/appointments/filter', identifyBarberia, async (req, res) => {
  const { date, barbero_id, barbero } = req.query;
  
  if (!date) {
    return res.status(400).json({ error: 'Fecha no proporcionada' });
  }
  
  try {
    let query = supabase
      .from('appointments')
      .select(`
        *,
        barberos!inner(id, nombre)
      `)
      .eq('fecha', date)
      .eq('barberia_id', req.barberia.id); // FILTRAR POR BARBERÍA ACTUAL
    
    // Soporte para ambos parámetros (barbero_id y barbero) para compatibilidad
    if (barbero_id) {
      query = query.eq('barbero_id', barbero_id);
    } else if (barbero) {
      // Buscar por nombre de barbero EN LA BARBERÍA ACTUAL
      const { data: barberoData, error: barberoError } = await supabase
        .from('barberos')
        .select('id')
        .eq('nombre', barbero)
        .eq('barberia_id', req.barberia.id) // VERIFICAR BARBERÍA
        .single();
      
      if (!barberoError && barberoData) {
        query = query.eq('barbero_id', barberoData.id);
      }
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error filtrando citas:', error);
      return res.status(500).json({ error: 'Error al obtener las citas' });
    }
    
    // Transformar datos para compatibilidad
    const transformedData = data.map(appointment => ({
      ...appointment,
      barbero: appointment.barberos.nombre
    }));
    
    res.json(transformedData);
  } catch (error) {
    console.error('Error en filter appointments:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar cita (protegida - verificar barbería)
app.put('/api/appointments/:id', verifyAuth, async (req, res) => {
  const { id } = req.params;
  const { nombre, apellido, telefono, fecha, hora, servicio, barbero_id } = req.body;

  try {
    // Verificar que la cita pertenece a la barbería del usuario
    const { data: existingAppointment, error: fetchError } = await supabase
      .from('appointments')
      .select('barbero_id, barberia_id')
      .eq('id', id)
      .single();

    if (fetchError || !existingAppointment) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }

    // Verificar permisos (mismo barbero Y misma barbería)
    if (req.user.barbero_id !== existingAppointment.barbero_id || 
        req.user.barberia_id !== existingAppointment.barberia_id) {
      return res.status(403).json({ error: 'No tienes permisos para editar esta cita' });
    }

    // Verificar conflictos en la misma barbería
    const { data: conflictingAppointments, error: checkError } = await supabase
      .from('appointments')
      .select('*')
      .eq('fecha', fecha)
      .eq('hora', hora)
      .eq('barbero_id', barbero_id)
      .eq('barberia_id', req.user.barberia_id) // VERIFICAR EN LA MISMA BARBERÍA
      .neq('id', id);

    if (checkError) {
      console.error('Error verificando conflictos:', checkError);
      return res.status(500).json({ error: 'Error en el servidor' });
    }

    if (conflictingAppointments.length > 0) {
      return res.status(400).json({ message: 'Ya existe una cita para esta fecha y hora' });
    }

    // Actualizar la cita
    const { data, error } = await supabase
      .from('appointments')
      .update({ nombre, apellido, telefono, fecha, hora, servicio, barbero_id })
      .eq('id', id);

    if (error) {
      console.error('Error actualizando cita:', error);
      return res.status(500).json({ error: 'Error al actualizar la cita' });
    }

    res.json({ message: 'Cita actualizada correctamente' });
  } catch (error) {
    console.error('Error en PUT appointments:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Eliminar cita (protegida - verificar barbería)
app.delete('/api/appointments/:id', verifyAuth, async (req, res) => {
  const { id } = req.params;

  try {
    // Primero obtener la cita para verificar permisos
    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select('barbero_id, barberia_id')
      .eq('id', id)
      .single();

    if (fetchError || !appointment) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }

    // Verificar permisos (mismo barbero Y misma barbería)
    if (req.user.barbero_id !== appointment.barbero_id || 
        req.user.barberia_id !== appointment.barberia_id) {
      return res.status(403).json({ error: 'No tienes permisos para eliminar esta cita' });
    }

    // Eliminar la cita
    const { data, error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error eliminando cita:', error);
      return res.status(500).json({ error: 'Error al eliminar la cita' });
    }
    
    res.json({ message: 'Cita eliminada correctamente' });
  } catch (error) {
    console.error('Error en DELETE appointments:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener horario por defecto de un barbero (aplicar middleware)
app.get('/api/barberos/:id/horario-defecto', identifyBarberia, async (req, res) => {
  const { id } = req.params;
  const { fecha } = req.query;
  
  try {
    const { data: barbero, error } = await supabase
      .from('barberos')
      .select('nombre, horario_defecto')
      .eq('id', id)
      .eq('barberia_id', req.barberia.id) // VERIFICAR BARBERÍA
      .single();

    if (error || !barbero) {
      return res.status(404).json({ error: 'Barbero no encontrado en esta barbería' });
    }

    // Si no tiene horario_defecto en la BD, retornar error
    if (!barbero.horario_defecto) {
      return res.status(404).json({ 
        error: 'El barbero no tiene horario por defecto configurado en la base de datos' 
      });
    }

    const horario = barbero.horario_defecto;

    // Si se proporciona una fecha, devolver solo el horario de ese día
    if (fecha) {
      const date = new Date(fecha + 'T00:00:00');
      const dayNames = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
      const dayName = dayNames[date.getDay()];
      
      const daySchedule = horario[dayName];
      if (daySchedule) {
        return res.json({
          dia: dayName,
          horario_manana: daySchedule.morning || [],
          horario_tarde: daySchedule.afternoon || [],
          dia_no_laboral: (daySchedule.morning || []).length === 0 && (daySchedule.afternoon || []).length === 0
        });
      } else {
        return res.status(404).json({ 
          error: `No se encontró horario para el día ${dayName}` 
        });
      }
    }

    // Devolver todo el horario semanal
    res.json(horario);

  } catch (error) {
    console.error('Error obteniendo horario por defecto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});




// Crear servicio
app.post('/api/barberos/:id/servicios', verifyAuth, async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion, imagen_url } = req.body;

  try {
    const { data, error } = await supabase
      .from('servicios')
      .insert([{
        barbero_id: id,
        nombre,
        descripcion,
        imagen_url
      }])
      .select();

    if (error) {
      return res.status(500).json({ error: 'Error creando servicio' });
    }

    res.json({ message: 'Servicio creado exitosamente', data });
  } catch (error) {
    console.error('Error creando servicio:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ====== MANEJO DE ERRORES ======

app.use('*', (req, res) => {
  console.log(`Ruta no encontrada: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.use((error, req, res, next) => {
  console.error('Error global del servidor:', error);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
  console.log(`Archivos estáticos desde: ${path.join(__dirname, 'public')}`);
});