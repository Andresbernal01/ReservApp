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

// Middleware de autenticación
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
        rol: barbero.nombre,
        barbero_id: barbero.id
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
        rol: barbero.nombre,
        barbero_id: barbero.id
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

// ====== API DE BARBEROS ======

// Obtener barberos activos (público - para el formulario de reservas)
// CORRECCIÓN: Removemos imagen_url que no existe en la tabla
app.get('/api/barberos', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('barberos')
      .select('id, nombre') // Solo campos que existen
      .eq('activo', true)
      .neq('nombre', 'admin');

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

// Obtener servicios por barbero
// En server.js, línea 125 aproximadamente
app.get('/api/barberos/:id/servicios', async (req, res) => {
  const { id } = req.params;
  
  try {
    // Obtener información del barbero
    const { data: barbero, error: barberoError } = await supabase
      .from('barberos')
      .select('nombre')
      .eq('id', id)
      .single();

    if (barberoError || !barbero) {
      return res.status(404).json({ error: 'Barbero no encontrado' });
    }

    // Servicios hardcodeados por ahora
    const serviciosPorBarbero = {
      Giovany: [
        { value: "Corte de cabello", text: "Corte de cabello", image: "img/corte.jpg" },
        { value: "Barba", text: "Barba", image: "img/barba.jpg" },
        { value: "Corte y Barba", text: "Corte y Barba", image: "img/corte-barba.jpg" }
      ],
      Danitza: [
        { value: "Corte", text: "Corte", image: "img/corte.jpg" },
        { value: "Depilaciones", text: "Depilaciones", image: "img/depilacion.jpg" },
        { value: "Limpieza facial", text: "Limpieza facial", image: "img/limpieza.jpg" },
        { value: "Peinados", text: "Peinados", image: "img/peinado.jpg" },
        { value: "Trenzados", text: "Trenzados", image: "img/trenzas.jpg" },
        { value: "Colorimetria Artistica", text: "Colorimetria Artistica", image: "img/color.jpg" },
        { value: "Maquillaje", text: "Maquillaje", image: "img/maquillaje.jpg" },
        { value: "Masajes", text: "Masajes", image: "img/masajes.jpg" }
      ]
    };

    const servicios = serviciosPorBarbero[barbero.nombre] || [];
    res.json(servicios);

  } catch (error) {
    console.error('Error en GET servicios:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ====== API DE CITAS ======

// Crear cita (público - para el formulario de reservas)
app.post('/api/appointments', async (req, res) => {
  const { nombre, apellido, telefono, fecha, hora, servicio, barbero_id } = req.body;

  try {
    // Verificar si ya existe una cita para esa fecha, hora y barbero
    const { data: existingAppointments, error: checkError } = await supabase
      .from('appointments')
      .select('*')
      .eq('fecha', fecha)
      .eq('hora', hora)
      .eq('barbero_id', barbero_id);

    if (checkError) {
      console.error('Error verificando citas:', checkError);
      return res.status(500).json({ message: 'Error en el servidor al verificar citas' });
    }

    if (existingAppointments.length > 0) {
      return res.status(400).json({ message: 'Ya existe una cita para esta fecha y hora, intenta otra hora' });
    }

    // Insertar nueva cita
    const { data, error } = await supabase
      .from('appointments')
      .insert([{ nombre, apellido, telefono, fecha, hora, servicio, barbero_id }]);

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

// Obtener citas (protegida y filtrada según usuario)
app.get('/api/appointments', verifyAuth, async (req, res) => {
  const { barbero_id } = req.query;
  
  try {
    let query = supabase
      .from('appointments')
      .select(`
        *,
        barberos!inner(id, nombre)
      `);
    
    // Filtrar según el rol del usuario autenticado
    if (req.user.rol === 'admin') {
      // Admin puede ver todas las citas o filtrar por barbero específico
      if (barbero_id && barbero_id !== 'todos') {
        query = query.eq('barbero_id', barbero_id);
      }
    } else {
      // Los barberos solo ven sus propias citas
      query = query.eq('barbero_id', req.user.barbero_id);
    }
    
    const { data, error } = await query.order('fecha', { ascending: true }).order('hora', { ascending: true });
    
    if (error) {
      console.error('Error obteniendo citas:', error);
      return res.status(500).json({ error: 'Error al obtener las citas' });
    }
    
    // Transformar datos para mantener compatibilidad con el frontend
    const transformedData = data.map(appointment => ({
      ...appointment,
      barbero: appointment.barberos.nombre // Para compatibilidad con el frontend existente
    }));
    
    res.json(transformedData);
  } catch (error) {
    console.error('Error en GET appointments:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Filtrar citas por fecha (público - para mostrar horarios disponibles)
app.get('/api/appointments/filter', async (req, res) => {
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
      .eq('fecha', date);
    
    // Soporte para ambos parámetros (barbero_id y barbero) para compatibilidad
    if (barbero_id) {
      query = query.eq('barbero_id', barbero_id);
    } else if (barbero) {
      // Buscar por nombre de barbero (para compatibilidad con código existente)
      const { data: barberoData, error: barberoError } = await supabase
        .from('barberos')
        .select('id')
        .eq('nombre', barbero)
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

// Actualizar cita (protegida)
app.put('/api/appointments/:id', verifyAuth, async (req, res) => {
  const { id } = req.params;
  const { nombre, apellido, telefono, fecha, hora, servicio, barbero_id } = req.body;

  try {
    // Verificar permisos
    if (req.user.rol !== 'admin' && req.user.barbero_id !== barbero_id) {
      return res.status(403).json({ error: 'No tienes permisos para editar esta cita' });
    }

    // Verificar si existe otra cita en la misma fecha/hora (excluyendo la actual)
    const { data: existingAppointments, error: checkError } = await supabase
      .from('appointments')
      .select('*')
      .eq('fecha', fecha)
      .eq('hora', hora)
      .eq('barbero_id', barbero_id)
      .neq('id', id);

    if (checkError) {
      console.error('Error verificando conflictos:', checkError);
      return res.status(500).json({ error: 'Error en el servidor' });
    }

    if (existingAppointments.length > 0) {
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

// Eliminar cita (protegida)
app.delete('/api/appointments/:id', verifyAuth, async (req, res) => {
  const { id } = req.params;

  try {
    // Primero obtener la cita para verificar permisos
    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select('barbero_id')
      .eq('id', id)
      .single();

    if (fetchError || !appointment) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }

    // Verificar permisos
    if (req.user.rol !== 'admin' && req.user.barbero_id !== appointment.barbero_id) {
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




// Agregar esta ruta en server.js después de la ruta de servicios por barbero

// Obtener horario por defecto de un barbero
app.get('/api/barberos/:id/horario-defecto', async (req, res) => {
  const { id } = req.params;
  const { fecha } = req.query; // Opcional: fecha para determinar el día de la semana
  
  try {
    const { data: barbero, error } = await supabase
      .from('barberos')
      .select('nombre, horario_defecto')
      .eq('id', id)
      .single();

    if (error || !barbero) {
      return res.status(404).json({ error: 'Barbero no encontrado' });
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