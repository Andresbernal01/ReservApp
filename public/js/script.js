document.addEventListener('DOMContentLoaded', function() {
    const dateInput = document.getElementById('date');
    const timeInput = document.getElementById('time');
    const barberoInput = document.getElementById('barbero');
    const availableHoursList = document.getElementById('available-hours-list');
    const serviceInput = document.getElementById('service');

    // Verificar si los elementos existen antes de usarlos
    if (dateInput) {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const minDate = `${year}-${month}-${day}`;
        dateInput.min = minDate;

        const sixMonthsLater = new Date(today);
        sixMonthsLater.setMonth(today.getMonth() + 6);
        const maxDate = sixMonthsLater.toISOString().split('T')[0];
        dateInput.max = maxDate;

        dateInput.addEventListener('click', function(e) {
            this.showPicker();
        });

        dateInput.addEventListener('input', updateAvailableTimeSlots);
    }

    if (barberoInput) {
        barberoInput.addEventListener('change', updateAvailableTimeSlots);
    }



    function convertToAMPM(hour) {
        const [h, m] = hour.split(':');
        const hours = parseInt(h, 10);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const newHours = hours % 12 || 12;
        return `${newHours}:${m} ${ampm}`;
    }

// Reemplazar la función updateAvailableTimeSlots en script.js
// Función updateAvailableTimeSlots modificada en script.js
async function updateAvailableTimeSlots() {
    if (!dateInput || !barberoInput || !availableHoursList) return;
    
    const selectedDate = dateInput.value;
    const selectedBarbero = barberoInput.value;

    if (!selectedDate || !selectedBarbero) return;

    availableHoursList.innerHTML = '<li class="loading-indicator">Cargando horas disponibles...</li>';

    try {
        // Obtener lista de barberos para conseguir el ID
        const barberosResponse = await fetch('/api/barberos');
        const barberos = await barberosResponse.json();
        const barberoData = barberos.find(b => b.nombre === selectedBarbero);
        
        if (!barberoData) {
            throw new Error('Barbero no encontrado');
        }

        // Obtener el horario por defecto del barbero usando su ID
        const defaultScheduleResponse = await fetch(`/api/barberos/${barberoData.id}/horario-defecto?fecha=${selectedDate}`);
        
        if (defaultScheduleResponse.ok) {
            const defaultSchedule = await defaultScheduleResponse.json();
            
            if (defaultSchedule.dia_no_laboral) {
                availableHoursList.innerHTML = '<li>No hay atención este día.</li>';
                if (timeInput) timeInput.disabled = false;
                return;
            }
            
            let selectedDaySlots = [
                ...(defaultSchedule.horario_manana || []),
                ...(defaultSchedule.horario_tarde || [])
            ];

            selectedDaySlots = selectedDaySlots.map(convertToAMPM);

            // Usar la nueva ruta unificada con parámetro barbero
            const response = await fetch(`/api/appointments/filter?date=${selectedDate}&barbero=${selectedBarbero}`);
            const bookedAppointments = await response.json();
            const bookedTimes = bookedAppointments.map(appointment => convertToAMPM(appointment.hora));

            const remainingSlots = selectedDaySlots.filter(slot => !bookedTimes.includes(slot));

            availableHoursList.innerHTML = '';
            
            if (remainingSlots.length === 0) {
                availableHoursList.innerHTML = '<li>No hay horarios disponibles para esta fecha.</li>';
                if (timeInput) timeInput.disabled = false;
            } else {
                remainingSlots.forEach(slot => {
                    const listItem = document.createElement('li');
                    listItem.textContent = slot;
                    listItem.addEventListener('click', () => {
                        const [time, period] = slot.split(' ');
                        let [hours, minutes] = time.split(':');
                        hours = parseInt(hours);
                        
                        if (period === 'PM' && hours !== 12) hours += 12;
                        if (period === 'AM' && hours === 12) hours = 0;
                        
                        const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes}`;
                        if (timeInput) {
                            timeInput.value = formattedTime;
                            timeInput.disabled = false;
                        }
                        
                        document.querySelectorAll('#available-hours-list li').forEach(item => 
                            item.classList.remove('selected'));
                        listItem.classList.add('selected');
                    });
                    availableHoursList.appendChild(listItem);
                });
            }
        } else {
            // Fallback si no se puede obtener el horario
            console.error('Error obteniendo horario por defecto, usando fallback');
            const fallbackSlots = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'].map(convertToAMPM);
            
            availableHoursList.innerHTML = '';
            fallbackSlots.forEach(slot => {
                const listItem = document.createElement('li');
                listItem.textContent = slot;
                listItem.addEventListener('click', () => {
                    const [time, period] = slot.split(' ');
                    let [hours, minutes] = time.split(':');
                    hours = parseInt(hours);
                    
                    if (period === 'PM' && hours !== 12) hours += 12;
                    if (period === 'AM' && hours === 12) hours = 0;
                    
                    const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes}`;
                    if (timeInput) {
                        timeInput.value = formattedTime;
                        timeInput.disabled = false;
                    }
                    
                    document.querySelectorAll('#available-hours-list li').forEach(item => 
                        item.classList.remove('selected'));
                    listItem.classList.add('selected');
                });
                availableHoursList.appendChild(listItem);
            });
        }
    } catch (error) {
        console.error('Error:', error);
        // Fallback completo en caso de error
        const fallbackSlots = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'].map(convertToAMPM);
        
        availableHoursList.innerHTML = '';
        fallbackSlots.forEach(slot => {
            const listItem = document.createElement('li');
            listItem.textContent = slot;
            listItem.addEventListener('click', () => {
                const [time, period] = slot.split(' ');
                let [hours, minutes] = time.split(':');
                hours = parseInt(hours);
                
                if (period === 'PM' && hours !== 12) hours += 12;
                if (period === 'AM' && hours === 12) hours = 0;
                
                const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes}`;
                if (timeInput) {
                    timeInput.value = formattedTime;
                    timeInput.disabled = false;
                }
                
                document.querySelectorAll('#available-hours-list li').forEach(item => 
                    item.classList.remove('selected'));
                listItem.classList.add('selected');
            });
            availableHoursList.appendChild(listItem);
        });
    }
}

    // Inicializar solo si los elementos existen
    if (dateInput && barberoInput) {
        updateAvailableTimeSlots();
    }
});

const formatDate = (dateString) => {
    const date = new Date(dateString);
    date.setDate(date.getDate() + 1);
    return new Intl.DateTimeFormat('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    }).format(date);
};

const formatTime = (timeString) => {
    const [hour, minute] = timeString.split(':');
    const date = new Date();
    date.setHours(hour, minute);
    return date.toLocaleString('es-ES', {
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
    });
};

// Cargar servicios según el barbero
document.addEventListener('DOMContentLoaded', function () {
    const barberoInput = document.getElementById('barbero');
    const serviceInput = document.getElementById('service');

    const serviciosPorBarbero = {
        Giovany: [
            { value: "Corte de cabello", text: "Corte de cabello" },
            { value: "Barba", text: "Barba" },
            { value: "Corte y Barba", text: "Corte y Barba" }
        ],
        Sharit: [
            { value: "Corte", text: "Corte" },
            { value: "Depilaciones", text: "Depilaciones" },
            { value: "Limpieza facial", text: "Limpieza facial" },
            { value: "Peinados", text: "Peinados" },
            { value: "Trenzados", text: "Trenzados" },
            { value: "Colorimetria Artistica", text: "Colorimetria Artistica" },
            { value: "Maquillaje", text: "Maquillaje" }
        ]
    };

    if (barberoInput && serviceInput) {
        barberoInput.addEventListener('change', function () {
            const barberoSeleccionado = barberoInput.value;

            serviceInput.innerHTML = '<option disabled selected value="">Elige un tipo de servicio</option>';

            if (serviciosPorBarbero[barberoSeleccionado]) {
                serviciosPorBarbero[barberoSeleccionado].forEach(servicio => {
                    const option = document.createElement('option');
                    option.value = servicio.value;
                    option.textContent = servicio.text;
                    serviceInput.appendChild(option);
                });
            }
        });
    }
});

    // Función unificada para cargar citas
    function loadAppointments() {
        fetch('/api/appointments')
            .then(response => response.json())
            .then(appointments => {
                const container = document.getElementById('appointments-container');
                if (!container) return;
                
                container.innerHTML = '';
    
                const now = new Date();
                const today = new Date(now.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
                today.setHours(0, 0, 0, 0);
                
                const todayStr = today.toISOString().split('T')[0];
                
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
                const formatLocalDate = (dateStr) => {
                    const date = new Date(`${dateStr}T00:00:00`);
                    return date.toLocaleDateString('es-CO', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        timeZone: 'America/Bogota'
                    });
                };
    
                const todayAppointments = appointments.filter(app => {
                    const appDate = new Date(`${app.fecha}T00:00:00`);
                    return appDate.toISOString().split('T')[0] === todayStr;
                });
    
                const tomorrowAppointments = appointments.filter(app => {
                    const appDate = new Date(`${app.fecha}T00:00:00`);
                    return appDate.toISOString().split('T')[0] === tomorrowStr;
                });
    
                const upcomingAppointments = appointments.filter(app => {
                    const appDate = new Date(`${app.fecha}T00:00:00`);
                    return appDate > tomorrow && appDate >= today;
                });
    
                const sortByTime = (a, b) => a.hora.localeCompare(b.hora);
                todayAppointments.sort(sortByTime);
                tomorrowAppointments.sort(sortByTime);
                upcomingAppointments.sort(sortByTime);
    
                const renderGroup = (group, title, emoji) => {
                    if (group.length === 0) return '';
                    
                    return `
                        <div class="appointment-group">
                            <h2 class="group-title" style="color: var(--primary-purple); text-align: center; margin-bottom: var(--spacing-xl); font-size: 1.8rem; font-weight: 700;">
                                ${emoji} ${title} (${group.length})
                            </h2>
                            <div class="appointments-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: var(--spacing-xl);">
                                ${group.map(app => `
                                    <div class="appointment">
                                        <div class="appointment-info" id="appointment-info-${app.id}">
                                            <p><span class="field-title">Barbero:</span> <span class="field-data" style="font-weight: bold; color: var(--primary-purple);">${app.barbero}</span></p>
                                            <p><span class="field-title">Hora:</span> <span class="field-data">${convertToAMPM(app.hora)}</span></p>
                                            <p><span class="field-title">Nombre:</span> <span class="field-data">${app.nombre} ${app.apellido}</span></p>
                                            <p><span class="field-title">Teléfono:</span> <span class="field-data">${app.telefono}</span></p>
                                            <p><span class="field-title">Fecha:</span> <span class="field-data">${formatLocalDate(app.fecha)}</span></p>
                                            <p><span class="field-title">Servicio:</span> <span class="field-data">${app.servicio}</span></p>
                                            <div class="appointment-actions">
                                                <button onclick="deleteAppointment(${app.id}, '${app.barbero}')">Eliminar</button>
                                                <button onclick="showEditForm(${app.id})">Editar</button>
                                            </div>
                                        </div>
                                        <div class="edit-form" id="edit-form-${app.id}" style="display: none;">
                                            <h3>Editar Cita</h3>
                                            <input type="text" id="edit-name-${app.id}" value="${app.nombre}" placeholder="Nombre">
                                            <input type="text" id="edit-surname-${app.id}" value="${app.apellido}" placeholder="Apellido">
                                            <input type="tel" id="edit-phone-${app.id}" value="${app.telefono}" placeholder="Teléfono">
                                            <input type="date" id="edit-date-${app.id}" value="${app.fecha}">
                                            <input type="time" id="edit-time-${app.id}" value="${app.hora}">
                                            <select id="edit-service-${app.id}">
                                                ${getServiceOptions(app.barbero, app.servicio)}
                                            </select>
                                            <div class="appointment-actions">
                                                <button onclick="saveEdit(${app.id})" style="background: linear-gradient(135deg, var(--success-green) 0%, var(--success-green-dark) 100%);">Guardar</button>
                                                <button onclick="cancelEdit(${app.id})" style="background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);">Cancelar</button>
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                };
    
                container.innerHTML = `
                    ${renderGroup(todayAppointments, 'Citas Hoy', '📅')}
                    ${renderGroup(tomorrowAppointments, 'Citas Mañana', '⏳')}
                    ${renderGroup(upcomingAppointments, 'Próximas Citas', '🗓️')}
                `;
    
                if (appointments.length === 0) {
                    container.innerHTML = '<p class="no-appointments" style="text-align: center; color: var(--text-light); font-size: 1.2rem; margin-top: var(--spacing-xxl);">No hay citas programadas.</p>';
                }
            })
            .catch(error => console.error('Error:', error));
    }

function getServiceOptions(barbero, currentService) {
    const serviciosPorBarbero = {
        Giovany: [
            "Corte de cabello",
            "Barba", 
            "Corte y Barba"
        ],
        Sharit: [
            "Corte",
            "Depilaciones",
            "Limpieza facial",
            "Peinados",
            "Trenzados",
            "Colorimetria Artistica",
            "Maquillaje"
        ]
    };

    const services = serviciosPorBarbero[barbero] || [];
    return services.map(service => 
        `<option value="${service}" ${service === currentService ? 'selected' : ''}>${service}</option>`
    ).join('');
}

function convertToAMPM(hour) {
    const [h, m] = hour.split(':');
    const hours = parseInt(h, 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const newHours = hours % 12 || 12;
    return `${newHours}:${m} ${ampm}`;
}

// Función unificada para eliminar citas
function deleteAppointment(id, barbero) {
    if (confirm('¿Estás seguro de que deseas eliminar esta cita?')) {
        fetch(`/api/appointments/${id}`, {
            method: 'DELETE'
        })
        .then(response => {
            if (response.ok) {
                alert('Cita eliminada');
                localStorage.removeItem("reservaCita");
                localStorage.removeItem("ultimaCitaFecha");
                applyFilters();
            } else {
                alert('Error al eliminar la cita');
            }
        })
        .catch(error => {
            console.error('Error al eliminar la cita:', error);
            alert('Error al conectar con el servidor');
        });
    }
}

function showEditForm(id) {
    const infoElement = document.getElementById(`appointment-info-${id}`);
    const formElement = document.getElementById(`edit-form-${id}`);
    if (infoElement) infoElement.style.display = 'none';
    if (formElement) formElement.style.display = 'block';
}

function cancelEdit(id) {
    const infoElement = document.getElementById(`appointment-info-${id}`);
    const formElement = document.getElementById(`edit-form-${id}`);
    if (infoElement) infoElement.style.display = 'block';
    if (formElement) formElement.style.display = 'none';
}

async function saveEdit(id) {
    const editedAppointment = {
        nombre: document.getElementById(`edit-name-${id}`)?.value,
        apellido: document.getElementById(`edit-surname-${id}`)?.value,
        telefono: document.getElementById(`edit-phone-${id}`)?.value,
        fecha: document.getElementById(`edit-date-${id}`)?.value,
        hora: document.getElementById(`edit-time-${id}`)?.value,
        servicio: document.getElementById(`edit-service-${id}`)?.value,
        barbero: document.querySelector(`#appointment-info-${id} .field-data`).textContent
    };

    try {
        const response = await fetch(`/api/appointments/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(editedAppointment),
        });

        if (response.ok) {
            alert('Cita actualizada correctamente');
            applyFilters();
        } else {
            const data = await response.json();
            alert(data.message || 'Ya existe una cita para esta hora, intenta otra hora');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al conectar con el servidor');
    }
}

let activeFilters = {
    date: null,
    search: null
};

function renderActiveFilters() {
    const container = document.getElementById('active-filters');
    if (!container) return;
    
    container.innerHTML = '';

    Object.entries(activeFilters).forEach(([key, value]) => {
        if (value) {
            const filterDiv = document.createElement('div');
            filterDiv.style.cssText = `
                background:#4A90E2;
                color:white;
                padding:5px 10px;
                border-radius:5px;
                display:flex;
                align-items:center;
                gap:5px;
            `;
            filterDiv.innerHTML = `
                <span>${key === 'date' ? 'Fecha: ' + formatDate(value) : 'Búsqueda: ' + value}</span>
                <button style="
                    background:#ff4d4d;
                    border:none;
                    color:white;
                    cursor:pointer;
                    font-weight:bold;
                    font-size:1rem;
                    margin-left:8px;
                    padding:2px 6px;
                    border-radius:50%;
                    vertical-align:middle;
                    transition:transform 0.2s ease, background 0.2s ease;
                " 
                onmouseover="this.style.background='#ff1a1a'; this.style.transform='scale(1.2)';" 
                onmouseout="this.style.background='#ff4d4d'; this.style.transform='scale(1)';">
                    ✖
                </button>
            `;

            filterDiv.querySelector('button').addEventListener('click', () => {
                activeFilters[key] = null;
                applyFilters();
            });

            container.appendChild(filterDiv);
        }
    });

    container.style.display = Object.values(activeFilters).some(v => v) ? 'flex' : 'none';
}

function applyFilters() {
    if (activeFilters.date && activeFilters.search) {
        filterAndSearchAppointments(activeFilters.date, activeFilters.search);
    } else if (activeFilters.date) {
        filterAppointments(activeFilters.date);
    } else if (activeFilters.search) {
        searchAppointments(activeFilters.search);
    } else {
        loadAppointments(window.currentBarbero || 'todos');
    }
    renderActiveFilters();

    loadAppointments();
  renderActiveFilters();
}

function filterAndSearchAppointments(date, searchTerm) {
    let url = `/api/appointments/filter?date=${date}`;
    
    // Agregar filtro de barbero si hay uno seleccionado
    if (window.currentBarbero && window.currentBarbero !== 'todos') {
        url += `&barbero=${window.currentBarbero}`;
    }

    fetch(url)
        .then(res => res.json())
        .then(appointments => {
            const filtered = appointments.filter(appointment => {
                const fullName = `${appointment.nombre} ${appointment.apellido}`.toLowerCase();
                return fullName.includes(searchTerm.toLowerCase()) || appointment.telefono.includes(searchTerm);
            });
            renderAppointments(filtered);
        })
        .catch(err => console.error('Error combinando filtros:', err));
}

function renderAppointments(appointments) {
    const container = document.getElementById('appointments-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (appointments.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-light); font-size: 1.2rem; margin-top: var(--spacing-xxl);">No hay resultados para los filtros aplicados.</p>';
        return;
    }
    
    appointments.sort((a, b) => new Date(`${a.fecha}T${a.hora}:00`) - new Date(`${b.fecha}T${b.hora}:00`));
    
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(320px, 1fr))';
    container.style.gap = 'var(--spacing-xl)';
    
    appointments.forEach(appointment => {
        const appointmentDiv = document.createElement('div');
        appointmentDiv.classList.add('appointment');
        const formattedTime = convertToAMPM(appointment.hora);
        const formattedDate = new Date(appointment.fecha + 'T00:00:00').toLocaleDateString('es-ES', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        
        appointmentDiv.innerHTML = `
            <div class="appointment-info" id="appointment-info-${appointment.id}">
                <p><span class="field-title">Barbero:</span> <span class="field-data" style="font-weight: bold; color: var(--primary-purple);">${appointment.barbero}</span></p>
                <p><span class="field-title">Hora:</span> <span class="field-data">${formattedTime}</span></p>
                <p><span class="field-title">Nombre:</span> <span class="field-data">${appointment.nombre} ${appointment.apellido}</span></p>
                <p><span class="field-title">Teléfono:</span> <span class="field-data">${appointment.telefono}</span></p>
                <p><span class="field-title">Fecha:</span> <span class="field-data">${formattedDate}</span></p>
                <p><span class="field-title">Servicio:</span> <span class="field-data">${appointment.servicio}</span></p>
                <div class="appointment-actions">
                    <button onclick="deleteAppointment(${appointment.id}, '${appointment.barbero}')">Eliminar</button>
                    <button onclick="showEditForm(${appointment.id})">Editar</button>
                </div>
            </div>
            <div class="edit-form" id="edit-form-${appointment.id}" style="display: none;">
                <h3>Editar Cita</h3>
                <input type="text" id="edit-name-${appointment.id}" value="${appointment.nombre}" placeholder="Nombre">
                <input type="text" id="edit-surname-${appointment.id}" value="${appointment.apellido}" placeholder="Apellido">
                <input type="tel" id="edit-phone-${appointment.id}" value="${appointment.telefono}" placeholder="Teléfono">
                <input type="date" id="edit-date-${appointment.id}" value="${appointment.fecha}">
                <input type="time" id="edit-time-${appointment.id}" value="${appointment.hora}">
                <select id="edit-service-${appointment.id}">
                    ${getServiceOptions(appointment.barbero, appointment.servicio)}
                </select>
                <div class="appointment-actions">
                    <button onclick="saveEdit(${appointment.id})" style="background: linear-gradient(135deg, var(--success-green) 0%, var(--success-green-dark) 100%);">Guardar</button>
                    <button onclick="cancelEdit(${appointment.id})" style="background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);">Cancelar</button>
                </div>
            </div>
        `;
        container.appendChild(appointmentDiv);
    });
}